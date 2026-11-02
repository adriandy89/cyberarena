import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ByteCompanion } from '../../components/byte/byte-companion';
import { ByteProvider } from '../../components/byte/byte-provider';
import { SiteFooter } from '../../components/shell/site-footer';
import { SiteHeader } from '../../components/shell/site-header';
import { routing } from '../../i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations('Nav');

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-slate-950 font-sans text-slate-100 antialiased">
        <NextIntlClientProvider>
          <ByteProvider>
            <a
              href="#main"
              className="sr-only z-50 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              {t('skip')}
            </a>
            {/* ambient glow behind every page */}
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-144 bg-[radial-gradient(ellipse_at_top,rgb(16_185_129/0.10),transparent_65%)]"
            />
            <SiteHeader />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
            <ByteCompanion />
          </ByteProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
