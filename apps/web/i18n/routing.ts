import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Spanish is the default authoring language; English is the secondary locale.
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
