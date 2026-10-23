export type SoundThemeId = 'cosmic' | 'classic'
export type GameEndSound = 'win' | 'loss' | 'draw'

export interface SoundTheme {
  playMove(): void
  playCapture(): void
  playCheck(): void
  playGameEnd(type: GameEndSound): void
}

export const SOUND_THEME_STORAGE_KEY = 'solar_chess_sound_theme'

export function createSoundThemes(
  cosmic: SoundTheme,
  getContext: () => AudioContext | null,
): Readonly<Record<SoundThemeId, SoundTheme>> {
  const woodThud = (frequency: number, bodyFrequency: number, duration: number, volume: number): void => {
    const ctx = getContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(700, now)
      filter.Q.setValueAtTime(0.65, now)
      filter.connect(ctx.destination)
      const voices: { type: OscillatorType; start: number; end: number; length: number; sweep: number; gain: number }[] = [
        { type: 'triangle', start: frequency, end: frequency === 260 ? 130 : 180, length: duration, sweep: 0.05, gain: volume * 0.6 },
        { type: 'sine', start: bodyFrequency, end: bodyFrequency * 0.8, length: duration, sweep: duration, gain: volume * 0.45 },
        { type: 'triangle', start: 460, end: 160, length: 0.005, sweep: 0.005, gain: volume * 0.15 },
      ]
      let remaining = voices.length
      for (const voice of voices) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = voice.type
        osc.frequency.setValueAtTime(voice.start, now)
        osc.frequency.exponentialRampToValueAtTime(voice.end, now + voice.sweep)
        gain.gain.setValueAtTime(voice.gain, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.length)
        osc.connect(gain)
        gain.connect(filter)
        osc.onended = () => {
          osc.disconnect()
          gain.disconnect()
          if (--remaining === 0) filter.disconnect()
        }
        osc.start(now)
        osc.stop(now + voice.length)
      }
    } catch {
      // Unsupported or unavailable Web Audio implementations remain silent.
    }
  }
  return Object.freeze({
    cosmic,
    classic: {
      playMove: () => woodThud(400, 200, 0.06, 0.45),
      playCapture: () => woodThud(260, 140, 0.07, 0.6),
      playCheck: () => woodThud(440, 210, 0.065, 0.48),
      playGameEnd: (type: GameEndSound) =>
        woodThud(type === 'win' ? 460 : type === 'loss' ? 320 : 380, 200, 0.07, 0.5),
    },
  })
}
