// Centralized Synthesized Web Audio API & Haptics Service
// Offline-only, zero external assets, strictly follows AGENTS.md Rule 7

import { SoundStyle } from '../domain/types';

export type SoundEffectType = 'click' | 'success' | 'warning' | 'panel' | 'delete' | 'tap';

class AudioService {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private volumeGain: GainNode | null = null;

  private volume: number = 75; // 0 - 100
  private isMuted: boolean = false;
  private style: SoundStyle = 'modern';
  private hapticsEnabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init(volume: number, isMuted: boolean, style: SoundStyle, haptics: boolean) {
    this.volume = volume;
    this.isMuted = isMuted;
    this.style = style;
    this.hapticsEnabled = haptics;
  }

  public updateConfig(volume?: number, isMuted?: boolean, style?: SoundStyle, haptics?: boolean) {
    if (volume !== undefined) this.volume = volume;
    if (isMuted !== undefined) this.isMuted = isMuted;
    if (style !== undefined) this.style = style;
    if (haptics !== undefined) this.hapticsEnabled = haptics;

    if (this.volumeGain && this.ctx) {
      const vol = this.isMuted ? 0 : (this.volume / 100) * 0.8;
      this.volumeGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      // Dynamics Compressor (peak limiter) to prevent harsh clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(15, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      // Master Volume Gain
      this.volumeGain = this.ctx.createGain();
      const vol = this.isMuted ? 0 : (this.volume / 100) * 0.8;
      this.volumeGain.gain.setValueAtTime(vol, this.ctx.currentTime);

      this.compressor.connect(this.volumeGain);
      this.volumeGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public play(type: SoundEffectType = 'click') {
    if (this.isMuted || this.volume <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) return; // Don't play when app is in background

    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;

    // Trigger haptics
    this.triggerHaptic(type);

    const now = ctx.currentTime;

    switch (type) {
      case 'click':
      case 'tap':
        this.synthesizeClick(ctx, now);
        break;
      case 'success':
        this.synthesizeSuccess(ctx, now);
        break;
      case 'warning':
        this.synthesizeWarning(ctx, now);
        break;
      case 'panel':
        this.synthesizePanel(ctx, now);
        break;
      case 'delete':
        this.synthesizeDelete(ctx, now);
        break;
    }
  }

  private synthesizeClick(ctx: AudioContext, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (this.style === 'retro') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (this.style === 'lembut') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (this.style === 'tegas') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.035);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(now);
      osc.stop(now + 0.035);
    } else {
      // Modern clean pop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  }

  private synthesizeSuccess(ctx: AudioContext, now: number) {
    // Beautiful ascending melodic chime (Offline synthesized)
    const notes = this.style === 'retro' ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;
      const duration = 0.22;

      osc.type = this.style === 'retro' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(start);
      osc.stop(start + duration);
    });
  }

  private synthesizeWarning(ctx: AudioContext, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.setValueAtTime(220, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.compressor!);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private synthesizePanel(ctx: AudioContext, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.05);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.compressor!);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private synthesizeDelete(ctx: AudioContext, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.compressor!);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private triggerHaptic(type: SoundEffectType) {
    if (!this.hapticsEnabled || typeof window === 'undefined' || !window.navigator?.vibrate) {
      return;
    }
    try {
      if (type === 'success') {
        window.navigator.vibrate([20, 40, 25]);
      } else if (type === 'warning' || type === 'delete') {
        window.navigator.vibrate([40, 30, 40]);
      } else {
        window.navigator.vibrate(10);
      }
    } catch {
      // Safe fallback
    }
  }
}

export const soundService = new AudioService();
