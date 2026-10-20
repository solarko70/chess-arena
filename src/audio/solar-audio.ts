// Procedural audio engine for Solar Chess using Web Audio API

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

export class SolarAudio {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private unlockListenersAttached = false;

  constructor() {
    this.initUnlockListeners();
  }

  private initUnlockListeners(): void {
    if (typeof window === 'undefined' || this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  public ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    }
    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return null;
    try {
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setContextForTesting(ctx: AudioContext | null): void {
    this.ctx = ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Soft move click: fast frequency drop 240Hz -> 90Hz in 0.05s via GainNode and OscillatorNode.
   */
  public playMove(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Tactile wooden capture knock (chess.com style):
   * Low-frequency thud with triangle wave (140Hz -> 45Hz in 0.08s),
   * warm bone click shaped by a 550Hz lowpass filter,
   * with a tight, dense gain decay to 0.001 over 0.09s.
   */
  public playCapture(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.09;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(550, now);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Soft warning chime (middle-register vibraphone / crystal bell):
   * Pure harmonious sines at 493.88Hz (B4) and 622.25Hz (D#5),
   * gentle 0.015s attack to eliminate click wavefront,
   * reduced peak gain (0.09, soft and quiet, non-piercing),
   * smooth warm decay over 0.38s shaped by an 1100Hz lowpass filter.
   */
  public playCheck(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.38;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.09, now + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // B4 (493.88Hz) and D#5 (622.25Hz)
      const freqs = [493.88, 622.25];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration);
      }
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Deep noble victory chord:
   * Majestic major chord in bass-mid range: C3 (130.81Hz), G3 (196.0Hz), E4 (329.63Hz),
   * warm triangle oscillators shaped through an 800Hz lowpass filter,
   * soft 0.05s attack with prolonged resonating decay over 1.3s.
   */
  public playCheckmate(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 1.3;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Low majestic chord: C3, G3, E4
      const freqs = [130.81, 196.0, 329.63];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration);
      }
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Procedural cosmic Stellar move sound:
   * 3-layer patch:
   * 1. Sub-bass / Supernova: triangle 120Hz -> 40Hz (1.5s), gain 0.9 -> 0.01 (1.5s)
   * 2. Laser sweep / Energy sweep: sawtooth 300Hz -> 1500Hz (0.4s), lowpass filter 800Hz -> 4000Hz (0.4s), gain 0.35 peak
   * 3. Celestial Shimmer: 5 sine oscillators [C5, E5, G5, B5, D6] with staggered delay (0.04s * (i + 1)),
   *    micro-modulated gain (0.04-0.12) up to 2.0s, exponential decay to 0.001 at 2.2s.
   * Master gain: 0.55 connected to destination.
   */
  public playStellar(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Master output gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.55, now);
      masterGain.connect(ctx.destination);

      // ── Layer 1: Sub-bass (Supernova burst) ──────────────────────────────────
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 1.5);

      subGain.gain.setValueAtTime(0.9, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

      subOsc.connect(subGain);
      subGain.connect(masterGain);

      subOsc.start(now);
      subOsc.stop(now + 1.6);

      // ── Layer 2: Laser sweep (Energy sweep) ──────────────────────────────────
      const laserOsc = ctx.createOscillator();
      const laserFilter = ctx.createBiquadFilter();
      const laserGain = ctx.createGain();

      laserOsc.type = 'sawtooth';
      laserOsc.frequency.setValueAtTime(300, now);
      laserOsc.frequency.exponentialRampToValueAtTime(1500, now + 0.4);

      laserFilter.type = 'lowpass';
      laserFilter.frequency.setValueAtTime(800, now);
      laserFilter.frequency.exponentialRampToValueAtTime(4000, now + 0.4);

      laserGain.gain.setValueAtTime(0.0001, now);
      laserGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      laserGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      laserOsc.connect(laserFilter);
      laserFilter.connect(laserGain);
      laserGain.connect(masterGain);

      laserOsc.start(now);
      laserOsc.stop(now + 0.7);

      // ── Layer 3: Celestial Shimmer ───────────────────────────────────────────
      const shimmerFreqs = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5, E5, G5, B5, D6
      shimmerFreqs.forEach((freq, index) => {
        const shimOsc = ctx.createOscillator();
        const shimGain = ctx.createGain();

        shimOsc.type = 'sine';
        shimOsc.frequency.setValueAtTime(freq, now);

        shimGain.gain.setValueAtTime(0.0001, now);
        shimGain.gain.linearRampToValueAtTime(0.12, now + 0.1);

        // Micro-modulations of volume between 0.04 and 0.12 up to 2.0s
        const mod1 = 0.04 + ((index * 17) % 80) / 1000;
        const mod2 = 0.06 + ((index * 23) % 60) / 1000;
        const mod3 = 0.05 + ((index * 31) % 70) / 1000;
        shimGain.gain.linearRampToValueAtTime(mod1, now + 0.6);
        shimGain.gain.linearRampToValueAtTime(mod2, now + 1.2);
        shimGain.gain.linearRampToValueAtTime(mod3, now + 1.8);
        shimGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        if (typeof ctx.createDelay === 'function') {
          try {
            const delay = ctx.createDelay();
            delay.delayTime.setValueAtTime(0.04 * (index + 1), now);
            shimOsc.connect(delay);
            delay.connect(shimGain);
          } catch {
            shimOsc.connect(shimGain);
          }
        } else {
          shimOsc.connect(shimGain);
        }

        shimGain.connect(masterGain);

        shimOsc.start(now);
        shimOsc.stop(now + 2.3);
      });
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }
}

export const solarAudio = new SolarAudio();

export function playMove(): void {
  solarAudio.playMove();
}

export function playCapture(): void {
  solarAudio.playCapture();
}

export function playCheck(): void {
  solarAudio.playCheck();
}

export function playCheckmate(): void {
  solarAudio.playCheckmate();
}

export function playStellar(): void {
  solarAudio.playStellar();
}

