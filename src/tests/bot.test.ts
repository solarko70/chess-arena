import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEVELS, LEVEL_ORDER, findBestMove } from '@/ai';
import * as api from '@/ai/api';
import { MAX_DEPTH } from '@/ai/search';
import { parseFEN } from '@/core';
import { GameSetupModalUI } from '@/ui/setupmodals';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('Eight bot difficulties', () => {
  it('shows eight named cards with Elo in a two-column, four-row grid', () => {
    const mount = document.createElement('div');
    const modal = new GameSetupModalUI(mount, vi.fn());
    try {
      modal.open('bot');
      expect(Object.keys(LEVELS)).toHaveLength(8);
      expect(mount.querySelectorAll('.bot-grid .setup-level-card')).toHaveLength(8);
      expect(Array.from(mount.querySelectorAll('.setup-level-name'), (el) => el.textContent)).toEqual([
        'Новичок', 'Ученик', 'Любитель', 'Клубный', 'Кандидат', 'Эксперт', 'Мастер', 'Сингулярность',
      ]);
      expect(Array.from(mount.querySelectorAll('.setup-level-elo'), (el) => el.textContent)).toEqual([
        '400 Elo', '800 Elo', '1000 Elo', '1200 Elo', '1500 Elo', '1900 Elo', '2300 Elo', '2700+ Elo',
      ]);
      const css = readFileSync(resolve(__dirname, '../ui/styles.css'), 'utf8');
      expect(css).toMatch(/\.setup-level-cards\s*\{[^}]*display:\s*grid/);
      expect(css).toMatch(/\.setup-level-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2, 1fr\)/);
      expect(css).toMatch(/\.setup-level-cards\s*\{[^}]*gap:\s*8px 10px/);
    } finally {
      modal.destroy();
    }
  });

  it.each(LEVEL_ORDER)('starts a game with the selected level: %s', (id) => {
    const mount = document.createElement('div');
    const onStart = vi.fn();
    const modal = new GameSetupModalUI(mount, onStart);
    try {
      modal.open('bot');
      mount.querySelector<HTMLButtonElement>(`[data-level-id="${id}"]`)!.click();
      expect(mount.querySelectorAll('.setup-level-card.selected')).toHaveLength(1);
      expect(mount.querySelector(`[data-level-id="${id}"]`)?.getAttribute('aria-pressed')).toBe('true');
      mount.querySelector<HTMLButtonElement>('#btn-setup-start')!.click();
      expect(onStart).toHaveBeenCalledWith({
        mode: 'ai', level: id, timeControl: 'rapid-10-0', playerColor: 'white',
      });
      modal.open('bot');
      expect(mount.querySelector('.setup-level-card.selected')?.getAttribute('data-level-id')).toBe(id);
    } finally {
      modal.destroy();
    }
  });

  it.each(LEVEL_ORDER)('passes the search budget and sampling parameters: %s', (id) => {
    const analyze = vi.spyOn(api, 'analyzePosition').mockReturnValue({
      bestMove: null, score: { type: 'cp', value: 0 }, pv: [], lines: [],
      depth: 0, nodes: 0, timeMs: 0,
    });
    const cfg = LEVELS[id];
    findBestMove(parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), id);
    expect(analyze).toHaveBeenCalledWith(expect.anything(), {
      depth: cfg.depth, nodes: cfg.maxNodes, quiescence: cfg.quiescence,
      timeMs: cfg.maxNodes === undefined ? cfg.timeMs : undefined,
      multiPV: cfg.blunderChance > 0 ? Math.max(cfg.topMoves, 10) : cfg.topMoves,
    });
  });

  it('increases budgets and decreases deliberate errors across the rating scale', () => {
    expect(LEVEL_ORDER.map((id) => LEVELS[id].elo)).toEqual([400, 800, 1000, 1200, 1500, 1900, 2300, 2700]);
    for (let i = 1; i < LEVEL_ORDER.length; i++) {
      const prev = LEVELS[LEVEL_ORDER[i - 1]];
      const next = LEVELS[LEVEL_ORDER[i]];
      expect(next.depth).toBeGreaterThanOrEqual(prev.depth);
      expect(next.maxNodes ?? Infinity).toBeGreaterThanOrEqual(prev.maxNodes ?? Infinity);
      expect(next.timeMs).toBeGreaterThan(prev.timeMs);
      expect(next.temperature).toBeLessThanOrEqual(prev.temperature);
      expect(next.blunderChance).toBeLessThanOrEqual(prev.blunderChance);
    }
    expect(LEVELS.singularity.depth).toBe(MAX_DEPTH);
    expect(LEVELS.singularity.maxNodes).toBeUndefined();
    expect(LEVELS.singularity.temperature).toBe(0);
    expect(LEVELS.singularity.blunderChance).toBe(0);
  });
});
