import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold">
              PR Triage
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
              >
                Dashboard
              </Link>
              <Link
                href="/analyze"
                className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
              >
                Analyze
              </Link>
              <Link
                href="/settings"
                className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
              >
                Settings
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-7 h-7 rounded-full"
                />
              )}
              <span className="text-sm text-muted-foreground">
                {session.user.name || session.user.email}
              </span>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
