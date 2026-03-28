import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchPRData } from '../src/engine/github';
import { runTriage } from '../src/engine/triage';

const prUrl = process.argv[2];
const mode = (process.argv[3] || 'QUICK').toUpperCase() as 'QUICK' | 'DEEP';
if (!prUrl) {
  console.error('Usage: npx tsx scripts/analyze-pr.ts <pr-url> [QUICK|DEEP]');
  process.exit(1);
}

const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
if (!match) {
  console.error('Invalid PR URL');
  process.exit(1);
}

const [, owner, repo, numStr] = match;
const number = parseInt(numStr, 10);

async function main() {
  console.error(`Fetching PR data for ${owner}/${repo}#${number}...`);
  const prData = await fetchPRData(owner, repo, number);

  console.error(`Running ${mode} triage...`);
  const result = await runTriage(prData, {
    apiKey: process.env.TEST_API_KEY!,
    provider: (process.env.TEST_PROVIDER || 'OPENROUTER') as any,
    mode,
  });

  console.log(JSON.stringify({
    title: prData.title,
    url: prUrl,
    compositeScore: result.compositeScore,
    confidenceLevel: result.confidenceLevel,
    recommendation: result.recommendation,
    action: result.action,
    prCategory: result.prCategory,
    dimensions: result.dimensions,
    concerns: result.concerns,
    strengths: result.strengths,
    riskFlags: result.riskFlags,
    executiveSummary: result.executiveSummary,
    // Deep analysis fields
    ...(result.fileAnalysis && { fileAnalysis: result.fileAnalysis }),
    ...(result.securityReview && { securityReview: result.securityReview }),
    ...(result.maintainability && { maintainability: result.maintainability }),
  }, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
