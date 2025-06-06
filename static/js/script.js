// Chess Game Logic
// This script handles all client-side chess game logic, including:
// - Board initialization and rendering
// - Move validation (client-side)
// - Socket.IO integration for real-time play
// - Game state management

// ======= Constants and Configuration =======
const API_URL = '/api';
const PIECE_TYPES = {
    'p': 'pawn',
    'r': 'rook',
    'n': 'knight',
    'b': 'bishop',
    'q': 'queen',
    'k': 'king'
};

// ======= ChessRules Object =======
// Main game engine for validation and move generation
const ChessRules = {
    // Constants for game state
    CASTLING_RIGHTS: {
        WHITE_KINGSIDE: 0x1,
        WHITE_QUEENSIDE: 0x2,
        BLACK_KINGSIDE: 0x4,
        BLACK_QUEENSIDE: 0x8
    },
    PIECE_OFFSETS: {
        'p': [], // Pawn moves are handled separately
        'P': [],
        'n': [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
        'N': [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
        'b': [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        'B': [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        'r': [[-1, 0], [0, -1], [0, 1], [1, 0]],
        'R': [[-1, 0], [0, -1], [0, 1], [1, 0]],
        'q': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
        'Q': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
        'k': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
        'K': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    },
    SLIDING_PIECES: ['b', 'B', 'r', 'R', 'q', 'Q'],

    // Game state tracking
    gameState: {
        position: [], // Current position (will be filled in setupPosition)
        activeColor: 'w', // 'w' or 'b'
        castlingRights: 0x0F, // All castling rights by default
        enPassantTarget: null, // Square where en passant capture is possible
        halfMoveClock: 0, // For 50-move rule
        fullMoveNumber: 1,
        kingPositions: {w: -1, b: -1} // Track king positions for check detection
    },

    // Initialize the game state from a position array
    setupPosition: function (position) {
        this.gameState.position = [...position];

        // Find king positions
        for (let i = 0; i < 64; i++) {
            const piece = position[i];
            if (piece === 'K') {
                this.gameState.kingPositions.w = i;
            } else if (piece === 'k') {
                this.gameState.kingPositions.b = i;
            }
        }

        this.gameState.activeColor = 'w';
        this.gameState.castlingRights = 0x0F;
        this.gameState.enPassantTarget = null;
        this.gameState.halfMoveClock = 0;
        this.gameState.fullMoveNumber = 1;
    },

    // Parse FEN notation and update internal state
    parseFEN: function (fen) {
        const parts = fen.trim().split(' ');
        const position = new Array(64).fill('');

        let rank = 0;
        let file = 0;
        for (const char of parts[0]) {
            if (char === '/') {
                rank++;
                file = 0;
            } else if (/\d/.test(char)) {
                file += parseInt(char);
            } else {
                const index = rank * 8 + file;
                position[index] = char;
                file++;
            }
        }

        this.setupPosition(position);

        this.gameState.activeColor = parts[1] === 'w' ? 'w' : 'b';

        // Castling rights
        this.gameState.castlingRights = 0;
        if (parts[2].includes('K')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_KINGSIDE;
        if (parts[2].includes('Q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_QUEENSIDE;
        if (parts[2].includes('k')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_KINGSIDE;
        if (parts[2].includes('q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_QUEENSIDE;

        // En passant target
        this.gameState.enPassantTarget = parts[3] !== '-' ? this.algebraicToIndex(parts[3]) : null;

        // Half move clock and full move number
        this.gameState.halfMoveClock = parseInt(parts[4]) || 0;
        this.gameState.fullMoveNumber = parseInt(parts[5]) || 1;

        return position;
    },

    // Generate FEN from current position
    generateFEN: function () {
        let fen = '';

        // Piece placement
        for (let rank = 0; rank < 8; rank++) {
            let emptySquares = 0;
            for (let file = 0; file < 8; file++) {
                const index = rank * 8 + file;
                const piece = this.gameState.position[index];

                if (piece === '') {
                    emptySquares++;
                } else {
                    if (emptySquares > 0) {
                        fen += emptySquares;
                        emptySquares = 0;
                    }
                    fen += piece;
                }
            }

            if (emptySquares > 0) {
                fen += emptySquares;
            }

            if (rank < 7) {
                fen += '/';
            }
        }

        // Active color
        fen += ' ' + this.gameState.activeColor;

        // Castling rights
        let castling = '';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE) castling += 'K';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE) castling += 'Q';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE) castling += 'k';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE) castling += 'q';
        fen += ' ' + (castling || '-');

        // En passant target
        fen += ' ' + (this.gameState.enPassantTarget !== null ?
            this.indexToAlgebraic(this.gameState.enPassantTarget) : '-');

        // Half move clock and full move number
        fen += ' ' + this.gameState.halfMoveClock;
        fen += ' ' + this.gameState.fullMoveNumber;

        return fen;
    },

    // Convert algebraic notation to board index
    algebraicToIndex: function (algebraic) {
        const file = algebraic.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, ...
        const rank = 8 - parseInt(albraic[1]);
        return rank * 8 + file;
    },

    // Convert board index to algebraic notation
    indexToAlgebraic: function (index) {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        return String.fromCharCode(97 + file) + (8 - rank);
    },

    // Check if a square is on the board
    isOnBoard: function (rank, file) {
        return rank >= 0 && rank < 8 && file >= 0 && file < 8;
    },

    // Get piece color ('w' or 'b' or null if empty)
    getPieceColor: function (piece) {
        if (piece === '') return null;
        return piece === piece.toUpperCase() ? 'w' : 'b';
    },

    // Check if a piece is of a specific color
    isPieceColor: function (piece, color) {
        if (piece === '') return false;
        return color === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
    },

    // Check if the king is in check
    isInCheck: function (position, kingPos, color) {
        const enemyColor = color === 'w' ? 'b' : 'w';

        // Check for attacks from each enemy piece
        for (let i = 0; i < 64; i++) {
            const piece = position[i];
            if (piece === '' || this.getPieceColor(piece) !== enemyColor) continue;

            const moves = this.generatePieceMoves(position, i, false);
            for (const move of moves) {
                if (move.to === kingPos) {
                    return true;
                }
            }
        }

        return false;
    },

    // Generate all possible moves for a specific piece
    generatePieceMoves: function (position, fromIndex, checkLegality = true) {
        const piece = position[fromIndex];
        if (piece === '') return [];

        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const fromRank = Math.floor(fromIndex / 8);
        const fromFile = fromIndex % 8;
        const moves = [];

        // Handle pawn moves
        if (pieceType === 'p') {
            const direction = color === 'w' ? -1 : 1;
            const startRank = color === 'w' ? 6 : 1;

            // Forward move
            const oneForward = fromIndex + direction * 8;
            if (oneForward >= 0 && oneForward < 64 && position[oneForward] === '') {
                moves.push({from: fromIndex, to: oneForward});

                if (fromRank === startRank) {
                    const twoForward = fromIndex + direction * 16;
                    if (position[twoForward] === '') {
                        moves.push({from: fromIndex, to: twoForward, flags: 'double_push'});
                    }
                }
            }

            const captureOffsets = [direction * 8 - 1, direction * 8 + 1];
            for (const offset of captureOffsets) {
                const toIndex = fromIndex + offset;

                if (toIndex < 0 || toIndex >= 64) continue;
                const toFile = toIndex % 8;
                if (Math.abs(fromFile - toFile) !== 1) continue;

                // Regular capture
                if (position[toIndex] !== '' && this.isPieceColor(position[toIndex], color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }

                // En passant capture
                if (toIndex === this.gameState.enPassantTarget) {
                    moves.push({from: fromIndex, to: toIndex, flags: 'en_passant'});
                }
            }
        }
        // Knight moves
        else if (pieceType === 'n') {
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                const toRank = fromRank + rankOffset;
                const toFile = fromFile + fileOffset;

                if (!this.isOnBoard(toRank, toFile)) continue;

                const toIndex = toRank * 8 + toFile;
                const targetPiece = position[toIndex];

                if (targetPiece === '' || this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }
            }
        }
        // Sliding pieces (bishop, rook, queen)
        else if (this.SLIDING_PIECES.includes(pieceType)) {
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                let toRank = fromRank + rankOffset;
                let toFile = fromFile + fileOffset;

                while (this.isOnBoard(toRank, toFile)) {
                    const toIndex = toRank * 8 + toFile;
                    const targetPiece = position[toIndex];

                    // Empty square
                    if (targetPiece === '') {
                        moves.push({from: fromIndex, to: toIndex});
                    }
                    // Capture
                    else if (this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                        moves.push({from: fromIndex, to: toIndex});
                        break;
                    }
                    // Own piece - stop looking in this direction
                    else {
                        break;
                    }

                    toRank += rankOffset;
                    toFile += fileOffset;
                }
            }
        }
        // King moves
        else if (pieceType === 'k') {
            // Normal king moves
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                const toRank = fromRank + rankOffset;
                const toFile = fromFile + fileOffset;

                if (!this.isOnBoard(toRank, toFile)) continue;

                const toIndex = toRank * 8 + toFile;
                const targetPiece = position[toIndex];

                // Empty square or capture
                if (targetPiece === '' || this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }
            }

            // Castling
            if (!checkLegality || !this.isInCheck(position, fromIndex, color)) {
                // Kingside castling
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE))) {

                    const kingFinalPos = color === 'w' ? 62 : 6;
                    const kingStartPos = color === 'w' ? 60 : 4;

                    if (position[kingFinalPos - 1] === '' && position[kingFinalPos] === '') {
                        // Check if squares are not under attack
                        if (!checkLegality ||
                            (!this.isSquareAttacked(position, kingStartPos + 1, color) &&
                                !this.isSquareAttacked(position, kingFinalPos, color))) {
                            moves.push({from: fromIndex, to: kingFinalPos, flags: 'kingside_castle'});
                        }
                    }
                }

                // Queenside castling
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE))) {

                    const kingFinalPos = color === 'w' ? 58 : 2;
                    const kingStartPos = color === 'w' ? 60 : 4;

                    if (position[kingFinalPos + 1] === '' && position[kingFinalPos] === '' && position[kingFinalPos - 1] === '') {
                        // Check if squares are not under attack
                        if (!checkLegality ||
                            (!this.isSquareAttacked(position, kingStartPos - 1, color) &&
                                !this.isSquareAttacked(position, kingFinalPos, color))) {
                            moves.push({from: fromIndex, to: kingFinalPos, flags: 'queenside_castle'});
                        }
                    }
                }
            }
        }

        // Filter out illegal moves that would leave the king in check
        if (checkLegality) {
            return moves.filter(move => this.isMoveLegal(position, move, color));
        }

        return moves;
    },

    // Check if a move is legal (doesn't leave the king in check)
    isMoveLegal: function (position, move, color) {
        // Create a copy of the position to make the move
        const newPosition = [...position];

        // Move the piece
        const piece = newPosition[move.from];
        newPosition[move.to] = piece;
        newPosition[move.from] = '';

        // Special handling for en passant capture
        if (move.flags === 'en_passant') {
            const capturedPawnPos = move.to + (color === 'w' ? 8 : -8);
            newPosition[capturedPawnPos] = '';
        }

        // Special handling for castling
        if (move.flags === 'kingside_castle') {
            const rookFromPos = color === 'w' ? 63 : 7;
            const rookToPos = color === 'w' ? 61 : 5;
            newPosition[rookToPos] = color === 'w' ? 'R' : 'r';
            newPosition[rookFromPos] = '';
        } else if (move.flags === 'queenside_castle') {
            const rookFromPos = color === 'w' ? 56 : 0;
            const rookToPos = color === 'w' ? 59 : 3;
            newPosition[rookToPos] = color === 'w' ? 'R' : 'r';
            newPosition[rookFromPos] = '';
        }

        // Find the king's position after the move
        let kingPos;
        if (piece.toLowerCase() === 'k') {
            kingPos = move.to;
        } else {
            kingPos = this.findKing(newPosition, color);
        }

        // Check if the king is in check after the move
        return !this.isInCheck(newPosition, kingPos, color);
    },

    // Check if a square is attacked by any enemy piece
    isSquareAttacked: function (position, index, defenderColor) {
        const attackerColor = defenderColor === 'w' ? 'b' : 'w';

        for (let i = 0; i < 64; i++) {
            const piece = position[i];
            if (piece === '' || this.getPieceColor(piece) !== attackerColor) continue;

            const moves = this.generatePieceMoves(position, i, false);
            for (const move of moves) {
                if (move.to === index) {
                    return true;
                }
            }
        }

        return false;
    },

    // Find the king's position on the board
    findKing: function (position, color) {
        const kingPiece = color === 'w' ? 'K' : 'k';
        for (let i = 0; i < 64; i++) {
            if (position[i] === kingPiece) {
                return i;
            }
        }
        return -1; // This should never happen in a valid position
    },

    // Generate all legal moves for the current player
    generateAllLegalMoves: function () {
        const allMoves = [];
        const color = this.gameState.activeColor;

        for (let i = 0; i < 64; i++) {
            const piece = this.gameState.position[i];
            if (piece === '' || this.getPieceColor(piece) !== color) continue;

            const pieceMoves = this.generatePieceMoves(this.gameState.position, i, true);
            allMoves.push(...pieceMoves);
        }

        return allMoves;
    },

    // Make a move on the board
    makeMove: function (move) {
        // Get information about the current state before the move
        const piece = this.gameState.position[move.from];
        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const isCapture = this.gameState.position[move.to] !== '';

        // Save previous state for potential rollback
        const prevState = {
            position: [...this.gameState.position],
            activeColor: this.gameState.activeColor,
            castlingRights: this.gameState.castlingRights,
            enPassantTarget: this.gameState.enPassantTarget,
            halfMoveClock: this.gameState.halfMoveClock,
            fullMoveNumber: this.gameState.fullMoveNumber,
            kingPositions: {...this.gameState.kingPositions}
        };

        // Record the captured piece
        let capturedPiece = this.gameState.position[move.to];

        // Move the piece
        this.gameState.position[move.to] = piece;
        this.gameState.position[move.from] = '';

        // Update king positions if king moved
        if (pieceType === 'k') {
            this.gameState.kingPositions[color] = move.to;
        }

        // Special move handling
        if (move.flags === 'en_passant') {
            const capturedPawnPos = move.to + (color === 'w' ? 8 : -8);
            capturedPiece = this.gameState.position[capturedPawnPos];
            this.gameState.position[capturedPawnPos] = '';
        } else if (move.flags === 'kingside_castle') {
            const rookFromPos = color === 'w' ? 63 : 7;
            const rookToPos = color === 'w' ? 61 : 5;
            this.gameState.position[rookToPos] = color === 'w' ? 'R' : 'r';
            this.gameState.position[rookFromPos] = '';
        } else if (move.flags === 'queenside_castle') {
            const rookFromPos = color === 'w' ? 56 : 0;
            const rookToPos = color === 'w' ? 59 : 3;
            this.gameState.position[rookToPos] = color === 'w' ? 'R' : 'r';
            this.gameState.position[rookFromPos] = '';
        } else if (move.flags === 'promotion') {
            this.gameState.position[move.to] = color === 'w' ?
                move.promotionPiece.toUpperCase() : move.promotionPiece.toLowerCase();
        }

        // Update castling rights
        if (pieceType === 'k') {
            if (color === 'w') {
                this.gameState.castlingRights &= ~(this.CASTLING_RIGHTS.WHITE_KINGSIDE | this.CASTLING_RIGHTS.WHITE_QUEENSIDE);
            } else {
                this.gameState.castlingRights &= ~(this.CASTLING_RIGHTS.BLACK_KINGSIDE | this.CASTLING_RIGHTS.BLACK_QUEENSIDE);
            }
        } else if (pieceType === 'r') {
            const fromFile = move.from % 8;
            const fromRank = Math.floor(move.from / 8);

            if (color === 'w') {
                if (fromRank === 7 && fromFile === 7) {
                    this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.WHITE_KINGSIDE;
                } else if (fromRank === 7 && fromFile === 0) {
                    this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.WHITE_QUEENSIDE;
                }
            } else {
                if (fromRank === 0 && fromFile === 7) {
                    this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.BLACK_KINGSIDE;
                } else if (fromRank === 0 && fromFile === 0) {
                    this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.BLACK_QUEENSIDE;
                }
            }
        }

        // Update castling rights if a rook is captured
        if (isCapture) {
            const toRank = Math.floor(move.to / 8);
            const toFile = move.to % 8;

            if (toRank === 0 && toFile === 0) {
                this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.BLACK_QUEENSIDE;
            } else if (toRank === 0 && toFile === 7) {
                this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.BLACK_KINGSIDE;
            } else if (toRank === 7 && toFile === 0) {
                this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.WHITE_QUEENSIDE;
            } else if (toRank === 7 && toFile === 7) {
                this.gameState.castlingRights &= ~this.CASTLING_RIGHTS.WHITE_KINGSIDE;
            }
        }

        // Update en passant target
        if (move.flags === 'double_push') {
            this.gameState.enPassantTarget = move.from + (color === 'w' ? 8 : -8);
        } else {
            this.gameState.enPassantTarget = null;
        }

        // Update half-move clock
        if (pieceType === 'p' || isCapture) {
            this.gameState.halfMoveClock = 0;
        } else {
            this.gameState.halfMoveClock++;
        }

        // Update full move number
        if (color === 'b') {
            this.gameState.fullMoveNumber++;
        }

        // Switch active color
        this.gameState.activeColor = color === 'w' ? 'b' : 'w';

        // Check if move was legal (king is not in check)
        const kingPos = this.gameState.kingPositions[color];
        if (this.isInCheck(this.gameState.position, kingPos, color)) {
            // Illegal move, revert to previous state
            this.gameState = prevState;
            return {success: false, reason: 'illegal_move'};
        }

        return {
            success: true,
            capturedPiece: capturedPiece,
            flags: move.flags || null,
            isCheck: this.isInCheck(
                this.gameState.position,
                this.gameState.kingPositions[this.gameState.activeColor],
                this.gameState.activeColor
            )
        };
    },

    // Check the current game state (normal, check, checkmate, stalemate)
    checkGameState: function () {
        const color = this.gameState.activeColor;
        const kingPos = this.gameState.kingPositions[color];
        const isInCheck = this.isInCheck(this.gameState.position, kingPos, color);
        const hasLegalMoves = this.generateAllLegalMoves().length > 0;

        if (isInCheck && !hasLegalMoves) {
            return 'checkmate';
        } else if (!isInCheck && !hasLegalMoves) {
            return 'stalemate';
        } else if (isInCheck) {
            return 'check';
        } else if (this.gameState.halfMoveClock >= 100) {
            return 'draw_fifty_move';
        }

        return 'normal';
    },

    // Generate algebraic notation for a move
    generateMoveNotation: function (move, isCheck, isCheckmate) {
        const piece = this.getPieceAt(move.from);
        const pieceType = piece.toLowerCase();
        const pieceSymbol = pieceType === 'p' ? '' : pieceType.toUpperCase();

        // Handle castling
        if (piece.toUpperCase() === 'K' && Math.abs(move.from % 8 - move.to % 8) > 1) {
            const isKingside = move.to % 8 > move.from % 8;
            const notation = isKingside ? 'O-O' : 'O-O-O';
            return isCheckmate ? notation + '#' : (isCheck ? notation + '+' : notation);
        }

        let notation = pieceSymbol;

        // Add disambiguation if needed
        if (pieceType !== 'p' && pieceType !== 'k') {
            const ambiguousMoves = this.findAmbiguousMoves(move);
            if (ambiguousMoves.length > 0) {
                // Check if file disambiguation is sufficient
                const sameFileCount = ambiguousMoves.filter(m => m.from % 8 === move.from % 8).length;
                if (sameFileCount === 0) {
                    // File is sufficient for disambiguation
                    notation += String.fromCharCode(97 + (move.from % 8));
                } else {
                    // Need rank or full coordinate
                    const sameRankCount = ambiguousMoves.filter(m => Math.floor(m.from / 8) === Math.floor(move.from / 8)).length;
                    if (sameRankCount === 0) {
                        // Rank is sufficient
                        notation += 8 - Math.floor(move.from / 8);
                    } else {
                        // Need full coordinate
                        notation += this.indexToAlgebraic(move.from);
                    }
                }
            }
        }

        // Add capture symbol
        const isCapture = this.getPieceAt(move.to) !== '' || move.flags === 'en_passant';
        if (isCapture) {
            // For pawns, add file of origin
            if (pieceSymbol === '' && !notation.includes(String.fromCharCode(97 + (move.from % 8)))) {
                notation += String.fromCharCode(97 + (move.from % 8));
            }
            notation += 'x';
        }

        // Add destination square
        notation += this.indexToAlgebraic(move.to);

        // Add promotion piece
        if (move.flags === 'promotion') {
            notation += '=' + move.promotionPiece.toUpperCase();
        }

        // Add check or checkmate symbol
        if (isCheckmate) {
            notation += '#';
        } else if (isCheck) {
            notation += '+';
        }

        return notation;
    },

    // Find moves that could be ambiguous in notation
    findAmbiguousMoves: function (move) {
        const piece = this.getPieceAt(move.from);
        const color = this.getPieceColor(piece);
        const ambiguousMoves = [];

        for (let i = 0; i < 64; i++) {
            if (i === move.from) continue;

            const otherPiece = this.getPieceAt(i);
            if (otherPiece === piece) {
                const moves = this.generatePieceMoves(this.gameState.position, i, true);
                for (const m of moves) {
                    if (m.to === move.to) {
                        ambiguousMoves.push({from: i, to: move.to});
                    }
                }
            }
        }

        return ambiguousMoves;
    },

    // Get piece at a specific index
    getPieceAt: function (index) {
        return this.gameState.position[index];
    },

    // Set position from an existing board state
    setPositionFromState: function (position, activeColor = 'w') {
        this.setupPosition(position);
        this.gameState.activeColor = activeColor;

        // Reset en passant target when loading a new position
        this.gameState.enPassantTarget = null;
    }
};

// ======= Game State Management =======
const STATE = {
    board: [],
    currentPosition: [],
    selectedSquare: null,
    flipped: false,
    gameId: null,
    userColor: null,
    gameStatus: 'waiting',
    socket: null,
    userId: null,
    username: null,
    manuallyFlipped: false,
    opponentId: null,
    opponentName: null,
    lastMove: null,
    moveHistory: [],
    chatMessages: [],
    legalMoves: {}, // Store precomputed legal moves for current player
    animation: {
        inProgress: false,
        elements: [],
        callback: null
    },
    clock: {
        white: null,         // White player's time in milliseconds
        black: null,         // Black player's time in milliseconds
        increment: 0,        // Increment in milliseconds
        lastMoveTime: null,  // Server timestamp of last move
        started: false,      // Has the clock started?
        intervalId: null     // ID of the clock update interval
    }
};

// Initialize the clocks based on game data
function initClocks(gameData) {
    console.log('Initializing clocks with data:', gameData);

    // Clear any existing interval
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }

    // Check if the game has time control
    if (!gameData.time_control || gameData.time_control === 'unlimited') {
        console.log('Game has unlimited time');
        STATE.clock.white = null;
        STATE.clock.black = null;
        STATE.clock.increment = 0;
        STATE.clock.started = false;
        updateClockDisplay('white', null);
        updateClockDisplay('black', null);
        return;
    }
    
    // Handle string-based time controls (e.g., 'blitz', 'rapid', 'classical')
    if (typeof gameData.time_control === 'string') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control;
        }
        
        console.log('Game has time control:', gameData.time_control);
        
        // Set times based on the time control type
        switch(gameData.time_control) {
            case 'blitz':
                STATE.clock.white = 5 * 60 * 1000; // 5 minutes
                STATE.clock.black = 5 * 60 * 1000;
                break;
            case 'rapid':
                STATE.clock.white = 10 * 60 * 1000; // 10 minutes
                STATE.clock.black = 10 * 60 * 1000;
                break;
            case 'classical':
                STATE.clock.white = 30 * 60 * 1000; // 30 minutes
                STATE.clock.black = 30 * 60 * 1000;
                break;
            default:
                STATE.clock.white = 10 * 60 * 1000; // Default to 10 minutes
                STATE.clock.black = 10 * 60 * 1000;
        }
        
        STATE.clock.increment = 0; // Default to no increment for string-based controls
    } 
    // Handle object-based time controls (with properties like initial_time_ms, increment, type)
    else if (typeof gameData.time_control === 'object') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control.type || 'Custom';
        }
        
        console.log('Game has time control:', gameData.time_control.type);
        
        // Use initial_time_ms from time_control object for both clocks
        if (gameData.time_control.initial_time_ms !== undefined) {
            STATE.clock.white = gameData.time_control.initial_time_ms;
            STATE.clock.black = gameData.time_control.initial_time_ms;
            STATE.clock.increment = gameData.time_control.increment || 0;
        } else {
            // Fallback based on type if initial_time_ms is not provided
            switch(gameData.time_control.type) {
                case 'blitz':
                    STATE.clock.white = 5 * 60 * 1000;
                    STATE.clock.black = 5 * 60 * 1000;
                    break;
                case 'rapid':
                    STATE.clock.white = 10 * 60 * 1000;
                    STATE.clock.black = 10 * 60 * 1000;
                    break;
                case 'classical':
                    STATE.clock.white = 30 * 60 * 1000;
                    STATE.clock.black = 30 * 60 * 1000;
                    break;
                default:
                    STATE.clock.white = 10 * 60 * 1000;
                    STATE.clock.black = 10 * 60 * 1000;
            }
        }
    }
    
    // If the server provides explicit time values for each player, use those instead
    if (gameData.white_time_ms !== undefined && gameData.white_time_ms !== null) {
        STATE.clock.white = gameData.white_time_ms;
    }
    
    if (gameData.black_time_ms !== undefined && gameData.black_time_ms !== null) {
        STATE.clock.black = gameData.black_time_ms;
    }
    
    if (gameData.increment_ms !== undefined) {
        STATE.clock.increment = gameData.increment_ms;
    }

    // Set additional clock properties
    STATE.clock.lastMoveTime = gameData.last_move_timestamp ? new Date(gameData.last_move_timestamp).getTime() : null;
    STATE.clock.started = gameData.status === 'active';

    // Force an immediate sync with server to get the most accurate times
    if (STATE.clock.started) {
        // First update the display with what we have (to avoid flickering)
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
        
        // Then immediately sync with the server
        syncClockWithServer(true); // Pass true to indicate this is the initial sync
    } else {
        // Just update the display for a game that hasn't started
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
    }

    console.log('Clocks initialized (v3):', STATE.clock);
}

// Parse the time control string into initial time and increment
function parseTimeControl(timeControlStr) {
    // Default values
    const result = {
        initial: null,   // No time limit by default
        increment: 0     // No increment by default
    };

    // Handle simple string formats
    if (!timeControlStr || timeControlStr === 'unlimited') {
        return result;
    }

    if (typeof timeControlStr === 'object') {
        // If it's already an object, use it directly
        return {
            initial: timeControlStr.initial_time_ms || null,
            increment: timeControlStr.increment_ms || 0
        };
    }

    // Otherwise parse the string format
    switch (timeControlStr) {
        case 'blitz':
            result.initial = 5 * 60 * 1000; // 5 minutes in ms
            break;
        case 'rapid':
            result.initial = 10 * 60 * 1000; // 10 minutes in ms
            break;
        case 'classical':
            result.initial = 30 * 60 * 1000; // 30 minutes in ms
            break;
        default:
            // Try to parse as "initial+increment" format (e.g., "5+2")
            const match = timeControlStr.match(/^(\d+)(?:\+(\d+))?$/);
            if (match) {
                result.initial = parseInt(match[1]) * 60 * 1000; // Minutes to ms
                if (match[2]) {
                    result.increment = parseInt(match[2]) * 1000; // Seconds to ms
                }
            }
    }

    return result;
}

// Start the clock interval to update the active player's clock
function startClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
    }

    const updateRate = 100; // Update every 100ms for smoother display
    STATE.clock.intervalId = setInterval(() => {
        updateActiveClock();
    }, updateRate);
}

// Stop the clock interval
function stopClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }
}

// Update the active player's clock
function updateActiveClock() {
    if (!STATE.clock.started || STATE.gameStatus !== 'active') {
        stopClockInterval();
        return;
    }

    // Determine which player's turn it is
    const activeColor = ChessRules.gameState.activeColor === 'w' ? 'white' : 'black';

    // Update the active clock
    if (STATE.clock[activeColor] !== null) {
        // Decrement the time
        STATE.clock[activeColor] -= 100; // Subtract 100ms

        // Check for timeout
        if (STATE.clock[activeColor] <= 0) {
            STATE.clock[activeColor] = 0;
            handleTimeout(activeColor);
        }

        // Update the display
        updateClockDisplay(activeColor, STATE.clock[activeColor]);
    }
}

// Handle a player timing out
function handleTimeout(color) {
    console.log(`${color} player ran out of time`);
    stopClockInterval();
    STATE.clock.started = false;

    // Emit event to the server to handle the timeout
    if (STATE.socket) {
        STATE.socket.emit('time_out', {
            game_id: STATE.gameId,
            token: localStorage.getItem('token'),
            color: color
        });
    }

    // Handle UI changes for timeout
    const winner = color === 'white' ? 'black' : 'white';
    showGameResult({
        result: 'timeout',
        winner: winner === STATE.userColor ? STATE.userId : STATE.opponentId
    });
}

// Update the clock display for a player
function updateClockDisplay(color, timeMs) {
    const displayId = color === 'white' ?
        (STATE.userColor === 'white' ? 'player-clock' : 'opponent-clock') :
        (STATE.userColor === 'white' ? 'opponent-clock' : 'player-clock');

    const clockElement = document.getElementById(displayId);
    if (!clockElement) return;

    if (timeMs === null) {
        clockElement.textContent = '--:--';
        return;
    }

    // Format the time
    const formattedTime = formatClockTime(timeMs);
    clockElement.textContent = formattedTime;

    // Add visual indicators
    clockElement.classList.remove('clock-active', 'clock-low');

    // Check if this is the active clock
    if (STATE.clock.started && ChessRules.gameState.activeColor === (color === 'white' ? 'w' : 'b')) {
        clockElement.classList.add('clock-active');
    }

    // Check if time is running low (less than 30 seconds)
    if (timeMs < 30000) {
        clockElement.classList.add('clock-low');
    }
}

// Format milliseconds into a clock display string
function formatClockTime(ms) {
    if (ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // For times less than 10 seconds, show deciseconds
    if (totalSeconds < 10) {
        const deciseconds = Math.floor((ms % 1000) / 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${deciseconds}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
function setupClockSync() {
    // Do an immediate sync
    syncClockWithServer();

    // Then set up an interval to sync every 10 seconds
    // This helps prevent drift between client and server clocks
    setInterval(() => {
        if (STATE.gameStatus === 'active' && STATE.clock.started) {
            syncClockWithServer();
        }
    }, 10000);
}

// Sync clock with server
function syncClockWithServer(isInitialSync = false) {
    if (!STATE.socket || !STATE.gameId) return;

    console.log('Syncing clock with server...');

    // Store the sync request time
    const syncRequestTime = Date.now();

    STATE.socket.emit('get_remaining_time', {
        game_id: STATE.gameId,
        token: localStorage.getItem('token')
    });

    // If this is the initial sync, we'll set up a one-time listener for the response
    if (isInitialSync) {
        // Use once() to ensure this only happens once
        STATE.socket.once('clock_update', (data) => {
            console.log('Initial clock sync received:', data);

            // Calculate network latency (very simplified)
            const latency = Math.floor((Date.now() - syncRequestTime) / 2);
            console.log('Estimated one-way latency:', latency, 'ms');

            // Update clock state with server values
            if (data.white_time_ms !== undefined) {
                STATE.clock.white = data.white_time_ms;
            }
            if (data.black_time_ms !== undefined) {
                STATE.clock.black = data.black_time_ms;
            }
            if (data.increment_ms !== undefined) {
                STATE.clock.increment = data.increment_ms;
            }
            if (data.last_move_timestamp) {
                STATE.clock.lastMoveTime = new Date(data.last_move_timestamp).getTime();
            }

            // Update displays
            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);

            // Start clock interval if the game is active
            if (STATE.clock.started && STATE.gameStatus === 'active' &&
                STATE.clock.white !== null && STATE.clock.black !== null) {
                startClockInterval();
            }
        });
    }
}
// Handle a move being made - switch the clock
function handleClockAfterMove(color) {
    if (STATE.clock.white === null || STATE.clock.black === null) {
        return; // No time control
    }

    // Get the color that just moved
    const movingColor = color ||
        (ChessRules.gameState.activeColor === 'w' ? 'black' : 'white');

    // Add increment to the player who just moved
    if (STATE.clock.increment > 0) {
        STATE.clock[movingColor] += STATE.clock.increment;
    }

    // Make sure clocks are started after the first move
    if (!STATE.clock.started && STATE.gameStatus === 'active') {
        STATE.clock.started = true;
        startClockInterval();
    }

    // Update both displays
    updateClockDisplay('white', STATE.clock.white);
    updateClockDisplay('black', STATE.clock.black);
}
// ======= Utility Functions =======

// Convert file (0-7) and rank (0-7) to algebraic notation (a1, h8, etc.)
function fileRankToPosition(file, rank) {
    const fileChar = String.fromCharCode(97 + file);
    const rankChar = 8 - rank;
    return fileChar + rankChar;
}

// Convert algebraic notation to file and rank
function positionToFileRank(position) {
    const file = position.charCodeAt(0) - 97;
    const rank = 8 - parseInt(position[1]);
    return { file, rank };
}

// Convert position index to algebraic notation
function indexToAlgebraic(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return fileRankToPosition(file, rank);
}

// Convert algebraic notation to position index
function algebraicToIndex(algebraic) {
    const { file, rank } = positionToFileRank(algebraic);
    return rank * 8 + file;
}

// Get square element for a given board index
function getSquareElement(index) {
    // Convert internal index to file and rank
    const file = index % 8;
    const rank = Math.floor(index / 8);

    // Convert to algebraic notation, considering board orientation
    let position;
    if (STATE.flipped) {
        position = fileRankToPosition(7 - file, 7 - rank);
    } else {
        position = fileRankToPosition(file, rank);
    }

    // Get the square element
    return document.querySelector(`.square[data-position="${position}"]`);
}

// Convert a move object to UCI notation
function moveToUci(move) {
    const from = indexToAlgebraic(move.from);
    const to = indexToAlgebraic(move.to);

    // Handle promotion
    if (move.flags === 'promotion' && move.promotionPiece) {
        return `${from}${to}${move.promotionPiece}`;
    }

    return `${from}${to}`;
}

// Convert UCI notation to a move object
function uciToMove(uci) {
    if (typeof uci !== 'string' || uci.length < 4) {
        console.error('Invalid UCI notation:', uci);
        return null;
    }

    const from = algebraicToIndex(uci.substring(0, 2));
    const to = algebraicToIndex(uci.substring(2, 4));

    let flags = null;
    let promotionPiece = null;

    // Check for promotion
    if (uci.length === 5) {
        flags = 'promotion';
        promotionPiece = uci[4];
    }
    // Check for en passant
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'p' &&
             Math.abs(from % 8 - to % 8) === 1 &&
             ChessRules.gameState.position[to] === '') {
        flags = 'en_passant';
    }
    // Check for castling
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'k' &&
             Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }

    return { from, to, flags, promotionPiece };
}

// Check if it's the current player's turn
function isPlayersTurn() {
    const userColor = document.getElementById('user-color').value;
    const fen = ChessRules.generateFEN();
    const isWhiteTurn = fen.split(' ')[1] === 'w';

    return (userColor === 'white' && isWhiteTurn) || (userColor === 'black' && !isWhiteTurn);
}

// ======= DOM Manipulation Functions =======

// Initialize the board elements
function initBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const square = document.createElement('div');
            const isLight = (rank + file) % 2 === 0;
            square.className = `square ${isLight ? 'light' : 'dark'}`;

            const position = fileRankToPosition(file, rank);
            square.dataset.position = position;

            square.addEventListener('click', () => handleSquareClick(position));
            board.appendChild(square);
        }
    }

    setupStartingPosition();
}

// Setup the starting position
function setupStartingPosition() {
    STATE.currentPosition = [
        'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
        'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
        'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'
    ];

    // Initialize the chess rules engine
    ChessRules.setupPosition(STATE.currentPosition);

    // Precompute legal moves for the starting position
    precomputeLegalMoves();

    updateBoard();
    updateGameStateUI();
}

// Update the visual board based on the current position
// Replace the updateBoard function in script.js
function updateBoard() {
    const squares = document.querySelectorAll('.square');

    // Clear all squares first
    squares.forEach(square => {
        // Remove any existing pieces
        const img = square.querySelector('img');
        if (img) {
            square.removeChild(img);
        }
    });

    // Now add pieces based on current position
    squares.forEach(square => {
        // Get the square's position (like "a1", "e4", etc.)
        const position = square.dataset.position;
        const {file, rank} = positionToFileRank(position);

        // Adjust for board orientation
        const adjustedIndex = STATE.flipped
            ? (7 - rank) * 8 + (7 - file)
            : rank * 8 + file;

        const piece = STATE.currentPosition[adjustedIndex];

        if (piece) {
            const img = document.createElement('img');
            const color = piece.toUpperCase() === piece ? 'w' : 'b';
            const pieceChar = piece.toLowerCase();
            const pieceName = PIECE_TYPES[pieceChar];

            img.src = `/static/images/${pieceName}-${color}.svg`;
            img.draggable = false;
            square.appendChild(img);
        }
    });

    // Synchronize rules engine with current position
    ChessRules.setPositionFromState(STATE.currentPosition,
        STATE.gameStatus === 'active' ? ChessRules.gameState.activeColor : 'w');

    // Precompute legal moves for the current position
    precomputeLegalMoves();

    // Update game state display
    updateGameStateUI();

    console.log('Board updated with position:', [...STATE.currentPosition]);
}

// Update the UI based on the current game state
function updateGameStateUI() {
    // Check for check, checkmate, stalemate
    const gameState = ChessRules.checkGameState();
    const gameStatusDisplay = document.getElementById('game-status');
    const checkIndicator = document.getElementById('check-indicator');

    // Check if the game is active
    if (STATE.gameStatus !== 'active') {
        gameStatusDisplay.textContent = 'Waiting for opponent...';
        checkIndicator.style.display = 'none';
        return;
    }

    // Clear any existing indicators
    document.querySelectorAll('.check-indicator').forEach(el => el.remove());

    // Set proper text based on whose turn and game state
    if (gameState === 'checkmate') {
        const winner = ChessRules.gameState.activeColor === 'w' ? 'Black' : 'White';
        gameStatusDisplay.textContent = `Checkmate! ${winner} wins.`;
        checkIndicator.style.display = 'none';
        // Show the game result UI
        showGameResult(winner.toLowerCase() === STATE.userColor ? 'win' : 'loss');
    } else if (gameState === 'stalemate' || gameState === 'draw_fifty_move') {
        gameStatusDisplay.textContent = gameState === 'stalemate' ? 'Stalemate! The game is a draw.' : 'Draw by fifty-move rule.';
        checkIndicator.style.display = 'none';
        // Show the game result UI
        showGameResult('draw');
    } else if (gameState === 'check') {
        const colorInCheck = ChessRules.gameState.activeColor;
        const playerInCheck = colorInCheck === 'w' ? 'White' : 'Black';
        gameStatusDisplay.textContent = `${playerInCheck} is in check!`;
        checkIndicator.style.display = 'block';

        // Mark the king that's in check
        const kingPos = ChessRules.gameState.kingPositions[colorInCheck];
        highlightKingInCheck(kingPos);
    } else {
        // Normal play - show whose turn it is
        const colorToMove = ChessRules.gameState.activeColor;
        const isPlayersTurn = (STATE.userColor === 'white' && colorToMove === 'w') ||
                            (STATE.userColor === 'black' && colorToMove === 'b');

        gameStatusDisplay.textContent = isPlayersTurn ? 'Your turn' : 'Opponent\'s turn';
        checkIndicator.style.display = 'none';
    }

    // Precompute legal moves for the current position
    precomputeLegalMoves();
}

// Replace the showGameResult function in script.js (around line 2100)

function showGameResult(result) {
    const gameResult = document.getElementById('game-result');
    const resultMessage = document.getElementById('result-message');

    if (!gameResult || !resultMessage) {
        console.error('Game result elements not found');
        return;
    }

    console.log('Showing game result:', result);

    // Determine the result type and message
    let message = '';
    let cause = '';
    let resultClass = '';

    // Check if the current user is the winner
    const isWinner = result.winner === STATE.userId;
    const isLoser = result.loser === STATE.userId;
    const isDraw = result.result === 'draw' || result.winner === 'draw';

    // Handle different result types
    if (isDraw) {
        message = 'Draw';
        resultClass = 'draw';
        
        if (result.result_type) {
            switch(result.result_type) {
                case 'agreement':
                    cause = 'By agreement';
                    break;
                case 'stalemate':
                    cause = 'By stalemate';
                    break;
                case 'fifty_move':
                    cause = 'By fifty-move rule';
                    break;
                case 'insufficient':
                    cause = 'By insufficient material';
                    break;
                default:
                    cause = 'By ' + result.result_type;
            }
        } else {
            cause = 'By agreement';
        }
    } 
    else if (result.result === 'timeout') {
        if (isLoser) {
            message = 'You lost';
            resultClass = 'loss';
            cause = 'On time';
        } else {
            message = 'You won';
            resultClass = 'win';
            cause = 'Opponent ran out of time';
        }
    }
    else if (result.result === 'resigned' || result.result === 'resignation') {
        if (isLoser) {
            message = 'You lost';
            resultClass = 'loss';
            cause = 'By resignation';
        } else {
            message = 'You won';
            resultClass = 'win';
            cause = 'Opponent resigned';
        }
    }
    else if (isWinner) {
        message = 'You won';
        resultClass = 'win';
        cause = result.result_type ? 'By ' + result.result_type : 'By checkmate';
    } 
    else {
        message = 'You lost';
        resultClass = 'loss';
        cause = result.result_type ? 'By ' + result.result_type : 'By checkmate';
    }

    // Set the message content
    resultMessage.innerHTML = `
        <div class="result-header">${message}</div>
        <div class="result-cause">${cause}</div>
    `;
    
    // ✅ SMOOTH ANIMATION: Reset classes and set up for animation
    gameResult.className = 'game-result-panel'; // Clear all classes
    gameResult.style.display = 'block'; // Make visible but still hidden via CSS
    
    // ✅ FORCE REFLOW: Ensure initial state is applied
    gameResult.offsetHeight;
    
    // ✅ TRIGGER ANIMATION: Add classes to start smooth transition
    gameResult.classList.add('show', resultClass);

    // Disable game interaction
    disableGameInteraction();

    // Show a notification
    showNotification(`${message} - ${cause}`, resultClass === 'win' ? 'success' :
        (resultClass === 'loss' ? 'error' : 'info'));

    // Update game status display
    const gameStatus = document.getElementById('game-status');
    if (gameStatus) {
        gameStatus.textContent = `Game over - ${message} ${cause}`;
    }

    // ✅ SMOOTH SCROLL: Scroll the result into view smoothly
    setTimeout(() => {
        gameResult.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
        });
    }, 100); // Small delay to let animation start
}

// ✅ ADD FUNCTION: Hide game result with animation
function hideGameResult() {
    const gameResult = document.getElementById('game-result');
    if (!gameResult) return;
    
    // Remove show class and add hide class
    gameResult.classList.remove('show');
    gameResult.classList.add('hide');
    
    // After animation completes, fully hide
    setTimeout(() => {
        gameResult.style.display = 'none';
        gameResult.classList.remove('hide');
    }, 300); // Match CSS transition duration
}

// ✅ IMPROVED: Update result panel for loading existing games
function showGameResultForExistingGame(gameData) {
    if (gameData.status !== 'completed') return;
    
    // Determine result based on game data
    const result = {
        game_id: gameData.game_id,
        winner: gameData.winner,
        result_type: gameData.result_type || 'checkmate'
    };
    
    // Small delay to ensure board is loaded first
    setTimeout(() => {
        showGameResult(result);
    }, 500); // Give time for board to render
}
// Update ELO calculation and display logic
function updateELODisplay(playerRating, opponentRating, gameTimeControl) {
    // playerRating and opponentRating are objects with keys: blitz, rapid, classical
    // Choose which rating to update based on gameTimeControl
    let ratingKey;
    switch(gameTimeControl) {
        case 'blitz':
            ratingKey = 'blitz';
            break;
        case 'rapid':
            ratingKey = 'rapid';
            break;
        case 'classical':
            ratingKey = 'classical';
            break;
        default:
            ratingKey = 'classical';
    }
    const playerELOElement = document.getElementById('game-result-elo'); // in result box
    if (!playerELOElement) {
        console.error('Result ELO element not found');
        return;
    }
    // Compute new rating (using k=32)
    const kFactor = 32;
    const expected = 1/(1+Math.pow(10, (opponentRating[ratingKey]-playerRating[ratingKey])/400));
    // Assume game result is win for player; adjust externally if loss/draw
    const score = 1; 
    const newRating = Math.round(playerRating[ratingKey] + kFactor * (score - expected));
    playerELOElement.textContent = `${newRating}`;
}

function disableGameInteraction() {
    // Remove click handlers from squares
    document.querySelectorAll('.square').forEach(square => {
        const newSquare = square.cloneNode(true);
        square.parentNode.replaceChild(newSquare, square);
    });

    // Disable game action buttons

    const drawBtn = document.getElementById('draw-btn');
    const resignBtn = document.getElementById('resign-btn')
    if (resignBtn) resignBtn.disabled = true;
    if (drawBtn) drawBtn.disabled = true;
}

// Highlight the king that's in check
function highlightKingInCheck(kingPos) {
    const kingRank = Math.floor(kingPos / 8);
    const kingFile = kingPos % 8;

    // Convert to visual position (adjusting for board flip)
    const visualPos = STATE.flipped
        ? fileRankToPosition(7 - kingFile, 7 - kingRank)
        : fileRankToPosition(kingFile, kingRank);

    const kingSquare = document.querySelector(`.square[data-position="${visualPos}"]`);
    if (kingSquare) {
        const checkIndicator = document.createElement('div');
        checkIndicator.className = 'check-indicator';
        kingSquare.appendChild(checkIndicator);
    }
}

// Precompute legal moves for the current player
function precomputeLegalMoves() {
    STATE.legalMoves = {}; // Reset the legal moves cache

    // Only compute legal moves if it's the player's turn
    if (!isPlayersTurn()) return;

    const color = ChessRules.gameState.activeColor;

    // Loop through all squares
    for (let i = 0; i < 64; i++) {
        const piece = STATE.currentPosition[i];
        // If square has a piece of the current player's color
        if (piece && ChessRules.getPieceColor(piece) === color) {
            // Compute legal moves for this piece
            const moves = ChessRules.generatePieceMoves(STATE.currentPosition, i, true);
            if (moves.length > 0) {
                STATE.legalMoves[i] = moves;
            }
        }
    }
}

// Display possible moves for a selected piece
function showPossibleMoves(index) {
    // Clear any existing indicators
    clearPossibleMoves();

    // Get legal moves for the selected piece from precomputed cache
    const legalMoves = STATE.legalMoves[index] || [];

    for (const move of legalMoves) {
        // Convert to visual position (adjusting for board flip)
        const toRank = Math.floor(move.to / 8);
        const toFile = move.to % 8;
        const visualPos = STATE.flipped
            ? fileRankToPosition(7 - toFile, 7 - toRank)
            : fileRankToPosition(toFile, toRank);

        const targetSquare = document.querySelector(`.square[data-position="${visualPos}"]`);
        if (!targetSquare) continue;

        // Check if this is an en passant capture
        const isEnPassant = move.flags === 'en_passant';

        // Create appropriate indicator based on move type
        if (STATE.currentPosition[move.to] !== '' || isEnPassant) {
            // Capture move - including en passant
            const captureIndicator = document.createElement('div');
            captureIndicator.className = 'possible-capture';
            targetSquare.appendChild(captureIndicator);
        } else {
            // Regular move
            const moveIndicator = document.createElement('div');
            moveIndicator.className = 'possible-move';
            targetSquare.appendChild(moveIndicator);
        }
    }
}

// Clear all possible move indicators
function clearPossibleMoves() {
    document.querySelectorAll('.possible-move, .possible-capture').forEach(el => el.remove());
}

// Highlight a square
function highlightSquare(index) {
    clearHighlights();

    const {file, rank} = STATE.flipped
        ? {file: 7 - (index % 8), rank: 7 - Math.floor(index / 8)}
        : {file: index % 8, rank: Math.floor(index / 8)};

    const position = fileRankToPosition(file, rank);
    const square = document.querySelector(`.square[data-position="${position}"]`);

    if (square) {
        square.classList.add('highlighted');
    }
}

// Clear all highlights
function clearHighlights() {
    document.querySelectorAll('.square').forEach(s => {
        s.classList.remove('highlighted');
    });
}

// Update the moves list display
function updateMovesList() {
    const movesList = document.getElementById('moves-list');
    if (!movesList) return;

    movesList.innerHTML = '';

    if (STATE.moveHistory.length === 0) {
        movesList.innerHTML = '<p>No moves made yet.</p>';
        return;
    }

    let moveHtml = '';
    let moveNumber = 1;

    for (let i = 0; i < STATE.moveHistory.length; i += 2) {
        moveHtml += `<div class="move-row">`;
        moveHtml += `<span class="move-number">${moveNumber}.</span>`;

        // White's move
        moveHtml += `<span class="move">${STATE.moveHistory[i].notation}</span>`;

        // Black's move (if exists)
        if (i + 1 < STATE.moveHistory.length) {
            moveHtml += `<span class="move">${STATE.moveHistory[i + 1].notation}</span>`;
        } else {
            moveHtml += `<span class="move-placeholder"></span>`;
        }

        moveHtml += `</div>`;
        moveNumber++;
    }

    movesList.innerHTML = moveHtml;

    // Scroll to the bottom
    movesList.scrollTop = movesList.scrollHeight;
}

// Show the promotion dialog when a pawn reaches the last rank
function showPromotionDialog(move, callback) {
    const promotionOverlay = document.getElementById('promotion-overlay');
    const promotionPieces = document.getElementById('promotion-pieces');

    // Clear previous pieces
    promotionPieces.innerHTML = '';

    // Get player color
    const color = STATE.userColor === 'white' ? 'w' : 'b';

    // Add promotion pieces (queen, rook, bishop, knight)
    const pieces = ['q', 'r', 'b', 'n'];

    pieces.forEach(pieceType => {
        const pieceElement = document.createElement('div');
        pieceElement.className = 'promotion-piece';

        const pieceImg = document.createElement('img');
        pieceImg.src = `/static/images/${PIECE_TYPES[pieceType]}-${color}.svg`;
        pieceImg.draggable = false;

        pieceElement.appendChild(pieceImg);
        pieceElement.addEventListener('click', () => {
            promotionOverlay.style.display = 'none';
            callback(pieceType);
        });

        promotionPieces.appendChild(pieceElement);
    });

    // Show the promotion dialog
    promotionOverlay.style.display = 'flex';
}

// Animation functions
function animatePieceMove(fromSquare, toSquare, piece, duration = 200, callback = null, isCastling = false, rookData = null) {
    // First, finish any animation that might be in progress
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    // Set animation state
    STATE.animation.inProgress = true;
    STATE.animation.elements = [];
    STATE.animation.callback = callback;

    // Create the animated piece element
    const animatedPiece = document.createElement('img');
    const color = piece.toUpperCase() === piece ? 'w' : 'b';
    const pieceChar = piece.toLowerCase();
    const pieceName = PIECE_TYPES[pieceChar];

    animatedPiece.src = `/static/images/${pieceName}-${color}.svg`;
    animatedPiece.className = 'piece';

    // Add to animation elements list for cleanup
    STATE.animation.elements.push(animatedPiece);

    // Position calculations - get actual screen coordinates
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();
    const boardContainer = document.querySelector('.board-container');
    const boardRect = boardContainer.getBoundingClientRect();

    // Size calculations
    const squareSize = fromRect.width;
    const pieceSize = Math.round(squareSize * 0.95);
    animatedPiece.style.width = `${pieceSize}px`;
    animatedPiece.style.height = `${pieceSize}px`;

    // Add to DOM
    boardContainer.appendChild(animatedPiece);

    // Calculate centering offset
    const offsetX = (squareSize - pieceSize) / 2;

    // Set initial position based on visual fromRect
    animatedPiece.style.left = `${fromRect.left - boardRect.left + offsetX}px`;
    animatedPiece.style.top = `${fromRect.top - boardRect.top + offsetX}px`;

    // Hide the original image during animation
    const originalImg = fromSquare.querySelector('img');
    if (originalImg) {
        // Explicitly set opacity to 0 in addition to adding the class
        originalImg.style.opacity = '0';
        originalImg.classList.add('animating');
    }

    // For castling, we need to animate both king and rook
    if (isCastling && rookData) {
        const { rookFromSquare, rookToSquare, rookPiece } = rookData;

        // Create rook animation element
        const animatedRook = document.createElement('img');
        const rookColor = rookPiece.toUpperCase() === rookPiece ? 'w' : 'b';
        animatedRook.src = `/static/images/rook-${rookColor}.svg`;
        animatedRook.className = 'piece';

        // Add to animation elements list for cleanup
        STATE.animation.elements.push(animatedRook);

        // Position the rook using DOM coordinates
        const rookFromRect = rookFromSquare.getBoundingClientRect();
        const rookToRect = rookToSquare.getBoundingClientRect();

        animatedRook.style.width = `${pieceSize}px`;
        animatedRook.style.height = `${pieceSize}px`;

        // Add to DOM
        boardContainer.appendChild(animatedRook);

        // Set initial rook position based on visual rect
        animatedRook.style.left = `${rookFromRect.left - boardRect.left + offsetX}px`;
        animatedRook.style.top = `${rookFromRect.top - boardRect.top + offsetX}px`;

        // Hide the original rook during animation
        const originalRookImg = rookFromSquare.querySelector('img');
        if (originalRookImg) {
            // Explicitly set opacity to 0 in addition to adding the class
            originalRookImg.style.opacity = '0';
            originalRookImg.classList.add('animating');
        }

        // We use a requestAnimationFrame trick to ensure all layout is done
        // before starting the transition for smoother animation
        requestAnimationFrame(() => {
            // Set transitions for both pieces
            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            animatedRook.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            // Move king to destination using visual coordinates
            const destXKing = toRect.left - boardRect.left + offsetX;
            const destYKing = toRect.top - boardRect.top + offsetX;
            animatedPiece.style.left = `${destXKing}px`;
            animatedPiece.style.top = `${destYKing}px`;

            // Move rook to destination using visual coordinates
            const destXRook = rookToRect.left - boardRect.left + offsetX;
            const destYRook = rookToRect.top - boardRect.top + offsetX;
            animatedRook.style.left = `${destXRook}px`;
            animatedRook.style.top = `${destYRook}px`;

            // Use transitionend event for completion
            let animationsCompleted = 0;
            const onTransitionEnd = () => {
                animationsCompleted++;

                // When both pieces have completed their transitions
                if (animationsCompleted === 2) {
                    // Check if animation was canceled
                    if (!STATE.animation.inProgress) return;

                    // Update UI after animation completes
                    finishCurrentAnimation();
                }
            };

            animatedPiece.addEventListener('transitionend', onTransitionEnd, { once: true });
            animatedRook.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Safety timeout in case transitions don't fire their events
            setTimeout(() => {
                if (STATE.animation.inProgress &&
                    STATE.animation.elements.includes(animatedPiece)) {
                    finishCurrentAnimation();
                }
            }, duration + 50);
        });
    } else {
        // Regular non-castling animation
        requestAnimationFrame(() => {
            // Calculate destination using visual coordinates
            const destX = toRect.left - boardRect.left + offsetX;
            const destY = toRect.top - boardRect.top + offsetX;

            // Set transition
            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            // Move to destination
            animatedPiece.style.left = `${destX}px`;
            animatedPiece.style.top = `${destY}px`;

            // Listen for transition completion
            animatedPiece.addEventListener('transitionend', () => {
                // Check if animation was canceled
                if (!STATE.animation.inProgress) return;

                // Complete the animation
                finishCurrentAnimation();
            }, { once: true });

            // Safety timeout in case transition doesn't fire its event
            setTimeout(() => {
                if (STATE.animation.inProgress &&
                    STATE.animation.elements.includes(animatedPiece)) {
                    finishCurrentAnimation();
                }
            }, duration + 50);
        });
    }
}

function finishCurrentAnimation() {
    if (!STATE.animation.inProgress) return;

    // Remove all animated pieces
    STATE.animation.elements.forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });

    // Make sure all pieces that were hidden for animation are visible again
    document.querySelectorAll('.animating').forEach(el => {
        el.classList.remove('animating');
        // Also explicitly restore opacity
        el.style.opacity = '1';
    });

    // Execute the callback synchronously rather than waiting for animation to complete
    if (STATE.animation.callback) {
        const callback = STATE.animation.callback;
        STATE.animation.callback = null;
        callback();
    }

    // Reset animation state
    STATE.animation.inProgress = false;
    STATE.animation.elements = [];
}

// ======= Game Logic Functions =======

// Handle click on a square
function handleSquareClick(position) {
    // If animation is in progress, finish it
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    // Check if the game is active and it's player's turn
    if (STATE.gameStatus !== 'active' || !isPlayersTurn()) {
        return;
    }

    const { file, rank } = positionToFileRank(position);
    const index = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;

    // Check if a piece is at the clicked position and it's the current player's turn
    const pieceAtClicked = STATE.currentPosition[index];
    const isCurrentPlayerPiece = pieceAtClicked &&
        ChessRules.getPieceColor(pieceAtClicked) === ChessRules.gameState.activeColor;

    if (STATE.selectedSquare === null) {
        // If no square is selected and clicked on a piece of the current player, select it
        if (isCurrentPlayerPiece) {
            STATE.selectedSquare = index;
            highlightSquare(index);
            showPossibleMoves(index);
        }
    } else {
        // If a square is already selected

        // If clicked on the same piece that's already selected, unselect it
        if (STATE.selectedSquare === index) {
            clearHighlights();
            clearPossibleMoves();
            STATE.selectedSquare = null;
            return;
        }

        // If clicked on another piece of the current player, select it instead
        if (isCurrentPlayerPiece && STATE.selectedSquare !== index) {
            clearHighlights();
            clearPossibleMoves();
            STATE.selectedSquare = index;
            highlightSquare(index);
            showPossibleMoves(index);
            return;
        }

        // If clicked on a different square, try to move the piece
        if (STATE.selectedSquare !== index) {
            // Get the legal moves for the selected piece from precomputed cache
            const legalMoves = STATE.legalMoves[STATE.selectedSquare] || [];
            const legalMove = legalMoves.find(move => move.to === index);

            if (legalMove) {
                // Handle the move
                makeMove(STATE.selectedSquare, index, legalMove);
            } else {
                // Clear selection if clicked on an illegal destination
                clearHighlights();
                clearPossibleMoves();
                STATE.selectedSquare = null;
            }
        }
    }
}

// Execute a move and send it to the server
function makeMove(fromIndex, toIndex, moveObj) {
    // Check for promotion
    const piece = STATE.currentPosition[fromIndex];
    const isPawn = piece.toLowerCase() === 'p';
    const toRank = Math.floor(toIndex / 8);
    const isLastRank = (piece === 'P' && toRank === 0) || (piece === 'p' && toRank === 7);

    if (isPawn && isLastRank) {
        // Show promotion dialog
        showPromotionDialog({from: fromIndex, to: toIndex}, (promotionPiece) => {
            // Create the move object with promotion
            const move = {
                from: fromIndex,
                to: toIndex,
                flags: 'promotion',
                promotionPiece: promotionPiece
            };

            // Execute the move locally
            const result = executeLocalMove(move);

            if (result.success) {
                // Send the move to the server
                const uciMove = moveToUci(move);
                sendMoveToServer(uciMove);
            }
        });
    } else {
        // Execute the move locally
        const result = executeLocalMove(moveObj);

        if (result.success) {
            // Send the move to the server
            const uciMove = moveToUci(moveObj);
            sendMoveToServer(uciMove);
        }
    }
}


// Update setInitialBoardOrientation function
function setInitialBoardOrientation() {
    console.log("Setting initial board orientation. User color:", STATE.userColor);

    // Auto-flip board for black player
    if (STATE.userColor === 'black') {
        console.log("Player is black, flipping board");
        STATE.flipped = true;
        STATE.manuallyFlipped = false; // This is the natural orientation for black
        updateBoard();
    } else {
        // Ensure board is not flipped for white player
        console.log("Player is white, normal orientation");
        STATE.flipped = false;
        STATE.manuallyFlipped = false; // This is the natural orientation for white
        updateBoard();
    }

    // Always update player boxes after setting orientation
    updatePlayerBoxes();
}



function updatePlayerBoxes() {
    const topPlayerBox = document.getElementById('top-player-box');
    const bottomPlayerBox = document.getElementById('bottom-player-box');
    const playerInfo = document.getElementById('player-info');
    const opponentInfo = document.getElementById('opponent-info');

    if (!topPlayerBox || !bottomPlayerBox || !playerInfo || !opponentInfo) {
        console.error('Player box elements not found');
        return;
    }

    console.log(`Updating player boxes. Board flipped: ${STATE.flipped}, Manually flipped: ${STATE.manuallyFlipped}, User color: ${STATE.userColor}`);

    // First, remove the info divs from their current parents if needed
    if (playerInfo.parentNode) {
        playerInfo.parentNode.removeChild(playerInfo);
    }

    if (opponentInfo.parentNode) {
        opponentInfo.parentNode.removeChild(opponentInfo);
    }

    // If the board is in its manual flip state (user clicked flip button)
    // then player should be at top, opponent at bottom
    if (STATE.manuallyFlipped) {
        console.log("Manual flip: player at top, opponent at bottom");
        topPlayerBox.appendChild(playerInfo);
        bottomPlayerBox.appendChild(opponentInfo);
    } else {
        // Natural orientation: player at bottom, opponent at top
        console.log("Natural orientation: player at bottom, opponent at top");
        topPlayerBox.appendChild(opponentInfo);
        bottomPlayerBox.appendChild(playerInfo);
    }
}
// Execute a move locally (on the client)
// Replace the entire executeLocalMove function in script.js
function executeLocalMove(moveObj) {
    // Make a copy of the move object
    const move = {...moveObj};

    // Save the piece being moved before any changes
    const piece = STATE.currentPosition[move.from];

    // Get the from and to square elements for animation
    const fromSquare = getSquareElement(move.from);
    const toSquare = getSquareElement(move.to);

    if (!fromSquare || !toSquare) {
        console.error('Could not find squares for animation');
        return { success: false, reason: 'animation_error' };
    }

    // Execute move in the rules engine
    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Failed to execute move in rules engine:', result.reason);
        return result;
    }

    // Update current position after successful move
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Generate proper algebraic notation
    let notation;
    if (piece.toLowerCase() === 'p') {
        // Special handling for pawn moves
        if (move.flags === 'promotion') {
            notation = indexToAlgebraic(move.to) + '=' + move.promotionPiece.toUpperCase();
        } else if (result.capturedPiece || move.flags === 'en_passant') {
            // Capture
            notation = indexToAlgebraic(move.from)[0] + 'x' + indexToAlgebraic(move.to);
        } else {
            // Normal pawn move
            notation = indexToAlgebraic(move.to);
        }
    } else if (move.flags === 'kingside_castle') {
        notation = 'O-O';
    } else if (move.flags === 'queenside_castle') {
        notation = 'O-O-O';
    } else {
        // Standard piece move
        notation = piece.toUpperCase();
        if (result.capturedPiece) {
            notation += 'x';
        }
        notation += indexToAlgebraic(move.to);
    }

    // Add check or checkmate indicator
    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

    // Create UCI format for server communication (e.g., "e2e4")
    const uciNotation = indexToAlgebraic(move.from) + indexToAlgebraic(move.to);

    // Add move to history
    STATE.moveHistory.push({
        from: move.from,
        to: move.to,
        piece: piece,
        captured: result.capturedPiece,
        promotion: move.promotionPiece,
        flags: move.flags,
        notation: notation,
        uci: uciNotation
    });

    // Update the UI
    updateMovesList();

    // Handle animation
    if (move.flags === 'kingside_castle' || move.flags === 'queenside_castle') {
        // Special castling animation with both king and rook
        const color = ChessRules.getPieceColor(piece);
        const isKingside = move.flags === 'kingside_castle';

        // Calculate logical positions for rook
        const rookFromIndex = color === 'w' ?
            (isKingside ? 63 : 56) :
            (isKingside ? 7 : 0);

        const rookToIndex = color === 'w' ?
            (isKingside ? 61 : 59) :
            (isKingside ? 5 : 3);

        // Get visual squares for rook animation
        const rookFromSquare = getSquareElement(rookFromIndex);
        const rookToSquare = getSquareElement(rookToIndex);

        if (rookFromSquare && rookToSquare) {
            const rookData = {
                rookFromSquare,
                rookToSquare,
                rookPiece: color === 'w' ? 'R' : 'r'
            };

            // Animate king and rook together
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                // Make sure to update the board after animation completes
                updateBoard();
            }, true, rookData);
        } else {
            // Fallback if rook squares not found
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                updateBoard();
            });
        }
    } else {
        // Regular move animation
        animatePieceMove(fromSquare, toSquare, piece, 200, () => {
            // Critical: update the board after animation completes
            updateBoard();
        });
    }

    // Clear selection
    clearHighlights();
    clearPossibleMoves();
    STATE.selectedSquare = null;
    if (result.success) {
        // Get the player color who just moved
        const playerColor = STATE.userColor;

        // Update clock after move
        handleClockAfterMove(playerColor);
    return result;

}
    if (result.success) {
        // Check if the game has ended
        const gameState = ChessRules.checkGameState();
        if (gameState === 'checkmate' || gameState === 'stalemate' ||
            gameState === 'draw_fifty_move' || gameState.includes('draw')) {

            // Create result object with specific details
            const gameResult = {
                game_id: STATE.gameId
            };

            if (gameState === 'checkmate') {
                // Checkmate - current player won
                gameResult.result = 'win';
                gameResult.winner = STATE.userId;
                gameResult.result_type = 'checkmate';
            } else {
                // Draw with specific reason
                gameResult.result = 'draw';
                gameResult.winner = 'draw';

                if (gameState === 'stalemate') {
                    gameResult.result_type = 'stalemate';
                } else if (gameState === 'draw_fifty_move') {
                    gameResult.result_type = 'fifty_move';
                } else {
                    // Default to generic draw if we can't determine specific reason
                    gameResult.result_type = 'other';
                }
            }

            // Show the result after board updates and animation
            const originalCallback = STATE.animation.callback;
            STATE.animation.callback = () => {
                if (originalCallback) originalCallback();

                // Small delay to ensure UI is updated first
                setTimeout(() => {
                    showGameResult(gameResult);
                }, 100);
            };
        }
    }
        }

// Handle opponent's move received from server
function handleOpponentMove(moveData) {
    // Parse the UCI move string
    const move = uciToMove(moveData.move);

    // Get the from and to square elements for animation
    const fromSquare = getSquareElement(move.from);
    const toSquare = getSquareElement(move.to);
    const piece = STATE.currentPosition[move.from];

    // Execute the move in the rules engine
    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Invalid move from opponent:', moveData);
        return;
    }

    // Update current position
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Create move notation
    const notation = ChessRules.generateMoveNotation(
        move,
        result.isCheck,
        ChessRules.checkGameState() === 'checkmate'
    );

    // Add move to history
    STATE.moveHistory.push({
        from: move.from,
        to: move.to,
        piece: piece,
        captured: result.capturedPiece,
        promotion: move.promotionPiece,
        flags: move.flags,
        notation: notation
    });

    // Update the UI
    updateMovesList();

    // Handle animation
    if (move.flags === 'kingside_castle' || move.flags === 'queenside_castle') {
        // Special castling animation
        const color = ChessRules.getPieceColor(piece);
        const isKingside = move.flags === 'kingside_castle';

        // Calculate logical positions for rook
        const rookFromIndex = color === 'w' ?
            (isKingside ? 63 : 56) :
            (isKingside ? 7 : 0);

        const rookToIndex = color === 'w' ?
            (isKingside ? 61 : 59) :
            (isKingside ? 5 : 3);

        // Get visual squares for rook animation
        const rookFromSquare = getSquareElement(rookFromIndex);
        const rookToSquare = getSquareElement(rookToIndex);

        if (rookFromSquare && rookToSquare) {
            const rookData = {
                rookFromSquare,
                rookToSquare,
                rookPiece: color === 'w' ? 'R' : 'r'
            };

            // Animate king and rook together
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                updateBoard();
            }, true, rookData);
        } else {
            // Fallback if rook squares not found
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                updateBoard();
            });
        }
    } else {
        // Regular move animation
        animatePieceMove(fromSquare, toSquare, piece, 200, () => {
            updateBoard();
        });
    }
    const opponentColor = STATE.userColor === 'white' ? 'black' : 'white';

    // Update clock after move
    handleClockAfterMove(opponentColor);
}

// Load a position from FEN
function loadFEN(fen) {
    try {
        // Use the rules engine to parse the FEN
        const position = ChessRules.parseFEN(fen);

        // Update the application state
        STATE.currentPosition = [...position];

        // Update the board display
        updateBoard();

        return true;
    } catch (error) {
        console.error('Error parsing FEN:', error);
        return false;
    }
}

// ======= Server Communication =======

// Initialize Socket.IO connection
function initSocket() {
    // Load the game ID from the URL or hidden input
    const gameIdInput = document.getElementById('game-id');
    if (!gameIdInput || !gameIdInput.value) {
        console.error('No game ID found');
        alert('Game ID is missing. Please try rejoining the game from the dashboard.');
        return;
    }

    const gameId = gameIdInput.value;
    console.log('Initializing socket connection for game:', gameId);

    STATE.gameId = gameId;
    STATE.userColor = document.getElementById('user-color').value || null;

    // Connect to the Socket.IO server
    STATE.socket = io();

    // Connection event
    // Connection event
STATE.socket.on('connect', () => {
    console.log('Connected to server');

    // Join the game room immediately on connection
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found');
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    // First join the game room BEFORE getting game data
    STATE.socket.emit('join_game', {
        game_id: STATE.gameId,
        token: token
    });

    console.log('Joining game room:', STATE.gameId);

    // Set up clock synchronization
    setupClockSync();

    // Small delay before loading game data to ensure room joining completes
    setTimeout(() => {
        // Load game data via API
        fetchGameData(STATE.gameId, token);
    }, 100);
});

    // Disconnection event
    STATE.socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    // Game joined event
    STATE.socket.on('game_joined', (data) => {
        console.log('Joined game room', data);
    });

    // Game state updated event
    // In the initSocket function, add:
    STATE.socket.on('game_updated', (data) => {
    console.log('Game updated event received:', data);

    // If the game is now active (someone joined), refresh the game data
    if (data.status === 'active' && STATE.gameStatus === 'waiting') {
        console.log('Game is now active, refreshing data...');

        // Refresh the game data from the server
        const token = localStorage.getItem('token');
        fetchGameData(STATE.gameId, token);

        // Show notification
        showNotification('Game is now active!', 'success');
    }
});

    // Move made event
    STATE.socket.on('move_made', (moveData) => {
        console.log('Opponent made a move', moveData);

        // Handle opponent's move
        handleOpponentMove(moveData);
    });

    // Game started event
    // Game started event
STATE.socket.on('game_started', (gameData) => {
    console.log('Game started', gameData);

    // Update opponent info
    updateOpponentInfo(gameData.opponent);

    // Set game as active
    STATE.gameStatus = 'active';

    // Update the UI
    updateGameStateUI();

    // Show notification
    showNotification('Opponent has joined the game!', 'success');

    // Update game status text
    const gameStatus = document.getElementById('game-status');
    if (gameStatus) {
        // If it's our turn (white), show "Your turn", otherwise "Opponent's turn"
        const isOurTurn = STATE.userColor === 'white';
        gameStatus.textContent = isOurTurn ? 'Your turn' : 'Opponent\'s turn';
    }

    // Hide the game code container if it's shown
    const gameCodeContainer = document.getElementById('game-code-container');
    if (gameCodeContainer) {
        gameCodeContainer.style.display = 'none';
    }

    // Close the invite modal if it's open
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal && inviteModal.style.display !== 'none') {
        inviteModal.style.display = 'none';
    }
});
    STATE.socket.on('clock_update', (data) => {
    console.log('Clock update received:', data);

    // Don't update if an animation is in progress to avoid visual glitches
    if (STATE.animation.inProgress) {
        console.log('Animation in progress, delaying clock update');
        // Store the update to apply after animation
        setTimeout(() => {
            // Update the clock state
            if (data.white_time_ms !== undefined) {
                STATE.clock.white = data.white_time_ms;
            }
            if (data.black_time_ms !== undefined) {
                STATE.clock.black = data.black_time_ms;
            }
            if (data.increment_ms !== undefined) {
                STATE.clock.increment = data.increment_ms;
            }
            if (data.last_move_timestamp) {
                STATE.clock.lastMoveTime = new Date(data.last_move_timestamp).getTime();
            }

            // Update the displays
            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);
        }, 100); // Short delay to allow animation to complete
    } else {
        // Normal update
        // Update the clock state
        if (data.white_time_ms !== undefined) {
            STATE.clock.white = data.white_time_ms;
        }
        if (data.black_time_ms !== undefined) {
            STATE.clock.black = data.black_time_ms;
        }
        if (data.increment_ms !== undefined) {
            STATE.clock.increment = data.increment_ms;
        }
        if (data.last_move_timestamp) {
            STATE.clock.lastMoveTime = new Date(data.last_move_timestamp).getTime();
        }

        // Update the displays
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
    }
});
    STATE.socket.on('game_result', (result) => {
    console.log('Game result received:', result);

    // Stop the clock when game ends
    stopClockInterval();
    STATE.clock.started = false;

    // Update game status
    STATE.gameStatus = 'completed';

    // Process the result with the enhanced result information
    if (result.result_type) {
        // If we have a specific result type, add it to the result object
        if (!result.result) {
            // Set a default result based on winner
            if (result.winner === 'draw') {
                result.result = 'draw';
            } else if (result.winner === STATE.userId) {
                result.result = 'win';
            } else {
                result.result = 'loss';
            }
        }

        // Create a combined result type for the showGameResult function
        if (result.result === 'draw') {
            result.result = `draw_${result.result_type}`;
        } else {
            // For wins/losses, prefix them with the specific cause
            result.result = `${result.result}_${result.result_type}`;
        }
    }

    // Show game result
    showGameResult(result);
});


    // Error event
    STATE.socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(error.message || 'An error occurred with the game connection');
    });
    // Add these inside the initSocket function after other socket.on handlers
// Draw offer received
STATE.socket.on('draw_offered', (data) => {
    console.log('Draw offered by opponent:', data);

    // Only show the draw offer modal if it wasn't sent by the current user
    if (data.user_id !== STATE.userId) {
        // Show the draw offer modal
        showDrawOfferModal();

        // Show notification
        showNotification('Your opponent has offered a draw', 'info');
    }
});

// Game result (includes checkmate, draw acceptance, resignation)
STATE.socket.on('game_result', (result) => {
    console.log('Game result received:', result);

    // Update game status
    STATE.gameStatus = 'completed';

    // Show game result
    showGameResult(result);
});
}

async function fetchGameData(gameId, token) {
    try {
        console.log('Fetching game data...');

        const response = await fetch(`/api/games/${gameId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load game data');
        }

        const gameData = await response.json();
        console.log('Game data loaded:', gameData);

        // Update game state
        STATE.gameStatus = gameData.status;

        // Update user color - CRITICAL for correct board orientation
        if (gameData.your_color) {
            STATE.userColor = gameData.your_color;
            document.getElementById('user-color').value = gameData.your_color;
        }

        // Update player info
        updatePlayerInfo(gameData);

        // Update opponent info
        const opponent = STATE.userColor === 'white' ? gameData.black_player : gameData.white_player;
        if (opponent) {
            updateOpponentInfo(opponent);
        }
        if (gameData.time_control) {
            updateTimeControlDisplay(gameData.time_control);
        }
        // Important: First load the move history to rebuild the game
        if (gameData.moves && gameData.moves.length > 0) {
            loadMoveHistory(gameData.moves);
        } else if (gameData.fen) {
            // If no moves but FEN is available, use it
            loadFEN(gameData.fen);
        } else {
            // Reset to starting position if no moves or FEN
            setupStartingPosition();
        }

        // Set board orientation AFTER loading positions
        setInitialBoardOrientation();

        // Initialize the clocks with server data
        initClocks(gameData);

        // Force board update after loading position
        updateBoard();

        // Update player boxes
        updatePlayerBoxes();

        // Update UI based on game status
        if (gameData.status === 'completed') {
            showGameResult(gameData.winner || 'draw');
        } else if (gameData.status === 'active') {
            const gameStatus = document.getElementById('game-status');
            if (gameStatus) {
                const isYourTurn = (STATE.userColor === 'white' && ChessRules.gameState.activeColor === 'w') ||
                                  (STATE.userColor === 'black' && ChessRules.gameState.activeColor === 'b');
                gameStatus.textContent = isYourTurn ? 'Your turn' : 'Opponent\'s turn';
            }
        } else if (gameData.status === 'waiting') {
            const gameStatus = document.getElementById('game-status');
            if (gameStatus) {
                gameStatus.textContent = 'Waiting for opponent to join...';
            }

            // Show game code if we're the creator
            const whitePlayerId = gameData.white_player ? gameData.white_player.user_id : null;
            if (whitePlayerId === localStorage.getItem('userId')) {
                showGameInviteModal(gameData.game_code);
            }
        }

        console.log('Game loaded successfully. Current position:', [...STATE.currentPosition]);

    } catch (error) {
        console.error('Error loading game data:', error);
        showNotification('Failed to load game data. Please refresh the page.', 'error');
    }
}


// Add function to show game invite modal
function showGameInviteModal(gameCode) {
    const modal = document.getElementById('invite-modal');
    if (!modal) return;

    const codeDisplay = document.getElementById('game-code-display');
    const linkInput = document.getElementById('game-link');
    const copyCodeBtn = document.getElementById('copy-code');
    const copyLinkBtn = document.getElementById('copy-link');
    const closeBtn = modal.querySelector('.close');

    if (codeDisplay) codeDisplay.textContent = gameCode;
    if (linkInput) linkInput.value = `${window.location.origin}/game/join/${gameCode}`;

    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(gameCode);
            copyCodeBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyCodeBtn.textContent = 'Copy';
            }, 2000);
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(linkInput.value);
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy';
            }, 2000);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Show the modal
    modal.style.display = 'flex';
}

// Function to update player information
function updatePlayerInfo(gameData) {
    const playerName = document.getElementById('player-name');
    const playerRating = document.getElementById('player-rating');

    if (!playerName || !playerRating) return;

    // Determine player data based on user color
    const player = STATE.userColor === 'white' ? gameData.white_player : gameData.black_player;

    if (player) {
        // We have player data from game
        playerName.textContent = player.username;
        playerRating.textContent = `ELO: ${player.elo || '?'}`;

        // Store our user ID for later comparisons
        STATE.userId = player.user_id;
    } else {
        // Fallback to local storage data
        playerName.textContent = localStorage.getItem('username') || 'You';
        playerRating.textContent = '';
        STATE.userId = localStorage.getItem('userId');
    }

    console.log(`Player info updated. User is ${STATE.userColor}.`);
}

// Function to load move history
// Replace the loadMoveHistory function in script.js
function loadMoveHistory(moves) {
    // Clear existing move history
    STATE.moveHistory = [];

    // Reset the position to starting position
    ChessRules.setupPosition([
        'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
        'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
        'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'
    ]);

    // Replay the moves to rebuild proper notation and current position
    for (const move of moves) {
        // Convert the UCI move to internal format
        const from = algebraicToIndex(move.move.substring(0, 2));
        const to = algebraicToIndex(move.move.substring(2, 4));

        // Skip invalid moves
        if (from < 0 || to < 0 || from > 63 || to > 63) {
            console.error('Invalid move in history:', move);
            continue;
        }

        // Get the piece being moved
        const piece = ChessRules.gameState.position[from];
        if (!piece) {
            console.error('No piece found at position:', from, 'for move:', move);
            continue;
        }

        // Determine promotion piece if needed
        let flags = null;
        let promotionPiece = null;

        if (move.move.length === 5) {
            flags = 'promotion';
            promotionPiece = move.move[4].toLowerCase();
        }
        // Check for castling
        else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
            flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
        }
        // Check for en passant
        else if (piece.toLowerCase() === 'p' &&
                Math.abs(from % 8 - to % 8) === 1 &&
                ChessRules.gameState.position[to] === '') {
            flags = 'en_passant';
        }

        // Create move object
        const moveObj = { from, to, flags, promotionPiece };

        // Execute the move in the rules engine
        const result = ChessRules.makeMove(moveObj);

        if (!result.success) {
            console.error('Failed to execute move in history:', move);
            continue;
        }

        // Generate proper algebraic notation
        let notation;
        if (piece.toLowerCase() === 'p') {
            // Pawn move
            if (flags === 'promotion') {
                notation = indexToAlgebraic(to) + '=' + promotionPiece.toUpperCase();
            } else if (result.capturedPiece || flags === 'en_passant') {
                // Capture
                notation = indexToAlgebraic(from)[0] + 'x' + indexToAlgebraic(to);
            } else {
                // Normal pawn move
                notation = indexToAlgebraic(to);
            }
        } else if (flags === 'kingside_castle') {
            notation = 'O-O';
        } else if (flags === 'queenside_castle') {
            notation = 'O-O-O';
        } else {
            // Standard piece move
            notation = piece.toUpperCase();
            if (result.capturedPiece) {
                notation += 'x';
            }
            notation += indexToAlgebraic(to);
        }

        // Add check or checkmate indicator
        if (result.isCheck) {
            notation += '+';
        }

        // Add move to history
        STATE.moveHistory.push({
            from: from,
            to: to,
            piece: piece,
            captured: result.capturedPiece,
            promotion: promotionPiece,
            flags: flags,
            notation: notation,
            uci: move.move
        });
    }

    // Update current position to match the final position from replayed moves
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Update the moves list display
    updateMovesList();
}
// Send a move to the server

async function sendMoveToServer(uciMove) {
    const token = localStorage.getItem('token');

    try {
        console.log('Sending move to server:', uciMove);

        // Send move through the REST API
        const response = await fetch(`/api/games/${STATE.gameId}/move`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ move: uciMove })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server rejected move:', errorData);
            alert('Move failed: ' + (errorData.error || 'Unknown error'));

            // Reload the current game state from server to fix any desync
            fetchGameData(STATE.gameId, token);
            return;
        }

        const gameData = await response.json();
        console.log('Move accepted by server:', gameData);

        // Optional: update with any other game state changes from response
        if (gameData.status === 'completed') {
            // Handle game completion if needed
            console.log('Game completed with result:', gameData.winner);
        }
    } catch (error) {
        console.error('Error sending move to server:', error);
        alert('Failed to send move to server. Please try again.');
    }
}

// Update the handleOpponentMove function:
// Replace the handleOpponentMove function in script.js
function handleOpponentMove(moveData) {
    console.log('Received opponent move:', moveData);

    // Parse the UCI move
    const from = algebraicToIndex(moveData.move.substring(0, 2));
    const to = algebraicToIndex(moveData.move.substring(2, 4));

    // Safety check for invalid indices
    if (from < 0 || from > 63 || to < 0 || to > 63) {
        console.error('Invalid move indices:', from, to);
        return;
    }

    const piece = STATE.currentPosition[from];
    if (!piece) {
        console.error('No piece found at source square:', from);
        // Try to recover by loading FEN if available
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }

    // Determine move type/flags
    let flags = null;
    let promotionPiece = null;

    // Check for promotion
    if (moveData.move.length === 5) {
        flags = 'promotion';
        promotionPiece = moveData.move[4].toLowerCase();
    }
    // Check for castling
    else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }
    // Check for en passant
    else if (piece.toLowerCase() === 'p' && Math.abs(from % 8 - to % 8) === 1 &&
             STATE.currentPosition[to] === '') {
        flags = 'en_passant';
    }

    const move = { from, to, flags, promotionPiece };

    // Get the from and to square elements for animation
    const fromSquare = getSquareElement(from);
    const toSquare = getSquareElement(to);

    // Execute the move in the rules engine
    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Failed to execute opponent move:', result.reason);
        // Fallback to loading the position from FEN if available
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }
    const opponentColor = STATE.userColor === 'white' ? 'black' : 'white';

    // Update clock after move
    handleClockAfterMove(opponentColor);
    // Update current position
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Generate proper notation (same logic as in executeLocalMove)
    let notation;
    if (piece.toLowerCase() === 'p') {
        if (move.flags === 'promotion') {
            notation = indexToAlgebraic(move.to) + '=' + move.promotionPiece.toUpperCase();
        } else if (result.capturedPiece || move.flags === 'en_passant') {
            notation = indexToAlgebraic(move.from)[0] + 'x' + indexToAlgebraic(move.to);
        } else {
            notation = indexToAlgebraic(move.to);
        }
    } else if (move.flags === 'kingside_castle') {
        notation = 'O-O';
    } else if (move.flags === 'queenside_castle') {
        notation = 'O-O-O';
    } else {
        notation = piece.toUpperCase();
        if (result.capturedPiece) {
            notation += 'x';
        }
        notation += indexToAlgebraic(move.to);
    }

    // Add check or checkmate indicator
    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

    // Add move to history
    STATE.moveHistory.push({
        from: move.from,
        to: move.to,
        piece: piece,
        captured: result.capturedPiece,
        promotion: move.promotionPiece,
        flags: move.flags,
        notation: notation,
        uci: moveData.move
    });

    // Update the UI
    updateMovesList();
    if (moveData.status === 'completed') {
        // Determine the game result
        let result = {
            game_id: STATE.gameId
        };

        if (moveData.winner === 'draw') {
            result.result = 'draw';

            // Try to determine the reason for the draw
            if (result.result_type) {
                result.result = `draw_${result.result_type}`;
            } else {
                // If no specific reason, check the board state
                const gameState = ChessRules.checkGameState();
                if (gameState === 'stalemate') {
                    result.result = 'draw_stalemate';
                } else if (gameState === 'draw_fifty_move') {
                    result.result = 'draw_fifty_move';
                } else if (board.isInsufficientMaterial()) {
                    result.result = 'draw_insufficient';
                }
            }
        } else if (moveData.winner === STATE.userId) {
            result.result = 'win';
            result.winner = STATE.userId;
        } else {
            result.result = 'loss';
            result.winner = moveData.winner;
        }

        // After the animation, show the game result
        const originalCallback = STATE.animation.callback;
        STATE.animation.callback = () => {
            if (originalCallback) originalCallback();
            showGameResult(result);
        };
    }
    // Animate the move
    animatePieceMove(fromSquare, toSquare, piece, 200, () => {
        // Critical: update the board after animation completes
        updateBoard();
    });
}

// Handle game state update from server
function handleGameStateUpdate(gameState) {
    // Update current position if FEN provided
    if (gameState.fen && gameState.fen !== ChessRules.generateFEN()) {
        loadFEN(gameState.fen);
    }

    // Update game status
    STATE.gameStatus = gameState.status;

    // Update game state UI
    updateGameStateUI();
}

// Update opponent info in UI
// Update the updateOpponentInfo function
function updateOpponentInfo(opponent) {
    if (!opponent) return;

    console.log('Updating opponent info:', opponent);

    STATE.opponentId = opponent.user_id;
    STATE.opponentName = opponent.username;

    const opponentName = document.getElementById('opponent-name');
    const opponentRating = document.getElementById('opponent-rating');

    if (opponentName) {
        opponentName.textContent = opponent.username || 'Opponent';
    }

    if (opponentRating) {
        opponentRating.textContent = `ELO: ${opponent.elo || '?'}`;
    }

    // Update the player boxes after updating opponent info
    updatePlayerBoxes();

    // Update game status since now we have an opponent
    if (STATE.gameStatus === 'waiting') {
        STATE.gameStatus = 'active';
        updateGameStateUI();
    }

    // Show notification
    showNotification(`${opponent.username} has joined the game!`, 'success');
}
// Show a notification
function showNotification(message, type = 'info') {
    // Check if notification exists already
    let notification = document.querySelector('.notification');

    // Create if it doesn't exist
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Set type and message
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Show the notification
    notification.style.display = 'block';

    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
// Show draw offer modal
function showDrawOfferModal() {
    const modal = document.getElementById('draw-offer-modal');
    if (!modal) {
        console.error('Draw offer modal not found');
        return;
    }

    modal.style.display = 'flex';

    // Handle accept button
    const acceptBtn = document.getElementById('accept-draw');
    if (acceptBtn) {
        acceptBtn.onclick = () => {
            if (STATE.socket) {
                // Send draw acceptance to server
                STATE.socket.emit('accept_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Update game status immediately (the server will confirm)
                const gameStatus = document.getElementById('game-status');
                if (gameStatus) {
                    gameStatus.textContent = 'Draw accepted';
                }

                // Disable game interaction
                disableGameInteraction();

                // Show notification
                showNotification('You accepted the draw offer', 'info');
            }
            modal.style.display = 'none';
        };
    }

    // Handle decline button
    const declineBtn = document.getElementById('decline-draw');
    if (declineBtn) {
        declineBtn.onclick = () => {
            if (STATE.socket) {
                // Send draw decline to server
                STATE.socket.emit('decline_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Show notification
                showNotification('You declined the draw offer', 'info');
            }
            modal.style.display = 'none';
        };
    }
}

// Add a chat message to the UI
function addChatMessage(messageData) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    // Add message to state
    STATE.chatMessages.push(messageData);

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageData.userId === STATE.userId ? 'self' : 'other'}`;

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${messageData.username}</span>
            <span class="message-time">${formatTime(new Date(messageData.timestamp))}</span>
        </div>
        <div class="message-content">${messageData.message}</div>
    `;

    // Add to chat container
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format time for chat messages
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ======= Event Listeners and Initialization =======

// Initialize the game
// Initialize the game
function initGame() {
    // Get user info from localStorage
    STATE.userId = localStorage.getItem('userId');
    STATE.username = localStorage.getItem('username');

    // Set player name in UI
    const playerName = document.getElementById('player-name');
    if (playerName) {
        playerName.textContent = STATE.username;
    }

    // Initialize the board
    initBoard();

    // Get initial user color from hidden input (if available)
    const userColorInput = document.getElementById('user-color');
    if (userColorInput && userColorInput.value) {
        STATE.userColor = userColorInput.value;
        console.log("Initial user color from input:", STATE.userColor);
    }

    // Initialize Socket.IO connection
    initSocket();

    // Add event listeners
    addEventListeners();
}

// Add event listeners
function addEventListeners() {
    // Flip board button
const flipBoardBtn = document.getElementById('flip-board');
if (flipBoardBtn) {
    flipBoardBtn.addEventListener('click', () => {
        STATE.flipped = !STATE.flipped;
        STATE.manuallyFlipped = !STATE.manuallyFlipped; // Toggle the manual flip state
        console.log(`Board manually flipped. Flipped: ${STATE.flipped}, Manual: ${STATE.manuallyFlipped}`);
        updateBoard();
        updatePlayerBoxes();
    });
}

    // Resign button
    // Update the resignBtn event handler in script.js

const resignBtn = document.getElementById('resign-btn');
if (resignBtn) {
    resignBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to resign? This action cannot be undone.')) {
            // Disable the button to prevent multiple clicks
            resignBtn.disabled = true;
            resignBtn.textContent = 'Resigning...';

            // Use socket.io for resignation (more reliable than REST API for real-time game state)
            if (STATE.socket) {
                STATE.socket.emit('resign', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Show notification that resignation was sent
                showNotification('Resignation submitted', 'info');
            } else {
                // Socket not available
                resignBtn.disabled = false;
                resignBtn.textContent = 'Resign';
                alert('Connection error. Please try again.');
            }
        }
    });
}

    // Draw button
    // Draw button handler
const drawBtn = document.getElementById('draw-btn');
if (drawBtn) {
    drawBtn.addEventListener('click', () => {
        if (STATE.socket) {
            STATE.socket.emit('offer_draw', {
                game_id: STATE.gameId,
                token: localStorage.getItem('token')
            });

            // Disable the button temporarily to prevent spam
            drawBtn.disabled = true;
            drawBtn.textContent = 'Draw Offered';

            // Show notification to the user
            showNotification('Draw offer sent to your opponent', 'info');

            // Reset after 3 seconds
            setTimeout(() => {
                drawBtn.disabled = false;
                drawBtn.textContent = 'Offer Draw';
            }, 3000);
        }
    });
}

    // Chat send button
    const sendMsgBtn = document.getElementById('send-message');
    if (sendMsgBtn) {
        sendMsgBtn.addEventListener('click', sendChatMessage);
    }

    // Chat message input (enter key)
    const chatInput = document.getElementById('chat-message');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    // Rematch button
    const rematchBtn = document.getElementById('rematch-btn');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            STATE.socket.emit('request_rematch', {
                game_id: STATE.gameId,
                token: localStorage.getItem('token')
            });

            rematchBtn.textContent = 'Rematch Requested';
            rematchBtn.disabled = true;
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear tokens
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');

            // Redirect to login
            window.location.href = '/login';
        });
    }
}

// Send chat message
function sendChatMessage() {
    const chatInput = document.getElementById('chat-message');
    const message = chatInput.value.trim();

    if (!message) return;

    // Send message to server
    STATE.socket.emit('chat_message', {
        game_id: STATE.gameId,
        message: message,
        token: localStorage.getItem('token')
    });

    // Clear input
    chatInput.value = '';
}

// Check user authentication
function checkAuth() {
    const token = localStorage.getItem('token');

    if (!token) {
        // Redirect to login
        window.location.href = '/login';
        return false;
    }

    return true;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) return;

    // Initialize game
    initGame();
})

// Update time control display with appropriate icon
function updateTimeControlDisplay(timeControl) {
    const timeControlText = document.getElementById('time-control-text');
    const timeControlIcon = document.getElementById('time-control-icon');
    
    if (!timeControlText || !timeControlIcon) return;

    let icon = '<i class="fas fa-infinity"></i>';
    let text = 'Unlimited';
    
    if (timeControl) {
        if (typeof timeControl === 'string') {
            switch(timeControl) {
                case 'blitz':
                    icon = '<i class="fas fa-bolt"></i>';
                    text = '5 min';
                    break;
                case 'rapid':
                    icon = '<i class="fas fa-stopwatch"></i>';
                    text = '10 min';
                    break;
                case 'classical':
                    icon = '<i class="fas fa-chess-clock"></i>';
                    text = '30 min';
                    break;
                case 'unlimited':
                    icon = '<i class="fas fa-infinity"></i>';
                    text = 'Unlimited';
                    break;
                default:
                    text = timeControl;
            }
        } else if (typeof timeControl === 'object') {
            const type = timeControl.type || '';
            const initialMinutes = timeControl.initial_time_ms 
                ? Math.floor(timeControl.initial_time_ms / 60000)
                : 0;
                
            const increment = timeControl.increment
                ? Math.floor(timeControl.increment / 1000)
                : 0;
            console.log('Time : ', initialMinutes,'+', increment);
            switch(type) {
                case 'blitz':
                    icon = '<i class="fas fa-bolt"></i>';
                    break;
                case 'rapid':
                    icon = '<i class="fas fa-stopwatch"></i>';
                    break;
                case 'classical':
                    icon = '<i class="fas fa-chess-clock"></i>';
                    break;
                default:
                    icon = '<i class="fas fa-clock"></i>';
            }
            
            text = increment > 0 ? `${initialMinutes}+${increment}` : `${initialMinutes} min`;
        }
    }
    
    timeControlIcon.innerHTML = icon;
    timeControlText.textContent = text;
}
