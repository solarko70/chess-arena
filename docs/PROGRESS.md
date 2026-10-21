# Progress

## Stage 2: Classical Chess Core (Completed)
- [x] Board representation supporting arbitrary $W \times H$ dimensions (`src/core/board.ts`).
- [x] Declarative piece movement definitions (`src/core/pieces.ts`).
- [x] FEN parser/serializer and position key generation (`src/core/notation/fen.ts`).
- [x] Pseudo-legal and legal move generators, check/mate/stalemate detection (`src/core/moves/`).
- [x] Full FIDE rules: castling, en passant, pawn promotion, fifty-move rule, threefold repetition with irreversible move reset, insufficient material (`src/core/rules/classical.ts`).
- [x] Advanced SAN notation: `moveToSAN`, `sanToMove`, full disambiguation (`Nbd7`, `R1a3`, `Qh4e1`), checks, checkmates, promotions, and castling (`src/core/notation/san.ts`).
- [x] PGN notation: Seven Tag Roster export with line-wrapping (<80 chars) and robust single-game PGN parser `parsePGN` (`src/core/notation/pgn.ts`).
- [x] Comprehensive public API entry point (`src/core/index.ts`).
- [x] Perft-tests (Start position depths 1–4, Kiwipete, Positions 3, 4, 5).
- [x] Comprehensive test suites: FEN, SAN round-trips for every legal move, ambiguous SAN cases, classical game rules (checkmate, stalemate, draw conditions), Morphy Opera Game (1858) PGN test.
- [x] Verified via `npm run lint`, `npm run build`, and `npm test`.

## Stage 4a: AI Search Engine (no UI)
- [x] Fast internal position with make/unmake and Zobrist hashing for any board size (`src/ai/position.ts`), validated by perft.
- [x] Evaluation: material, 8×8 piece-square tables, bishop pair, doubled pawns, king safety, endgame king centralisation; material + pawn advancement on other sizes (`src/ai/evaluate.ts`).
- [x] Search: negamax alpha-beta (PVS), iterative deepening, quiescence (captures/promotions), TT, MVV-LVA/killers/history ordering, mate distance, repetition/50-move draws, strict time/depth/node limits (`src/ai/search.ts`).
- [x] Analysis API `analyzePosition` with White-perspective scores and multi-PV (`src/ai/api.ts`).
- [x] Levels Новичок…Мастер and `findBestMove` (`src/ai/levels.ts`); tests in `src/tests/ai.test.ts`.

## Stage 4b: Play vs AI in UI (Completed)
- [x] Web Worker `src/ai/worker.ts` with search cancellation, error reporting, and 300–600 ms delay on weak levels.
- [x] Game setup menu in UI (`src/main.ts`, `src/ui/styles.css`): mode ("Двое на одном экране" / "Против компьютера"), level (Новичок…Мастер), player color (Белые / Чёрные / Случайно), persisted in `localStorage`.
- [x] Store integration (`src/state/store.ts`): automatic AI move, input lock during AI turn, auto-flip by player color, two-ply undo vs AI, search cancellation on undo/new game/FEN/PGN/timeout, clock support for AI, and worker error handling.
- [x] Unit & integration tests with synchronous/deferred Worker stubs (`src/tests/ai-ui.test.ts`).

## Stage 4c-1: Game Review Logic (Stockfish & OwnEngine) (Completed)
- [x] Win chance formula & Lichess model (`src/analysis/winchance.ts`).
- [x] Lichess accuracy calculation (`src/analysis/accuracy.ts`).
- [x] Move classifier: best, excellent, good, inaccuracy, mistake, blunder, onlyMove (`src/analysis/classify.ts`).
- [x] Analysis engines: Stockfish (UCI over Web Worker / Node) and OwnEngine (`src/analysis/engine.ts`).
- [x] Game review pipeline `reviewGame` with horizon inconsistency re-analysis (`src/analysis/review.ts`).
- [x] Unit & regression tests for Stockfish & Opera game (`src/tests/review.test.ts`, `src/tests/review.slow.test.ts`).

## Stage 4c-2: Game Review UI (Completed)
- [x] Review Web Worker `src/analysis/worker.ts` for running OwnEngine off the main thread.
- [x] Service `src/analysis/service.ts` managing engine selection, fallback, progress, and cancellation.
- [x] Review Panel UI (`src/ui/reviewpanel.ts`): "Разбор партии" button, deep mode toggle, progress bar & cancellation, engine info badge, white/black accuracies, move classification table, interactive SVG win chance graph, key moments list, and PGN export with `[%eval]` & NAGs (`src/analysis/pgn-export.ts`).
- [x] Board & History UI enhancements (`src/ui/board.ts`, `src/ui/history.ts`, `src/ui/styles.css`): vertical evaluation bar with mate detection, move class color badges in move list, move selection detail panel, and SVG best move arrow overlay.
- [x] Store integration (`src/state/store.ts`): clocks and move input paused during review mode, arrow key navigation enabled, automatic cleanup on exit/new game.
## Stage 4d-1: Game Over Modal & UI Polish (Completed)
- [x] UI polish: Move history list enlarged to show at least 6 rows (`min-height: 170px; max-height: 260px;`), auto-scrolling to active move upon selection, deep review checkbox unchecked by default.
- [x] Game Over Modal (`src/ui/gameovermodal.ts`): auto-pops on game end (checkmate, stalemate, draws, clock timeout) in live games; excluded during history inspection, review mode, and completed FEN/PGN loading.
- [x] Modal content: Result title and one-line reason, prominent AI verdict banner ("Вы выиграли" / "Вы проиграли" / "Ничья"), moves count, game duration, and captured material lost in points.
- [x] Review preview: shows placeholder string «Разбор партии покажет точность и ключевые моменты» when unanalyzed, and accuracies + inaccuracies/mistakes/blunders counts when review is present.
- [x] Modal controls: "Разбор партии" button launches review, "Новая партия" starts new game, close button ✕ / Esc / backdrop click dismisses modal for board inspection.
- [x] Summary button (`#btn-show-summary`): remains visible after modal dismissal to re-open game summary at any time.
- [x] Accessibility: `role="dialog"`, `aria-modal="true"`, focus trap cycling with Tab/Shift+Tab, focus restore upon close, lightweight fade/pop animation disabled on `prefers-reduced-motion`.
- [x] Build hygiene: eliminated all dynamic `node:fs` warnings in Vite client bundle via `src/analysis/node-stockfish.ts` and test setup hook (`src/tests/setup.ts`).
- [x] Unit & integration tests in `src/tests/game-over-modal.test.ts` (11 tests with titles <= 100 chars).
 
## Stage A1: Screen Skeleton & Main Screen (Completed)
- [x] Documentation: created `docs/UX.md` and `docs/ROADMAP.md` describing UX flows, design system, and multi-stage roadmap.
- [x] Global configuration: created `src/config.ts` with single `APP_NAME = 'Chess Arena'`; tab title and headers derive from it.
- [x] Localization: created `src/i18n.ts` with minimal layer and `t(key)` helper for new screen text.
- [x] Hash router: implemented `HashRouter` (`src/router.ts`) supporting `#/`, `#/game`, `#/analysis`, browser back/forward buttons, and smooth fade transitions with `prefers-reduced-motion` support.
- [x] Main screen: created home screen with large `APP_NAME` title, staggered button appearance animations, corner theme toggle, and "Скоро" toasts for online, variants, and analysis stubs.
- [x] Game screen navigation: added "На главный" button with confirmation check ("Партия будет потеряна") during ongoing games.
- [x] App icons: generated `public/favicon.svg` (white queen on light board square background) and raster PNGs `favicon-32x32.png` and `apple-touch-icon.png` (180x180), linked in `index.html`.
- [x] Unit & integration tests: created `src/tests/screens-navigation.test.ts` (9 tests with titles <= 100 chars).

## Stage A1.1: Main Screen Polish & Solar Chess Background (Completed)
- [x] Clean typography: strictly `APP_NAME` ("Chess Arena") without emojis across all screens and UI buttons; removed text-shadow/fringing; clean system font stack.
- [x] Queen silhouette: centered white queen icon behind title on `z-index: 1` peeking out above letters (`z-index: 2`).
- [x] Solar Chess Background: pure SVG & CSS background on home screen (`aria-hidden="true"`, `pointer-events: none`, no layout shifts) with cosmic/warm gradients, radial pulsing amber sun, 4 counter-rotating piece orbits (pawn, knight, bishop, rook), twinkling star dust, and fading perspective chessboard plane.
- [x] Fixed theme toggle: positioned at `top: 16px; right: 16px; z-index: 1000;` with crisp SVG moon/sun icons.
- [x] Accessibility: all background animations and transitions cleanly disabled under `prefers-reduced-motion: reduce`.
- [x] Tests: added 4 tests in `src/tests/screens-navigation.test.ts` covering title emoji absence, `APP_NAME` equality, solar background attributes, fixed theme toggle, and reduced motion.

## Stage A1.2: Fullscreen Background, Glass Blur & Vignette (Completed)
- [x] Fullscreen background layer: moved `.solar-background` into fixed layer (`position: fixed; inset: 0; z-index: -1; pointer-events: none; aria-hidden="true"`) scaling across all viewports (mobile 390x844 to ultrawide 2560x1080+); matching body background color with seamless edges.
- [x] Zero resource leakage: background hidden via `display: none` and all animations stopped when leaving the home screen.
- [x] Frosted glass hero container: `.home-hero` styled with `backdrop-filter: blur(var(--glass-blur))` (default 10px), translucent theme-colored background, rounded corners (24px), and `@supports not` fallback.
- [x] Vignette overlay: radial gradient darkening edges controlled by `var(--vignette-strength)` (0.55 dark theme, 0.25 light theme).
- [x] Depth blur: static distant orbits and stars blurred with `filter: blur(var(--far-blur))` (default 1px); animations preserved on transform and opacity only.
- [x] CSS variables: `--glass-blur`, `--vignette-strength`, `--far-blur` defined on `:root` with descriptive comments.
- [x] Mobile responsiveness: reduced orbits and stars on narrow screens ($\le 600\text{px}$) via media query.
- [x] Crown positioning: white queen icon placed strictly behind title text (`z-index: 1` vs `2`), crown completely elevated above letters with lower body hidden behind text.
- [x] Tests: added 5 tests in `src/tests/screens-navigation.test.ts` verifying fullscreen fixed layer, absence on game screen, CSS variables declaration, reduced motion blur preservation, and queen z-index.

## Stage A1.3: Main Screen Recomposition & Layout Polishing (Completed)
- [x] Unified solar center: declared `--sun-x: 50%` and `--sun-y: 34vh` on `:root`; centered sun glow (`.solar-sun`), orbital system (`.solar-orbits`), and title (`.home-title-wrapper`) precisely at this focal point.
- [x] Title outside hero container: moved `.home-title-wrapper` out of `.home-hero` into `.screen-home`, styled as absolute overlay centered at (`--sun-x`, `--sun-y`) with smooth entrance animation (`homeTitleAppear`).
- [x] Large title typography: increased size to `clamp(2.6rem, 9vmin, 7rem)` with `line-height: 1.05`, `letter-spacing: -0.03em`, and soft warm solar glow `text-shadow`.
- [x] Queen crown proportions: scaled queen icon with relative units (`1.2em`, top `-0.55em`, `z-index: 1`), keeping crown protruding over uppercase letters.
- [x] Frosted glass buttons block: `.home-hero` strictly contains 5 menu buttons and toast; positioned below title with `margin-top: calc(var(--sun-y) + 12vh)` with zero overlap across viewports; staggered button appearance delays (0.35s to 0.67s).
- [x] Landscape & low-height adaptation: added `@media (max-height: 600px)` switching to static flow layout with scrollability and smaller title sizing.
- [x] Accessibility: `prefers-reduced-motion` cleanly disables title animation and preserves center alignment.
- [x] Tests: added 4 tests in `src/tests/screens-navigation.test.ts` covering title separation, hero 5 buttons, CSS coordinates variables, clamp/em sizing, and reduced motion.

## Stage A2: Game Setup Modals, Game Launch & Resignation (Part 1 Completed)
- [x] Game setup modals: created `GameSetupModalUI` in `src/ui/setupmodals.ts` with accessible dialog (`role="dialog"`, `aria-modal="true"`, focus trap, default focus on start button, smooth fade-in/pop-in, Esc/backdrop/close button handling, `prefers-reduced-motion` support).
- [x] Local game modal: time controls cards grouped by category («Без часов», «Пуля 1+0», «Блиц 3+2 и 5+0», «Рапид 10+0 и 15+10»); no level or color fields.
- [x] Bot game modal: time controls groups plus 5 difficulty levels with strength guidelines (Novice, Amateur, Club, Expert, Master with ~Elo ratings) and player color selection (White, Random, Black).
- [x] Storage persistence: user choices remembered across sessions via `localStorage` independently (`chess_arena_setup_local` and `chess_arena_setup_bot`).
- [x] Game launch & route protection: starting game configures store (`setClockMode`, `newGame`), sets active game state, and transitions to `#/game`. Opening or reloading `#/game` without an active game redirects to home screen (`#/`).
- [x] Resignation flow: added `resignedPlayer` state to `ChessStore`, with `resign(color)` stopping clocks, cancelling AI search, and triggering game over modal («Вы сдались», «Вы проиграли» vs bot; «Белые/Чёрные сдались. Победили ...» in local game).
- [x] Resignation dialogs: temporary button «Сдаться» (`#btn-resign`) on game screen with confirmation dialog for bot games («Вы уверены, что хотите сдаться?») and side picker for local games («Кто сдаётся?»). Disabled when game is over.
- [x] Undo restoration: clicking «Отменить ход» after resignation clears `resignedPlayer` and restores game to ongoing status.
- [x] Tests: created `src/tests/setup-modals.test.ts` (11 new tests $\le 100$ chars) and updated 2 navigation tests in `src/tests/screens-navigation.test.ts` to test the full modal-to-game flow. All 17 test suites (172 tests) passing.

## Stage A2b: New Game Screen Layout & Review Overlay (Completed)
- [x] Bot level descriptions without Elo: updated `BOT_LEVELS` in `src/ui/setupmodals.ts` to concise descriptions («часто ошибается», «ошибается реже», «играет уверенно», «играет сильно», «полная сила движка») and removed `.setup-level-elo` badges.
- [x] Chess.com-style two-column game screen (`#/game` in `src/main.ts`, `src/ui/styles.css`):
  - Left column: top opponent bar (`#player-bar-top`), large square board (`clamp(320px, min(calc(100vh - 164px), calc(100vw - 436px)), 840px)`), bottom player bar (`#player-bar-bottom`).
  - Player bars display color indicator and side label («Компьютер: <уровень>» / «Вы» in AI mode; «Белые» / «Чёрные» in local mode) on the left and clock timer on the right; flipping the board swaps top and bottom bars along with their clocks.
  - Clocks hidden in `'none'` mode and visible in timed modes with tenths of a second and `.low-time` highlight below 10s.
  - Right column (`340–400px`): header with status and icon button «Перевернуть доску» (`#btn-flip`, shortcut key `F`), 2-column move list with click-to-jump and auto-scroll, navigation buttons (`|<`, `←`, `→`, `>|`), and action buttons «Отменить ход», «Сдаться», and «Показать итог».
  - Clean game topbar: compact «← На главный» button on the left, no app title or emojis, solid theme background.
- [x] Mobile adaptation ($\le 800\text{px}$): single-column layout with full-width board (`calc(100vw - 24px)`), opponent/player bars above and below, compact horizontal scrollable move ribbon, and action buttons row without horizontal overflow.
- [x] Removed legacy elements from `#/game`: mode/level/color/clock dropdowns, FEN/PGN textarea & copy/load buttons (`ImportExportUI` preserved in codebase for Stage A4 `#/analysis`), inline review start button & deep toggle, and live-game evaluation bar (`#eval-bar-wrapper` only shown in review mode).
- [x] Post-game summary modal & review overlay: renamed `#btn-modal-new-game` to «Играть снова» (navigates to `#/`); clicking «Разбор партии» (`#btn-modal-review`) opens fullscreen `#review-overlay` hosting the board (with eval bar and best-move arrow), move history, and `ReviewPanelUI`; closing overlay via `✕` (`#btn-close-review-overlay`) or `Escape` restores the summary modal.
## Stage A2c-1: Post-Game Undo Prohibition & Summary Button Polish (Completed)
- [x] Post-game undo prohibition: when a game is over (checkmate, stalemate, any draw, clock timeout, resignation), "Отменить ход" button is permanently disabled with `disabled` attribute and tooltip `title="Партия окончена"`. `store.undo()` returns `false` and does not revert positions (including Ctrl+Z / Cmd+Z keyboard shortcut).
- [x] Store API `store.canUndo()`: introduced method returning `true` only when the game is ongoing, not reviewing, not in review mode, not viewing history, and history has moves.
- [x] Live game state check `store.getLiveGameResult()`: checks termination on current game state `this.state` rather than historical `viewIndex` state so that `isGameOver()` remains `true` while viewing past moves.
- [x] Summary button (`#btn-show-summary`): visible whenever the game is finished (`store.isGameOver() === true`), allowing users to reopen the post-game summary modal (`GameOverModalUI`) at any time, even while reviewing past moves. Hidden during ongoing games.
- [x] Tests: added `src/tests/undo-and-summary.test.ts` (9 comprehensive tests) and updated 3 existing test suites for the new post-game undo prohibition.

## Stage A2c-2: New Post-Game Summary Modal, Move Class Registry, Background Analysis & Test Watchdog (Completed)
- [x] Move Class Registry (`src/analysis/classes.ts`): single source of truth `MOVE_CLASS_REGISTRY` with 6 ordered classes (`best`, `excellent`, `good`, `inaccuracy`, `mistake`, `blunder`), Russian labels, CSS variables (`--class-*`), hex colors, symbols, NAGs, and `formatMaterialPoints(n)` declension helper without minus sign.
- [x] Redesigned Post-Game Summary Modal (`src/ui/gameovermodal.ts`, `src/ui/styles.css`): `680px` dialog with centered header (verdict pill, title, reason, moves & duration meta), two side-by-side player cards (`1fr 1fr`, stacking on $\le 620\text{px}$) with winner highlight (`--class-best`), accuracy display, 6 move classes with `.zero-count` dimming, and properly declined material lost.
- [x] Automatic Background Analysis (`src/state/store.ts`): auto-starts once upon game completion ($\ge 2$ plies) with progress bar, error/retry UI («Анализ недоступен» + «Повторить»), instant cache reuse in «Разбор партии», and automatic cancellation on «Играть снова» or «На главный».
- [x] Re-entrancy Protection & Pure Subscribers (`src/state/store.ts`, `src/ui/gameovermodal.ts`): guarded `store.notify()` against deep re-entry ($>20$ throws descriptive error; single re-entry deferred via dirty flag without stack recursion) and removed all state-mutating calls from subscribers and `render` functions.
- [x] Safe Test Runner Watchdog (`scripts/safe-test.mjs`, `npm run test:safe`): monitors `node.exe` process tree memory and elapsed time every $500\text{ ms}$, killing the process tree if any process exceeds $2\text{ GB}$, total memory exceeds $3\text{ GB}$, or runtime exceeds $120\text{ s}$.
- [x] Tests: added `src/tests/game-over-a2c2.test.ts` (11 tests covering `notify` re-entrancy guard, `render` purity, registry & CSS variables, 2-column cards, auto-review, short-game skip, cache reuse, cancellation, error/retry, and Russian point declension).

## Stage 4d-2: Opening Book (ECO Codes), Opening Move Class & Mobile Polish (Completed)
- [x] Opening Database (`src/analysis/openings/database.ts`): catalog of 130+ standard opening variations across open (C20-C99), semi-open (B00-B99, C00-C19), closed (D00-D99), and Indian/flank games (A00-A99, E00-E99) with ECO codes, Russian names, and move lists.
- [x] Trie-based Opening Identification (`src/analysis/openings/database.ts`): $O(k)$ prefix matching with SAN normalization (stripping `+`, `#`, `?`, `!`, normalizing `0-0` to `O-O`) via `identifyOpening()` supporting SAN string arrays, `Move[]` objects, single `GameState`, and `GameState[]`.
- [x] Opening Move Class (`src/analysis/classes.ts`, `src/analysis/classify.ts`, `src/analysis/review.ts`): added `'opening'` class (order 0, `--class-opening: #94723c;`, light `#825f2a`, crisp vector book SVG icon without emojis). Moves within opening line are classified as `'opening'` with 0 win loss and 100% accuracy, excluded from key moments.
- [x] UI Opening Badges (`src/ui/gameovermodal.ts`, `src/ui/reviewpanel.ts`, `src/ui/history.ts`, `src/ui/styles.css`): `.opening-badge.solar-card` renders ECO code and Russian name (e.g. «C50 · Итальянская партия») or «Нестандартный дебют» in game over modal header, review panel results section, and history moves list on mobile (hidden on desktop to avoid duplicate).
- [x] Mobile Frame & Background Polish (`src/ui/styles.css`, `src/main.ts`): board padding in `#review-overlay` set to `8px 10px` on mobile ($\le 800\text{px}$), `.eval-bar-wrapper` / `.eval-bar` styled with `border-radius: 4px; overflow: hidden;`, `.review-solar-scene` / `.review-space-scene` fixed at `position: fixed; inset: 0;` to prevent tearing on scroll, and soft cosmic radial gradients on `body.review-active`.
- [x] Verification: 31 test files, 319 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-2.1: Mobile Review Overlay Polish & Space Scenes Alignment (Completed)
- [x] Vertical Move History on Mobile (`src/ui/styles.css`): overridden `.game-history-mount .history-list` horizontal ribbon inside `.review-overlay` with a clean vertical table (`.review-moves-list`) featuring 3-column rows (`36px 1fr 1fr`), custom scrollbar, `overflow-x: hidden`, and non-squished move feedback/mistake navigation controls.
- [x] Unclipped Celestial Layers (`src/ui/space-scenes.ts`, `src/ui/styles.css`): eliminated localized sub-viewBoxes and `contain: paint` cutoffs; all animated layers now use unified `viewBox="0 0 1920 1080"` with `preserveAspectRatio="xMidYMid slice"`, `overflow: visible`, and `contain: layout style`. Intermediate review containers have transparent backgrounds.
- [x] Board Frame & Evaluation Bar Alignment (`src/ui/styles.css`): set `aspect-ratio: auto;` on `.review-overlay .game-board-mount`, `align-items: stretch;` and `gap: 8px` on `.board-area`, `flex: 1; min-width: 0; aspect-ratio: 1 / 1; border-radius: 6px; overflow: hidden;` on `.board-container`, and `border-radius: 6px; align-self: stretch;` on `.eval-bar-wrapper`.
- [x] Verification: 31 test files, 322 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-2.2: Mobile Review Overlay Scroll Bug Fix & Vertical Flow (Completed)
- [x] Fixed Review Overlay Scroll & Coordinate Bug (src/ui/styles.css): eliminated flex centering (justify-content: center) and margin: auto that pushed the board and header into negative scroll coordinates (y < 0) on mobile viewports. Replaced with justify-content: flex-start !important; on #review-overlay, .review-overlay, .review-overlay-content, and .review-overlay-body.
- [x] Strict Top-to-Bottom Vertical Flow (src/ui/styles.css): structured layout starting from y = 0: 1) Overlay header (.review-overlay-header), 2) Board with evaluation bar (#review-overlay-board-slot / .game-board-mount), 3) 4-button move navigation (.review-board-nav), 4) Mobile tabs bar (.review-mobile-tabs), and 5) Active tab panel content (.review-overlay-side-col).
- [x] Board Mount Clamp & Frame Alignment (src/ui/styles.css): clamped mobile board mount width to width: min(calc(100vw - 20px), 380px); max-width: 380px; margin-top: 4px; so evaluation bar and squares 1–8 are fully visible directly under header.
- [x] Programmatic Viewport Scroll Reset (src/main.ts, src/ui/reviewpanel.ts): enforces eviewOverlay.scrollTop = 0 whenever the review overlay is opened and whenever mobile tabs are clicked (unless keyboard/move focus is within a .history-move).
- [x] Comprehensive Vitest Integration Suite (src/tests/review-ui.test.ts): verified justify-content: flex-start !important, safe width clamping, sequential DOM ordering, and programmatic scrollTop reset on mobile tab navigation.
- [x] Verification: 31 test files, 323 tests passing via pm test (scripts/safe-test.mjs), 0 lint warnings/errors in pm run lint, and clean production build via pm run build.

## Stage 4d-3.1: Solar Move Classes Registration (Stellar, Superb, Missed) (Completed)
- [x] Move Class Registry Expansion (`src/analysis/classes.ts`): expanded registry to 10 move classes with strict ordering: opening (0), stellar (1), superb (2), best (3), excellent (4), good (5), inaccuracy (6), mistake (7), blunder (8), missed (9).
- [x] Stellar Move Class (`src/analysis/classes.ts`, `src/ui/styles.css`): id `stellar`, symbol `!!`, `--class-stellar: #c026d3`, `--class-stellar-gradient: linear-gradient(135deg, #4c1d95 0%, #db2777 100%)`, box-shadow glow, and 8-pointed supernova sharp vector icon with D4 symmetry in `viewBox="0 0 24 24"`.
- [x] Superb Move Class (`src/analysis/classes.ts`, `src/ui/styles.css`): id `superb`, symbol `!`, `--class-superb: #ec4899`, `--class-superb-gradient: linear-gradient(135deg, #f43f5e 0%, #db2777 100%)`, box-shadow glow, and 4-pointed pulsar star with sharp diagonal rays in `viewBox="0 0 24 24"`.
- [x] Missed Chance Class (`src/analysis/classes.ts`, `src/ui/styles.css`): id `missed`, symbol `✖!`, `--class-missed: #e11d48`, `--class-missed-bg: #27272a`, 1.5px border, and eclipsed solar corona disk with cross vector icon in `viewBox="0 0 24 24"`.
- [x] Types & Severity Order (`src/analysis/classify.ts`, `src/analysis/review.ts`): added `stellar`, `superb`, `missed` to `MoveClass` union, `MOVE_CLASS_LABELS`, `SEVERITY_ORDER`, and `MoveClassCounts`.
- [x] Unified Badge Styling (`src/ui/styles.css`): added styling across `.board-move-badge`, `.review-move-badge`, and `.class-row-badge` for all new classes with non-distorted SVG scaling.
- [x] Test Suite Updates (`src/tests/classes-icons.test.ts`, `src/tests/game-over-a2c2.test.ts`, `src/tests/game-screen-a2c5.test.ts`, `src/tests/review.test.ts`): updated class count expectations from 7 to 10, added SVG vector geometry tests, and included new classes in `VALID_CLASSES`.
- [x] Verification: 31 test files, 324 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-3.2: Stellar, Superb & Missed Classification Algorithms & Class Polish (Completed)
- [x] Unified Single-Line Class Names (`src/analysis/classes.ts`, `src/ui/styles.css`): removed the word «ход» from registry `nameRu` (`opening` -> «Дебют», `stellar` -> «Звёздный», `superb` -> «Превосходный») and added `white-space: nowrap;` to `.card-class-label` so all class rows fit on a single line.
- [x] Enlarged Stellar 8-Pointed Supernova SVG (`src/analysis/classes.ts`): scaled the 8-pointed star geometry in `viewBox="0 0 24 24"` (main rays `2.5..21.5`, diagonal rays `5.8..18.2`, inner vertices `8.1..15.9`, `fill="white"`) to occupy 75% of the circular badge.
- [x] Classification Algorithms (`src/analysis/classify.ts`, `src/analysis/review.ts`):
  - `'stellar'` (`!!`): non-book best move (`loss <= 2%`) holding equality/advantage (`winAfter >= 48%`) with a tactical material sacrifice $\ge 150\text{ cp}$ (`computeMoveMaterialSacrifice` using `pawn: 100, knight: 300, bishop: 315, rook: 500, queen: 900`), such as Morphy's `16.Qb8+!`.
  - `'superb'` (`!`): non-book, non-stellar best move holding the position (`winAfter >= 40%`) that is the only move (`winChance` gap $\ge 20\%$ or `cp` gap $\ge 120$ when 2nd candidate $< 75\%$, or `isOnlyDefensiveMoveOnBoard` preventing immediate mate-in-1).
  - `'missed'` (`✖!`): move from a clearly winning position (`winBefore >= 75%`, mover eval $\ge +2.00$) that drops `winAfter` to $\le 55\%$ with `loss >= 20%`, replacing `'mistake'`/`'blunder'`.
- [x] Move Feedback Card Verdicts & Descriptions (`src/ui/history.ts`, `src/ui/styles.css`): added titles and explanatory descriptions in `.move-feedback-card` for `'stellar'` («Звёздный !!» — «Блестящая жертва материала, ведущая к победе»), `'superb'` («Превосходный !» — «Единственный ход, сохраняющий решающий перевес»), and `'missed'` («Упущенный шанс ✖!» — «Упущена возможность победить»).
- [x] Tests (`src/tests/stellar-moves.test.ts`, `src/tests/openings.test.ts`): added 6 unit/integration tests for `'stellar'`, `'superb'`, `'missed'`, single-line registry labels, enlarged SVG geometry, and feedback card rendering; updated `openings.test.ts` `meta.nameRu` expectation to `'Дебют'`.
- [x] Verification: 32 test files, 330 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-4: Solar Eval Bar & Move Classes Vector Redesign (Completed)
- [x] Solar Eval Bar Photosphere & Void (`src/ui/styles.css`, `src/ui/board.ts`):
  - White side (`.eval-bar-fill`): solar energy gradient `linear-gradient(180deg, #fffbeb 0%, #fde68a 35%, #f59e0b 100%)` with inner glow `box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.6)`.
  - Black side (`.eval-bar-track`, `.eval-bar-wrapper`): deep cosmic void `#0d0824` with 4-point star-speckle radial gradients and linear gradient `linear-gradient(180deg, #130a2e 0%, #080415 100%)`.
  - Separator marker (`.eval-bar-marker`): 2px line with `var(--solar-accent, #f59e0b)` and neon glow `box-shadow: 0 0 4px #f59e0b`.
  - Eval text (`.eval-bar-text`): centered vertically and horizontally at `50%` with `transform: translate(-50%, -50%)`, high-contrast white text, subtle dark void backdrop `rgba(13, 8, 36, 0.7)`, and double text shadow for perfect legibility.
- [x] Harmonization of Move Class Icons & Colors (`src/analysis/classes.ts`, `src/ui/styles.css`):
  - `best` (★): radiant solar gold star (`fill="white"`), color `--class-best: #f59e0b`.
  - `excellent` (★ / chevrons): double upward aurora light beams / parallel chevrons (`stroke-width="2.5"`, `stroke="white"`, `stroke-linecap="round"`), color `--class-excellent: #06b6d4` (neon cyan).
  - `good` (✓): smooth orbital checkmark trajectory (`stroke-width="2.5"`, `stroke="white"`, `stroke-linecap="round"`), color `--class-good: #10b981` (emerald ray).
  - `opening` (D / atlas): opened star atlas (`stroke-width="2"`, `stroke="white"`), color `--class-opening: #94723c`.
  - `inaccuracy` (?!): solar perturbation contours with distinct tspans, color `--class-inaccuracy: #eab308`.
  - `mistake` (?): sharp supergiant flash question mark, color `--class-mistake: #f97316`.
  - `blunder` (??): dual gravitational collapse symbols, color `--class-blunder: #ef4444`.
  - `missed` (✖!): solar eclipse corona with clean cross, color `--class-missed: #e11d48` with dark background `#27272a`.
- [x] Test Suite Expansion (`src/tests/classes-icons.test.ts`, `src/tests/review-ui.test.ts`):
  - Added full color and CSS variable mapping validation for all 10 classes.
  - Added strict emoji-free validation across all move class SVG markups.
  - Added comprehensive eval bar styling and DOM mount test.
- [x] Verification: 32 test files, 331 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-4.1: Cosmic Nebula Eval Bar & Celestial Vector Icons (Completed)
- [x] Vivid Cosmic Purple Nebula Eval Bar (`src/ui/styles.css`, `src/tests/review-ui.test.ts`):
  - Black side (`.eval-bar-track`, `.eval-bar-wrapper`): updated background to a deep cosmic purple nebula `linear-gradient(180deg, #2a114f 0%, #1a0a33 50%, #0f0521 100%)` with `background-color: #1a0a33`.
  - Multi-layered celestial stardust: integrated 6 visible radial star-speckles with radii between 1.5px and 2.2px using bright white `#ffffff`, pink/rose `#f472b6`, and neon cyan `#67e8f9` halos.
- [x] Text Sticking Bug Fix for Class Rows (`src/ui/class-rows.ts`, `src/ui/styles.css`, `src/tests/review-ui.test.ts`):
  - Separated label and count by appending an explicit text node space (`document.createTextNode(' ')`) between `.card-class-info` and `.card-class-count` in `createClassRow()`, guaranteeing proper spacing in plain text (`«Упущенный шанс: 0»`).
  - Added `gap: 8px; justify-content: space-between;` to `.card-class-row, .class-row`, `min-width: 0; flex: 1;` to `.card-class-info`, `text-overflow: ellipsis; overflow: hidden;` to `.card-class-label`, and `flex-shrink: 0; min-width: 16px; text-align: right;` to `.card-class-count` both in base styles and mobile `@media (max-width: 800px)`.
  - Supported `circle[fill='none']` in SVG icon fill-rule resets.
- [x] Celestial Vector Redesign of Move Class Icons (`src/analysis/classes.ts`, `src/tests/classes-icons.test.ts`):
  - `best` (★): 10-pointed radiant solar star with 5 protruding rays and 5 inner vertices (`fill="white"`).
  - `good` (✓): orbital trajectory curve with planetary satellite node (`fill="none"`, `stroke="white"`, `stroke-width="2.5"`, `<circle cx="20" cy="5" r="1.5" fill="white"/>`).
  - `inaccuracy` (?!): solar flare question curve, vertical beam, and twin 4-pointed diamond sparkle dots (`fill="white"`).
  - `mistake` (?): red supergiant flash question mark with cosmic 4-pointed diamond star dot (`fill="white"`).
  - `blunder` (??): dual gravitational collapse question marks with symmetrical singularity dots (`fill="white"`, `<circle>` at x=7.5 and x=16.5).
  - `missed` (✖!): solar eclipse corona with clean diagonal cross lines (`stroke-width="2"`, `stroke="white"`).
- [x] Unit & Regression Tests:
  - Updated `src/tests/classes-icons.test.ts` to validate vector geometry for `inaccuracy`, `mistake`, `blunder`, `best`, and `good`.
  - Updated `src/tests/review-ui.test.ts` to assert the `#1a0a33` / `#2a114f` cosmic purple track gradient and added unit test for `«Упущенный шанс: 0»` spacing.
  - Synchronized `src/tests/game-screen-a2c5.test.ts` line 165 for the new vector badge markup.
- [x] Verification: 32 test files, 332 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-4.2: Concept-Art Move Class SVGs & Solid Deep Violet Eval Bar (Completed)
- [x] Solid Deep-Space & Purple Nebula Eval Bar (`src/ui/styles.css`, `src/tests/review-ui.test.ts`):
  - Black side (`.eval-bar-track`, `.eval-bar-wrapper`): removed semi-transparent greyish tone, replaced with dense opaque deep-space gradient `linear-gradient(180deg, #05020a 0%, #17042b 45%, #2c0852 100%)` and `background-color: #05020a`.
  - Multi-stardust radial layers: 5 bright star speckles (1.4px to 2.2px) at `#ffffff` (80-90%), `#f472b6` (75%), and `#67e8f9` (80%).
  - Added `ellipse[fill='none']` to SVG fill resets in `.board-move-badge`, `.review-move-badge`, `.class-row`, `.card-class-row`.
- [x] Solar Chess Concept-Art Vector SVGs (`src/analysis/classes.ts`, `src/tests/classes-icons.test.ts`):
  - `best`: large golden 5-pointed solar star (`<polygon>`) with surrounding corona ray flares (`<path>`).
  - `excellent`: dual ascending aurora chevrons (`stroke-width="2.6"`).
  - `good`: clean checkmark with dynamic planetary orbital ring (`<ellipse transform="rotate(-28 12 12.5)" stroke-dasharray="26 6 12 4"/>`).
  - `opening`: open star atlas (`<path>`, `<line>`) with crossed planetary orbit (`<ellipse transform="rotate(-20 12 12)"/>`).
  - `inaccuracy`: solar perturbation symbol `?!` (`font-weight="900"`, `font-size="11"`) with circular dashed flare ring (`<circle stroke-dasharray="3 2"/>`).
  - `mistake`: red supergiant flash `?` (`font-weight="900"`, `font-size="13"`) with surrounding plasma spikes (`<path>`).
  - `blunder`: gravitational vortex singularity (`<path>` spiral) with centered `??` (`font-weight="900"`, `font-size="11"`).
  - `missed`: solar eclipse corona ring (`<circle>`) with cross `✖` and exclamation `!` (`<path>`).
  - `stellar` and `superb`: preserved without changes matching the design.
- [x] Test Suite Verification:
  - All 10 classes verified for valid XML/SVG syntax, viewBox, and vector element containment (`path, circle, polygon, ellipse, line`).
  - Eval bar styles verified for `#05020a` and depth gradient.
- [x] Verification: 32 test files, 332 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.

## Stage 4d-4.3: Pure Readable Move Class Icons & Rich Radial Starfield (Completed)
- [x] Deep Space & Dense Multi-Starfield Eval Bar (`src/ui/styles.css`, `src/tests/review-ui.test.ts`):
  - Black side (`.eval-bar-track`, `.eval-bar-wrapper`): dense dark violet gradient `linear-gradient(180deg, #05020a 0%, #160429 50%, #28064a 100%)`.
  - Rich starfield: 12-point radial gradient constellation (14–18 stars, 1.2px–2.2px) across full height with bright white `#ffffff`, pink `#f472b6`, and neon cyan `#67e8f9` stars.
- [x] Rich Color Gradients for All Move Class Badges (`src/ui/styles.css`):
  - Added CSS variables `--class-*-gradient` for opening, stellar, superb, best, excellent, good, inaccuracy, mistake, blunder, and missed.
  - Applied gradients to `.badge-*`, `.board-move-badge`, `.review-move-badge`, and `.class-row-badge`.
  - Added `border: 1.5px solid #e11d48;` to missed badge.
- [x] Clean Vector Icons Without Visual Clutter (`src/analysis/classes.ts`, `src/tests/classes-icons.test.ts`):
  - `stellar`: preserved 8-pointed star.
  - `superb`: preserved 4-pointed curved star.
  - `best`: clean symmetrical 5-pointed gold star (`<polygon>`).
  - `excellent`: clean dual chevron (`stroke-width="2.8"`).
  - `good`: smooth checkmark centered on badge (`stroke-width="3"`).
  - `opening`: clean open book silhouette (`<path>`, `<line>`).
  - `inaccuracy`: bold centered `?!` (`font-size="12"`, `font-weight="900"`).
  - `mistake`: bold centered `?` (`font-size="14"`, `font-weight="900"`).
  - `blunder`: bold centered `??` (`font-size="12"`, `font-weight="900"`).
  - `missed`: bold centered `✖!` (`font-size="11.5"`, `font-weight="900"`).
- [x] Test Suite Verification:
  - Synchronized `src/tests/classes-icons.test.ts` for clean vector/text layout and chevron stroke-width.
  - Synchronized `src/tests/review-ui.test.ts` for `#05020a` / `#160429` / `#28064a` gradient.
- [x] Verification: 32 test files, 332 tests passing via `npm test` (`scripts/safe-test.mjs`), 0 lint warnings/errors in `npm run lint`, and clean production build via `npm run build`.


## Stage 4d-4.4: Move Class Font Scaling & Concise Missed Symbol (Completed)
- [x] Enlarged Typography & Vertical Centering for Move Badges (`src/analysis/classes.ts`):
  - `inaccuracy` (?!): increased `font-size` from `12` to `14.5`, centered baseline at `y="17.2"`.
  - `mistake` (?): increased `font-size` from `14` to `17.5`, centered baseline at `y="18"`.
  - `blunder` (??): increased `font-size` from `12` to `14.5`, centered baseline at `y="17.2"` with `letter-spacing="-0.5"`.
- [x] Concise Missed Symbol (`src/analysis/classes.ts`, `src/ui/history.ts`):
  - Replaced symbol `'✖!'` with concise `'✖'`: `symbol: '✖'`.
  - Updated SVG text to clean centered cross: `<text x="12" y="17.5" text-anchor="middle" font-size="16" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="white">✖</text>`.
  - Updated feedback verdict title in `src/ui/history.ts`: `getFeedbackVerdictTitle` returns `'Упущенный шанс ✖'`.
- [x] Test Suite Synchronization:
  - Updated `src/tests/classes-icons.test.ts`: allowed `fontSize <= 18` for `mistake` (17.5) and `missed` (16), updated expected content and markup for `missed` to `'✖'`.
  - Updated `src/tests/stellar-moves.test.ts`: updated verdict title expectation for `missed` move card from `'Упущенный шанс ✖!'` to `'Упущенный шанс ✖'`.
- [x] Verification:
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run build`: built production bundle in 597ms with exit code 0.
  - `npm test`: 32 test files passed, 332 tests passed (80s, watchdog clean).


## Stage 5a-1: Solar Audio Web Audio API Sound Engine (Completed)
- [x] Procedural Sound Engine Architecture (`src/audio/solar-audio.ts`):
  - Created singleton `SolarAudio` and exported helper functions `playMove`, `playCapture`, `playCheck`, `playCheckmate`, `playStellar`.
  - Lazy initialization & unlock on first user gesture (`click`, `touchstart`, `keydown`).
  - Safe no-op in Node/jsdom environments without errors or crashes.
  - Procedural sound palette:
    - `playMove()`: soft move click (frequency ramp 240Hz -> 90Hz in 0.05s).
    - `playCapture()`: chess.com style tactile wooden knock (triangle wave 140Hz -> 45Hz in 0.08s, warm bone click shaped by a 550Hz lowpass filter, 0.09s gain decay).
    - `playCheck()`: soft & quiet crystal warning chime (B4 493.88Hz + D#5 622.25Hz, 0.015s soft attack, reduced peak gain 0.09, 1100Hz lowpass filter, 0.38s smooth decay).
    - `playCheckmate()`: deep noble low victory chord in bass-mid range (C3 130.81Hz, G3 196.0Hz, E4 329.63Hz, 800Hz lowpass filter, 0.05s attack, 1.3s resonating decay).
    - `playStellar()`: 3-layer procedural cosmic patch (Sub-bass Supernova 120Hz->40Hz, Laser energy sweep 300Hz->1500Hz with 800Hz->4000Hz lowpass, Celestial Shimmer with 5 sine oscillators [C5, E5, G5, B5, D6], staggered delays 0.04s*(i+1), micro-modulated gain, master gain 0.55).
- [x] Gameplay & Review Mode Integration (`src/ui/board.ts`, `src/ui/history.ts`, `src/main.ts`):
  - In `ChessBoardUI`: live moves play `playCheckmate` on checkmate, `playCheck` on check, `playCapture` on piece capture, and `playMove` on quiet moves.
  - In `HistoryUI`: move navigation in review mode plays corresponding sound, and plays `playStellar()` when inspected move has `class === 'stellar'`.
- [x] Test Suite & Verification (`src/tests/solar-audio.test.ts`):
  - Added 5 unit and integration tests with titles <= 100 characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle in 626ms with exit code 0).
  - Verified `npm test` (33 test files passed, 337 tests passed, watchdog clean).

## Stage 5a-2: Smooth Piece Kinematics in Review & Solar Wings for Stellar Moves (Completed)
- [x] Smooth Piece Sliding Kinematics (`src/ui/board.ts`, `src/ui/styles.css`):
  - Implemented FLIP kinematics for move navigation in review mode (`this.store.isReviewMode()`).
  - Animated moving piece from `from` to `to` over 170ms using `transition: transform 170ms cubic-bezier(0.2, 0.8, 0.2, 1) !important; will-change: transform;`.
  - Inverted offset `translate(dx, dy) -> translate(0, 0)` applied via FLIP technique without modifying top/left coordinates.
  - Handled forward steps, backward single undo steps, and jump steps cleanly.
  - Spam and rapid click protection: if navigation step occurs < 150ms after previous, animation cancels immediately and snaps directly to position without lag.
  - Strict isolation: live gameplay and drag-and-drop are unaffected (`.piece-sliding` only triggers when review mode is active).
- [x] Angelic Solar Wings for Stellar Moves (`src/ui/board.ts`, `src/ui/styles.css`):
  - Mounted container `.stellar-wings-mount` on target square (`to`) behind the piece (`z-index: 2`, `pointer-events: none`).
  - Pure vector SVG wings with symmetrical left and right wings featuring distinct feathers (`fill="url(#solar-wings-grad)"`).
  - Feather gradient from golden `#fde68a` to cosmic magenta `#ec4899`, with cosmic glow `filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.75))`.
  - 6-keyframe flutter animation `.stellar-wings-flutter` (~2.3s duration) with scale and rotation dynamics:
    `0% { scale(0.2) rot 0deg, op 0 }`, `12% { scale(1.08) rot -6deg, op 1 }`, `32% { scale(0.96) rot 5deg }`, `55% { scale(1.03) rot -4deg, op 0.95 }`, `78% { scale(1.0) rot 0deg, op 0.8 }`, `100% { scale(1.15) translateY(-10px), op 0 }`.
  - Automatic cleanup on `animationend` or 2500ms timeout; immediately dismantled if move changes before timeout.
- [x] Test Suite & Verification (`src/tests/stellar-wings-anim.test.ts`):
  - Added 7 unit and integration tests verifying `.stellar-wings-mount` presence on target square, SVG validity, emoji-free geometry, cleanup on move change, 2500ms timeout cleanup, `.piece-sliding` CSS application, and spam protection.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 344 tests passed, watchdog clean).

## Stage 5a-2.1: Refined Angelic Wings & Symmetrical Synchronous Flutter Kinematics (Completed)
- [x] Symmetrical Separated Solar Wings Architecture (`src/ui/board.ts`, `src/ui/styles.css`):
  - Centered `.stellar-wings-mount` on the target square (`top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2`).
  - Separated left and right wings into distinct elements `<g class="stellar-wing stellar-wing-left">` and `<g class="stellar-wing stellar-wing-right">` within `viewBox="0 0 100 60"`.
  - Classic angelic wing shape with gracefully curved feathers tapering to fine tips and inner radiant contour lines.
  - Feather fills rendered with soft lunar-gold gradient `url(#wing-glow)` (`#ffffff` -> `#fffbeb` -> `#fde68a`), delicate cosmic magenta contour lines (`rgba(236, 72, 153, 0.55)`), and refined outer glow `filter: drop-shadow(0 0 5px rgba(236, 72, 153, 0.6))`.
- [x] Synchronous Symmetrical Wing Flap Kinematics (`src/ui/styles.css`):
  - Dedicated anatomical attachment points (`transform-origin`):
    - `.stellar-wing-left`: `transform-origin: 45px 35px;` (right edge of left wing at piece body)
    - `.stellar-wing-right`: `transform-origin: 55px 35px;` (left edge of right wing at piece body)
  - Synchronous mirror keyframes (`@keyframes stellarWingLeftFlutter` & `@keyframes stellarWingRightFlutter`, ~2.2s):
    - `0%`: both wings folded behind back (left: `rotate(35deg) scale(0.6)`, right: `rotate(-35deg) scale(0.6)`), `opacity: 0`.
    - `15%`: rapid emergence, feathers uncurling, `opacity: 1`.
    - `35%`: full power flap spreading wide upwards & outwards (left: `rotate(-25deg) scale(1.08)`, right: `rotate(25deg) scale(1.08)`).
    - `60%`: gentle downward return to neutral hovering posture (left: `rotate(10deg)`, right: `rotate(-10deg)`).
    - `80%`: secondary gentle hover and ascending glide (`translateY(-6px)`).
    - `100%`: ethereal dissolution into cosmic space (`opacity: 0, translateY(-10px), scale(1.05)`).
  - Maintained auto-cleanup timeout (2300ms) and instant dismantle on `viewIndex` changes.
- [x] Test Suite & Verification (`src/tests/stellar-wings-anim.test.ts`):
  - Added verification for presence of `.stellar-wing-left` and `.stellar-wing-right` elements and `#wing-glow` gradient.
  - Added verification that CSS rules specify independent `transform-origin: 45px 35px` and `55px 35px`.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 346 tests passed, watchdog clean).

## Stage 5a-2.2: Elongated Sharp Solar Wings, Rich Gradient & 2.5-Flap Cadence (Completed)
- [x] Elongated Sharp Feather Geometry (`src/ui/board.ts`, `src/ui/styles.css`):
  - Expanded wing span to 136% of the square (`.stellar-wings-mount { width: 136%; height: 136%; }`), projecting boldly beyond the piece silhouette.
  - Redesigned feather silhouettes with acute, tapered sharp points extending upwards and outwards.
  - Removed all internal stroke lines (`stroke="none"`) to create pure monolithic silhouettes with soft secondary layers.
  - Saturated cosmic gradient (`#solar-wing-gradient`): `#fef08a` (0%) -> `#f43f5e` (45%) -> `#c026d3` (100%) applied to both `.stellar-wing-left` and `.stellar-wing-right`.
  - Neon glow drop shadow: `filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.7))`.
- [x] Energetic 1.9s Flap Cadence (2 Full Flaps + 1 Partial Flap with Dissolution) (`src/ui/styles.css`, `src/ui/board.ts`):
  - Shortened overall animation duration from 2.2s to 1.9s for a more lively, rhythmic feel.
  - Keyframe structure across left and right wings:
    - `0%`: folded emergence behind piece (`opacity: 0, scale: 0.4`).
    - `8%`: uncurling and full appearance (`opacity: 1`).
    - `22%`: Flap 1 crest — powerful deep ascent & wide spread (left: `rotate(-28deg) scale(1.08)`, right: `rotate(28deg) scale(1.08)`).
    - `38%`: Flap 1 descent to neutral (left: `rotate(8deg)`, right: `rotate(-8deg)`).
    - `54%`: Flap 2 crest — second powerful spread (left: `rotate(-24deg) scale(1.05)`, right: `rotate(24deg) scale(1.05)`).
    - `70%`: Flap 2 descent to neutral (left: `rotate(6deg)`, right: `rotate(-6deg)`).
    - `82%`: Flap 3 partial upward lift (`rotate(±12deg), translateY(-4px), opacity: 0.9`).
    - `100%`: celestial dissolution without falling back (`opacity: 0, translateY(-12px), scale(1.04)`).
  - Synchronized `.stellar-wings-mount` DOM auto-removal timeout to 1900ms.
- [x] Test Suite & Verification (`src/tests/stellar-wings-anim.test.ts`):
  - Verified presence of `solar-wing-gradient` and pure `stroke="none"` monolithic attributes on wing feathers.
  - Verified cleanup timing: wings remain mounted at 1800ms and are cleanly removed after 1900ms (at 2000ms).
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 347 tests passed, watchdog clean).

## Stage 5a-2.3: Majestic Hovering Dynamics & 2 Soft Partial Flaps for Solar Wings (Completed)
- [x] Majestic Slow-Paced Hovering Kinematics (`src/ui/styles.css`):
  - Preserved approved vector geometry, sharp feathers, and `#solar-wing-gradient` in `src/ui/board.ts` unchanged.
  - Extended overall animation duration to smooth, majestic ~2.4s (via `cubic-bezier(0.25, 1, 0.5, 1)`).
  - Softened keyframe trajectory to eliminate sharp angles and deep flaps:
    - `0%`: gentle emergence from behind the piece (`opacity: 0, scale: 0.7`).
    - `14%`: full blossoming into neutral hovering posture (`opacity: 1`).
    - `32%`: Soft Flap 1 — gentle upward lift of tips without excessive spread (left: `rotate(-16deg) scale(1.03)`, right: `rotate(16deg) scale(1.03)`).
    - `52%`: slow, gentle return to hovering equilibrium (left: `rotate(4deg)`, right: `rotate(-4deg)`).
    - `72%`: Soft Flap 2 — second delicate hovering wave with subtle upward glide (left: `rotate(-12deg)`, right: `rotate(12deg), translateY(-4px)`).
    - `86%`: hovering suspension, beginning to softly melt into the cosmos (`opacity: 0.7, translateY(-7px)`).
    - `100%`: seamless celestial dissolution into space (`opacity: 0, translateY(-12px), scale(1.02)`).
- [x] DOM Cleanup Timer Synchronization (`src/ui/board.ts`):
  - Re-synchronized `.stellar-wings-mount` auto-removal timeout from 1900ms to 2500ms to match the 2.4s animation cycle.
  - Retained immediate DOM dismantling upon switching `viewIndex`.
- [x] Test Suite & Verification (`src/tests/stellar-wings-anim.test.ts`):
  - Synchronized auto-cleanup test: verified wings remain mounted at 2400ms and are cleanly unmounted at 2600ms (past 2500ms threshold).
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 347 tests passed, watchdog clean).

## Stage 5b: Ambient Cosmic Drone, Button Click Sound, and Mute Toggle (Completed)
- [x] Procedural Sound Engine Enhancements (`src/audio/solar-audio.ts`):
  - Added global mute management: `isMuted(): boolean`, `toggleMute(): boolean`, `setMuted(val: boolean)`, with backward-compatible alias `isAudioMuted(): boolean`.
  - Persisted user mute choice in `localStorage` under key `'solar_chess_sound_muted'`.
  - Complete silence across moves, captures, checks, checkmates, stellar moves, ambient drone, and tactile clicks when muted.
  - Implemented tactile button click sound `playButtonClick()`: short high-tech click (~35ms), triangle wave frequency drop 600Hz -> 180Hz in 0.035s, delicate peak gain 0.09 decaying exponentially to 0.001.
  - Implemented procedural cosmic black hole menu drone `startMenuAmbient()` / `stopMenuAmbient(fadeMs = 1000)`:
    - Sub-bass layer: 48Hz sine + 51.5Hz triangle interference beats (~3.5Hz beat frequency).
    - Relic radiation noise layer: looped random noise buffer filtered through 160Hz BiquadFilter (bandpass, Q: 3.0), modulated by slow 0.08Hz LFO (12.5s breathing cycle).
    - Master ambient gain ~0.05 with smooth 2.5s fade-in upon start and 1.0s fade-out upon stop.
- [x] UI & Navigation Integration (`src/main.ts`, `src/ui/styles.css`):
  - Added vector SVG mute toggle button `#sound-btn` (`.sound-toggle-btn`) in top bar next to `#theme-btn` with crisp speaker icons (`SOUND_ON_ICON` and `SOUND_OFF_ICON`), zero emojis.
  - Shifted button positioning to `right: 64px` in standard view and `right: 116px` in review overlay (`body.review-active`).
  - Automated ambient drone lifecycle: starts on home/lobby screen upon user interaction and fades out smoothly over 1s when entering game or review.
  - Suspended drone automatically on page hide (`document.hidden`) and resumed on return to home screen.
  - Added delegated tactile button click listener triggering `playButtonClick()` across menu buttons, actions, setup cards, and review tabs.
- [x] Unit & Integration Tests (`src/tests/solar-audio.test.ts`):
  - Added tests for `toggleMute`, `isMuted`, `setMuted`, and `localStorage` persistence.
  - Added tests for `playButtonClick()`, `startMenuAmbient()`, and `stopMenuAmbient()` audio graph synthesis.
  - Added tests for silence when muted, sound toggle button interactions, and delegated tactile click sounds.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 355 tests passed, watchdog clean).

## Stage 5b-1: Autoplay Policy Resolution & Deferred Ambient Start (Completed)
- [x] Autoplay Policy Compliance (`src/audio/solar-audio.ts`):
  - Replaced eager startup with deferred intention flag: `isAmbientRequested: boolean`.
  - Calling `startMenuAmbient()` before first user gesture marks `isAmbientRequested = true` without creating an `AudioContext` or calling `resume()`, eliminating browser console warnings.
  - If `this.ctx` is already created and in `'running'` state, starts ambient immediately.
  - Attached global gesture unlock listeners on `pointerdown`, `touchstart`, and `keydown`.
  - Upon first user gesture, calls `ensureContext()` and `ctx.resume()`. Once resolved, launches ambient drone if `isAmbientRequested === true` and `!isMuted()`.
  - Disconnects all gesture event listeners immediately after initial unlock.
  - Calling `stopMenuAmbient()` sets `isAmbientRequested = false` and smoothly fades out active ambient nodes.
- [x] Unit Tests & Verification (`src/tests/solar-audio.test.ts`):
  - Added tests verifying `startMenuAmbient()` records request without creating nodes when context is suspended or null.
  - Added tests verifying repeated calls to `startMenuAmbient()` and `stopMenuAmbient()` before unlock are safe.
  - Added test verifying window gesture event (`pointerdown`) resumes suspended context and launches requested drone.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 358 tests passed, watchdog clean).

## Stage 5b-2: Sound Deconfliction on Move Navigation & Audible Ambient Acoustics (Completed)
- [x] UI Click Deconfliction on Move Navigation (`src/main.ts`):
  - Filtered out `playButtonClick()` for all move navigation and review controls (`.review-nav-btn`, `.review-btn`, `.history-row`, `.card-class-row`, `.board-arrow-btn`, `.key-moment-item`, `.history-nav`, `.history-move`, `[data-nav]`, `[data-move-idx]`, `[data-move-index]`).
  - During move navigation and game review, only chess move sounds (`playMove`, `playCapture`, `playCheck`, `playCheckmate`, `playStellar`) sound, preventing clashing UI clicks.
- [x] Audible Cosmic Ambient Acoustics (`src/audio/solar-audio.ts`):
  - Shifted drone fundamentals into lower-mid range audible on laptop and mobile speakers:
    - Osc 1: 110Hz ($A_2$, triangle wave).
    - Osc 2: 164.8Hz ($E_3$, sine wave, deep cosmic fifth).
    - Osc 3: 55Hz ($A_1$, sine wave, sub-octave for bass headphones/subwoofers).
  - Cosmic wind & relic radiation noise:
    - Filter: 380Hz bandpass filter ($Q = 2.5$).
    - LFO: 0.06Hz sine wave modulating filter frequency between 230Hz and 530Hz (~16.6s breathing cycle).
  - Increased master ambient gain to clear, comfortable 0.16 (range 0.14–0.18) with smooth 2.0s fade-in.
  - Configured `stopMenuAmbient(800)` for responsive 800ms fade-out when transitioning to game or review.
  - Instant start upon first gesture (`pointerdown`) if on menu screen.
- [x] Navigation Lifecycle Integration (`src/main.ts`):
  - Guaranteed `startMenuAmbient()` triggers on menu display, returning from game via «На главный» / «В меню», or starting a new game from summary modal.
  - Guaranteed `stopMenuAmbient(800)` triggers when entering game screen or opening review overlay.
- [x] Unit Tests & Verification (`src/tests/solar-audio.test.ts`):
  - Added test verifying that clicking move navigation elements never calls `playButtonClick()`, while standard menu buttons do.
  - Updated audio synthesis test for new 110Hz/164.8Hz/55Hz oscillators, 380Hz filter, 0.06Hz LFO, and 0.16 gain.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 359 tests passed, watchdog clean).

## Stage 5b-3: Dynamic 3-Chord Solar Progression & Mobile Scroll Elimination (Completed)
- [x] Dynamic 3-Chord Ambient Progression (`src/audio/solar-audio.ts`):
  - Defined 3 atmospheric space chords cycling every 4.8 seconds:
    - Chord 1 (Base Solar, A-space): Osc 1: 110.0 Hz ($A_2$), Osc 2: 164.8 Hz ($E_3$), Osc 3: 55.0 Hz ($A_1$), Bandpass Filter: 380 Hz.
    - Chord 2 (Deep lower nebula, F-space): Osc 1: 87.3 Hz ($F_2$), Osc 2: 130.8 Hz ($C_3$), Osc 3: 43.65 Hz ($F_1$), Bandpass Filter: 310 Hz.
    - Chord 3 (Elevated stellar, C-space): Osc 1: 130.8 Hz ($C_3$), Osc 2: 196.0 Hz ($G_3$), Osc 3: 65.4 Hz ($C_2$), Bandpass Filter: 440 Hz.
  - Implemented smooth cosmic glissando: 2.8s `exponentialRampToValueAtTime` glides frequencies smoothly across oscillators and noise bandpass filter center.
  - Automatic progression loop via 4.8s timer interval started on drone launch.
  - Immediate cleanup of progression timer interval and glissando scheduling on `stopMenuAmbient()`.
  - Added public methods and helpers `getCurrentChordIndex()`, `advanceAmbientChord()`.
- [x] Complete Elimination of Mobile Viewport Shifts (`src/ui/history.ts`, `src/ui/gameovermodal.ts`, `src/ui/setupmodals.ts`, `src/main.ts`):
  - Replaced browser `Element.prototype.scrollIntoView()` in `HistoryUI` with localized container-only scrolling: `this.listEl.scrollTop` calculated from active row offset relative to `this.listEl.scrollTop` and `this.listEl.clientHeight`. This guarantees zero window scrolling or mobile page jumps.
  - Added `{ preventScroll: true }` to all element `.focus()` calls in `GameOverModalUI`, `GameSetupModalUI`, and `src/main.ts` resignation modal.
- [x] Unit Tests & Verification:
  - In `src/tests/solar-audio.test.ts`: added test verifying start, timer advancement (0 -> 1 -> 2 -> 0), glissando ramps, and interval cleanup for the 3-chord ambient progression.
  - In `src/tests/review-ui.test.ts`: added test asserting that move navigation across game history never calls `scrollIntoView` or `window.scrollTo`.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 361 tests passed, watchdog clean).

## Stage 5b-4: Monolithic Solar Chord & Black Hole Gravitational Pulse (Completed)
- [x] Return to Monolithic Solar Chord Tuning (`src/audio/solar-audio.ts`):
  - Completely removed recurring interval timers (`progressionTimer`) and chord-switching pitch glissandos.
  - Locked monolithic harmonic triad for deep, stable, meditative cosmic ambient:
    * Fundamental tone: 110.0 Hz ($A_2$, warm triangle wave).
    * Cosmic fifth: 164.8 Hz ($E_3$, pure sine wave for infinite space sensation).
    * Event horizon sub-bass: 55.0 Hz ($A_1$, dense solid sine wave).
- [x] Gravitational Pulse of the Event Horizon (LFO Modulation) (`src/audio/solar-audio.ts`):
  - Added low-frequency LFO oscillator: sine wave at 0.20 Hz (~5.0s breathing cycle).
  - Ambient density & volume modulation: LFO routed through `lfoVolumeGain` (amplitude 0.04) directly to `ambientMasterGain.gain` (base 0.12), smoothly swaying gain between 0.08 and 0.16 (hypnotic ebb and flow of the accretion disk).
  - Synchronized cosmic wind bandpass filter cutoff modulation: LFO routed through `lfoFilterGain` (amplitude 100 Hz) to `noiseFilter.frequency` (base 380 Hz), smoothly breathing between 280 Hz and 480 Hz in unison with volume pulse.
  - Safe fade-out: `stopMenuAmbient(fadeMs)` ramps master gain and LFO volume modulation down to 0.0001, and cleanly disconnects and stops all oscillators, noise sources, LFO, and gain nodes with zero leaks.
- [x] Unit Tests & Verification (`src/tests/solar-audio.test.ts`):
  - Updated audio synthesis test verifying monolithic chord frequencies, 0.20 Hz LFO, 0.08..0.16 volume modulation depth, and 280..480 Hz filter modulation depth.
  - Updated timer leak test confirming zero `setInterval` calls, locked pitches over time without ramps, and safe resource release upon stop.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 361 tests passed, watchdog clean).

## Stage 5b-5: Hover UI Sound & Floating Solar Crown for Stellar Moves (Completed)
- [x] Delicate Tactile Hover Sound (`src/audio/solar-audio.ts`, `src/main.ts`):
  - Implemented `playButtonHover()` in `SolarAudio`: airy sine wave micro-tick at 1040 Hz (950–1100 Hz range), ultra-short 0.022s duration (0.018–0.025s range) with instant exponential decay, soft peak volume 0.03 (0.025–0.035 range).
  - Early-return safety when muted or AudioContext is not running.
  - Connected delegated `mouseover` and capturing `mouseenter` listener across interactive UI buttons (`.menu-btn`, `.btn-menu`, `.btn-action`, `.review-tab-btn`, setup cards, sound/theme toggles, dialog buttons).
  - Anti-spam throttling: 45ms throttle interval between hover triggers.
  - Strictly excluded chess board squares, piece wrappers, and move navigation rows from hover sounds.
- [x] Floating Cosmic Solar Crown for Stellar Moves (`src/ui/board.ts`, `src/ui/styles.css`):
  - Added pure SVG 5-pointed solar crown `<g class="stellar-crown stellar-crown-float" aria-hidden="true">` inside `stellar-wings-mount`.
  - Geometric vectors: sharpened royal crown rays (`.crown-body`), sparkling 4-point star on the center peak (`.crown-sparkle`), and jewel accents.
  - Styled with bright solar gold gradient (`#solar-crown-gold`: `#fffbeb` -> `#fde68a` -> `#f59e0b`) and glowing amber drop shadow `filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.8))`.
  - Floating and rotation kinematics (`@keyframes stellarCrownFloat`): 2.4s animation synchronized with angel wings (0% entrance twist, 15% reveal, 45% float right, 75% rise left, 100% ascension and dissolve).
  - Automatically cleaned up together with wings after 2500ms or on next move navigation.
  - Full support for `prefers-reduced-motion: reduce`.
- [x] Unit Tests & Verification (`src/tests/solar-audio.test.ts`, `src/tests/stellar-wings-anim.test.ts`):
  - In `src/tests/solar-audio.test.ts`: verified `playButtonHover()` synthesis, mute/suspended safety, UI button hover triggering with 45ms throttling, and chessboard exclusion.
  - In `src/tests/stellar-wings-anim.test.ts`: verified presence of `.stellar-crown`, `.stellar-crown-float`, gold gradient fill, and CSS animation keyframe rules.
  - All test titles $\le 100$ characters.
  - Verified `npm run lint` (0 errors, 0 warnings).
  - Verified `npm run build` (built bundle with exit code 0).
  - Verified `npm test` (34 test files passed, 364 tests passed, watchdog clean).



