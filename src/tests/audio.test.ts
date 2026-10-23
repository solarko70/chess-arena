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

  it('previews the requested theme without persisting it and respects mute', () => {
    const audio = new SolarAudio()
    audio.setSoundTheme('cosmic')
    const capture = vi.spyOn(audio.themes.classic, 'playCapture')
    audio.previewSoundTheme('classic')
    expect(capture).toHaveBeenCalledOnce()
    expect(audio.getSoundTheme()).toBe('cosmic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('cosmic')
    audio.setMuted(true)
    audio.previewSoundTheme('classic')
    expect(capture).toHaveBeenCalledOnce()
  })

  it('does not launch the home drone when audio is unlocked on settings', () => {
    const screens = document.createElement('div')
    screens.innerHTML = '<div id="screen-home" style="display: none"></div><div id="screen-game"></div><div id="screen-settings" class="active"></div>'
    document.body.appendChild(screens)
    const audio = new SolarAudio()
    const createGain = vi.fn()
    audio.setContextForTesting({ state: 'running', createGain } as unknown as AudioContext)
    const wasHomeActive = document.body.classList.contains('home-active')
    document.body.classList.remove('home-active')
    try {
      window.dispatchEvent(new Event('pointerdown'))
      expect(createGain).not.toHaveBeenCalled()
      expect(audio.isAmbientPlaying()).toBe(false)
    } finally {
      screens.remove()
      document.body.classList.toggle('home-active', wasHomeActive)
      audio.setContextForTesting(null)
    }
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
    expect(oscillators).toHaveLength(18)
    filters.forEach((node) => {
      expect(node.type).toBe('lowpass')
      expect(node.frequency.setValueAtTime).toHaveBeenCalledWith(700, 10)
      expect(node.Q.setValueAtTime).toHaveBeenCalledWith(0.65, 10)
    })
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(400, 10)
    expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(180, 10.05)
    expect(oscillators[0].stop).toHaveBeenCalledWith(10.06)
    expect(oscillators[1].type).toBe('sine')
    expect(oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(200, 10)
    expect(oscillators[2].stop).toHaveBeenCalledWith(10.005)
    expect(oscillators[3].frequency.setValueAtTime).toHaveBeenCalledWith(260, 10)
    expect(oscillators[4].frequency.setValueAtTime).toHaveBeenCalledWith(140, 10)
    expect(oscillators[3].stop).toHaveBeenCalledWith(10.07)
    expect(oscillators[4].stop).toHaveBeenCalledWith(10.07)
    oscillators.forEach((node, index) => {
      const duration = node.stop.mock.calls[0][0] - 10
      expect(duration).toBeGreaterThanOrEqual(index % 3 === 2 ? 0.004 : 0.05)
      expect(duration).toBeLessThanOrEqual(index % 3 === 2 ? 0.006 : 0.0701)
      node.onended?.()
      expect(node.disconnect).toHaveBeenCalledOnce()
    })
    audio.startMenuAmbient()
    expect(audio.isAmbientPlaying()).toBe(false)
    audio.setMuted(true)
    audio.playCapture()
    expect(oscillators).toHaveLength(18)
  })
})
