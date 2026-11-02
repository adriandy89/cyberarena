import { cn } from '@repo/ui';
import type { ReactNode } from 'react';
import { Byte, type ByteMood, type ByteSize } from './byte';
import { ByteBubble, type BubbleTone } from './byte-bubble';

export interface ByteSceneProps {
  mood: ByteMood;
  message: string;
  size?: ByteSize;
  tone?: BubbleTone;
  /** `row`: Byte left of the bubble; `column`: Byte above it (centered). */
  layout?: 'row' | 'column';
  typing?: boolean;
  live?: boolean;
  /** Actions rendered inside the bubble (links/buttons). */
  children?: ReactNode;
  className?: string;
}

/**
 * Inline Byte + speech bubble for page sections (empty states, 404, errors,
 * greetings). Server-renderable: only the bubble hydrates.
 */
export function ByteScene({
  mood,
  message,
  size = 'md',
  tone,
  layout = 'row',
  typing = false,
  live = false,
  children,
  className,
}: ByteSceneProps) {
  const column = layout === 'column';
  return (
    <div
      className={cn(
        'flex gap-3',
        column ? 'flex-col items-center text-center' : 'items-start',
        className,
      )}
    >
      <Byte mood={mood} size={size} />
      <ByteBubble
        text={message}
        tone={tone}
        tail={column ? 'bottom' : 'left'}
        typing={typing}
        live={live}
        className={cn(
          column ? 'order-first max-w-sm' : 'mt-3 max-w-md flex-1',
          column && 'text-left',
        )}
      >
        {children}
      </ByteBubble>
    </div>
  );
}
