import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Typed navigation helpers aware of our locales (Link, useRouter, usePathname, redirect).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
