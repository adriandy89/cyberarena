'use client';

import { cn } from '@repo/ui';
import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
import { Link, usePathname } from '../../i18n/navigation';

/** True when `pathname` is `href` or below it, or under one of `also`. */
export function isActivePath(pathname: string, href: string, also: string[] = []): boolean {
  return [href, ...also].some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)),
  );
}

/** Small spinner dot shown while the link's navigation is pending. */
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-1.5 w-1.5 rounded-full bg-emerald-400 transition-opacity duration-200',
        pending ? 'animate-pulse opacity-100' : 'opacity-0',
      )}
    />
  );
}

export interface NavLinkProps {
  href: string;
  /** Extra path prefixes that also mark this link active (e.g. rooms under paths). */
  also?: string[];
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  onNavigate?: () => void;
}

export function NavLink({
  href,
  also,
  icon,
  children,
  className,
  activeClassName,
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href, also);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-100',
        active && cn('text-slate-50', activeClassName),
        className,
      )}
    >
      {icon}
      <span>{children}</span>
      <PendingIndicator />
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 -bottom-px h-0.5 animate-scale-in rounded-full bg-emerald-400"
        />
      ) : null}
    </Link>
  );
}
