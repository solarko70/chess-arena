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
  const woodThud = (frequency: number, bodyFrequency: number, duration: number, volume: number, double = false, check = false): void => {
    const ctx = getContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1100, now)
      filter.Q.setValueAtTime(0.65, now)
      filter.connect(ctx.destination)
      const taps = double ? [0, 0.015] : [0]
      let remaining = taps.length * 3
      const release = () => { if (--remaining === 0) filter.disconnect() }
      const contactLength = 0.004
      const sampleRate = ctx.sampleRate
      const contactBuffer = ctx.createBuffer(1, Math.ceil(sampleRate * contactLength), sampleRate)
      const samples = contactBuffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length)
      }
      for (const offset of taps) {
        const start = now + offset
        const tapVolume = offset === 0 ? volume : volume * 0.8
        // A filtered noise impulse gives lacquered wood a brief, non-tonal contact click.
        const contact = ctx.createBufferSource()
        contact.buffer = contactBuffer
        const bandpass = ctx.createBiquadFilter()
        bandpass.type = 'bandpass'
        bandpass.frequency.setValueAtTime(2100, start)
        bandpass.Q.setValueAtTime(2, start)
        const contactGain = ctx.createGain()
        contactGain.gain.setValueAtTime(tapVolume * 0.5, start)
        contactGain.gain.exponentialRampToValueAtTime(0.0001, start + contactLength)
        contact.connect(bandpass)
        bandpass.connect(contactGain)
        contactGain.connect(filter)
        contact.onended = () => {
          contact.disconnect()
          bandpass.disconnect()
          contactGain.disconnect()
          release()
        }
        contact.start(start)
        contact.stop(start + contactLength)
        const voices: { type: OscillatorType; start: number; end: number; gain: number }[] = [
          { type: 'triangle', start: offset === 0 ? frequency : 130, end: check ? 160 : double ? 90 : 100, gain: tapVolume * 0.6 },
          { type: 'sine', start: bodyFrequency, end: check ? bodyFrequency : bodyFrequency * 0.8, gain: tapVolume * 0.45 },
        ]
        for (const voice of voices) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = voice.type
          osc.frequency.setValueAtTime(voice.start, start)
          osc.frequency.exponentialRampToValueAtTime(voice.end, start + (check ? 0.04 : 0.048))
          const voiceDuration = check && voice.type === 'triangle' ? 0.06 : duration
          gain.gain.setValueAtTime(0, start)
          gain.gain.linearRampToValueAtTime(voice.gain, start + 0.001)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + voiceDuration)
          gain.gain.setValueAtTime(0, start + voiceDuration)
          osc.connect(gain)
          gain.connect(filter)
          osc.onended = () => {
            osc.disconnect()
            gain.disconnect()
            release()
          }
          osc.start(start)
          osc.stop(start + voiceDuration)
        }
      }
    } catch {
      // Unsupported or unavailable Web Audio implementations remain silent.
    }
  }
  return Object.freeze({
    cosmic,
    classic: {
      playMove: () => woodThud(240, 120, 0.06, 0.45),
      playCapture: () => woodThud(180, 80, 0.065, 0.6, true),
      playCheck: () => woodThud(380, 710, 0.14, 0.48, false, true),
      playGameEnd: (type: GameEndSound) => cosmic.playGameEnd(type),
    },
  })
}
