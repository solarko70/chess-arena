import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRouteHash } from '@/router'
import { initApp, getRouter } from '@/main'
import { globalStore } from '@/state/store'
import { solarAudio } from '@/audio/solar-audio'
import { COLOR_THEME_STORAGE_KEY } from '@/ui/settings'

describe('Settings navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    solarAudio.setMuted(false)
    window.location.hash = '#/'
    document.documentElement.removeAttribute('data-theme')
    document.body.innerHTML = '<div id="app"></div>'
    globalStore.newGame(undefined, { mode: 'pvp' })
    initApp()
  })

  afterEach(() => {
    getRouter()?.destroy()
    document.body.innerHTML = ''
    document.body.classList.remove('settings-active')
    document.documentElement.removeAttribute('data-theme')
    solarAudio.setMuted(false)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('recognizes settings hashes and preserves existing routes', () => {
    expect(['#/settings', '#settings', '#/SETTINGS'].map(parseRouteHash)).toEqual(['settings', 'settings', 'settings'])
    expect(['#/', '#/game', '#/analysis', '#/unknown'].map(parseRouteHash))
      .toEqual(['home', 'game', 'analysis', 'home'])
  })

  it('opens settings from the SVG header button and returns home', () => {
    const button = document.getElementById('settings-btn')!
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    button.click()
    expect(window.location.hash).toBe('#/settings')
    expect(document.getElementById('screen-settings')?.style.display).toBe('flex')
    expect(document.getElementById('screen-home')?.style.display).toBe('none')
    document.getElementById('settings-back')?.click()
    expect(window.location.hash).toBe('#/')
    expect(document.getElementById('screen-settings')?.style.display).toBe('none')
    expect(document.getElementById('screen-home')?.style.display).toBe('flex')
  })

  it('opens settings through a direct hash change and restores saved appearance', () => {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, 'light')
    window.location.hash = '#/settings'
    initApp()
    expect(document.getElementById('screen-settings')?.classList.contains('active')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.querySelector('[data-color-theme="light"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps header appearance and sound controls synchronized with settings', () => {
    document.getElementById('settings-btn')?.click()
    document.querySelector<HTMLButtonElement>('[data-color-theme="light"]')!.click()
    expect(document.getElementById('theme-btn')?.getAttribute('aria-label')).toBe('Светлая тема')
    document.getElementById('theme-btn')?.click()
    expect(document.querySelector('[data-color-theme="dark"]')?.getAttribute('aria-pressed')).toBe('true')
    document.getElementById('settings-sound-toggle')?.click()
    expect(document.getElementById('sound-btn')?.classList.contains('muted')).toBe(true)
    document.getElementById('sound-btn')?.click()
    expect(document.getElementById('settings-sound-toggle')?.getAttribute('aria-checked')).toBe('true')
  })

  it('preserves the game position and mounted clocks while visiting settings', () => {
    globalStore.makeMove(52, 36)
    const fen = globalStore.getState()
    getRouter()?.navigate('game')
    document.getElementById('settings-btn')?.click()
    getRouter()?.navigate('game')
    expect(globalStore.getState()).toBe(fen)
    expect(document.getElementById('clock-mount')).not.toBeNull()
    expect(document.getElementById('clock-mount')?.style.display).not.toBe('none')
    expect(document.querySelector('.clock-select')).not.toBeNull()
  })
})
