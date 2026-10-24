// Procedural audio engine for Solar Chess using Web Audio API
import { createSoundThemes, SOUND_THEME_STORAGE_KEY, type SoundThemeId, type SoundTheme, type GameEndSound } from './sound-theme';
export type { SoundTheme, SoundThemeId, GameEndSound } from './sound-theme';

export interface AmbientChord {
  osc1: number;
  osc2: number;
  osc3: number;
  filterFreq: number;
}

export const MONOLITHIC_SOLAR_CHORD = {
  osc1: 110.0, // A2 (triangle, warm fundamental)
  osc2: 164.8, // E3 (sine, cosmic fifth)
  osc3: 55.0,  // A1 (sine, event horizon sub-bass)
  filterFreq: 380, // bandpass center
  filterQ: 2.5,
  lfoFreq: 0.20, // Gravitational pulse LFO (~5.0s pulse cycle, 0.20-0.22Hz)
};

export const AMBIENT_CHORDS: AmbientChord[] = [
  // Monolithic Solar chord: 110.0 Hz (A2), 164.8 Hz (E3), 55.0 Hz (A1), filter 380 Hz
  { osc1: 110.0, osc2: 164.8, osc3: 55.0, filterFreq: 380 },
];

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (typeof process !== 'undefined' && process.versions?.node) return null;
  if (/jsdom/i.test(window.navigator?.userAgent ?? '')) return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

export class SolarAudio {
  private themeId: SoundThemeId = 'cosmic';
  public readonly themes: Readonly<Record<SoundThemeId, SoundTheme>>;
  private ctx: AudioContext | null = null;
  private isMutedState = false;
  private unlockListenersAttached = false;
  private isAmbientRequested = false;
  private ambientNodes: {
    masterGain: GainNode;
    sources: (OscillatorNode | AudioBufferSourceNode)[];
    gains?: GainNode[];
    lfoVolumeGain?: GainNode;
  } | null = null;

  constructor() {
    this.themes = createSoundThemes({
      playMove: () => this.playCosmicMove(),
      playCapture: () => this.playCosmicCapture(),
      playCheck: () => this.playCosmicCheck(),
      playGameEnd: (type) => this.playCosmicGameEnd(type),
    }, () => this.isMutedState ? null : this.ensureContext());
    try {
      if (typeof localStorage !== 'undefined') {
        this.isMutedState = localStorage.getItem('solar_chess_sound_muted') === 'true';
        this.themeId = localStorage.getItem(SOUND_THEME_STORAGE_KEY) === 'classic' ? 'classic' : 'cosmic';
      }
    } catch {
      this.isMutedState = false;
    }
    this.initUnlockListeners();
  }

  public getSoundTheme(): SoundThemeId {
    return this.themeId;
  }

  public setSoundTheme(theme: SoundThemeId): void {
    if (theme !== 'cosmic' && theme !== 'classic') return;
    this.themeId = theme;
    try {
      localStorage.setItem(SOUND_THEME_STORAGE_KEY, theme);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }

  public playMove(): void { this.themes[this.themeId].playMove(); }
  public playCapture(): void { this.themes[this.themeId].playCapture(); }
  public playCheck(): void { this.themes[this.themeId].playCheck(); }
  public playGameEnd(type: GameEndSound): void { this.themes[this.themeId].playGameEnd(type); }
  public playCheckmate(): void { this.playGameEnd('loss'); }

  public previewSoundTheme(theme: SoundThemeId): void {
    if (this.isMutedState || (theme !== 'cosmic' && theme !== 'classic')) return;
    this.themes[theme].playCapture();
  }

  public initUnlockListeners(): void {
    if (typeof window === 'undefined' || this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const unlockEvents = ['pointerdown', 'touchstart', 'keydown'];

    const unlock = () => {
      const ctx = this.ensureContext();
      if (ctx) {
        const homeScreen = typeof document !== 'undefined' ? document.getElementById('screen-home') : null;
        const isMenuScreen = typeof document !== 'undefined'
          ? (document.body.classList.contains('home-active') ||
             (homeScreen ? homeScreen.style.display !== 'none'
               : !document.getElementById('screen-game')?.classList.contains('active')))
          : true;

        const shouldLaunch = (this.isAmbientRequested || isMenuScreen) && !this.isMutedState && !this.ambientNodes;

        if (ctx.state === 'suspended') {
          void ctx.resume().then(() => {
            if (shouldLaunch && !this.ambientNodes && !this.isMutedState) {
              this.launchAmbientDrone();
            }
          }).catch(() => {
            // Autoplay rejection safety
          });
        } else if (ctx.state === 'running') {
          if (shouldLaunch && !this.ambientNodes && !this.isMutedState) {
            this.launchAmbientDrone();
          }
        }
      }
      for (const evt of unlockEvents) {
        window.removeEventListener(evt, unlock, true);
      }
      this.unlockListenersAttached = false;
    };

    for (const evt of unlockEvents) {
      window.addEventListener(evt, unlock, true);
    }
  }

  public ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return null;
    try {
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setContextForTesting(ctx: AudioContext | null): void {
    this.ctx = ctx;
    this.ambientNodes = null;
    this.isAmbientRequested = false;
  }

  public resetUnlockForTesting(): void {
    this.unlockListenersAttached = false;
    this.initUnlockListeners();
  }

  public getIsAmbientRequested(): boolean {
    return this.isAmbientRequested;
  }

  public isAmbientPlaying(): boolean {
    return this.ambientNodes !== null;
  }

  public getCurrentChordIndex(): number {
    return 0;
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('solar_chess_sound_muted', muted ? 'true' : 'false');
      }
    } catch {
      // Storage unavailable
    }
    if (muted) {
      this.isAmbientRequested = false;
      this.stopMenuAmbient(100);
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public isAudioMuted(): boolean {
    return this.isMutedState;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  /**
   * Short, soft tactile button click (~30ms):
   * Triangle wave frequency drop 600Hz -> 180Hz in 0.035s with delicate gain 0.09 -> 0.001.
   */
  public playButtonClick(): void {
    if (this.isMutedState) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.035;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + duration);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Ultra-short, delicate airy hover micro-tick for UI buttons:
   * Pure sine wave pulse at 1040Hz (in 950-1100Hz range),
   * ultra-short duration (0.022s) with instant exponential decay to 0.0001,
   * gentle peak volume (0.03, within 0.025-0.035 limit).
   * Safe return if muted or context not unlocked.
   */
  public playButtonHover(): void {
    if (this.isMutedState) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const duration = 0.022;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1040, now);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Procedural cosmic black hole background ambient (Cosmic Drone):
   * Sets isAmbientRequested = true. If AudioContext is already running, launches drone immediately.
   * If AudioContext is not created or suspended, drone will be started upon first user unlock gesture.
   */
  public startMenuAmbient(): void {
    if (this.isMutedState) return;
    this.isAmbientRequested = true;
    if (this.ambientNodes) return;

    if (!this.ctx || this.ctx.state !== 'running') {
      return;
    }

    this.launchAmbientDrone();
  }

  /**
   * Synthesis graph for monolithic cosmic black hole background drone:
   * 1. Monolithic harmonic chord layer:
   *    - Osc 1: 110.0Hz (A2, triangle wave) - warm fundamental lower-mid tone
   *    - Osc 2: 164.8Hz (E3, sine wave) - deep cosmic fifth for infinite space
   *    - Osc 3: 55.0Hz (A1, sine wave) - event horizon sub-bass
   * 2. Cosmic wind / relic radiation noise layer:
   *    - Looped noise buffer filtered through 380Hz bandpass filter (Q: 2.5)
   * 3. Gravitational Pulse LFO (0.20-0.22Hz, ~5.0s breathing cycle):
   *    - Sine oscillator at 0.20Hz
   *    - Volume modulation via lfoVolumeGain (0.04): master gain oscillates between 0.08 and 0.16 (base 0.12)
   *    - Filter modulation via lfoFilterGain (100Hz): bandpass frequency breathes between 280Hz and 480Hz (center 380Hz)
   * 4. Master ambient gain: ramps from 0.0001 to 0.12 over 2.0s.
   */
  private launchAmbientDrone(): void {
    if (this.ambientNodes || this.isMutedState) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;

      const ambientMasterGain = ctx.createGain();
      ambientMasterGain.gain.setValueAtTime(0.0001, now);
      ambientMasterGain.gain.linearRampToValueAtTime(0.12, now + 2.0);
      ambientMasterGain.connect(ctx.destination);

      const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
      const gains: GainNode[] = [ambientMasterGain];

      // Harmonic drone chord: 110Hz (A2) + 164.8Hz (E3) + 55Hz (A1)
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0.08, now);
      chordGain.connect(ambientMasterGain);
      gains.push(chordGain);

      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(110.0, now);
      osc1.connect(chordGain);
      osc1.start(now);
      sources.push(osc1);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(164.8, now);
      osc2.connect(chordGain);
      osc2.start(now);
      sources.push(osc2);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(55.0, now);
      osc3.connect(chordGain);
      osc3.start(now);
      sources.push(osc3);

      let noiseFilter: BiquadFilterNode | undefined;
      // Relic radiation noise layer with 380Hz bandpass filter (Q: 2.5)
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        const sampleRate = ctx.sampleRate || 44100;
        const bufferLength = Math.floor(sampleRate * 3);
        const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferLength; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.4;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(380, now);
        noiseFilter.Q.setValueAtTime(2.5, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.06, now);
        gains.push(noiseGain);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ambientMasterGain);

        noiseSource.start(now);
        sources.push(noiseSource);
      }

      // Gravitational Pulse LFO: 0.20Hz (~5.0s breathing cycle, 0.20-0.22Hz range)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.20, now);

      // Volume modulation: sway gain in 0.08..0.16 range around base 0.12 (depth: 0.04)
      const lfoVolumeGain = ctx.createGain();
      lfoVolumeGain.gain.setValueAtTime(0.04, now);
      lfo.connect(lfoVolumeGain);
      lfoVolumeGain.connect(ambientMasterGain.gain);
      gains.push(lfoVolumeGain);

      // Synchronous filter cutoff breathing: sway between 280Hz and 480Hz around 380Hz (depth: 100Hz)
      if (noiseFilter) {
        const lfoFilterGain = ctx.createGain();
        lfoFilterGain.gain.setValueAtTime(100, now);
        lfo.connect(lfoFilterGain);
        lfoFilterGain.connect(noiseFilter.frequency);
        gains.push(lfoFilterGain);
      }

      lfo.start(now);
      sources.push(lfo);

      this.ambientNodes = {
        masterGain: ambientMasterGain,
        sources,
        gains,
        lfoVolumeGain,
      };
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Retained for compatibility. Monolithic chord mode does not cycle pitch.
   */
  public advanceAmbientChord(): void {
    // No-op: monolithic ambient preserves stable, meditative tuning without pitch jumps
  }

  /**
   * Smooth fade-out of menu ambient drone over fadeMs (default 800ms).
   */
  public stopMenuAmbient(fadeMs = 800): void {
    this.isAmbientRequested = false;
    if (!this.ambientNodes) return;

    const nodes = this.ambientNodes;
    this.ambientNodes = null;

    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const fadeSec = Math.max(0.01, fadeMs / 1000);

    try {
      if (typeof nodes.masterGain.gain.cancelScheduledValues === 'function') {
        nodes.masterGain.gain.cancelScheduledValues(now);
      }
      const currentVal = nodes.masterGain.gain.value ?? 0.12;
      nodes.masterGain.gain.setValueAtTime(currentVal, now);
      nodes.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);

      if (nodes.lfoVolumeGain && typeof nodes.lfoVolumeGain.gain.linearRampToValueAtTime === 'function') {
        if (typeof nodes.lfoVolumeGain.gain.cancelScheduledValues === 'function') {
          nodes.lfoVolumeGain.gain.cancelScheduledValues(now);
        }
        nodes.lfoVolumeGain.gain.setValueAtTime(nodes.lfoVolumeGain.gain.value ?? 0.04, now);
        nodes.lfoVolumeGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      }

      setTimeout(() => {
        try {
          for (const src of nodes.sources) {
            src.stop();
            if (typeof src.disconnect === 'function') {
              src.disconnect();
            }
          }
          if (nodes.gains) {
            for (const g of nodes.gains) {
              if (typeof g.disconnect === 'function') {
                g.disconnect();
              }
            }
          }
          if (typeof nodes.masterGain.disconnect === 'function') {
            nodes.masterGain.disconnect();
          }
        } catch {
          // Safe cleanup
        }
      }, fadeMs + 50);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Procedural premove registration micro-impulse:
   * Two-component impulse (sine + triangle) dropping 740Hz -> 420Hz in 0.04s,
   * passed through a bandpass filter (center 580Hz, Q=1.5), with delicate volume ~0.09.
   */
  public playPremove(): void {
    if (this.themeId === 'classic') return this.playMove();
    if (this.isMutedState) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.04;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(580, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      filter.connect(gain);
      gain.connect(ctx.destination);

      // Component 1: Sine wave dropping 740Hz -> 420Hz
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(740, now);
      osc1.frequency.exponentialRampToValueAtTime(420, now + duration);
      osc1.connect(filter);

      // Component 2: Triangle wave dropping 740Hz -> 420Hz
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(740, now);
      osc2.frequency.exponentialRampToValueAtTime(420, now + duration);
      osc2.connect(filter);

      osc1.start(now);
      osc1.stop(now + duration);
      osc2.start(now);
      osc2.stop(now + duration);
    } catch {
      // Safe fallback on Web Audio API errors
    }
  }

  /**
   * Soft move click: fast frequency drop 240Hz -> 90Hz in 0.05s via GainNode and OscillatorNode.
   */
  private playCosmicMove(): void {
    if (this.isMutedState) return;
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
   * Cosmic capture: wooden transient, 120ms sine sub-impact and metallic resonance.
   */
  private playCosmicCapture(): void {
    if (this.isMutedState) return;
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

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      subGain.gain.setValueAtTime(0.42, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.12);

      const metal = ctx.createOscillator();
      const metalFilter = ctx.createBiquadFilter();
      const metalGain = ctx.createGain();
      metal.type = 'triangle';
      metal.frequency.setValueAtTime(1760, now);
      metalFilter.type = 'bandpass';
      metalFilter.frequency.setValueAtTime(1760, now);
      metalFilter.Q.setValueAtTime(6, now);
      metalGain.gain.setValueAtTime(0.045, now);
      metalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      metal.connect(metalFilter);
      metalFilter.connect(metalGain);
      metalGain.connect(ctx.destination);
      metal.start(now);
      metal.stop(now + 0.09);
      osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
      sub.onended = () => { sub.disconnect(); subGain.disconnect(); };
      metal.onended = () => { metal.disconnect(); metalFilter.disconnect(); metalGain.disconnect(); };
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
  private playCosmicCheck(): void {
    if (this.isMutedState) return;
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
   * Cosmic finale: warm harmonic swell and a descending sine sub-bass,
   * shaped through an 800Hz lowpass with a 0.05s attack and 1.3s decay.
   */
  private playCosmicGameEnd(type: GameEndSound): void {
    if (this.isMutedState) return;
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
      const freqs = type === 'win' ? [261.63, 329.63, 392.0]
        : type === 'draw' ? [196.0, 261.63, 392.0] : [130.81, 196.0, 329.63];
      let remaining = freqs.length + 1;
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.35, now);
      subGain.connect(filter);
      const release = (osc: OscillatorNode) => {
        osc.disconnect();
        if (--remaining === 0) {
          subGain.disconnect();
          filter.disconnect();
          masterGain.disconnect();
        }
      };
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(65.4, now);
      sub.frequency.exponentialRampToValueAtTime(40, now + 0.7);
      sub.connect(subGain);
      sub.onended = () => release(sub);
      sub.start(now);
      sub.stop(now + duration);
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(filter);
        osc.onended = () => release(osc);
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
    if (this.themeId === 'classic') return this.playMove();
    if (this.isMutedState) return;
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

export function playButtonClick(): void {
  solarAudio.playButtonClick();
}

export function playButtonHover(): void {
  solarAudio.playButtonHover();
}

export function playPremove(): void {
  solarAudio.playPremove();
}

export function startMenuAmbient(): void {
  solarAudio.startMenuAmbient();
}

export function stopMenuAmbient(fadeMs?: number): void {
  solarAudio.stopMenuAmbient(fadeMs);
}

export function toggleMute(): boolean {
  return solarAudio.toggleMute();
}

export function isAudioMuted(): boolean {
  return solarAudio.isAudioMuted();
}

export function isMuted(): boolean {
  return solarAudio.isMuted();
}

export function getCurrentChordIndex(): number {
  return solarAudio.getCurrentChordIndex();
}

export function advanceAmbientChord(): void {
  solarAudio.advanceAmbientChord();
}


