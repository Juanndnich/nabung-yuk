import confetti from 'canvas-confetti';

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  disableForReducedMotion?: boolean;
}

/**
 * Trigger celebration confetti without emoji.
 * Colors: Navy Blue, Pastel Pink, Emerald, and Amber
 */
export function triggerCelebration(options: ConfettiOptions = {}) {
  // Check reduced motion preference
  if (
    options.disableForReducedMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    return;
  }

  try {
    confetti({
      particleCount: options.particleCount || 40,
      spread: options.spread || 60,
      origin: options.origin || { y: 0.65 },
      colors: ['#2563eb', '#ec4899', '#38bdf8', '#10b981', '#f59e0b'],
      disableForReducedMotion: true,
      shapes: ['square', 'circle'],
    });
  } catch {
    // Graceful fallback if canvas is unsupported
  }
}
