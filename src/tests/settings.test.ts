import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SolarAudio } from '@/audio/solar-audio'
import { SOUND_THEME_STORAGE_KEY } from '@/audio/sound-theme'
import { SettingsUI, COLOR_THEME_STORAGE_KEY, getColorTheme } from '@/ui/settings'

describe('Settings screen', () => {
  let container: HTMLElement
  let audio: SolarAudio
  let onBack: ReturnType<typeof vi.fn>
  let onThemeChange: ReturnType<typeof vi.fn>
  let onSoundChange: ReturnType<typeof vi.fn>
  const button = (selector: string) => container.querySelector<HTMLButtonElement>(selector)!

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    container = document.createElement('div')
    document.body.appendChild(container)
    audio = new SolarAudio()
    onBack = vi.fn()
    onThemeChange = vi.fn()
    onSoundChange = vi.fn()
    new SettingsUI(container, { audio, onBack, onThemeChange, onSoundChange })
  })

  afterEach(() => {
    container.remove()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('renders audio, appearance and language sections with the current choices', () => {
    expect(container.querySelector('h1')?.textContent).toBe('Настройки')
    expect([...container.querySelectorAll('h2')].map((el) => el.textContent))
      .toEqual(['Аудио', 'Оформление', 'Язык'])
    expect(button('[data-sound-theme="cosmic"]').getAttribute('aria-pressed')).toBe('true')
    expect(button('[data-color-theme="dark"]').getAttribute('aria-pressed')).toBe('true')
    expect(button('[data-piece-set="classic"]').getAttribute('aria-pressed')).toBe('true')
    expect(button('[data-piece-set="solar"]').disabled).toBe(true)
    expect(button('[data-piece-set="solar"]').textContent).toContain('Скоро')
    expect([...container.querySelectorAll('button:disabled')].some((el) => el.textContent?.includes('English'))).toBe(true)
  })

  it('selects and persists both sound themes without replacing the controls', () => {
    const classic = button('[data-sound-theme="classic"]')
    classic.click()
    expect(audio.getSoundTheme()).toBe('classic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('classic')
    expect(classic.getAttribute('aria-pressed')).toBe('true')
    button('[data-sound-theme="cosmic"]').click()
    expect(audio.getSoundTheme()).toBe('cosmic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('cosmic')
    expect(classic.getAttribute('aria-pressed')).toBe('false')
    expect(classic.isConnected).toBe(true)
  })

  it('previews a theme without selecting it or changing the saved preference', () => {
    audio.setSoundTheme('cosmic')
    const preview = vi.spyOn(audio, 'previewSoundTheme')
    const capture = vi.spyOn(audio.themes.classic, 'playCapture')
    button('[data-preview-theme="classic"]').click()
    expect(preview).toHaveBeenCalledWith('classic')
    expect(capture).toHaveBeenCalledOnce()
    expect(audio.getSoundTheme()).toBe('cosmic')
    expect(localStorage.getItem(SOUND_THEME_STORAGE_KEY)).toBe('cosmic')
    expect(audio.ensureContext()).toBeNull()
  })

  it('persists global mute and disables previews until sound is enabled', () => {
    const toggle = button('#settings-sound-toggle')
    toggle.click()
    expect(audio.isMuted()).toBe(true)
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('true')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(button('[data-preview-theme="classic"]').disabled).toBe(true)
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Звук выключен')
    toggle.click()
    expect(localStorage.getItem('solar_chess_sound_muted')).toBe('false')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(button('[data-preview-theme="classic"]').disabled).toBe(false)
    expect(onSoundChange).toHaveBeenCalledTimes(2)
  })

  it('applies and persists light and dark appearance', () => {
    button('[data-color-theme="light"]').click()
    expect(getColorTheme()).toBe('light')
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe('light')
    expect(button('[data-color-theme="light"]').getAttribute('aria-pressed')).toBe('true')
    button('[data-color-theme="dark"]').click()
    expect(getColorTheme()).toBe('dark')
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe('dark')
    expect(onThemeChange).toHaveBeenCalledTimes(2)
  })

  it('restores saved sound and color themes when the screen is reopened', () => {
    button('[data-sound-theme="classic"]').click()
    button('[data-color-theme="light"]').click()
    document.documentElement.removeAttribute('data-theme')
    const second = document.createElement('div')
    new SettingsUI(second, { audio: new SolarAudio(), onBack })
    expect(getColorTheme()).toBe('light')
    expect(second.querySelector('[data-sound-theme="classic"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(second.querySelector('[data-color-theme="light"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('returns to the home route through its back control', () => {
    const back = container.querySelector<HTMLAnchorElement>('#settings-back')!
    expect(back.getAttribute('href')).toBe('#/')
    back.click()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps controls functional when localStorage writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    expect(() => {
      button('[data-sound-theme="classic"]').click()
      button('[data-color-theme="light"]').click()
      button('#settings-sound-toggle').click()
    }).not.toThrow()
    expect(audio.getSoundTheme()).toBe('classic')
    expect(audio.isMuted()).toBe(true)
    expect(getColorTheme()).toBe('light')
  })
})
