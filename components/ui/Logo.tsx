'use client';

import Image from 'next/image';

/**
 * The official DUEL logo (duellogo.png). The source artwork ships on a black
 * background; the web-ready PNGs below carry a transparent background so the
 * wordmark sits correctly on any surface.
 *   /images/duel-logo.png          — lockup with the "CHALLENGE A BETTER YOU" tagline (1777x460)
 *   /images/duel-logo-wordmark.png — wordmark only, for nav bars (1502x300)
 *   /images/duel-logo-sm.png       — small wordmark for tight spaces (601x120)
 */

const VARIANTS = {
  wordmark: { src: '/images/duel-logo-wordmark.png', w: 1502, h: 300 },
  tagline: { src: '/images/duel-logo.png', w: 1777, h: 460 },
} as const;

export default function Logo({
  height = 30,
  onClick,
  className = '',
  priority = false,
  withTagline = false,
  alt = 'DUEL — Challenge A Better You',
}: {
  height?: number;
  onClick?: () => void;
  className?: string;
  priority?: boolean;
  withTagline?: boolean;
  alt?: string;
}) {
  const v = withTagline ? VARIANTS.tagline : VARIANTS.wordmark;
  const width = Math.round((height * v.w) / v.h);
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      aria-label={onClick ? 'DUEL home' : undefined}
      className={`shrink-0 select-none ${onClick ? 'cursor-pointer transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]' : ''} ${className}`}
    >
      <Image
        src={v.src}
        alt={alt}
        width={v.w}
        height={v.h}
        priority={priority}
        style={{ width, height: 'auto' }}
        className="block"
      />
    </Comp>
  );
}
