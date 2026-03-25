# PR Triage

AI-powered pull request evaluation for open source maintainers. Stop reviewing junk PRs.

PR Triage reads the diff, checks the linked issue, evaluates code quality in context, and tells you whether a PR is worth your time — in seconds, not hours.

## Why PR Triage?

Open source maintainers are drowning in low-quality pull requests. Existing anti-spam tools only check superficial contributor signals (account age, commit history). None of them actually read the code.

PR Triage does. It evaluates six dimensions of PR quality using AI, produces a confidence-scored recommendation, and gives you actionable guidance — merge it, review it, batch it for later, or close it.

**BYOK (Bring Your Own Key)**: You provide your own LLM API key. Your key is encrypted at rest and never shared. Supports Anthropic, OpenAI, OpenRouter, and Gemini.

## Quick Start

1. **Sign in** with your GitHub account at [pr-triage.dev](https://pr-triage.dev)
2. **Add your API key** in Settings (Anthropic, OpenAI, OpenRouter, or Gemini)
3. **Paste a PR URL** on the Analyze page
4. **Read the results** — score, action, confidence, and detailed breakdown

That's it. No GitHub App to install, no repo access required. PR Triage uses GitHub's public API to fetch PR data.

## Supported Providers

| Provider | Default Model | Key Format |
|----------|--------------|------------|
| Anthropic | claude-sonnet-4-20250514 | `sk-ant-...` |
| OpenAI | gpt-4o-mini | `sk-...` |
| OpenRouter | anthropic/claude-sonnet-4 | `sk-or-...` |
| Gemini | gemini-2.0-flash | `AI...` |

You can use any provider. Results are most calibrated with Claude models.

---

## Understanding the Output

Every analysis produces a structured result with these components:

### Composite Score (0–100)

The headline number. A weighted average of six dimension scores, minus risk penalties.

| Range | Meaning |
|-------|---------|
| **80–100** | Strong PR. Addresses the issue, follows repo patterns, appropriate scope. |
| **60–79** | Decent PR. Worth reviewing but has gaps or uncertainties. |
| **40–59** | Marginal. May have value but needs significant human judgment. |
| **0–39** | Weak. Low-effort, off-topic, spam, or fundamentally flawed. |

### Action

What you should do with this PR. One of five values:

| Action | Badge | Meaning |
|--------|-------|---------|
| **PRIORITIZE** | Merge | High-quality PR. Review and merge promptly. |
| **REVIEW** | Review | Worth your time. Review when you can. |
| **BATCH** | Low Priority | Not urgent. Batch with similar PRs for a low-priority pass. |
| **CLOSE** | Close | Not worth review time. Close with a polite explanation. |
| **NEEDS_HUMAN_JUDGMENT** | Needs Judgment | Conflicting signals. The system can't make a confident call — you decide. |

Actions are determined by a **signal hierarchy**, not just the score. A high score with critical risk flags won't get PRIORITIZE. A borderline score with strong fundamentals can get upgraded. See [How Actions Are Determined](#how-actions-are-determined) below.

### Confidence Level

How sure the system is about its assessment:

| Level | Meaning |
|-------|---------|
| **HIGH** | Sufficient context across all dimensions. Assessment is reliable. |
| **MODERATE** | Some context missing (e.g., no linked issue). Assessment is directional. |
| **LOW** | Significant context gaps. Use the assessment as a starting point, not a verdict. |
| **INSUFFICIENT** | Too much missing context to make a meaningful call. Defaults to NEEDS_HUMAN_JUDGMENT. |

Trivial PR categories (docs-only, formatting) get higher confidence even with missing context, because they're straightforward to evaluate.

### Priority

How much attention this PR deserves:

| Priority | When |
|----------|------|
| **HIGH** | Code changes scoring 80+ |
| **MEDIUM** | Code changes scoring 60–79, or security-relevant dependency bumps |
| **LOW** | Everything else — trivial categories, low scores, batched PRs |

### PR Category

Auto-detected from dimension evidence:

| Category | Description |
|----------|-------------|
| `CODE_CHANGE` | Functional code modifications (most PRs) |
| `DOCS_ONLY` | README updates, typo fixes, documentation changes |
| `DEPENDENCY_BUMP` | Version bumps, lock file updates, Dependabot PRs |
| `FORMATTING_ONLY` | Whitespace, linting, indentation changes |
| `COSMETIC_RENAME` | Variable renames with no behavioral change |

Category affects scoring, confidence, and action determination. A docs-only PR won't get PRIORITIZE regardless of score — it gets BATCH if acceptable, CLOSE if not.

---

## How Scores Are Calculated

### The Six Dimensions

Each PR is evaluated across six dimensions. The LLM assigns a **band** to each:

| Band | Score | Meaning |
|------|-------|---------|
| STRONG | 90 | Clearly good signal |
| MODERATE | 60 | Acceptable with caveats |
| WEAK | 25 | Poor signal |
| INSUFFICIENT_DATA | excluded | Not enough info to judge — dimension is removed from the weighted average |

The dimensions and their weights:

#### 1. Issue Resolution Fit (30%)
Does the diff actually address the linked issue? This is the single most important signal.
- **STRONG**: Diff directly implements what the issue requests. Clear causal link.
- **MODERATE**: Partially addresses the issue, or reasonable interpretation with gaps.
- **WEAK**: Tangentially related or addresses a different problem.
- **INSUFFICIENT_DATA**: No linked issue, or issue too vague to evaluate.

#### 2. Implementation Substance (25%)
Is there real, functional code here — or just cosmetic changes?
- **STRONG**: Functional code changes that alter behavior. New logic, modified control flow.
- **MODERATE**: Mix of substantive and cosmetic changes.
- **WEAK**: Predominantly cosmetic: renames, formatting, comment edits, trivial refactors.
- **INSUFFICIENT_DATA**: Diff too small or too large to meaningfully assess.

#### 3. Repository Pattern Alignment (15%)
Does the code follow the repo's existing conventions?
- **STRONG**: Follows naming, file organization, error handling, and style patterns.
- **MODERATE**: Mostly aligned with minor deviations.
- **WEAK**: Noticeably different style. Feels pasted in.
- **INSUFFICIENT_DATA**: No repo context available to compare.

#### 4. Scope / Complexity Match (15%)
Is the change appropriately sized for what it claims to do?
- **STRONG**: Change size proportional to issue requirements.
- **MODERATE**: Slightly over- or under-scoped but reasonable.
- **WEAK**: Dramatically disproportionate.
- **INSUFFICIENT_DATA**: Issue scope unclear.

#### 5. Test Signal (10%)
Are there tests for the changes?
- **STRONG**: Tests added/modified that verify the claimed fix. Relevant assertions.
- **MODERATE**: Some test changes but incomplete coverage.
- **WEAK**: No test changes for a change that warrants them.
- **INSUFFICIENT_DATA**: Repo has no test infrastructure, or change doesn't typically need tests.

#### 6. Risk Flags (5%)
Are there red flags? (Inverted scale — STRONG means low risk.)
- **STRONG**: No red flags detected.
- **MODERATE**: Minor concerns present.
- **WEAK**: Significant red flags.
- **INSUFFICIENT_DATA**: Cannot assess risk.

### Composite Calculation

```
composite = Σ (band_score × normalized_weight)  for all scoreable dimensions
          − min(total_risk_penalty, 25)          penalty cap prevents score collapse
          − 5                                    if major dimension conflict detected
```

**Normalized weights**: If a dimension has INSUFFICIENT_DATA, it's excluded and remaining weights are re-normalized to sum to 1.0.

**Risk penalties** by severity:
- High: 12 points
- Medium: 7 points
- Low: 3 points

Total penalty is capped at 25 points to prevent stacking many small issues from collapsing the score unreasonably.

**Severity normalization**: LLMs tend to over-classify process/hygiene issues (missing description, no tests, unfilled template) as "high" severity. PR Triage automatically caps these at "medium" — true "high" is reserved for security vulnerabilities, data loss, or harmful code.

**Major conflict**: If two major dimensions (issue_fit, substance, pattern_alignment, scope_match) differ by 2+ band levels (e.g., STRONG + WEAK), an additional 5-point penalty applies for inconsistency.

**Score floors** prevent absurd numbers:
- PRs with high-severity risk flags: floor of 0 (genuinely harmful)
- Normal PRs: floor of 8 (bad but not dangerous)
- Trivial categories (docs, formatting): floor of 12 (low-effort, not malicious)

---

## How Actions Are Determined

Actions use a **7-layer signal hierarchy** — not just score thresholds. Each layer can override or adjust the result from previous layers.

### Layer 0: Definitive Low Scores
Score < 40 → **CLOSE**. No other signal rescues a failing PR.

### Layer 1: Dealbreakers
High-severity risk flags + score < 60 → **CLOSE**. Security concerns override moderate scores.

### Layer 2: Trivial Categories
- Docs/formatting/cosmetic PRs scoring 50+ → **BATCH**
- Docs/formatting/cosmetic PRs scoring < 50 → **CLOSE**
- Dependency bumps scoring 80+ → **REVIEW** (likely security-relevant)
- Other dependency bumps → **BATCH**

### Layer 3: Score-Based Baseline (code changes only)
- Score 80+ → PRIORITIZE
- Score 60–79 → REVIEW
- Score 40–59 → BATCH

### Layer 4: Red Flag Cap
High-severity risk flags cap the action — PRIORITIZE is downgraded to REVIEW. You should never auto-merge a PR with significant risk flags.

### Layer 5: Missing Essentials
Code changes with no linked issue AND no tests → downgrade one level (e.g., REVIEW → BATCH). Missing context about what the PR is supposed to do reduces confidence in its value.

### Layer 6: Strong Positives
If all four major dimensions (issue_fit, substance, pattern_alignment, scope_match) are STRONG or MODERATE, AND there are zero risk flags → upgrade one level (e.g., REVIEW → PRIORITIZE).

### Layer 7: Confidence / Conflict Overrides
- INSUFFICIENT confidence on code changes → **NEEDS_HUMAN_JUDGMENT**
- Conflicting signals + medium-severity risks + score 50–79 → **NEEDS_HUMAN_JUDGMENT** (unless the PR has strong fundamentals across all major dimensions)

---

## Detailed Output Sections

Each analysis result includes:

### Executive Summary
2–3 sentences stating the key finding, main evidence, and material uncertainty. References specific files or patterns from the diff.

### Strengths
Key positive signals the system identified — what this PR does well.

### Concerns
Key negative signals — what gave the system pause.

### What to Verify
Specific things a human reviewer should check. These are actionable items, not vague suggestions.

### Risk Flags
Each flag includes:
- **Description**: What the risk is
- **Severity**: low / medium / high
- **Evidence**: Specific reference from the diff or PR metadata

### Conflicting Signals
When different dimensions tell different stories (e.g., strong substance but weak pattern alignment), the system flags the contradiction explicitly.

### Missing Context
What information was unavailable — no linked issue, no CONTRIBUTING.md, no test infrastructure, etc. Helps you understand why confidence might be lower.

### Available Context
What the system did have to work with — confirms it saw the diff, the issue, the repo description, etc.

### Maintainer Guidance
A plain-language explanation of why the system recommends the given action, calibrated to the specific PR. Explains the root cause, not just the symptom. For example: "This PR scored low because the diff contains only whitespace changes with no functional modifications" rather than "Score is below threshold."

---

## Caching

If you analyze the same PR (same owner/repo/number) within 1 hour, PR Triage returns the cached result instead of re-running the analysis. This saves your API credits and provides instant results for recently analyzed PRs.

---

## Plans

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Daily analyses | 3 | Unlimited | Unlimited |
| History retention | 7 days | Forever | Forever |
| Deep Analysis mode | — | Yes | Yes |
| Shareable links | — | Yes | Yes |
| Batch analysis | — | Yes | Yes |
| Connected repos | — | 5 | Unlimited |
| Export (JSON/CSV) | — | Yes | Yes |
| REST API | — | — | Yes |
| Custom scoring rules | — | — | Yes |
| Team members | — | — | Up to 10 |

---

## Self-Hosting / Development

### Prerequisites
- Node.js 18+
- PostgreSQL (or Neon for serverless)
- GitHub OAuth App (for sign-in)

### Setup

```bash
git clone https://github.com/Elifterminal/pr-triage-web.git
cd pr-triage-web
npm install
```

Create `.env` with:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/prtriage"

# Auth (create at https://github.com/settings/developers)
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
AUTH_SECRET="..."  # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Encryption key for stored API keys
ENCRYPTION_KEY="..."  # 32-byte hex string
```

```bash
npx prisma db push    # Create tables
npm run dev            # Start dev server at localhost:3000
```

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth v5 with GitHub OAuth
- **Styling**: Tailwind CSS + Radix UI primitives
- **LLM Providers**: Anthropic SDK, OpenAI SDK, OpenRouter (OpenAI-compatible)

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Authenticated pages (dashboard, analyze, settings, analysis detail)
│   ├── api/analyze/        # POST endpoint — runs triage pipeline
│   └── login/              # Auth page
├── engine/                 # Core triage engine
│   ├── types.ts            # All type definitions, band scores, default models
│   ├── scoring.ts          # Composite score calculation, action determination, signal hierarchy
│   ├── prompts.ts          # System + user prompts for LLM evaluation
│   ├── triage.ts           # Orchestrator — fetches data, calls LLM, parses result
│   ├── github.ts           # GitHub API client (PR data, issues, repo context)
│   └── providers/          # LLM provider implementations
│       ├── anthropic.ts
│       ├── openai.ts
│       └── openrouter.ts
├── components/             # React components (UI primitives, nav, score display)
└── lib/                    # Auth config, DB client, encryption, tier logic
```

---

## How It Works (Technical Flow)

1. User pastes a GitHub PR URL (e.g., `https://github.com/owner/repo/pull/123`)
2. The API parses the URL and checks rate limits / caching
3. `github.ts` fetches via GitHub API: PR metadata, diff, linked issues (from `Fixes #N` references), repo context (language, description, CONTRIBUTING.md)
4. `prompts.ts` builds a structured prompt with all context, truncating the diff at 12,000 characters
5. The user's chosen LLM provider evaluates the PR and returns structured JSON
6. `scoring.ts` parses the response, calculates composite score, detects PR category, determines confidence/priority/action through the signal hierarchy
7. Results are stored in the database and displayed to the user

The system is explicitly **not** a code review tool or an AI detection tool. It's a triage decision-support system that uses probabilistic language ("appears to," "likely," "shows signals of") — never definitive claims.

---

## License

MIT
