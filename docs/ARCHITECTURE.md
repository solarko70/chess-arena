# Chess Arena Architecture

## Overview
Chess Arena is a robust, modular chess engine and application core written in TypeScript without DOM dependencies in its core logic (`src/core/`).

## Core Modules (`src/core/`)
- **`types.ts`**: Fundamental data structures (`Color`, `PieceType`, `Square`, `Piece`, `Board`, `CastlingRights`, `Move`, `GameState`, `PieceDef`, `RuleSet`).
- **`board.ts`**: Board utilities supporting arbitrary $W \times H$ board dimensions (`toSquare`, `toCoords`, `inBounds`, `cloneBoard`, `emptyBoard`).
- **`pieces.ts`**: Declarative piece definitions (`PIECE_DEFS`) describing sliders and jumpers without hardcoded conditional logic.
- **`notation/`**:
  - `fen.ts`: FEN parsing and serialization, and `positionKey` generation.
  - `san.ts`: Standard Algebraic Notation (SAN) move conversion.
  - `pgn.ts`: Portable Game Notation (PGN) game export.
- **`moves/`**:
  - `generators.ts`: Pseudo-legal move generation (sliding, jumping, pawns, en passant, promotion, castling).
  - `apply.ts`: Move application and reversion (`applyMove`, `undoMove`) using self-contained `Move` objects.
  - `legal.ts`: Attack detection, check validation, legal move filtering (`generateLegal`), checkmate, and stalemate.
- **`rules/`**:
  - `ruleset.ts`: `RuleSet` interface.
  - `classical.ts`: Classical FIDE rules implementation (`ClassicalRuleSet`, threefold repetition, 50-move rule, insufficient material).
