import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SolarAudio, type SoundTheme } from '@/audio/solar-audio'
import { SOUND_THEME_STORAGE_KEY } from '@/audio/sound-theme'

describe('Sound themes', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('provides both themes implementing the SoundTheme contract', () => {
    const audio = new SolarAudio()
    const verifyTheme = (theme: SoundTheme) => {
      expect(typeof theme.playMove).toBe('function')
      expect(typeof theme.playCapture).toBe('function')
      expect(typeof theme.playCheck).toBe('function')
      for (const type of ['win', 'loss', 'draw'] as const) {
        expect(() => theme.playGameEnd(type)).not.toThrow()
      }
    }
    verifyTheme(audio.themes.cosmic)
    verifyTheme(audio.themes.classic)
    expect(audio.getSoundTheme()).toBe('cosmic')
  })

  it('persists and restores cosmic and classic selections', () => {
    const audio = new SolarAudio()
    audio.setSoundTheme('classic')
    expect(audio.getSoundTheme()).toBe('classic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('classic')
    expect(new SolarAudio().getSoundTheme()).toBe('classic')
    audio.setSoundTheme('cosmic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('cosmic')
    expect(new SolarAudio().getSoundTheme()).toBe('cosmic')
  })

  it('uses cosmic for invalid storage and tolerates unavailable storage', () => {
    localStorage.setItem(SOUND_THEME_STORAGE_KEY, 'unknown')
    expect(new SolarAudio().getSoundTheme()).toBe('cosmic')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    const audio = new SolarAudio()
    expect(() => audio.setSoundTheme('classic')).not.toThrow()
    expect(audio.getSoundTheme()).toBe('classic')
  })

  it('routes game events through the selected theme and remains silent in JSDOM', () => {
    const audio = new SolarAudio()
    for (const id of ['classic', 'cosmic'] as const) {
      audio.setSoundTheme(id)
      expect(audio.ensureContext()).toBeNull()
      const theme = audio.themes[id]
      const move = vi.spyOn(theme, 'playMove')
      const capture = vi.spyOn(theme, 'playCapture')
      const check = vi.spyOn(theme, 'playCheck')
      const end = vi.spyOn(theme, 'playGameEnd')
      audio.playMove()
      audio.playCapture()
      audio.playCheck()
      audio.playGameEnd('draw')
      audio.playCheckmate()
      expect(move).toHaveBeenCalledOnce()
      expect(capture).toHaveBeenCalledOnce()
      expect(check).toHaveBeenCalledOnce()
      expect(end.mock.calls).toEqual([['draw'], ['loss']])
    }
  })

  it('synthesizes dry classic impulses within the frequency and duration limits', () => {
    const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
    const oscillators: ReturnType<typeof oscillator>[] = []
    const filters: ReturnType<typeof filter>[] = []
    const oscillator = () => ({
      type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
    })
    const filter = () => ({ type: '', frequency: param(), Q: param(), connect: vi.fn(), disconnect: vi.fn() })
    const ctx = {
      currentTime: 10, state: 'running', destination: {},
      createOscillator: vi.fn(() => { const node = oscillator(); oscillators.push(node); return node }),
      createBiquadFilter: vi.fn(() => { const node = filter(); filters.push(node); return node }),
      createGain: vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })),
    }
    const audio = new SolarAudio()
    audio.setContextForTesting(ctx as unknown as AudioContext)
    audio.setSoundTheme('classic')
    audio.playMove()
    audio.playCapture()
    audio.playCheck()
    audio.playGameEnd('win')
    audio.playGameEnd('loss')
    audio.playGameEnd('draw')
    expect(oscillators).toHaveLength(6)
    filters.forEach((node) => {
      expect(node.type).toBe('bandpass')
      expect(node.frequency.setValueAtTime.mock.calls[0][0]).toBeGreaterThanOrEqual(900)
      expect(node.frequency.setValueAtTime.mock.calls[0][0]).toBeLessThanOrEqual(1200)
    })
    oscillators.forEach((node) => {
      const duration = node.stop.mock.calls[0][0] - 10
      expect(duration).toBeGreaterThanOrEqual(0.03)
      expect(duration).toBeLessThanOrEqual(0.0451)
      node.onended?.()
      expect(node.disconnect).toHaveBeenCalledOnce()
    })
    audio.startMenuAmbient()
    expect(audio.isAmbientPlaying()).toBe(false)
    audio.setMuted(true)
    audio.playCapture()
    expect(oscillators).toHaveLength(6)
  })
})
