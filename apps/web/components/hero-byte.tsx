'use client';

import { useState } from 'react';
import { Byte, type ByteMood } from './byte/byte';
import { ByteBubble } from './byte/byte-bubble';

const HOVER_MOODS: ByteMood[] = ['happy', 'think', 'celebrate', 'hint', 'scan', 'wave'];

/** Large hero Byte that changes mood every time the pointer comes back. */
export function HeroByte({ message }: { message: string }) {
  const [step, setStep] = useState(-1);
  const mood: ByteMood = step < 0 ? 'wave' : HOVER_MOODS[step % HOVER_MOODS.length]!;

  return (
    <div
      className="relative flex flex-col items-center"
      onPointerEnter={() => setStep((value) => value + 1)}
    >
      <div
        aria-hidden="true"
        className="absolute top-10 h-48 w-48 animate-pulse-glow rounded-full bg-emerald-500/10 blur-2xl"
      />
      <ByteBubble text={message} tail="bottom" typing className="mb-4 max-w-xs text-center" />
      <Byte mood={mood} size="xl" className="relative" />
    </div>
  );
}
