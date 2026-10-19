/**
 * ECO opening database and Trie-based identifier for chess game reviews.
 * Maps move sequences (SAN tokens) to ECO codes and Russian opening names.
 */

import type { GameState, Move } from '@/core';
import { classicalRuleSet, moveToSAN, applyMove } from '@/core';

export interface OpeningEntry {
  readonly eco: string;
  readonly name: string;
  readonly moves: readonly string[];
}

export interface IdentifiedOpening {
  readonly eco: string;
  readonly name: string;
  readonly plies: number;
}

interface TrieNode {
  readonly children: Map<string, TrieNode>;
  eco?: string;
  name?: string;
  plies?: number;
}

/**
 * Normalize SAN string for robust Trie lookup:
 * - strips check/mate/evaluation suffixes (+, #, ?, !)
 * - normalizes 0-0 to O-O
 * - trims whitespace
 */
export function normalizeSAN(san: string): string {
  return san
    .replace(/[+#?!]/g, '')
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O')
    .trim();
}

/**
 * Complete opening database containing 130+ standard openings and main variations.
 */
export const OPENING_DATABASE: readonly OpeningEntry[] = [
  // ── Open Games (C20-C99) ──────────────────────────────────────────────────
  { eco: 'C20', name: 'Открытый дебют', moves: ['e4', 'e5'] },
  { eco: 'C21', name: 'Центральный дебют', moves: ['e4', 'e5', 'd4', 'exd4'] },
  { eco: 'C21', name: 'Северный гамбит', moves: ['e4', 'e5', 'd4', 'exd4', 'c3'] },
  { eco: 'C23', name: 'Дебют слона', moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C24', name: 'Дебют слона: Берлинский вариант', moves: ['e4', 'e5', 'Bc4', 'Nf6'] },
  { eco: 'C25', name: 'Венская партия', moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'C26', name: 'Венская партия: Вариант Фалькбеера', moves: ['e4', 'e5', 'Nc3', 'Nf6'] },
  { eco: 'C27', name: 'Венская партия: Вариант Франкенштейна-Дракулы', moves: ['e4', 'e5', 'Nc3', 'Nf6', 'Bc4', 'Nxe4'] },
  { eco: 'C29', name: 'Венский гамбит', moves: ['e4', 'e5', 'Nc3', 'Nf6', 'f4'] },
  { eco: 'C30', name: 'Королевский гамбит', moves: ['e4', 'e5', 'f4'] },
  { eco: 'C30', name: 'Отказанный королевский гамбит', moves: ['e4', 'e5', 'f4', 'Bc5'] },
  { eco: 'C31', name: 'Контргамбит Фалькбеера', moves: ['e4', 'e5', 'f4', 'd5'] },
  { eco: 'C33', name: 'Принятый королевский гамбит', moves: ['e4', 'e5', 'f4', 'exd4'] },
  { eco: 'C34', name: 'Королевский гамбит: Гамбит коня', moves: ['e4', 'e5', 'f4', 'exd4', 'Nf3'] },
  { eco: 'C36', name: 'Королевский гамбит: Защита Каннингема', moves: ['e4', 'e5', 'f4', 'exd4', 'Nf3', 'Be7'] },
  { eco: 'C37', name: 'Королевский гамбит: Гамбит Муцио', moves: ['e4', 'e5', 'f4', 'exd4', 'Nf3', 'g5', 'Bc4', 'g4', 'O-O'] },
  { eco: 'C40', name: 'Дебют королевского коня', moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C40', name: 'Гамбит слона', moves: ['e4', 'e5', 'Nf3', 'd5'] },
  { eco: 'C40', name: 'Латышский гамбит', moves: ['e4', 'e5', 'Nf3', 'f5'] },
  { eco: 'C41', name: 'Защита Филидора', moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C42', name: 'Русская партия (Защита Петрова)', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C43', name: 'Русская партия: Современная атака', moves: ['e4', 'e5', 'Nf3', 'Nf6', 'd4'] },
  { eco: 'C44', name: 'Дебют Понциани', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'] },
  { eco: 'C44', name: 'Шотландский гамбит', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4'] },
  { eco: 'C45', name: 'Шотландская партия', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
  { eco: 'C45', name: 'Шотландская партия: Классический вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5'] },
  { eco: 'C45', name: 'Шотландская партия: Вариант Шмидта', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6'] },
  { eco: 'C46', name: 'Дебют трёх коней', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3'] },
  { eco: 'C47', name: 'Дебют четырёх коней', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C48', name: 'Дебют четырёх коней: Испанский вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5'] },
  { eco: 'C49', name: 'Дебют четырёх коней: Симметричный вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5', 'Bb4'] },
  { eco: 'C50', name: 'Итальянская партия', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C50', name: 'Защита двух коней', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C50', name: 'Венгерская партия', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7'] },
  { eco: 'C51', name: 'Гамбит Эванса', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'] },
  { eco: 'C52', name: 'Принятый гамбит Эванса', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5'] },
  { eco: 'C53', name: 'Итальянская партия: Вариант с c3', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'] },
  { eco: 'C54', name: 'Итальянская партия: Главный вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'] },
  { eco: 'C55', name: 'Защита двух коней: Современная атака', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd4', 'exd4', 'O-O'] },
  { eco: 'C57', name: 'Защита двух коней: Атака Тракслера', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'] },
  { eco: 'C57', name: 'Защита двух коней: Атака жареной печени', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7'] },
  { eco: 'C60', name: 'Испанская партия', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C61', name: 'Испанская партия: Вариант Берда', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nd4'] },
  { eco: 'C62', name: 'Испанская партия: Старая защита Стейница', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'd6'] },
  { eco: 'C63', name: 'Испанская партия: Гамбит Яниша', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'f5'] },
  { eco: 'C65', name: 'Испанская партия: Берлинская защита', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C66', name: 'Испанская партия: Берлинская защита, Закрытый вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'd6'] },
  { eco: 'C67', name: 'Испанская партия: Берлинский эндшпиль', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6', 'Bxc6', 'dxc6', 'dxe5', 'Nf5', 'Qxd8+', 'Kxd8'] },
  { eco: 'C68', name: 'Испанская партия: Разменный вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C70', name: 'Испанская партия: Открытая защита', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'] },
  { eco: 'C77', name: 'Испанская партия: Вариант с 4...Nf6', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'] },
  { eco: 'C78', name: 'Испанская партия: Вариант с 5.O-O', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'] },
  { eco: 'C80', name: 'Испанская партия: Открытый вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Nxe4'] },
  { eco: 'C84', name: 'Испанская партия: Закрытый вариант', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'] },
  { eco: 'C88', name: 'Испанская партия: Анти-Маршалл', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'a4'] },
  { eco: 'C89', name: 'Испанская партия: Атака Маршалла', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd5'] },
  { eco: 'C92', name: 'Испанская партия: Вариант Зайцева', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Bb7'] },
  { eco: 'C95', name: 'Испанская партия: Вариант Брейера', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8'] },
  { eco: 'C97', name: 'Испанская партия: Вариант Чигорина', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Na5'] },

  // ── Semi-Open Games (B00-B99 & C00-C19) ───────────────────────────────────
  { eco: 'B00', name: 'Дебют королевской пешки', moves: ['e4'] },
  { eco: 'B00', name: 'Защита Нимцовича', moves: ['e4', 'Nc6'] },
  { eco: 'B00', name: 'Защита Оуэна', moves: ['e4', 'b6'] },
  { eco: 'B00', name: 'Защита Святого Георгия', moves: ['e4', 'a6'] },
  { eco: 'B01', name: 'Скандинавская защита', moves: ['e4', 'd5'] },
  { eco: 'B01', name: 'Скандинавская защита: Главный вариант', moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'] },
  { eco: 'B01', name: 'Скандинавская защита: Вариант с 3...Qd6', moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd6'] },
  { eco: 'B01', name: 'Скандинавская защита: Современный вариант', moves: ['e4', 'd5', 'exd5', 'Nf6'] },
  { eco: 'B02', name: 'Защита Алехина', moves: ['e4', 'Nf6'] },
  { eco: 'B03', name: 'Защита Алехина: Вариант четырёх пешек', moves: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'c4', 'Nb6', 'f4'] },
  { eco: 'B04', name: 'Защита Алехина: Современный вариант', moves: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3'] },
  { eco: 'B06', name: 'Современная защита (Защита Робача)', moves: ['e4', 'g6'] },
  { eco: 'B07', name: 'Защита Пирца-Уфимцева', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B08', name: 'Защита Пирца-Уфимцева: Классическая система', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7'] },
  { eco: 'B09', name: 'Защита Пирца-Уфимцева: Австрийская атака', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O'] },
  { eco: 'B10', name: 'Защита Каро-Канн', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Защита Каро-Канн: Вариант продвижения', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B12', name: 'Защита Каро-Канн: Вариант продвижения, Линия с Bf5', moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'] },
  { eco: 'B13', name: 'Защита Каро-Канн: Разменный вариант', moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5'] },
  { eco: 'B14', name: 'Защита Каро-Канн: Атака Панова', moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'c4'] },
  { eco: 'B15', name: 'Защита Каро-Канн: Вариант Тартаковера', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nf6', 'Nxf6+', 'exf6'] },
  { eco: 'B17', name: 'Защита Каро-Канн: Вариант Смыслова', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nd7'] },
  { eco: 'B18', name: 'Защита Каро-Канн: Классический вариант', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'] },
  { eco: 'C00', name: 'Французская защита', moves: ['e4', 'e6'] },
  { eco: 'C01', name: 'Французская защита: Разменный вариант', moves: ['e4', 'e6', 'd4', 'd5', 'exd5', 'exd5'] },
  { eco: 'C02', name: 'Французская защита: Вариант продвижения', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C03', name: 'Французская защита: Вариант Тарраша', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'] },
  { eco: 'C05', name: 'Французская защита: Закрытый Тарраш', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2', 'Nf6', 'e5', 'Nfd7'] },
  { eco: 'C07', name: 'Французская защита: Открытый Тарраш', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2', 'c5'] },
  { eco: 'C10', name: 'Французская защита: Вариант Рубинштейна', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'dxe4'] },
  { eco: 'C11', name: 'Французская защита: Классический вариант', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'C11', name: 'Французская защита: Атака Стейница', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'f4'] },
  { eco: 'C15', name: 'Французская защита: Вариант Винавера', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'] },
  { eco: 'C18', name: 'Французская защита: Вариант Винавера, Главный вариант', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+', 'bxc3'] },
  { eco: 'B20', name: 'Сицилианская защита', moves: ['e4', 'c5'] },
  { eco: 'B21', name: 'Сицилианская защита: Гамбит Морра', moves: ['e4', 'c5', 'd4', 'cxd4', 'c3'] },
  { eco: 'B22', name: 'Сицилианская защита: Вариант Алапина', moves: ['e4', 'c5', 'c3'] },
  { eco: 'B23', name: 'Сицилианская защита: Закрытый вариант', moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B27', name: 'Сицилианская защита: Вариант с ускоренным развитием дракона', moves: ['e4', 'c5', 'Nf3', 'g6'] },
  { eco: 'B30', name: 'Сицилианская защита: Атака Россолимо', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'B32', name: 'Сицилианская защита: Вариант Калашникова', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'e5', 'Nb5', 'd6'] },
  { eco: 'B33', name: 'Сицилианская защита: Вариант Свешникова', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'B33', name: 'Сицилианская защита: Свешников, Главный вариант', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5'] },
  { eco: 'B34', name: 'Сицилианская защита: Ускоренный дракон', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'] },
  { eco: 'B40', name: 'Сицилианская защита: Французский вариант', moves: ['e4', 'c5', 'Nf3', 'e6'] },
  { eco: 'B41', name: 'Сицилианская защита: Вариант Кана', moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6'] },
  { eco: 'B45', name: 'Сицилианская защита: Вариант Тайманова', moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6'] },
  { eco: 'B50', name: 'Сицилианская защита: Вариант с 2...d6', moves: ['e4', 'c5', 'Nf3', 'd6'] },
  { eco: 'B51', name: 'Сицилианская защита: Московский вариант', moves: ['e4', 'c5', 'Nf3', 'd6', 'Bb5+'] },
  { eco: 'B53', name: 'Сицилианская защита: Вариант Чеховера', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Qxd4'] },
  { eco: 'B54', name: 'Сицилианская защита: Открытый вариант', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4'] },
  { eco: 'B60', name: 'Сицилианская защита: Вариант Рихтера-Раузера', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'Nc6', 'Bg5'] },
  { eco: 'B70', name: 'Сицилианская защита: Вариант дракона', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B72', name: 'Сицилианская защита: Вариант дракона, Классическая система', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'Be2'] },
  { eco: 'B75', name: 'Сицилианская защита: Вариант дракона, Югославская атака', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3'] },
  { eco: 'B80', name: 'Сицилианская защита: Вариант Схевенингена', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6'] },
  { eco: 'B80', name: 'Сицилианская защита: Атака Кереса', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6', 'g4'] },
  { eco: 'B86', name: 'Сицилианская защита: Схевенинген, Атака Созина', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6', 'Bc4'] },
  { eco: 'B90', name: 'Сицилианская защита: Вариант Найдорфа', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B90', name: 'Сицилианская защита: Найдорф, Атака Адамса', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'h3'] },
  { eco: 'B90', name: 'Сицилианская защита: Найдорф, Английская атака', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3'] },
  { eco: 'B95', name: 'Сицилианская защита: Найдорф, Вариант 6.Bg5', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5'] },
  { eco: 'B96', name: 'Сицилианская защита: Найдорф, Вариант Полугаевского', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'b5'] },
  { eco: 'B97', name: 'Сицилианская защита: Найдорф, Вариант отравленной пешки', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'Qb6'] },

  // ── Closed Games (D00-D99) ────────────────────────────────────────────────
  { eco: 'D00', name: 'Дебют ферзевой пешки', moves: ['d4', 'd5'] },
  { eco: 'D00', name: 'Дебют ферзевой пешки: Каменная стена', moves: ['d4', 'd5', 'e3', 'Nf6', 'Bd3', 'c5', 'c3', 'Nc6', 'f4'] },
  { eco: 'D00', name: 'Гамбит Блэкмара-Димера', moves: ['d4', 'd5', 'e4', 'dxe4', 'Nc3'] },
  { eco: 'D02', name: 'Дебют ферзевой пешки: Лондонская система', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D02', name: 'Лондонская система: Вариант с c5', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'c5'] },
  { eco: 'D03', name: 'Дебют Торре', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bg5'] },
  { eco: 'D04', name: 'Дебют Колле', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'e3'] },
  { eco: 'D05', name: 'Дебют Колле-Цукерторта', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'e3', 'e6', 'Bd3', 'c5', 'b3'] },
  { eco: 'D06', name: 'Ферзевый гамбит', moves: ['d4', 'd5', 'c4'] },
  { eco: 'D07', name: 'Защита Чигорина', moves: ['d4', 'd5', 'c4', 'Nc6'] },
  { eco: 'D08', name: 'Контргамбит Альбина', moves: ['d4', 'd5', 'c4', 'e5'] },
  { eco: 'D10', name: 'Славянская защита', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'D11', name: 'Славянская защита: Вариант с 3.Nf3', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6'] },
  { eco: 'D12', name: 'Славянская защита: Вариант с 4...Bf5', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'e3', 'Bf5'] },
  { eco: 'D13', name: 'Славянская защита: Разменный вариант', moves: ['d4', 'd5', 'c4', 'c6', 'cxd5', 'cxd5'] },
  { eco: 'D15', name: 'Славянская защита: Чешский вариант', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5'] },
  { eco: 'D20', name: 'Принятый ферзевый гамбит', moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D22', name: 'Принятый ферзевый гамбит: Вариант Алехина', moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'a6'] },
  { eco: 'D27', name: 'Принятый ферзевый гамбит: Классический вариант', moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3', 'e6', 'Bxc4', 'c5', 'O-O', 'a6'] },
  { eco: 'D30', name: 'Отказанный ферзевый гамбит', moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D31', name: 'Полуславянская защита', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c6'] },
  { eco: 'D32', name: 'Защита Тарраша', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5'] },
  { eco: 'D35', name: 'Отказанный ферзевый гамбит: Разменный вариант', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5'] },
  { eco: 'D37', name: 'Отказанный ферзевый гамбит: Вариант с 4.Nf3', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3'] },
  { eco: 'D37', name: 'Отказанный ферзевый гамбит: Вариант с 5.Bf4', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7', 'Bf4'] },
  { eco: 'D43', name: 'Полуславянская защита: Вариант Ботвинника', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'Bg5', 'dxc4', 'e4', 'b5'] },
  { eco: 'D45', name: 'Полуславянская защита: Меранский вариант', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'e3', 'Nbd7', 'Bd3', 'dxc4', 'Bxc4', 'b5'] },
  { eco: 'D50', name: 'Отказанный ферзевый гамбит: Вариант с 4.Bg5', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'D51', name: 'Отказанный ферзевый гамбит: Защита Кембридж-Спрингс', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'e3', 'c6', 'Nf3', 'Qa5'] },
  { eco: 'D53', name: 'Отказанный ферзевый гамбит: Классический вариант', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3'] },
  { eco: 'D55', name: 'Отказанный ферзевый гамбит: Ортодоксальная защита', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'Nbd7'] },
  { eco: 'D60', name: 'Отказанный ферзевый гамбит: Вариант Рубинштейна', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'Nbd7', 'Qc2'] },
  { eco: 'D70', name: 'Защита Грюнфельда (вариант f3)', moves: ['d4', 'Nf6', 'c4', 'g6', 'f3', 'd5'] },
  { eco: 'D80', name: 'Защита Грюнфельда', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'D85', name: 'Защита Грюнфельда: Разменный вариант', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3'] },
  { eco: 'D90', name: 'Защита Грюнфельда: Система с 4.Nf3', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7'] },
  { eco: 'D97', name: 'Защита Грюнфельда: Российская система', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Qb3', 'dxc4', 'Qxc4', 'O-O', 'e4'] },

  // ── Indian Defenses & Flank (A00-A99 & E00-E99) ───────────────────────────
  { eco: 'A00', name: 'Дебют Ларсена', moves: ['b3'] },
  { eco: 'A00', name: 'Польский дебют (Дебют Сокольского)', moves: ['b4'] },
  { eco: 'A00', name: 'Дебют Гроба', moves: ['g4'] },
  { eco: 'A00', name: 'Дебют Ван Гейта', moves: ['Nc3'] },
  { eco: 'A00', name: 'Дебют Андерсена', moves: ['a3'] },
  { eco: 'A02', name: 'Дебют Бёрда', moves: ['f4'] },
  { eco: 'A03', name: 'Дебют Бёрда: Вариант с d5', moves: ['f4', 'd5'] },
  { eco: 'A04', name: 'Дебют Рети', moves: ['Nf3'] },
  { eco: 'A05', name: 'Дебют Рети: Староиндийское начало', moves: ['Nf3', 'Nf6', 'g3', 'g6', 'Bg2', 'Bg7', 'O-O', 'O-O', 'd3'] },
  { eco: 'A06', name: 'Дебют Рети: Вариант с 1...d5', moves: ['Nf3', 'd5'] },
  { eco: 'A09', name: 'Гамбит Рети', moves: ['Nf3', 'd5', 'c4'] },
  { eco: 'A10', name: 'Английское начало', moves: ['c4'] },
  { eco: 'A15', name: 'Английское начало: Англо-индийская система', moves: ['c4', 'Nf6'] },
  { eco: 'A16', name: 'Английское начало: Вариант с g3', moves: ['c4', 'Nf6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'g3'] },
  { eco: 'A20', name: 'Английское начало: Обратная сицилианская', moves: ['c4', 'e5'] },
  { eco: 'A22', name: 'Английское начало: Вариант четырёх коней', moves: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6'] },
  { eco: 'A30', name: 'Английское начало: Симметричный вариант', moves: ['c4', 'c5'] },
  { eco: 'A34', name: 'Английское начало: Симметричный, Вариант трёх коней', moves: ['c4', 'c5', 'Nc3', 'Nf6', 'g3', 'd5', 'cxd5', 'Nxd5', 'Bg2'] },
  { eco: 'A40', name: 'Дебют ферзевой пешки', moves: ['d4'] },
  { eco: 'A40', name: 'Английская защита', moves: ['d4', 'e6', 'c4', 'b6'] },
  { eco: 'A41', name: 'Староиндийская защита: Вариант Рагозина', moves: ['d4', 'd6'] },
  { eco: 'A43', name: 'Старый Бенони', moves: ['d4', 'c5'] },
  { eco: 'A45', name: 'Атака Тромповского', moves: ['d4', 'Nf6', 'Bg5'] },
  { eco: 'A46', name: 'Защита ферзевой пешки: Вариант Торре', moves: ['d4', 'Nf6', 'Nf3', 'e6', 'Bg5'] },
  { eco: 'A51', name: 'Будапештский гамбит', moves: ['d4', 'Nf6', 'c4', 'e5'] },
  { eco: 'A52', name: 'Принятый будапештский гамбит', moves: ['d4', 'Nf6', 'c4', 'e5', 'dxe5', 'Ng4'] },
  { eco: 'A53', name: 'Староиндийская защита: Вариант Яновского', moves: ['d4', 'Nf6', 'c4', 'd6'] },
  { eco: 'A56', name: 'Защита Бенони', moves: ['d4', 'Nf6', 'c4', 'c5'] },
  { eco: 'A57', name: 'Волжский гамбит (Гамбит Бенко)', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
  { eco: 'A58', name: 'Принятый волжский гамбит', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5', 'cxb5', 'a6'] },
  { eco: 'A60', name: 'Защита Модерн-Бенони', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6'] },
  { eco: 'A65', name: 'Модерн-Бенони: Главный вариант', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6', 'Nc3', 'exd5', 'cxd5', 'd6', 'e4', 'g6'] },
  { eco: 'A80', name: 'Голландская защита', moves: ['d4', 'f5'] },
  { eco: 'A83', name: 'Голландская защита: Гамбит Стаунтона', moves: ['d4', 'f5', 'e4', 'fxe4', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'A84', name: 'Голландская защита: Вариант с 2.c4', moves: ['d4', 'f5', 'c4'] },
  { eco: 'A87', name: 'Голландская защита: Ленинградский вариант', moves: ['d4', 'f5', 'c4', 'Nf6', 'g3', 'g6', 'Bg2', 'Bg7', 'Nf3', 'O-O', 'O-O', 'd6', 'Nc3'] },
  { eco: 'A90', name: 'Голландская защита: Каменная стена', moves: ['d4', 'f5', 'c4', 'Nf6', 'g3', 'e6', 'Bg2', 'd5'] },
  { eco: 'E00', name: 'Каталонское начало', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'E01', name: 'Каталонское начало: Закрытый вариант', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O'] },
  { eco: 'E04', name: 'Каталонское начало: Открытый вариант', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'dxc4', 'Nf3'] },
  { eco: 'E11', name: 'Защита Боголюбова', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'Bb4+'] },
  { eco: 'E12', name: 'Новоиндийская защита', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'E15', name: 'Новоиндийская защита: Вариант с Ba6', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Ba6'] },
  { eco: 'E16', name: 'Новоиндийская защита: Вариант Капабланки', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Bb7', 'Bg2', 'Bb4+'] },
  { eco: 'E20', name: 'Защита Нимцовича', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E21', name: 'Защита Нимцовича: Вариант трёх коней', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3'] },
  { eco: 'E32', name: 'Защита Нимцовича: Классический вариант', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2'] },
  { eco: 'E40', name: 'Защита Нимцовича: Вариант Рубинштейна', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3'] },
  { eco: 'E43', name: 'Защита Нимцовича: Система Фишера', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'b6', 'Ne2'] },
  { eco: 'E60', name: 'Староиндийская защита', moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E61', name: 'Староиндийская защита: Вариант с 3.Nc3', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'] },
  { eco: 'E70', name: 'Староиндийская защита: Система Земиша', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f3'] },
  { eco: 'E76', name: 'Староиндийская защита: Атака четырёх пешек', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f4'] },
  { eco: 'E80', name: 'Староиндийская защита: Земиш, Главный вариант', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f3', 'O-O', 'Be3', 'e5', 'd5'] },
  { eco: 'E90', name: 'Староиндийская защита: Классическая система', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5'] },
  { eco: 'E91', name: 'Староиндийская защита: Классическая, Вариант 6.Be2', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O'] },
  { eco: 'E97', name: 'Староиндийская защита: Вариант Мар-дель-Плата', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7'] },
];

/**
 * Builds the Trie from the database for prefix matching.
 */
function buildOpeningTrie(database: readonly OpeningEntry[]): TrieNode {
  const root: TrieNode = { children: new Map() };

  for (const entry of database) {
    let curr = root;
    for (let i = 0; i < entry.moves.length; i++) {
      const token = normalizeSAN(entry.moves[i]);
      let next = curr.children.get(token);
      if (!next) {
        next = { children: new Map() };
        curr.children.set(token, next);
      }
      curr = next;
    }
    // Store variation data on target node
    curr.eco = entry.eco;
    curr.name = entry.name;
    curr.plies = entry.moves.length;
  }

  return root;
}

const OPENING_TRIE_ROOT = buildOpeningTrie(OPENING_DATABASE);

/**
 * Reconstruct a list of SAN tokens from various representations of a game:
 * - string[] (SAN moves)
 * - Move[] (move objects)
 * - GameState (extract history and replay)
 * - GameState[] (successive positions from ply 0 to N)
 */
export function extractSanList(
  input: (Move | string)[] | readonly (Move | string)[] | GameState | readonly GameState[],
): string[] {
  if (!input) return [];

  // 1. Array of GameStates (e.g. from reconstructGameStates)
  if (Array.isArray(input)) {
    if (input.length === 0) return [];

    const first = input[0];
    if (typeof first === 'object' && first !== null && 'board' in first && 'history' in first) {
      const states = input as unknown as readonly GameState[];
      const sans: string[] = [];
      for (let i = 0; i < states.length - 1; i++) {
        const stateBefore = states[i];
        const stateAfter = states[i + 1];
        const lastMove = stateAfter.history[stateAfter.history.length - 1];
        if (lastMove) {
          sans.push(moveToSAN(stateBefore, lastMove));
        }
      }
      return sans;
    }

    // 2. Array of strings (SANs)
    if (typeof first === 'string') {
      return (input as unknown as readonly string[]).map((s) => s.trim());
    }

    // 3. Array of Move objects
    if (typeof first === 'object' && first !== null && 'from' in first && 'to' in first) {
      const moves = input as unknown as readonly Move[];
      const sans: string[] = [];
      let state = classicalRuleSet.getInitialState();
      for (const m of moves) {
        sans.push(moveToSAN(state, m));
        state = applyMove(state, m);
      }
      return sans;
    }

    return [];
  }

  // 4. Single GameState
  if (typeof input === 'object' && input !== null && 'history' in input && 'board' in input) {
    const stateInput = input as GameState;
    const sans: string[] = [];
    let state = classicalRuleSet.getInitialState();
    for (const m of stateInput.history) {
      sans.push(moveToSAN(state, m));
      state = applyMove(state, m);
    }
    return sans;
  }

  return [];
}

/**
 * Identifies the deepest matching chess opening for the given game history.
 * Returns { eco, name, plies } or null if no recognized opening book moves were played.
 */
export function identifyOpening(
  history: (Move | string)[] | readonly (Move | string)[] | GameState | readonly GameState[],
): IdentifiedOpening | null {
  const sans = extractSanList(history);
  if (sans.length === 0) return null;

  let curr = OPENING_TRIE_ROOT;
  let bestMatch: IdentifiedOpening | null = null;

  for (let i = 0; i < sans.length; i++) {
    const token = normalizeSAN(sans[i]);
    const next = curr.children.get(token);
    if (!next) {
      break;
    }
    curr = next;
    if (curr.eco && curr.name) {
      bestMatch = {
        eco: curr.eco,
        name: curr.name,
        plies: curr.plies ?? (i + 1),
      };
    }
  }

  return bestMatch;
}

