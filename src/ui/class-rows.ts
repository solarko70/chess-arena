/**
 * Reusable move classification rows component.
 * Renders badges, class names, counts, and background highlights from MOVE_CLASS_REGISTRY.
 */

import { MOVE_CLASS_REGISTRY, type MoveClassMeta } from '@/analysis';

export interface ClassRowItemDom {
  rowEl: HTMLElement;
  badgeEl: HTMLElement;
  labelEl: HTMLElement;
  countEl: HTMLElement;
  meta: MoveClassMeta;
  update: (count: number | null, isReviewing?: boolean) => void;
}

export interface ClassRowsListDom {
  containerEl: HTMLElement;
  rows: Map<string, ClassRowItemDom>;
  update: (counts: Partial<Record<string, number>> | null, isReviewing?: boolean) => void;
}

export interface ClassRowsListOptions {
  classes?: readonly MoveClassMeta[];
  containerClass?: string;
  showAll?: boolean;
}

/**
 * Creates a single move class row element.
 */
export function createClassRow(meta: MoveClassMeta): ClassRowItemDom {
  const rowEl = document.createElement('div');
  rowEl.className = 'card-class-row zero-count';
  rowEl.setAttribute('data-class-id', meta.id);
  rowEl.setAttribute('title', meta.nameRu);

  const infoEl = document.createElement('div');
  infoEl.className = 'card-class-info';

  const badgeEl = document.createElement('span');
  badgeEl.className = `move-class-badge badge-${meta.id}`;
  badgeEl.textContent = meta.symbol;
  infoEl.appendChild(badgeEl);

  const labelEl = document.createElement('span');
  labelEl.className = 'card-class-label';
  labelEl.textContent = `${meta.nameRu}:`;
  infoEl.appendChild(labelEl);

  rowEl.appendChild(infoEl);

  const countEl = document.createElement('span');
  countEl.className = 'card-class-count';
  countEl.textContent = '—';
  rowEl.appendChild(countEl);

  const update = (count: number | null, isReviewing = false): void => {
    if (count !== null && !isNaN(count)) {
      const countStr = count.toString();
      if (countEl.textContent !== countStr) {
        countEl.textContent = countStr;
      }
      if (count === 0) {
        rowEl.classList.add('zero-count');
        rowEl.style.removeProperty('--row-class-bg');
      } else {
        rowEl.classList.remove('zero-count');
        rowEl.style.setProperty('--row-class-bg', `var(--class-${meta.id}-bg)`);
      }
    } else if (isReviewing) {
      if (!countEl.querySelector('.skeleton-pill')) {
        countEl.innerHTML = '<span class="skeleton-pill"></span>';
      }
      rowEl.classList.remove('zero-count');
      rowEl.style.removeProperty('--row-class-bg');
    } else {
      if (countEl.textContent !== '—') {
        countEl.textContent = '—';
      }
      rowEl.classList.add('zero-count');
      rowEl.style.removeProperty('--row-class-bg');
    }
  };

  return {
    rowEl,
    badgeEl,
    labelEl,
    countEl,
    meta,
    update,
  };
}

/**
 * Creates a list container with class rows for all summary-enabled move classes.
 */
export function createClassRowsList(options: ClassRowsListOptions = {}): ClassRowsListDom {
  const containerEl = document.createElement('div');
  containerEl.className = `card-classes-list ${options.containerClass ?? ''}`.trim();

  const classes = options.classes ?? MOVE_CLASS_REGISTRY.filter((m) => options.showAll || m.showInSummary);
  const rows = new Map<string, ClassRowItemDom>();

  for (const meta of classes) {
    const item = createClassRow(meta);
    rows.set(meta.id, item);
    containerEl.appendChild(item.rowEl);
  }

  const update = (counts: Partial<Record<string, number>> | null, isReviewing = false): void => {
    for (const [id, item] of rows.entries()) {
      if (counts !== null && counts !== undefined) {
        item.update(counts[id] ?? 0, isReviewing);
      } else {
        item.update(null, isReviewing);
      }
    }
  };

  return {
    containerEl,
    rows,
    update,
  };
}

