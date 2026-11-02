import { useId } from 'react';
import styles from './byte.module.css';

/**
 * Byte, the CyberArena mascot (ADR-014).
 *
 * An inline SVG without state hooks (only `useId`, which Server Components
 * support) so it renders on the server. The visual state lives in
 * `data-mood`; byte.module.css shows/hides face parts and runs the per-mood
 * animations. Purely decorative: always aria-hidden — callers put any message
 * in a ByteBubble, which is announced to assistive tech.
 */
export const BYTE_MOODS = [
  'idle',
  'wave',
  'think',
  'happy',
  'celebrate',
  'sad',
  'confused',
  'error',
  'sleep',
  'scan',
  'point',
  'hint',
] as const;

export type ByteMood = (typeof BYTE_MOODS)[number];

export type ByteSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<ByteSize, number> = { xs: 36, sm: 56, md: 88, lg: 136, xl: 208 };

export interface ByteProps {
  mood?: ByteMood;
  size?: ByteSize;
  /** Mirrors the robot; `point` then points to the left. */
  direction?: 'left' | 'right';
  className?: string;
}

const SPARKLE = 'M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2 Z';
const SPARKLE_SPOTS = [
  'translate(13 32)',
  'translate(108 40) scale(0.8)',
  'translate(9 86) scale(0.7)',
  'translate(111 84)',
];

export function Byte({ mood = 'idle', size = 'md', direction = 'right', className }: ByteProps) {
  const glowId = `byte-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const glow = `url(#${glowId})`;
  const width = SIZE_PX[size];

  return (
    <svg
      viewBox="0 0 120 140"
      width={width}
      height={(width * 140) / 120}
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      data-dir={direction}
      data-byte=""
      className={className ? `${styles.root} ${className}` : styles.root}
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className={styles.shadow} cx="60" cy="134" rx="22" ry="4" />

      <g className={styles.mirror}>
        <g className={styles.bot}>
          {/* thruster */}
          <g className={styles.thruster}>
            <path className={styles.flame} filter={glow} d="M54.5 120 Q60 135 65.5 120 Z" />
            <path className={styles.flameCore} d="M57.5 120 Q60 128 62.5 120 Z" />
            <path className={styles.shade} d="M51 113 h18 l-3 7 h-12 z" />
          </g>

          {/* arms and neck sit behind the body so the joints tuck in */}
          <g className={styles.armL}>
            <rect className={styles.shell} x="27" y="86" width="10" height="24" rx="5" />
            <circle className={styles.hand} cx="32" cy="111" r="5.5" />
          </g>
          <g className={styles.armR}>
            <rect className={styles.shell} x="83" y="86" width="10" height="24" rx="5" />
            <circle className={styles.hand} cx="88" cy="111" r="5.5" />
          </g>
          <rect className={styles.shade} x="53" y="74" width="14" height="9" rx="3" />

          {/* body */}
          <rect className={styles.shell} x="36" y="80" width="48" height="36" rx="14" />
          <path
            className={styles.shadeSoft}
            d="M36 102 H84 A14 14 0 0 1 70 116 H50 A14 14 0 0 1 36 102 Z"
          />
          <circle className={styles.visor} cx="60" cy="96" r="7.5" />
          <circle className={styles.core} filter={glow} cx="60" cy="96" r="4" />

          {/* head */}
          <g className={styles.head}>
            <g className={styles.antenna}>
              <rect className={styles.shade} x="58.5" y="11" width="3" height="13" rx="1.5" />
              <circle className={styles.antennaLed} filter={glow} cx="60" cy="9" r="4.5" />
            </g>
            <rect className={styles.shade} x="14" y="41" width="10" height="20" rx="4.5" />
            <rect className={styles.shade} x="96" y="41" width="10" height="20" rx="4.5" />
            <rect className={styles.shell} x="20" y="22" width="80" height="56" rx="24" />
            <path
              className={styles.shadeSoft}
              d="M20 54 H100 A24 24 0 0 1 76 78 H44 A24 24 0 0 1 20 54 Z"
            />
            <ellipse
              className={styles.highlight}
              cx="38"
              cy="30"
              rx="9"
              ry="3.5"
              transform="rotate(-18 38 30)"
            />

            <rect className={styles.visor} x="28" y="31" width="64" height="38" rx="16" />
            <path className={styles.reflection} d="M36 36 q8 -3 18 -2" />

            <g className={styles.face} filter={glow}>
              <g className={styles.eyesOpen}>
                <g className={styles.pupils}>
                  <rect x="40" y="43" width="9" height="13" rx="4.5" />
                  <rect x="71" y="43" width="9" height="13" rx="4.5" />
                </g>
              </g>
              <g className={`${styles.stroke} ${styles.eyesHappy}`}>
                <path d="M39 52 Q44.5 43 50 52" />
                <path d="M70 52 Q75.5 43 81 52" />
              </g>
              <g className={`${styles.stroke} ${styles.eyesClosed}`}>
                <path d="M39 50 h11" />
                <path d="M70 50 h11" />
              </g>
              <g className={styles.eyesSad}>
                <rect x="40" y="47" width="9" height="9" rx="4.5" />
                <rect x="71" y="47" width="9" height="9" rx="4.5" />
                <path className={styles.stroke} d="M38 44 L49 40.5" />
                <path className={styles.stroke} d="M82 44 L71 40.5" />
              </g>
              <g className={styles.eyesConfused}>
                <circle cx="44.5" cy="49" r="6" />
                <rect x="70" y="48" width="11" height="4" rx="2" />
              </g>
              <g className={`${styles.stroke} ${styles.eyesX}`}>
                <path d="M40 44 l9 10 M49 44 l-9 10" />
                <path d="M71 44 l9 10 M80 44 l-9 10" />
              </g>

              <path className={`${styles.stroke} ${styles.mouthSmile}`} d="M54 60 Q60 65 66 60" />
              <path className={styles.mouthOpen} d="M52 58.5 Q60 69 68 58.5 Z" />
              <path
                className={`${styles.stroke} ${styles.mouthFrown}`}
                d="M54 63.5 Q60 58.5 66 63.5"
              />
              <circle className={`${styles.stroke} ${styles.mouthO}`} cx="60" cy="61.5" r="2.6" />
              <path className={`${styles.stroke} ${styles.mouthFlat}`} d="M55.5 61.5 h9" />
              <path
                className={`${styles.stroke} ${styles.mouthZig}`}
                d="M51 61.5 l3 -2.5 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -2.5"
              />

              <rect className={styles.scanBeam} x="30" y="33" width="4" height="34" rx="2" />
              <g className={styles.static}>
                <rect x="30" y="40" width="60" height="1.6" />
                <rect x="30" y="51" width="60" height="1.2" />
                <rect x="30" y="61" width="60" height="1.8" />
              </g>
            </g>
            <circle className={styles.cheek} cx="34.5" cy="60" r="3.5" />
            <circle className={styles.cheek} cx="85.5" cy="60" r="3.5" />
          </g>

          {/* accessories, shown per mood */}
          <g className={styles.thought}>
            <circle cx="90" cy="22" r="2.2" />
            <circle cx="98" cy="15" r="3" />
            <circle cx="107" cy="7" r="4" />
          </g>
          <text className={styles.question} x="96" y="25">
            ?
          </text>
          <g className={styles.zzz}>
            <text x="88" y="24">
              z
            </text>
            <text x="96" y="16">
              z
            </text>
            <text x="104" y="8">
              Z
            </text>
          </g>
          <g className={styles.bulb} filter={glow}>
            <circle cx="100" cy="16" r="7" />
            <rect x="97" y="22" width="6" height="4" rx="1" />
            <path
              className={styles.bulbRays}
              d="M100 5 v-3 M91 9 l-2 -2 M109 9 l2 -2 M89 16 h-3 M111 16 h3"
            />
          </g>
          <g className={styles.sparkles}>
            {SPARKLE_SPOTS.map((transform) => (
              <g key={transform} transform={transform}>
                <path d={SPARKLE} />
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
