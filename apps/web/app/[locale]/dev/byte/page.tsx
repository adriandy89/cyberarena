import { notFound } from 'next/navigation';
import { BYTE_MOODS, Byte, type ByteSize } from '../../../../components/byte/byte';
import { ByteScene } from '../../../../components/byte/byte-scene';

const SIZES: ByteSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/**
 * Development-only gallery to review every Byte mood (spec 010 T004).
 * Production builds answer 404 so the route never ships to students.
 */
export default function ByteGalleryPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Byte — moods</h1>
      <p className="mt-1 text-sm text-slate-500">
        Dev-only. Toggle &quot;prefers-reduced-motion&quot; in DevTools to check static poses.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {BYTE_MOODS.map((mood) => (
          <li
            key={mood}
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <Byte mood={mood} size="lg" />
            <code className="font-mono text-xs text-emerald-400">{mood}</code>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold">Sizes · direction</h2>
      <div className="mt-4 flex flex-wrap items-end gap-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        {SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-2">
            <Byte size={size} />
            <code className="font-mono text-xs text-slate-500">{size}</code>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <Byte mood="point" direction="left" size="md" />
          <code className="font-mono text-xs text-slate-500">point · left</code>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-semibold">Scenes</h2>
      <div className="mt-4 grid gap-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6 md:grid-cols-2">
        <ByteScene mood="wave" message="Row layout with a typed message for sections." typing />
        <ByteScene mood="sad" tone="danger" message="Danger tone, used for wrong answers." />
        <ByteScene mood="hint" tone="warn" message="Warn tone, used for hints." layout="column" />
        <ByteScene
          mood="celebrate"
          tone="success"
          message="Success tone with actions."
          layout="column"
        >
          <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
            Action
          </span>
        </ByteScene>
      </div>
    </div>
  );
}
