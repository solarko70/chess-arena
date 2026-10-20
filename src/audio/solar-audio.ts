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
   * Pure harmonious sines at 523.25Hz (C5) and 659.25Hz (E5),
   * gentle 0.015s attack to eliminate click wavefront,
   * smooth warm decay over 0.38s shaped by a 1200Hz lowpass filter.
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
      filter.frequency.setValueAtTime(1200, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.32, now + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // C5 (523.25Hz) and E5 (659.25Hz)
      const freqs = [523.25, 659.25];
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
   * Luminous vocal choir swell ("Ah-h-h"):
   * 4th-5th octave major vocal chord: F4 (349.23Hz), A4 (440.0Hz), C5 (523.25Hz), F5 (698.46Hz),
   * warm triangle oscillators with chorus micro-detuning (±4-7 cents),
   * human vowel /ɑ/ formant bandpass filter (800Hz, Q: 2.2),
   * gentle swell attack (0.35s), 1.0s plateau, and long ethereal tail release (~1.55s, total ~2.9s).
   */
  public playStellar(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const attack = 0.35;
      const hold = 1.0;
      const duration = 2.9;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.28, now + attack);
      masterGain.gain.setValueAtTime(0.28, now + attack + hold);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      masterGain.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(2.2, now);
      filter.connect(masterGain);

      // Vocal choir chord: F4, A4, C5, F5 with micro-detuning for rich human choral ensemble
      const voices = [
        { freq: 349.23, detune: -5 },
        { freq: 440.0, detune: 4 },
        { freq: 523.25, detune: -6 },
        { freq: 698.46, detune: 6 },
      ];

      for (const voice of voices) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(voice.freq, now);
        osc.detune.setValueAtTime(voice.detune, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration);
      }
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

