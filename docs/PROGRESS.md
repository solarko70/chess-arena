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


