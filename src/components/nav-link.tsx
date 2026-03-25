'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  // Exact match for most links; /dashboard also matches /analysis/* detail pages
  const isActive = pathname === href ||
    (href === '/dashboard' && pathname.startsWith('/analysis/'));

  return (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-md transition ${
        isActive
          ? 'text-foreground bg-accent'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </Link>
  );
}
