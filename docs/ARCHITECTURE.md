# Chess Arena Architecture

## Overview
Chess Arena is a modular, high-performance chess engine and application core implemented in TypeScript. The core library (`src/core/`) is completely decoupled from UI and DOM dependencies, supporting arbitrary $W \times H$ board configurations, declarative piece definitions, FIDE rules, notation parsers/serializers (FEN, SAN, PGN), and complete public API exports.

## Core Structure (`src/core/`)
- **`types.ts`**: Core domain types (`Color`, `PieceType`, `Square`, `Piece`, `Board`, `CastlingRights`, `Move`, `GameState`, `PieceDef`, `GameResult`, `RuleSet`).
- **`board.ts`**: Spatial coordinate utilities for arbitrary dimensions ($W \times H$) (`toSquare`, `toCoords`, `inBounds`, `cloneBoard`, `emptyBoard`).
- **`pieces.ts`**: Declarative piece definitions (`PIECE_DEFS`) describing movement vectors and sliding/jumping rules without hardcoded conditional logic.
- **`notation/`**:
  - `fen.ts`: FEN parsing, serialization, and position key generation (`positionKey`).
  - `san.ts`: Standard Algebraic Notation (SAN) move formatting (`moveToSAN`) with full disambiguation support (`Nbd7`, `R1a3`, `Qh4e1`) and reverse parsing (`sanToMove`).
  - `pgn.ts`: Portable Game Notation (PGN) game export with Seven Tag Roster and line-wrapping up to 80 characters, plus PGN single-game parsing (`parsePGN`).
- **`moves/`**:
  - `generators.ts`: Pseudo-legal move generator supporting sliding/jumping pieces, pawn pushes, double pushes, captures, en passant, promotion, and castling.
  - `apply.ts`: Move execution and reversion (`applyMove`, `undoMove`) maintaining self-contained state and undo metadata (`prevCastling`, `prevEpSquare`, `prevHalfmove`, `prevPositionHistory`).
  - `legal.ts`: Attack calculations (`isSquareAttacked`, `isInCheck`), legal move filtering (`generateLegal`), checkmate, and stalemate detection.
- **`rules/`**:
  - `ruleset.ts`: `RuleSet` interface.
  - `classical.ts`: Classical FIDE rules engine (`ClassicalRuleSet`) implementing threefold repetition, fifty-move rule, insufficient material, and game outcome evaluation.
- **`index.ts`**: Comprehensive public API entry point exporting all core modules, types, notations, and rule sets.

