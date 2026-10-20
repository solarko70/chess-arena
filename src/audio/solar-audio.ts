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
   * reduced peak gain (0.14, -40% for soft, non-piercing chime),
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
      masterGain.gain.linearRampToValueAtTime(0.14, now + 0.015);
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
   * Formant synthesis of human vocal choir based on reference:
   * - Harmonic chord: D4 (293.7Hz), A4 (440.0Hz), D5 (587.3Hz), F#5 (740.0Hz) with ±4-7 cents detuning
   * - Natural vocal vibrato: 5.2Hz sine LFO with 6 cents depth
   * - 3-formant parallel vocal tract filter bank for vowel /ɑ/ (Ah):
   *     F1: 700Hz, Q: 4.5, gain: 1.0 (oral cavity)
   *     F2: 1150Hz, Q: 5.5, gain: 0.65 (pharyngeal cavity)
   *     F3: 2600Hz, Q: 6.0, gain: 0.25 (singing formant / ring)
   * - Breath air stream: bandpass filtered white noise at 1600Hz, Q: 2.0, gain: 0.035
   * - Choral swell envelope: 0.45s attack, 0.9s hold, 2.0s release (total ~3.35s).
   */
  public playStellar(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const attack = 0.45;
      const sustain = 0.9;
      const duration = 3.35;

      // Master swell gain envelope
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.35, now + attack);
      masterGain.gain.setValueAtTime(0.35, now + attack + sustain);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      masterGain.connect(ctx.destination);

      // Vocal vibrato LFO (5.2Hz, 6 cents depth)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.2, now);
      lfoGain.gain.setValueAtTime(6, now);
      lfo.connect(lfoGain);

      // Voice summation bus
      const voiceBus = ctx.createGain();
      voiceBus.gain.setValueAtTime(1.0, now);

      // Harmonic choir chord: D4, A4, D5, F#5 with choral micro-detuning
      const voices = [
        { freq: 293.7, detune: -5 },
        { freq: 440.0, detune: 4 },
        { freq: 587.3, detune: -6 },
        { freq: 740.0, detune: 6 },
      ];

      for (const voice of voices) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(voice.freq, now);
        osc.detune.setValueAtTime(voice.detune, now);
        try {
          lfoGain.connect(osc.detune);
        } catch {
          // Safe fallback if audio param connection is unsupported
        }
        osc.connect(voiceBus);
        osc.start(now);
        osc.stop(now + duration);
      }

      lfo.start(now);
      lfo.stop(now + duration);

      // Parallel Formant Bank for vowel "Ah" (/ɑ/):
      // F1: 700Hz (Q: 4.5, gain: 1.0)
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(700, now);
      filter1.Q.setValueAtTime(4.5, now);
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1.0, now);
      voiceBus.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(masterGain);

      // F2: 1150Hz (Q: 5.5, gain: 0.65)
      const filter2 = ctx.createBiquadFilter();
      filter2.type = 'bandpass';
      filter2.frequency.setValueAtTime(1150, now);
      filter2.Q.setValueAtTime(5.5, now);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.65, now);
      voiceBus.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(masterGain);

      // F3: 2600Hz (Q: 6.0, gain: 0.25)
      const filter3 = ctx.createBiquadFilter();
      filter3.type = 'bandpass';
      filter3.frequency.setValueAtTime(2600, now);
      filter3.Q.setValueAtTime(6.0, now);
      const gain3 = ctx.createGain();
      gain3.gain.setValueAtTime(0.25, now);
      voiceBus.connect(filter3);
      filter3.connect(gain3);
      gain3.connect(masterGain);

      // Breath / air stream (whisper component)
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        try {
          const sampleRate = ctx.sampleRate || 44100;
          const bufferSize = Math.floor(sampleRate * 2.0);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          noiseSource.loop = true;

          const noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.setValueAtTime(1600, now);
          noiseFilter.Q.setValueAtTime(2.0, now);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.035, now);

          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(masterGain);

          noiseSource.start(now);
          noiseSource.stop(now + duration);
        } catch {
          // Safe fallback if buffer generation fails
        }
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

