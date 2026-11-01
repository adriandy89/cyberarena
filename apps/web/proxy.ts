import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next.js 16 renamed middleware.ts to proxy.ts — next-intl 4.x supports it natively.
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - /api, /_next and files with a dot (e.g. favicon.ico)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
