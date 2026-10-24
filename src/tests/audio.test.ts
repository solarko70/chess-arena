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

  it.each(['cosmic', 'classic'] as const)('keeps the menu drone independent of the %s theme', (theme) => {
    vi.useFakeTimers()
    localStorage.setItem(SOUND_THEME_STORAGE_KEY, theme)
    const sources: { stop: ReturnType<typeof vi.fn> }[] = []
    const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() })
    const ctx = {
      currentTime: 10, state: 'running', destination: {},
      createGain: vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })),
      createOscillator: vi.fn(() => {
        const node = { type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
        sources.push(node)
        return node
      }),
    }
    const audio = new SolarAudio()
    audio.setContextForTesting(ctx as unknown as AudioContext)
    try {
      audio.startMenuAmbient()
      expect(audio.isAmbientPlaying()).toBe(true)
      for (const id of ['classic', 'cosmic', 'classic'] as const) {
        audio.setSoundTheme(id)
        expect(audio.isAmbientPlaying()).toBe(true)
        expect(audio.getIsAmbientRequested()).toBe(true)
      }
      expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
      sources.forEach((node) => expect(node.stop).not.toHaveBeenCalled())
      audio.setMuted(true)
      vi.advanceTimersByTime(150)
      expect(audio.isAmbientPlaying()).toBe(false)
      sources.forEach((node) => expect(node.stop).toHaveBeenCalledOnce())
      audio.startMenuAmbient()
      expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
      audio.setMuted(false)
      audio.startMenuAmbient()
      expect(audio.isAmbientPlaying()).toBe(true)
      expect(ctx.createOscillator).toHaveBeenCalledTimes(8)
      audio.stopMenuAmbient(0)
      vi.advanceTimersByTime(50)
      expect(audio.isAmbientPlaying()).toBe(false)
    } finally {
      audio.setContextForTesting(null)
      vi.clearAllTimers()
      vi.useRealTimers()
    }
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
    const param = () => ({
      setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    })
    const oscillators: ReturnType<typeof oscillator>[] = []
    const filters: ReturnType<typeof filter>[] = []
    const contacts: ReturnType<typeof contact>[] = []
    const gains: ReturnType<typeof gain>[] = []
    const oscillator = () => ({
      type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
    })
    const filter = () => ({ type: '', frequency: param(), Q: param(), connect: vi.fn(), disconnect: vi.fn() })
    const contact = () => ({
      buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      onended: null as (() => void) | null,
    })
    const gain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })
    const ctx = {
      currentTime: 10, state: 'running', destination: {}, sampleRate: 48000,
      createOscillator: vi.fn(() => { const node = oscillator(); oscillators.push(node); return node }),
      createBiquadFilter: vi.fn(() => { const node = filter(); filters.push(node); return node }),
      createGain: vi.fn(() => { const node = gain(); gains.push(node); return node }),
      createBuffer: vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
      createBufferSource: vi.fn(() => { const node = contact(); contacts.push(node); return node }),
    }
    const audio = new SolarAudio()
    audio.setContextForTesting(ctx as unknown as AudioContext)
    audio.setSoundTheme('classic')
    const finale = vi.spyOn(audio.themes.cosmic, 'playGameEnd').mockImplementation(() => {})
    audio.playMove()
    audio.playCapture()
    audio.playCheck()
    audio.playGameEnd('win')
    audio.playGameEnd('loss')
    audio.playGameEnd('draw')
    expect(finale.mock.calls).toEqual([['win'], ['loss'], ['draw']])
    expect(oscillators).toHaveLength(8)
    const lowpasses = filters.filter((node) => node.type === 'lowpass')
    expect(lowpasses).toHaveLength(3)
    lowpasses.forEach((node) => {
      expect(node.frequency.setValueAtTime).toHaveBeenCalledWith(1100, 10)
      expect(node.Q.setValueAtTime).toHaveBeenCalledWith(0.65, 10)
      expect(node.connect).toHaveBeenCalledWith(ctx.destination)
    })
    const bandpasses = filters.filter((node) => node.type === 'bandpass')
    expect(bandpasses).toHaveLength(4)
    bandpasses.forEach((node, index) => {
      const start = index === 2 ? 10.015 : 10
      expect(node.frequency.setValueAtTime).toHaveBeenCalledWith(2100, start)
      expect(node.Q.setValueAtTime).toHaveBeenCalledWith(2, start)
    })
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 192, 48000)
    expect(contacts).toHaveLength(4)
    contacts.forEach((node, index) => {
      const start = index === 2 ? 10.015 : 10
      expect(node.start).toHaveBeenCalledWith(start)
      expect(node.stop).toHaveBeenCalledWith(start + 0.004)
      expect(node.connect).toHaveBeenCalledWith(bandpasses[index])
      node.onended?.()
      expect(node.disconnect).toHaveBeenCalledOnce()
      expect(bandpasses[index].disconnect).toHaveBeenCalledOnce()
    })
    expect(oscillators[0].type).toBe('triangle')
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(240, 10)
    expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(100, 10.048)
    expect(oscillators[0].stop).toHaveBeenCalledWith(10.06)
    expect(oscillators[1].type).toBe('sine')
    expect(oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(120, 10)
    expect(oscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(180, 10)
    expect(oscillators[2].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(90, 10.048)
    expect(oscillators[3].frequency.setValueAtTime).toHaveBeenCalledWith(80, 10)
    expect(oscillators[4].frequency.setValueAtTime).toHaveBeenCalledWith(130, 10.015)
    expect(oscillators[4].start).toHaveBeenCalledWith(10.015)
    expect(oscillators[4].stop).toHaveBeenCalledWith(10.015 + 0.065)
    const bodies = gains.filter((node) => node.gain.linearRampToValueAtTime.mock.calls.length)
    expect(bodies).toHaveLength(8)
    expect(bodies[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.45 * 0.6, 10.001)
    expect(bodies[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6 * 0.6, 10.001)
    oscillators.forEach((node, index) => {
      const start = node.start.mock.calls[0][0]
      const end = node.stop.mock.calls[0][0]
      expect(end - start).toBeGreaterThanOrEqual(0.05)
      expect(end - start).toBeLessThanOrEqual(0.0651)
      expect(bodies[index].gain.setValueAtTime).toHaveBeenCalledWith(0, start)
      expect(bodies[index].gain.linearRampToValueAtTime.mock.calls[0][1]).toBe(start + 0.001)
      expect(bodies[index].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, end)
      expect(bodies[index].gain.setValueAtTime).toHaveBeenCalledWith(0, end)
      expect(bodies[index].connect).toHaveBeenCalledWith(lowpasses[index < 2 ? 0 : index < 6 ? 1 : Math.floor(index / 2) - 1])
      node.onended?.()
      expect(node.disconnect).toHaveBeenCalledOnce()
      expect(bodies[index].disconnect).toHaveBeenCalledOnce()
    })
    lowpasses.forEach((node) => expect(node.disconnect).toHaveBeenCalledOnce())
    audio.startMenuAmbient()
    expect(audio.isAmbientPlaying()).toBe(true)
    const count = oscillators.length
    audio.stopMenuAmbient(0)
    audio.setMuted(true)
    audio.playCapture()
    expect(oscillators).toHaveLength(count)
  })

  it.each(['classic', 'cosmic'] as const)('synthesizes the cosmic finale for the %s theme', (theme) => {
    const param = () => ({
      setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    })
    const oscillator = () => ({
      type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      onended: null as (() => void) | null,
    })
    const gain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })
    const filter = () => ({ type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn() })
    const oscillators: ReturnType<typeof oscillator>[] = []
    const gains: ReturnType<typeof gain>[] = []
    const filters: ReturnType<typeof filter>[] = []
    const ctx = {
      state: 'running', currentTime: 10, destination: {},
      createOscillator: vi.fn(() => { const node = oscillator(); oscillators.push(node); return node }),
      createGain: vi.fn(() => { const node = gain(); gains.push(node); return node }),
      createBiquadFilter: vi.fn(() => { const node = filter(); filters.push(node); return node }),
    }
    const audio = new SolarAudio()
    audio.setContextForTesting(ctx as unknown as AudioContext)
    audio.setSoundTheme(theme)
    const cosmic = vi.spyOn(audio.themes.cosmic, 'playGameEnd')
    for (const type of ['win', 'loss', 'draw', 'checkmate'] as const) {
      oscillators.length = gains.length = filters.length = 0
      if (type === 'checkmate') audio.playCheckmate()
      else audio.playGameEnd(type)
      expect(cosmic).toHaveBeenLastCalledWith(type === 'checkmate' ? 'loss' : type)
      expect(oscillators).toHaveLength(4)
      expect(filters[0].type).toBe('lowpass')
      expect(filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(800, 10)
      expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.35, 10.05)
      expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 11.3)
      expect(oscillators[0].type).toBe('sine')
      expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(65.4, 10)
      expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(40, 10.7)
      const frequencies = type === 'win' ? [261.63, 329.63, 392]
        : type === 'draw' ? [196, 261.63, 392] : [130.81, 196, 329.63]
      oscillators.slice(1).forEach((node, index) => {
        expect(node.type).toBe('triangle')
        expect(node.frequency.setValueAtTime).toHaveBeenCalledWith(frequencies[index], 10)
      })
      oscillators.forEach((node) => {
        expect(node.start).toHaveBeenCalledWith(10)
        expect(node.stop).toHaveBeenCalledWith(11.3)
        node.onended?.()
        expect(node.disconnect).toHaveBeenCalledOnce()
      })
      filters.forEach((node) => expect(node.disconnect).toHaveBeenCalledOnce())
      gains.forEach((node) => expect(node.disconnect).toHaveBeenCalledOnce())
    }
    const count = ctx.createOscillator.mock.calls.length
    audio.setMuted(true)
    audio.playCheckmate()
    audio.playGameEnd('win')
    expect(ctx.createOscillator).toHaveBeenCalledTimes(count)
    audio.setContextForTesting(null)
  })
})
