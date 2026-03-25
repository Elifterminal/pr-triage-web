import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">PR Triage</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition">
            Log in
          </Link>
          <Link href="/login">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block px-3 py-1 rounded-full border border-border text-muted-foreground text-sm mb-6">
          Your triage assistant, not your decision-maker
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Stop reviewing<br /><span className="text-primary">junk PRs.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          PR Triage evaluates pull requests against the linked issue, repo patterns, and
          implementation substance. You get a structured triage decision in seconds, not a wall of AI text.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/login">
            <Button size="lg" className="text-base px-8">
              Analyze Your First PR
            </Button>
          </Link>
          <Link href="https://github.com/Elifterminal/pr-triage" target="_blank">
            <Button variant="outline" size="lg" className="text-base px-8">
              View on GitHub
            </Button>
          </Link>
        </div>
      </header>

      {/* Problem */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">The problem is real</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="text-3xl mb-4">&#128165;</div>
            <h3 className="text-lg font-semibold mb-2">Spam PRs waste your time</h3>
            <p className="text-muted-foreground text-sm">
              Bounty issues attract 10-25 PRs within hours. Most are cosmetic garbage
              dressed up as fixes. Reviewing each one takes 30+ minutes.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="text-3xl mb-4">&#128451;</div>
            <h3 className="text-lg font-semibold mb-2">Good PRs get buried</h3>
            <p className="text-muted-foreground text-sm">
              When 80% of submissions are noise, quality contributions get delayed or lost.
              Contributors stop contributing. The project suffers.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="text-3xl mb-4">&#9203;</div>
            <h3 className="text-lg font-semibold mb-2">Manual triage doesn&apos;t scale</h3>
            <p className="text-muted-foreground text-sm">
              Reading every diff across dozens of PRs? The review overhead exceeds the value
              of the contributions. Some maintainers just close everything.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
            <h3 className="text-lg font-semibold mb-2">Paste a PR URL</h3>
            <p className="text-muted-foreground text-sm">
              One input field. Paste any public GitHub PR URL. We fetch the diff,
              linked issue, and repo context automatically.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
            <h3 className="text-lg font-semibold mb-2">AI evaluates 6 dimensions</h3>
            <p className="text-muted-foreground text-sm">
              Issue fit, implementation substance, pattern alignment, scope match,
              test signal, and risk flags. Each one scored with evidence.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
            <h3 className="text-lg font-semibold mb-2">You get a triage decision</h3>
            <p className="text-muted-foreground text-sm">
              Structured score, confidence level, recommendation, evidence, and
              what to verify. Understand the PR in seconds, not minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Example output */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">What you&apos;ll see</h2>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-green-400">87</span>
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
              <div className="w-48 h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '87%' }} />
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">Prioritize</span>
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">High Priority</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold">High Confidence</span>
            </div>
          </div>

          <p className="text-muted-foreground">
            PR directly addresses issue #342 by implementing retry logic in <code className="text-primary text-sm">src/http/client.ts</code>.
            Adds three test cases in <code className="text-primary text-sm">tests/http/retry.test.ts</code> covering timeout, 5xx, and connection reset scenarios.
            Changes are scoped appropriately to the networking module.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { name: 'Issue Fit', band: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
              { name: 'Substance', band: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
              { name: 'Pattern Alignment', band: 'Moderate', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
              { name: 'Scope Match', band: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
              { name: 'Test Signal', band: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
              { name: 'Risk Flags', band: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
            ].map((d) => (
              <div key={d.name} className={`rounded-lg border px-3 py-2 ${d.color}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{d.name}</span>
                  <span className="text-xs font-semibold">{d.band}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Probabilistic assessment based on available context. Maintainers make the final call.
          </p>
        </div>
      </section>

      {/* What it checks */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">Six dimensions of review-worthiness</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'Issue Resolution Fit', weight: '30%', desc: 'Does the code actually address the linked issue? Compares the diff against what was requested.' },
            { name: 'Implementation Substance', weight: '25%', desc: 'Are the changes meaningful or cosmetic? Real logic changes vs. renames and formatting.' },
            { name: 'Pattern Alignment', weight: '15%', desc: 'Does the code follow your repo\'s conventions? Style, structure, error handling patterns.' },
            { name: 'Scope / Complexity Match', weight: '15%', desc: 'Is the change proportional to the problem? Flags both trivially small and suspiciously large PRs.' },
            { name: 'Test Signal', weight: '10%', desc: 'Were relevant tests added or modified? Do they actually verify the claimed fix?' },
            { name: 'Risk Flags', weight: '5%', desc: 'Red flags like unrelated file changes, suspicious patterns, dressed-up triviality.' },
          ].map((d) => (
            <div key={d.name} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{d.name}</span>
                <span className="text-xs text-muted-foreground">({d.weight})</span>
              </div>
              <p className="text-muted-foreground text-sm">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-muted-foreground text-center mb-12">Start free. Upgrade when you need automation.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-lg font-semibold mb-1">Free</h3>
            <div className="text-3xl font-bold mb-1">$0</div>
            <p className="text-muted-foreground text-sm mb-6">forever</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&#10003; Bring your own API key</li>
              <li>&#10003; Quick Scan analysis</li>
              <li>&#10003; 3 analyses per day</li>
              <li>&#10003; 7-day result history</li>
              <li>&#10003; Manual PR evaluation</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-primary bg-card p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
              Recommended
            </div>
            <h3 className="text-lg font-semibold mb-1">Pro</h3>
            <div className="text-3xl font-bold mb-1">$19<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <p className="text-muted-foreground text-sm mb-6">per maintainer</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&#10003; Everything in Free</li>
              <li>&#10003; <strong className="text-foreground">Unlimited</strong> analyses</li>
              <li>&#10003; <strong className="text-foreground">Deep Analysis</strong> mode</li>
              <li>&#10003; Permanent history</li>
              <li>&#10003; Shareable result links</li>
              <li>&#10003; Connect 5 repositories</li>
              <li>&#10003; Automatic PR ingestion</li>
              <li>&#10003; Export results (JSON/CSV)</li>
              <li>&#10003; Triage digest emails</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-lg font-semibold mb-1">Team</h3>
            <div className="text-3xl font-bold mb-1">$49<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <p className="text-muted-foreground text-sm mb-6">up to 10 members</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&#10003; Everything in Pro</li>
              <li>&#10003; 10 team members</li>
              <li>&#10003; Unlimited repositories</li>
              <li>&#10003; Team triage dashboard</li>
              <li>&#10003; API access for CI/CD</li>
              <li>&#10003; Custom triage rules</li>
              <li>&#10003; Priority support</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          BYOK: ~$0.002 per Quick Scan, ~$0.01 per Deep Analysis. You bring your own key.
          That&apos;s 500 quick scans for a dollar.
        </p>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to triage smarter?</h2>
        <p className="text-muted-foreground mb-8">
          Sign in with GitHub and analyze your first PR in under a minute.
        </p>
        <Link href="/login">
          <Button size="lg" className="text-base px-8">Get Started Free</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>PR Triage</span>
          <div className="flex gap-6">
            <Link href="https://github.com/Elifterminal/pr-triage" className="hover:text-foreground transition">GitHub</Link>
            <span>MIT License</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          PR Triage is a probabilistic triage assistant. It helps maintainers prioritize, not decide.
          Built by an AI agent who got pushed out of bounties by spam bots.
        </p>
      </footer>
    </div>
  );
}
