import { ChessStore } from '@/state/store';

export class ImportExportUI {
  private container: HTMLElement;
  private store: ChessStore;
  private textareaEl!: HTMLTextAreaElement;
  private errorEl!: HTMLElement;

  constructor(container: HTMLElement, store: ChessStore) {
    this.container = container;
    this.store = store;

    this.container.innerHTML = `
      <div class="io-panel">
        <textarea id="io-textarea" class="io-textarea" placeholder="Вставьте FEN или PGN сюда..."></textarea>
        <div id="io-error" class="io-error" style="display: none;"></div>
        <div class="io-buttons">
          <button id="btn-load" class="btn-action">Загрузить</button>
          <button id="btn-copy-fen" class="btn-action">Копировать FEN</button>
          <button id="btn-copy-pgn" class="btn-action">Копировать PGN</button>
        </div>
      </div>
    `;

    this.textareaEl = this.container.querySelector('#io-textarea') as HTMLTextAreaElement;
    this.errorEl = this.container.querySelector('#io-error') as HTMLElement;

    this.initEvents();
    this.store.subscribe(() => this.render());
  }

  private initEvents(): void {
    this.container.querySelector('#btn-load')?.addEventListener('click', () => {
      const text = this.textareaEl.value.trim();
      if (!text) return;

      this.store.clearError();
      // Try PGN first if it contains brackets or headers, else FEN
      if (text.includes('[') || text.includes('1.') || text.includes('1-0') || text.includes('0-1')) {
        const ok = this.store.loadPGN(text);
        if (!ok) {
          // Fallback try FEN
          this.store.loadFEN(text);
        }
      } else {
        const ok = this.store.loadFEN(text);
        if (!ok) {
          this.store.loadPGN(text);
        }
      }

      const err = this.store.getLastError();
      if (err) {
        this.errorEl.textContent = err;
        this.errorEl.style.display = 'block';
      } else {
        this.errorEl.style.display = 'none';
        this.textareaEl.value = '';
      }
    });

    this.container.querySelector('#btn-copy-fen')?.addEventListener('click', async () => {
      const fen = this.store.getFEN();
      try {
        await navigator.clipboard.writeText(fen);
        alert('FEN скопирован в буфер обмена!');
      } catch {
        alert(fen);
      }
    });

    this.container.querySelector('#btn-copy-pgn')?.addEventListener('click', async () => {
      const pgn = this.store.getPGN();
      try {
        await navigator.clipboard.writeText(pgn);
        alert('PGN скопирован в буфер обмена!');
      } catch {
        alert(pgn);
      }
    });
  }

  private render(): void {
    const err = this.store.getLastError();
    if (err) {
      this.errorEl.textContent = err;
      this.errorEl.style.display = 'block';
    } else {
      this.errorEl.style.display = 'none';
    }
  }
}
