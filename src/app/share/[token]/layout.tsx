import Link from 'next/link';

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-sm hover:text-foreground/80 transition">
          PR Triage
        </Link>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          Try it free &rarr;
        </Link>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
