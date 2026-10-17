# Progress

## Stage 2: Classical Chess Core (Completed)
- [x] Board representation supporting arbitrary $W \times H$ dimensions (`src/core/board.ts`).
- [x] Declarative piece movement definitions (`src/core/pieces.ts`).
- [x] FEN parser/serializer and position key generation (`src/core/notation/fen.ts`).
- [x] Pseudo-legal and legal move generators, check/mate/stalemate detection (`src/core/moves/`).
- [x] Full FIDE rules: castling, en passant, pawn promotion, fifty-move rule, threefold repetition, insufficient material (`src/core/rules/classical.ts`).
- [x] SAN export and basic PGN export (`src/core/notation/san.ts`, `src/core/notation/pgn.ts`).
- [x] Perft-tests (Start position depths 1–4, Kiwipete, Positions 3, 4, 5).
- [x] Comprehensive unit tests (FEN, SAN, perft, checkmate, stalemate, castling, en passant, draw conditions, round-trip apply/undo).
- [x] Verified via `npm run lint`, `npm run build`, and `npm test`.
