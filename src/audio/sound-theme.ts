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
  const click = (frequency: number, duration: number, volume: number): void => {
    const ctx = getContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(frequency, now)
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(frequency, now)
      filter.Q.setValueAtTime(4, now)
      gain.gain.setValueAtTime(volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.onended = () => {
        osc.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
      osc.start(now)
      osc.stop(now + duration)
    } catch {
      // Unsupported or unavailable Web Audio implementations remain silent.
    }
  }
  return Object.freeze({
    cosmic,
    classic: {
      playMove: () => click(1000, 0.035, 0.2),
      playCapture: () => click(900, 0.045, 0.32),
      playCheck: () => click(1200, 0.04, 0.22),
      playGameEnd: (type: GameEndSound) =>
        click(type === 'win' ? 1200 : type === 'loss' ? 900 : 1050, 0.045, 0.25),
    },
  })
}
