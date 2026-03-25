#!/usr/bin/env npx tsx
/**
 * PR Triage Test Harness
 *
 * Runs a batch of PRs through the scoring engine, saves results to the database,
 * and outputs links so you can view each result in the web UI.
 *
 * Usage: npx tsx scripts/test-harness.ts
 *
 * Env vars (reads from .env.local automatically):
 *   TEST_API_KEY      — LLM API key (or set per-provider below)
 *   TEST_PROVIDER     — ANTHROPIC | OPENAI | OPENROUTER (default: OPENROUTER)
 *   TEST_MODEL        — optional model override
 *   GITHUB_TOKEN      — optional, for higher rate limits
 *   DATABASE_URL      — PostgreSQL connection string (from .env.local)
 */

import { fetchPRData, parsePRUrl } from '../src/engine/github';
import { runTriage, TriageOptions } from '../src/engine/triage';
import { TriageResult, PRInputData } from '../src/engine/types';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
function loadEnv(filepath: string) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File not found, that's fine
  }
}

loadEnv(resolve(__dirname, '..', '.env.local'));
loadEnv(resolve(__dirname, '..', '.env'));

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Test case definitions
// ---------------------------------------------------------------------------

interface TestCase {
  url: string;
  label: string;
  expectedAction: string;
  expectedScoreRange: [number, number];
  notes?: string;
}

const TEST_CASES: TestCase[] = [
  // --- BAD PRs (should score low, IGNORE) ---
  {
    url: 'https://github.com/juice-shop/juice-shop/pull/3262',
    label: 'Spam: security "fix" on intentionally vulnerable app',
    expectedAction: 'CLOSE',
    expectedScoreRange: [0, 50],
    notes: 'OWASP Juice Shop is intentionally vulnerable — fixing vulns defeats its purpose',
  },

  // --- GOOD PRs (should score high, PRIORITIZE or REVIEW) ---
  {
    url: 'https://github.com/nodejs/node/pull/61713',
    label: 'Good: keepAliveTimeout bugfix with tests (Node.js)',
    expectedAction: 'PRIORITIZE',
    expectedScoreRange: [65, 100],
    notes: 'Real bugfix, linked issue, includes tests, clear description',
  },

  // --- DOCS-ONLY PRs (should BATCH, moderate score) ---
  {
    url: 'https://github.com/vercel/next.js/pull/90380',
    label: 'Docs only: clarify JSON-LD script tag (Next.js)',
    expectedAction: 'BATCH',
    expectedScoreRange: [30, 75],
    notes: 'Tiny docs clarification, 2-line change, legitimate but minimal',
  },

  // --- MEDIOCRE/UNCLEAR PRs (should score low or need judgment) ---
  {
    url: 'https://github.com/facebook/react/pull/35977',
    label: 'Unclear: vague "Fix issue" with no description (React)',
    expectedAction: 'CLOSE',
    expectedScoreRange: [0, 45],
    notes: 'No issue link, unfilled template, minimal change',
  },

  // --- SPAM-ADJACENT (no context, trivial) ---
  {
    url: 'https://github.com/facebook/react/pull/35993',
    label: 'Spam-adjacent: empty body, 1-line change (React)',
    expectedAction: 'CLOSE',
    expectedScoreRange: [0, 55],
    notes: 'Zero description, no linked issue, targeting major repo',
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

interface TestResult {
  label: string;
  url: string;
  analysisId?: string;
  score: number;
  action: string;
  confidence: string;
  priority: string;
  category: string;
  expectedAction: string;
  expectedScoreRange: [number, number];
  actionPass: boolean;
  scorePass: boolean;
  summary: string;
  topConcerns: string[];
  topStrengths: string[];
  durationMs: number;
  error?: string;
}

async function saveToDb(
  userId: string,
  tc: TestCase,
  prData: PRInputData,
  result: TriageResult
): Promise<string> {
  const parsed = parsePRUrl(tc.url)!;
  const analysis = await db.analysis.create({
    data: {
      userId,
      prUrl: tc.url,
      prOwner: parsed.owner,
      prRepo: parsed.repo,
      prNumber: parsed.number,
      prTitle: prData.title,
      status: 'COMPLETE',
      mode: 'QUICK',
      inputData: JSON.stringify(prData),
      compositeScore: result.compositeScore,
      confidenceLevel: result.confidenceLevel,
      recommendation: result.recommendation,
      resultData: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
  return analysis.id;
}

async function runTest(
  tc: TestCase,
  options: TriageOptions,
  userId: string,
  githubToken?: string
): Promise<TestResult> {
  const start = Date.now();
  const base = {
    label: tc.label,
    url: tc.url,
    expectedAction: tc.expectedAction,
    expectedScoreRange: tc.expectedScoreRange as [number, number],
  };

  try {
    const parsed = parsePRUrl(tc.url);
    if (!parsed) throw new Error(`Invalid PR URL: ${tc.url}`);

    console.log(`  Fetching ${parsed.owner}/${parsed.repo}#${parsed.number}...`);
    const input = await fetchPRData(parsed.owner, parsed.repo, parsed.number, githubToken);

    console.log(`  Running triage (${options.provider})...`);
    const result: TriageResult = await runTriage(input, options);

    console.log(`  Saving to database...`);
    const analysisId = await saveToDb(userId, tc, input, result);

    const durationMs = Date.now() - start;

    return {
      ...base,
      analysisId,
      score: result.compositeScore,
      action: result.action,
      confidence: result.confidenceLevel,
      priority: result.priority,
      category: result.prCategory,
      actionPass: result.action === tc.expectedAction,
      scorePass: result.compositeScore >= tc.expectedScoreRange[0] && result.compositeScore <= tc.expectedScoreRange[1],
      summary: result.executiveSummary.substring(0, 120),
      topConcerns: result.concerns.slice(0, 3),
      topStrengths: result.strengths.slice(0, 3),
      durationMs,
    };
  } catch (err) {
    return {
      ...base,
      score: -1,
      action: 'ERROR',
      confidence: '-',
      priority: '-',
      category: '-',
      actionPass: false,
      scorePass: false,
      summary: '',
      topConcerns: [],
      topStrengths: [],
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printTable(results: TestResult[]) {
  const divider = '─'.repeat(110);

  console.log('\n' + divider);
  console.log('  PR TRIAGE TEST HARNESS — RESULTS');
  console.log(divider);

  for (const r of results) {
    const actionIcon = r.actionPass ? '✓' : '✗';
    const scoreIcon = r.scorePass ? '✓' : '✗';

    console.log(`\n  ${r.label}`);
    console.log(`  ${r.url}`);

    if (r.error) {
      console.log(`  ❌ ERROR: ${r.error}`);
      continue;
    }

    console.log(`  Score: ${r.score}/100  |  Action: ${r.action}  |  Confidence: ${r.confidence}  |  Priority: ${r.priority}  |  Category: ${r.category}`);
    console.log(`  Time: ${(r.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${scoreIcon} Score ${r.scorePass ? 'PASS' : 'FAIL'} (expected ${r.expectedScoreRange[0]}-${r.expectedScoreRange[1]}, got ${r.score})`);
    console.log(`  ${actionIcon} Action ${r.actionPass ? 'PASS' : 'FAIL'} (expected ${r.expectedAction}, got ${r.action})`);

    if (r.topConcerns.length > 0) {
      console.log(`  Concerns: ${r.topConcerns.join(' | ')}`);
    }
    if (r.topStrengths.length > 0) {
      console.log(`  Strengths: ${r.topStrengths.join(' | ')}`);
    }
    console.log(`  Summary: ${r.summary}...`);

    if (r.analysisId) {
      console.log(`  📋 View in UI: http://localhost:3000/analysis/${r.analysisId}`);
    }
  }

  console.log('\n' + divider);

  // Summary
  const total = results.length;
  const actionPasses = results.filter(r => r.actionPass).length;
  const scorePasses = results.filter(r => r.scorePass).length;
  const errors = results.filter(r => r.error).length;

  console.log(`  TOTAL: ${total} tests  |  Action: ${actionPasses}/${total} pass  |  Score: ${scorePasses}/${total} pass  |  Errors: ${errors}`);
  console.log(divider + '\n');
}

async function main() {
  const provider = (process.env.TEST_PROVIDER || 'OPENROUTER') as 'ANTHROPIC' | 'OPENAI' | 'OPENROUTER';
  const apiKey = process.env.TEST_API_KEY;
  const model = process.env.TEST_MODEL;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!apiKey) {
    console.error('ERROR: Set TEST_API_KEY environment variable (or add it to .env.local)');
    console.error('Usage: TEST_API_KEY=sk-... npx tsx scripts/test-harness.ts');
    process.exit(1);
  }

  // Find the first user in the DB to attach results to
  const user = await db.user.findFirst();
  if (!user) {
    console.error('ERROR: No user found in database. Log in to the web app first.');
    process.exit(1);
  }
  console.log(`Using account: ${user.name || user.email} (${user.plan})\n`);

  const activeCases = TEST_CASES.filter(tc => tc.url);
  if (activeCases.length === 0) {
    console.error('No test cases defined. Edit scripts/test-harness.ts to add PR URLs.');
    process.exit(1);
  }

  const options: TriageOptions = {
    apiKey,
    provider,
    ...(model && { model }),
  };

  console.log(`PR Triage Test Harness`);
  console.log(`Provider: ${provider}  |  Model: ${model || 'default'}  |  Tests: ${activeCases.length}\n`);

  const results: TestResult[] = [];
  for (const tc of activeCases) {
    console.log(`[${results.length + 1}/${activeCases.length}] ${tc.label}`);
    const result = await runTest(tc, options, user.id, githubToken);
    results.push(result);
  }

  printTable(results);

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await db.$disconnect();
  process.exit(1);
});
