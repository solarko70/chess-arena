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
