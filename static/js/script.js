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
const ChessRules = {
    CASTLING_RIGHTS: {
        WHITE_KINGSIDE: 0x1,
        WHITE_QUEENSIDE: 0x2,
        BLACK_KINGSIDE: 0x4,
        BLACK_QUEENSIDE: 0x8
    },
    PIECE_OFFSETS: {
        'p': [],
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

    gameState: {
        position: [],
        activeColor: 'w',
        castlingRights: 0x0F,
        enPassantTarget: null,
        halfMoveClock: 0,
        fullMoveNumber: 1,
        kingPositions: {w: -1, b: -1}
    },

    setupPosition: function (position) {
        this.gameState.position = [...position];

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

        this.gameState.castlingRights = 0;
        if (parts[2].includes('K')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_KINGSIDE;
        if (parts[2].includes('Q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_QUEENSIDE;
        if (parts[2].includes('k')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_KINGSIDE;
        if (parts[2].includes('q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_QUEENSIDE;

        this.gameState.enPassantTarget = parts[3] !== '-' ? this.algebraicToIndex(parts[3]) : null;

        this.gameState.halfMoveClock = parseInt(parts[4]) || 0;
        this.gameState.fullMoveNumber = parseInt(parts[5]) || 1;

        return position;
    },

    generateFEN: function () {
        let fen = '';

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

        fen += ' ' + this.gameState.activeColor;

        let castling = '';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE) castling += 'K';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE) castling += 'Q';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE) castling += 'k';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE) castling += 'q';
        fen += ' ' + (castling || '-');

        fen += ' ' + (this.gameState.enPassantTarget !== null ?
            this.indexToAlgebraic(this.gameState.enPassantTarget) : '-');

        fen += ' ' + this.gameState.halfMoveClock;
        fen += ' ' + this.gameState.fullMoveNumber;

        return fen;
    },

    algebraicToIndex: function (algebraic) {
        const file = algebraic.charCodeAt(0) - 97;
        const rank = 8 - parseInt(algebraic[1]);
        return rank * 8 + file;
    },

    indexToAlgebraic: function (index) {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        return String.fromCharCode(97 + file) + (8 - rank);
    },

    isOnBoard: function (rank, file) {
        return rank >= 0 && rank < 8 && file >= 0 && file < 8;
    },

    getPieceColor: function (piece) {
        if (piece === '') return null;
        return piece === piece.toUpperCase() ? 'w' : 'b';
    },

    isPieceColor: function (piece, color) {
        if (piece === '') return false;
        return color === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
    },

    isInCheck: function (position, kingPos, color) {
        const enemyColor = color === 'w' ? 'b' : 'w';

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

    generatePieceMoves: function (position, fromIndex, checkLegality = true) {
        const piece = position[fromIndex];
        if (piece === '') return [];

        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const fromRank = Math.floor(fromIndex / 8);
        const fromFile = fromIndex % 8;
        const moves = [];

        if (pieceType === 'p') {
            const direction = color === 'w' ? -1 : 1;
            const startRank = color === 'w' ? 6 : 1;

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

                if (position[toIndex] !== '' && this.isPieceColor(position[toIndex], color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }

                if (toIndex === this.gameState.enPassantTarget) {
                    moves.push({from: fromIndex, to: toIndex, flags: 'en_passant'});
                }
            }
        }
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
        else if (this.SLIDING_PIECES.includes(pieceType)) {
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                let toRank = fromRank + rankOffset;
                let toFile = fromFile + fileOffset;

                while (this.isOnBoard(toRank, toFile)) {
                    const toIndex = toRank * 8 + toFile;
                    const targetPiece = position[toIndex];

                    if (targetPiece === '') {
                        moves.push({from: fromIndex, to: toIndex});
                    }
                    else if (this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                        moves.push({from: fromIndex, to: toIndex});
                        break;
                    }
                    else {
                        break;
                    }

                    toRank += rankOffset;
                    toFile += fileOffset;
                }
            }
        }
        else if (pieceType === 'k') {
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

            // Castling - FIXED: Only check specific castling squares
            if (!checkLegality || !this.isInCheck(position, fromIndex, color)) {
                // Kingside castling
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE))) {

                    const kingStartFile = 4; // e-file
                    const kingTargetFile = 6; // g-file
                    const rookFile = 7; // h-file
                    
                    if (fromFile === kingStartFile) { // Only allow castling from starting position
                        const targetIndex = fromRank * 8 + kingTargetFile;
                        const passThroughIndex = fromRank * 8 + 5; // f-file
                        
                        if (position[passThroughIndex] === '' && position[targetIndex] === '') {
                            if (!checkLegality ||
                                (!this.isSquareAttacked(position, passThroughIndex, color) &&
                                 !this.isSquareAttacked(position, targetIndex, color))) {
                                moves.push({from: fromIndex, to: targetIndex, flags: 'kingside_castle'});
                            }
                        }
                    }
                }

                // Queenside castling
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE))) {

                    const kingStartFile = 4; // e-file
                    const kingTargetFile = 2; // c-file
                    
                    if (fromFile === kingStartFile) { // Only allow castling from starting position
                        const targetIndex = fromRank * 8 + kingTargetFile;
                        const passThroughIndex = fromRank * 8 + 3; // d-file
                        const bSquareIndex = fromRank * 8 + 1; // b-file
                        
                        if (position[passThroughIndex] === '' && position[targetIndex] === '' && position[bSquareIndex] === '') {
                            if (!checkLegality ||
                                (!this.isSquareAttacked(position, passThroughIndex, color) &&
                                 !this.isSquareAttacked(position, targetIndex, color))) {
                                moves.push({from: fromIndex, to: targetIndex, flags: 'queenside_castle'});
                            }
                        }
                    }
                }
            }
        }

        if (checkLegality) {
            return moves.filter(move => this.isMoveLegal(position, move, color));
        }

        return moves;
    },

    isMoveLegal: function (position, move, color) {
        const newPosition = [...position];

        const piece = newPosition[move.from];
        newPosition[move.to] = piece;
        newPosition[move.from] = '';

        if (move.flags === 'en_passant') {
            const capturedPawnPos = move.to + (color === 'w' ? 8 : -8);
            newPosition[capturedPawnPos] = '';
        }

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

        let kingPos;
        if (piece.toLowerCase() === 'k') {
            kingPos = move.to;
        } else {
            kingPos = this.findKing(newPosition, color);
        }

        return !this.isInCheck(newPosition, kingPos, color);
    },

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

    findKing: function (position, color) {
        const kingPiece = color === 'w' ? 'K' : 'k';
        for (let i = 0; i < 64; i++) {
            if (position[i] === kingPiece) {
                return i;
            }
        }
        return -1;
    },

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

    makeMove: function (move) {
        const piece = this.gameState.position[move.from];
        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const isCapture = this.gameState.position[move.to] !== '';

        const prevState = {
            position: [...this.gameState.position],
            activeColor: this.gameState.activeColor,
            castlingRights: this.gameState.castlingRights,
            enPassantTarget: this.gameState.enPassantTarget,
            halfMoveClock: this.gameState.halfMoveClock,
            fullMoveNumber: this.gameState.fullMoveNumber,
            kingPositions: {...this.gameState.kingPositions}
        };

        let capturedPiece = this.gameState.position[move.to];

        this.gameState.position[move.to] = piece;
        this.gameState.position[move.from] = '';

        if (pieceType === 'k') {
            this.gameState.kingPositions[color] = move.to;
        }

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

        // FIXED: En passant target setting
        if (move.flags === 'double_push') {
            this.gameState.enPassantTarget = move.from + (color === 'w' ? 8 : -8);
        } else {
            this.gameState.enPassantTarget = null;
        }

        if (pieceType === 'p' || isCapture) {
            this.gameState.halfMoveClock = 0;
        } else {
            this.gameState.halfMoveClock++;
        }

        if (color === 'b') {
            this.gameState.fullMoveNumber++;
        }

        this.gameState.activeColor = color === 'w' ? 'b' : 'w';

        const kingPos = this.gameState.kingPositions[color];
        if (this.isInCheck(this.gameState.position, kingPos, color)) {
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

    generateMoveNotation: function (move, isCheck, isCheckmate) {
        const piece = this.getPieceAt(move.from);
        const pieceType = piece.toLowerCase();
        const pieceSymbol = pieceType === 'p' ? '' : pieceType.toUpperCase();

        // FIXED: Proper castling detection
        if (piece.toLowerCase() === 'k' && move.flags && 
            (move.flags === 'kingside_castle' || move.flags === 'queenside_castle')) {
            const notation = move.flags === 'kingside_castle' ? 'O-O' : 'O-O-O';
            return isCheckmate ? notation + '#' : (isCheck ? notation + '+' : notation);
        }

        let notation = pieceSymbol;

        if (pieceType !== 'p' && pieceType !== 'k') {
            const ambiguousMoves = this.findAmbiguousMoves(move);
            if (ambiguousMoves.length > 0) {
                const sameFileCount = ambiguousMoves.filter(m => m.from % 8 === move.from % 8).length;
                if (sameFileCount === 0) {
                    notation += String.fromCharCode(97 + (move.from % 8));
                } else {
                    const sameRankCount = ambiguousMoves.filter(m => Math.floor(m.from / 8) === Math.floor(move.from / 8)).length;
                    if (sameRankCount === 0) {
                        notation += 8 - Math.floor(move.from / 8);
                    } else {
                        notation += this.indexToAlgebraic(move.from);
                    }
                }
            }
        }

        const isCapture = this.getPieceAt(move.to) !== '' || move.flags === 'en_passant';
        if (isCapture) {
            if (pieceSymbol === '' && !notation.includes(String.fromCharCode(97 + (move.from % 8)))) {
                notation += String.fromCharCode(97 + (move.from % 8));
            }
            notation += 'x';
        }

        notation += this.indexToAlgebraic(move.to);

        if (move.flags === 'promotion') {
            notation += '=' + move.promotionPiece.toUpperCase();
        }

        if (isCheckmate) {
            notation += '#';
        } else if (isCheck) {
            notation += '+';
        }

        return notation;
    },

    findAmbiguousMoves: function (move) {
        const piece = this.getPieceAt(move.from);
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

    getPieceAt: function (index) {
        return this.gameState.position[index];
    },

    setPositionFromState: function (position, activeColor = 'w') {
        this.setupPosition(position);
        this.gameState.activeColor = activeColor;
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
    legalMoves: {},
    animation: {
        inProgress: false,
        elements: [],
        callback: null
    },
    clock: {
        white: null,
        black: null,
        increment: 0,
        lastMoveTime: null,
        started: false,
        intervalId: null
    },
    dragAndDrop: {
        isDragging: false,
        draggedPiece: null,
        draggedFromIndex: null,
        draggedElement: null,
        originalPosition: null
    },
    // NEW: Move navigation state
    navigation: {
        currentMoveIndex: -1, // -1 means we're at the current game position
        isNavigating: false,
        positions: [] // Store positions at each move
    }
};

// ======= Clock Management =======
function initClocks(gameData) {
    console.log('Initializing clocks with data:', gameData);

    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }

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
    
    if (typeof gameData.time_control === 'string') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control;
        }
        
        console.log('Game has time control:', gameData.time_control);
        
        switch(gameData.time_control) {
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
        
        STATE.clock.increment = 0;
    } 
    else if (typeof gameData.time_control === 'object') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control.type || 'Custom';
        }
        
        console.log('Game has time control:', gameData.time_control.type);
        
        if (gameData.time_control.initial_time_ms !== undefined) {
            STATE.clock.white = gameData.time_control.initial_time_ms;
            STATE.clock.black = gameData.time_control.initial_time_ms;
            STATE.clock.increment = gameData.time_control.increment || 0;
        } else {
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
    
    if (gameData.white_time_ms !== undefined && gameData.white_time_ms !== null) {
        STATE.clock.white = gameData.white_time_ms;
    }
    
    if (gameData.black_time_ms !== undefined && gameData.black_time_ms !== null) {
        STATE.clock.black = gameData.black_time_ms;
    }
    
    if (gameData.increment_ms !== undefined) {
        STATE.clock.increment = gameData.increment_ms;
    }

    STATE.clock.lastMoveTime = gameData.last_move_timestamp ? new Date(gameData.last_move_timestamp).getTime() : null;
    STATE.clock.started = gameData.status === 'active';

    if (STATE.clock.started) {
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
        syncClockWithServer(true);
    } else {
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
    }

    console.log('Clocks initialized:', STATE.clock);
}

function startClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
    }

    const updateRate = 100;
    STATE.clock.intervalId = setInterval(() => {
        updateActiveClock();
    }, updateRate);
}

function stopClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }
}

function updateActiveClock() {
    if (!STATE.clock.started || STATE.gameStatus !== 'active') {
        stopClockInterval();
        return;
    }

    const activeColor = ChessRules.gameState.activeColor === 'w' ? 'white' : 'black';

    if (STATE.clock[activeColor] !== null) {
        STATE.clock[activeColor] -= 100;

        if (STATE.clock[activeColor] <= 0) {
            STATE.clock[activeColor] = 0;
            handleTimeout(activeColor);
        }

        updateClockDisplay(activeColor, STATE.clock[activeColor]);
    }
}

function handleTimeout(color) {
    console.log(`${color} player ran out of time`);
    stopClockInterval();
    STATE.clock.started = false;

    if (STATE.socket) {
        STATE.socket.emit('time_out', {
            game_id: STATE.gameId,
            token: localStorage.getItem('token'),
            color: color
        });
    }

    const winner = color === 'white' ? 'black' : 'white';
    showGameResult({
        result: 'timeout',
        winner: winner === STATE.userColor ? STATE.userId : STATE.opponentId
    });
}

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

    const formattedTime = formatClockTime(timeMs);
    clockElement.textContent = formattedTime;

    clockElement.classList.remove('clock-active', 'clock-low');

    if (STATE.clock.started && ChessRules.gameState.activeColor === (color === 'white' ? 'w' : 'b')) {
        clockElement.classList.add('clock-active');
    }

    if (timeMs < 30000) {
        clockElement.classList.add('clock-low');
    }
}

function formatClockTime(ms) {
    if (ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalSeconds < 10) {
        const deciseconds = Math.floor((ms % 1000) / 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${deciseconds}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function setupClockSync() {
    syncClockWithServer();

    setInterval(() => {
        if (STATE.gameStatus === 'active' && STATE.clock.started) {
            syncClockWithServer();
        }
    }, 10000);
}

function syncClockWithServer(isInitialSync = false) {
    if (!STATE.socket || !STATE.gameId) return;

    console.log('Syncing clock with server...');

    const syncRequestTime = Date.now();

    STATE.socket.emit('get_remaining_time', {
        game_id: STATE.gameId,
        token: localStorage.getItem('token')
    });

    if (isInitialSync) {
        STATE.socket.once('clock_update', (data) => {
            console.log('Initial clock sync received:', data);

            const latency = Math.floor((Date.now() - syncRequestTime) / 2);
            console.log('Estimated one-way latency:', latency, 'ms');

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

            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);

            if (STATE.clock.started && STATE.gameStatus === 'active' &&
                STATE.clock.white !== null && STATE.clock.black !== null) {
                startClockInterval();
            }
        });
    }
}

function handleClockAfterMove(color) {
    if (STATE.clock.white === null || STATE.clock.black === null) {
        return;
    }

    const movingColor = color ||
        (ChessRules.gameState.activeColor === 'w' ? 'black' : 'white');

    if (STATE.clock.increment > 0) {
        STATE.clock[movingColor] += STATE.clock.increment;
    }

    if (!STATE.clock.started && STATE.gameStatus === 'active') {
        STATE.clock.started = true;
        startClockInterval();
    }

    updateClockDisplay('white', STATE.clock.white);
    updateClockDisplay('black', STATE.clock.black);
}

// ======= Utility Functions =======
function fileRankToPosition(file, rank) {
    const fileChar = String.fromCharCode(97 + file);
    const rankChar = 8 - rank;
    return fileChar + rankChar;
}

function positionToFileRank(position) {
    const file = position.charCodeAt(0) - 97;
    const rank = 8 - parseInt(position[1]);
    return { file, rank };
}

function indexToAlgebraic(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return fileRankToPosition(file, rank);
}

function algebraicToIndex(algebraic) {
    const { file, rank } = positionToFileRank(algebraic);
    return rank * 8 + file;
}

function getSquareElement(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);

    let position;
    if (STATE.flipped) {
        position = fileRankToPosition(7 - file, 7 - rank);
    } else {
        position = fileRankToPosition(file, rank);
    }

    return document.querySelector(`.square[data-position="${position}"]`);
}

function moveToUci(move) {
    const from = indexToAlgebraic(move.from);
    const to = indexToAlgebraic(move.to);

    if (move.flags === 'promotion' && move.promotionPiece) {
        return `${from}${to}${move.promotionPiece}`;
    }

    return `${from}${to}`;
}

function uciToMove(uci) {
    if (typeof uci !== 'string' || uci.length < 4) {
        console.error('Invalid UCI notation:', uci);
        return null;
    }

    const from = algebraicToIndex(uci.substring(0, 2));
    const to = algebraicToIndex(uci.substring(2, 4));

    let flags = null;
    let promotionPiece = null;

    if (uci.length === 5) {
        flags = 'promotion';
        promotionPiece = uci[4];
    }
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'p' &&
             Math.abs(from % 8 - to % 8) === 1 &&
             ChessRules.gameState.position[to] === '') {
        flags = 'en_passant';
    }
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'k' &&
             Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }

    return { from, to, flags, promotionPiece };
}

function isPlayersTurn() {
    const userColor = document.getElementById('user-color').value;
    const fen = ChessRules.generateFEN();
    const isWhiteTurn = fen.split(' ')[1] === 'w';

    return (userColor === 'white' && isWhiteTurn) || (userColor === 'black' && !isWhiteTurn);
}

// ======= DOM Manipulation Functions =======
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
            
            square.addEventListener('dragover', handleDragOver);
            square.addEventListener('drop', handleDrop);
            square.addEventListener('dragenter', handleDragEnter);
            square.addEventListener('dragleave', handleDragLeave);
            
            board.appendChild(square);
        }
    }

    setupStartingPosition();
}

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

    ChessRules.setupPosition(STATE.currentPosition);
    
    // NEW: Initialize navigation state
    STATE.navigation.positions = [STATE.currentPosition.slice()];
    STATE.navigation.currentMoveIndex = -1;
    STATE.navigation.isNavigating = false;

    precomputeLegalMoves();
    updateBoard();
    updateGameStateUI();
}

function updateBoard() {
    const squares = document.querySelectorAll('.square');

    squares.forEach(square => {
        const img = square.querySelector('img');
        if (img) {
            square.removeChild(img);
        }
    });

    squares.forEach(square => {
        const position = square.dataset.position;
        const {file, rank} = positionToFileRank(position);

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
            img.draggable = true;
            img.dataset.piece = piece;
            img.dataset.index = adjustedIndex;
            
            img.addEventListener('dragstart', handleDragStart);
            img.addEventListener('dragend', handleDragEnd);
            
            square.appendChild(img);
        }
    });

    ChessRules.setPositionFromState(STATE.currentPosition,
        STATE.gameStatus === 'active' ? ChessRules.gameState.activeColor : 'w');

    precomputeLegalMoves();
    updateGameStateUI();

    console.log('Board updated with position:', [...STATE.currentPosition]);
}

function navigateToMove(moveIndex) {
    // If we're navigating to the current position, exit navigation mode
    if (moveIndex === -1 || moveIndex >= STATE.moveHistory.length) {
        STATE.navigation.isNavigating = false;
        STATE.navigation.currentMoveIndex = -1;
        
        // Properly restore the current game position
        if (STATE.moveHistory.length > 0) {
            // Replay all moves to get to current position
            setupStartingPosition();
            for (const move of STATE.moveHistory) {
                const moveObj = uciToMove(move.uci);
                if (moveObj) {
                    ChessRules.makeMove(moveObj);
                }
            }
            STATE.currentPosition = ChessRules.gameState.position.slice();
        } else {
            // No moves played, just ensure we're at starting position
            setupStartingPosition();
        }
        
        // Update the board and UI
        updateBoard();
        
        // Update move list highlighting
        updateMoveListHighlighting(-1);
        
        // Show/hide result panel based on game status
        if (STATE.gameStatus === 'completed') {
            document.getElementById('game-result').style.display = 'block';
        }
        
        return;
    }
    
    // Enter navigation mode
    STATE.navigation.isNavigating = true;
    STATE.navigation.currentMoveIndex = moveIndex;
    
    // Hide result panel during navigation
    document.getElementById('game-result').style.display = 'none';
    
    // Get the position at this move
    if (moveIndex < STATE.navigation.positions.length) {
        STATE.currentPosition = STATE.navigation.positions[moveIndex + 1].slice();
        
        // Calculate the active color at this position
        const activeColor = (moveIndex % 2 === 0) ? 'b' : 'w';
        ChessRules.setPositionFromState(STATE.currentPosition, activeColor);
        
        updateBoard();
        updateMoveListHighlighting(moveIndex);
    }
}

// NEW: Function to check if we can make moves (either not navigating, or navigating at current position)
function canMakeMoves() {
    return !STATE.navigation.isNavigating || STATE.navigation.currentMoveIndex === -1;
}

// NEW: Function to auto-exit navigation when making a move at current position
function autoExitNavigationIfAtCurrent() {
    if (STATE.navigation.isNavigating && STATE.navigation.currentMoveIndex === -1) {
        STATE.navigation.isNavigating = false;
        STATE.navigation.currentMoveIndex = -1;
        updateMoveListHighlighting(-1);
    }
}


function navigateForward() {
    // Handle different navigation states
    if (STATE.navigation.currentMoveIndex === -2) {
        // We're at starting position, go to first move if it exists
        if (STATE.moveHistory.length > 0) {
            navigateToMove(0);
        } else {
            // No moves to go to, exit navigation
            navigateToMove(-1);
        }
    } else if (STATE.navigation.currentMoveIndex >= 0 && STATE.navigation.currentMoveIndex < STATE.moveHistory.length - 1) {
        // We're at a specific move, go to next move
        navigateToMove(STATE.navigation.currentMoveIndex + 1);
    } else {
        // We're at last move or current position, go to current position
        navigateToMove(-1);
    }
}

function navigateBackward() {
    if (STATE.navigation.currentMoveIndex > 0) {
        // Go to previous move
        navigateToMove(STATE.navigation.currentMoveIndex - 1);
    } else if (STATE.navigation.currentMoveIndex === 0) {
        // We're at first move, go to starting position
        navigateToStartingPosition();
    } else if (STATE.navigation.currentMoveIndex === -1) {
        // We're at current position, go to last move if it exists
        if (STATE.moveHistory.length > 0) {
            navigateToMove(STATE.moveHistory.length - 1);
        } else {
            // No moves to navigate to, go to starting position
            navigateToStartingPosition();
        }
    } else if (STATE.navigation.currentMoveIndex === -2) {
        // Already at starting position, can't go further back
        return;
    }
}

function navigateToStartingPosition() {
    STATE.navigation.isNavigating = true;
    STATE.navigation.currentMoveIndex = -2; // Special value for starting position
    
    // Hide result panel
    document.getElementById('game-result').style.display = 'none';
    
    // Load starting position and update the chess rules state
    const startingPosition = [
        'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
        'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
        'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'
    ];
    
    STATE.currentPosition = [...startingPosition];
    ChessRules.setupPosition(startingPosition);
    
    updateBoard();
    updateMoveListHighlighting(-2);
}

function updateMoveListHighlighting(currentMoveIndex) {
    // Remove all highlighting
    document.querySelectorAll('.move').forEach(move => {
        move.classList.remove('active-move');
    });
    
    // Highlight current move if we're navigating
    if (currentMoveIndex >= 0) {
        const moves = document.querySelectorAll('.move');
        if (moves[currentMoveIndex]) {
            moves[currentMoveIndex].classList.add('active-move');
            moves[currentMoveIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function exitNavigation() {
    // Properly exit navigation mode and restore current game state
    navigateToMove(-1);
}
// ======= Drag and Drop Functions =======
function handleDragStart(e) {
    // Allow dragging if not navigating, OR if navigating but at current position
    if (STATE.gameStatus !== 'active' || !isPlayersTurn() || 
        (STATE.navigation.isNavigating && STATE.navigation.currentMoveIndex !== -1)) {
        e.preventDefault();
        return;
    }
    
    // Auto-exit navigation if we're at current position
    autoExitNavigationIfAtCurrent();
    
    const img = e.target;
    const piece = img.dataset.piece;
    const index = parseInt(img.dataset.index);
    
    const isCurrentPlayerPiece = piece && 
        ChessRules.getPieceColor(piece) === ChessRules.gameState.activeColor;
    
    if (!isCurrentPlayerPiece) {
        e.preventDefault();
        return;
    }
    
    STATE.dragAndDrop.isDragging = true;
    STATE.dragAndDrop.draggedPiece = piece;
    STATE.dragAndDrop.draggedFromIndex = index;
    STATE.dragAndDrop.draggedElement = img;
    STATE.dragAndDrop.originalPosition = {
        parent: img.parentNode,
        nextSibling: img.nextSibling
    };
    
    clearPossibleMoves();
    STATE.selectedSquare = null;
    
    showPossibleMoves(index);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    
    img.classList.add('dragging');
    
    console.log('Started dragging piece:', piece, 'from index:', index);
}
function handleDragEnd(e) {
    const img = e.target;
    img.classList.remove('dragging');
    
    clearPossibleMoves();
    
    if (STATE.dragAndDrop.isDragging) {
        const originalPos = STATE.dragAndDrop.originalPosition;
        if (originalPos && originalPos.parent) {
            if (originalPos.nextSibling) {
                originalPos.parent.insertBefore(img, originalPos.nextSibling);
            } else {
                originalPos.parent.appendChild(img);
            }
        }
    }
    
    STATE.dragAndDrop = {
        isDragging: false,
        draggedPiece: null,
        draggedFromIndex: null,
        draggedElement: null,
        originalPosition: null
    };
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    
    if (!STATE.dragAndDrop.isDragging) return;
    
    const square = e.currentTarget;
    const position = square.dataset.position;
    const {file, rank} = positionToFileRank(position);
    
    const toIndex = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;
    
    const legalMoves = STATE.legalMoves[STATE.dragAndDrop.draggedFromIndex] || [];
    const isLegalMove = legalMoves.some(move => move.to === toIndex);
    
    if (isLegalMove) {
        square.classList.add('drag-over-valid');
    }
}

function handleDragLeave(e) {
    const square = e.currentTarget;
    square.classList.remove('drag-over-valid');
}

function handleDrop(e) {
    e.preventDefault();
    
    if (!STATE.dragAndDrop.isDragging) return;
    
    const square = e.currentTarget;
    square.classList.remove('drag-over-valid');
    
    const position = square.dataset.position;
    const {file, rank} = positionToFileRank(position);
    
    const toIndex = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;
    
    const fromIndex = STATE.dragAndDrop.draggedFromIndex;
    
    const legalMoves = STATE.legalMoves[fromIndex] || [];
    const legalMove = legalMoves.find(move => move.to === toIndex);
    
    if (legalMove) {
        const result = executeLocalMove(legalMove, false);
        
        if (result.success) {
            updateBoard();
            const uciMove = moveToUci(legalMove);
            sendMoveToServer(uciMove);
        }
        
        STATE.dragAndDrop.isDragging = false;
    } else {
        console.log('Illegal move attempted via drag & drop');
    }
}

// ======= Game State UI Updates =======
function updateGameStateUI() {
    const gameState = ChessRules.checkGameState();

    document.querySelectorAll('.check-indicator').forEach(el => el.remove());

    if (gameState === 'checkmate') {
        const winner = ChessRules.gameState.activeColor === 'w' ? 'Blacks' : 'Whites';
        showGameResult(winner.toLowerCase() === STATE.userColor ? 'win' : 'loss');
    } else if (gameState === 'stalemate' || gameState === 'draw_fifty_move') {
        showGameResult('draw');
    } else if (gameState === 'check') {
        const kingPos = ChessRules.gameState.kingPositions[ChessRules.gameState.activeColor];
        highlightKingInCheck(kingPos);
    }

    precomputeLegalMoves();
}

function showGameResult(result) {
    const gameResult = document.getElementById('game-result');
    const resultMessage = document.getElementById('result-message');

    if (!gameResult || !resultMessage) {
        console.error('Game result elements not found');
        return;
    }

    console.log('Showing game result:', result);

    let message = '';
    let cause = '';
    let resultClass = '';

    const isWinner = result.winner === STATE.userId;
    const isLoser = result.loser === STATE.userId;
    const isDraw = result.result === 'draw' || result.winner === 'draw';

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

    resultMessage.innerHTML = `
        <div class="result-header">${message}</div>
        <div class="result-cause">${cause}</div>
    `;
    
    gameResult.className = 'game-result-panel';
    gameResult.style.display = 'block';
    
    gameResult.offsetHeight;
    
    gameResult.classList.add('show', resultClass);

    disableGameInteraction();

    showNotification(`${message} - ${cause}`, resultClass === 'win' ? 'success' :
        (resultClass === 'loss' ? 'error' : 'info'));

    setTimeout(() => {
        gameResult.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
        });
    }, 100);
}

function hideGameResult() {
    const gameResult = document.getElementById('game-result');
    if (!gameResult) return;
    
    gameResult.classList.remove('show');
    gameResult.classList.add('hide');
    
    setTimeout(() => {
        gameResult.style.display = 'none';
        gameResult.classList.remove('hide');
    }, 300);
}

function showGameResultForExistingGame(gameData) {
    if (gameData.status !== 'completed') return;
    
    const result = {
        game_id: gameData.game_id,
        winner: gameData.winner,
        result_type: gameData.result_type || 'checkmate'
    };
    
    setTimeout(() => {
        showGameResult(result);
    }, 500);
}

function disableGameInteraction() {
    document.querySelectorAll('.square').forEach(square => {
        const newSquare = square.cloneNode(true);
        square.parentNode.replaceChild(newSquare, square);
    });

    const drawBtn = document.getElementById('draw-btn');
    const resignBtn = document.getElementById('resign-btn')
    if (resignBtn) resignBtn.disabled = true;
    if (drawBtn) drawBtn.disabled = true;
}

function highlightKingInCheck(kingPos) {
    const kingRank = Math.floor(kingPos / 8);
    const kingFile = kingPos % 8;

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

function precomputeLegalMoves() {
    STATE.legalMoves = {};

    // Don't compute moves if not player's turn, OR if navigating (unless at current position)
    if (!isPlayersTurn() || (STATE.navigation.isNavigating && STATE.navigation.currentMoveIndex !== -1)) {
        return;
    }

    const color = ChessRules.gameState.activeColor;

    for (let i = 0; i < 64; i++) {
        const piece = STATE.currentPosition[i];
        if (piece && ChessRules.getPieceColor(piece) === color) {
            const moves = ChessRules.generatePieceMoves(STATE.currentPosition, i, true);
            if (moves.length > 0) {
                STATE.legalMoves[i] = moves;
            }
        }
    }
}

function showPossibleMoves(index) {
    clearPossibleMoves();

    const legalMoves = STATE.legalMoves[index] || [];

    for (const move of legalMoves) {
        const toRank = Math.floor(move.to / 8);
        const toFile = move.to % 8;
        const visualPos = STATE.flipped
            ? fileRankToPosition(7 - toFile, 7 - toRank)
            : fileRankToPosition(toFile, toRank);

        const targetSquare = document.querySelector(`.square[data-position="${visualPos}"]`);
        if (!targetSquare) continue;

        const isEnPassant = move.flags === 'en_passant';

        if (STATE.currentPosition[move.to] !== '' || isEnPassant) {
            const captureIndicator = document.createElement('div');
            captureIndicator.className = 'possible-capture';
            targetSquare.appendChild(captureIndicator);
        } else {
            const moveIndicator = document.createElement('div');
            moveIndicator.className = 'possible-move';
            targetSquare.appendChild(moveIndicator);
        }
    }
}

function clearPossibleMoves() {
    document.querySelectorAll('.possible-move, .possible-capture').forEach(el => el.remove());
}

function updateMovesList() {
    const movesList = document.getElementById('moves-list');
    if (!movesList) return;

    movesList.innerHTML = '';

    if (STATE.moveHistory.length === 0) {
        movesList.innerHTML = '<p>No moves played yet.</p>';
        return;
    }

    let moveHtml = '';
    let moveNumber = 1;

    for (let i = 0; i < STATE.moveHistory.length; i += 2) {
        moveHtml += `<div class="move-row">`;
        moveHtml += `<span class="move-number">${moveNumber}.</span>`;

        // White's move
        moveHtml += `<span class="move" data-move-index="${i}">${STATE.moveHistory[i].notation}</span>`;

        // Black's move (if exists)
        if (i + 1 < STATE.moveHistory.length) {
            moveHtml += `<span class="move" data-move-index="${i + 1}">${STATE.moveHistory[i + 1].notation}</span>`;
        } else {
            moveHtml += `<span class="move-placeholder"></span>`;
        }

        moveHtml += `</div>`;
        moveNumber++;
    }

    movesList.innerHTML = moveHtml;

    // Add click listeners to moves
    movesList.querySelectorAll('.move').forEach(moveElement => {
        moveElement.addEventListener('click', () => {
            const moveIndex = parseInt(moveElement.dataset.moveIndex);
            navigateToMove(moveIndex);
        });
    });

    movesList.scrollTop = movesList.scrollHeight;
}

function showPromotionDialog(move, callback) {
    const promotionOverlay = document.getElementById('promotion-overlay');
    const promotionPieces = document.getElementById('promotion-pieces');

    promotionPieces.innerHTML = '';

    const color = STATE.userColor === 'white' ? 'w' : 'b';

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

    promotionOverlay.style.display = 'flex';
}

// ======= Animation Functions =======
function animatePieceMove(fromSquare, toSquare, piece, duration = 200, callback = null, isCastling = false, rookData = null) {
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    STATE.animation.inProgress = true;
    STATE.animation.elements = [];
    STATE.animation.callback = callback;

    const animatedPiece = document.createElement('img');
    const color = piece.toUpperCase() === piece ? 'w' : 'b';
    const pieceChar = piece.toLowerCase();
    const pieceName = PIECE_TYPES[pieceChar];

    animatedPiece.src = `/static/images/${pieceName}-${color}.svg`;
    animatedPiece.className = 'piece';

    STATE.animation.elements.push(animatedPiece);

    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();
    const boardContainer = document.querySelector('.board-container');
    const boardRect = boardContainer.getBoundingClientRect();

    const squareSize = fromRect.width;
    const pieceSize = Math.round(squareSize * 0.95);
    animatedPiece.style.width = `${pieceSize}px`;
    animatedPiece.style.height = `${pieceSize}px`;

    boardContainer.appendChild(animatedPiece);

    const offsetX = (squareSize - pieceSize) / 2;

    animatedPiece.style.left = `${fromRect.left - boardRect.left + offsetX}px`;
    animatedPiece.style.top = `${fromRect.top - boardRect.top + offsetX}px`;

    const originalImg = fromSquare.querySelector('img');
    if (originalImg) {
        originalImg.style.opacity = '0';
        originalImg.classList.add('animating');
    }

    if (isCastling && rookData) {
        const { rookFromSquare, rookToSquare, rookPiece } = rookData;

        const animatedRook = document.createElement('img');
        const rookColor = rookPiece.toUpperCase() === rookPiece ? 'w' : 'b';
        animatedRook.src = `/static/images/rook-${rookColor}.svg`;
        animatedRook.className = 'piece';

        STATE.animation.elements.push(animatedRook);

        const rookFromRect = rookFromSquare.getBoundingClientRect();
        const rookToRect = rookToSquare.getBoundingClientRect();

        animatedRook.style.width = `${pieceSize}px`;
        animatedRook.style.height = `${pieceSize}px`;

        boardContainer.appendChild(animatedRook);

        animatedRook.style.left = `${rookFromRect.left - boardRect.left + offsetX}px`;
        animatedRook.style.top = `${rookFromRect.top - boardRect.top + offsetX}px`;

        const originalRookImg = rookFromSquare.querySelector('img');
        if (originalRookImg) {
            originalRookImg.style.opacity = '0';
            originalRookImg.classList.add('animating');
        }

        requestAnimationFrame(() => {
            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            animatedRook.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            const destXKing = toRect.left - boardRect.left + offsetX;
            const destYKing = toRect.top - boardRect.top + offsetX;
            animatedPiece.style.left = `${destXKing}px`;
            animatedPiece.style.top = `${destYKing}px`;

            const destXRook = rookToRect.left - boardRect.left + offsetX;
            const destYRook = rookToRect.top - boardRect.top + offsetX;
            animatedRook.style.left = `${destXRook}px`;
            animatedRook.style.top = `${destYRook}px`;

            let animationsCompleted = 0;
            const onTransitionEnd = () => {
                animationsCompleted++;

                if (animationsCompleted === 2) {
                    if (!STATE.animation.inProgress) return;

                    finishCurrentAnimation();
                }
            };

            animatedPiece.addEventListener('transitionend', onTransitionEnd, { once: true });
            animatedRook.addEventListener('transitionend', onTransitionEnd, { once: true });

            setTimeout(() => {
                if (STATE.animation.inProgress &&
                    STATE.animation.elements.includes(animatedPiece)) {
                    finishCurrentAnimation();
                }
            }, duration + 50);
        });
    } else {
        requestAnimationFrame(() => {
            const destX = toRect.left - boardRect.left + offsetX;
            const destY = toRect.top - boardRect.top + offsetX;

            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            animatedPiece.style.left = `${destX}px`;
            animatedPiece.style.top = `${destY}px`;

            animatedPiece.addEventListener('transitionend', () => {
                if (!STATE.animation.inProgress) return;

                finishCurrentAnimation();
            }, { once: true });

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

    STATE.animation.elements.forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });

    document.querySelectorAll('.animating').forEach(el => {
        el.classList.remove('animating');
        el.style.opacity = '1';
    });

    if (STATE.animation.callback) {
        const callback = STATE.animation.callback;
        STATE.animation.callback = null;
        callback();
    }

    STATE.animation.inProgress = false;
    STATE.animation.elements = [];
}

// ======= Game Logic Functions =======
function handleSquareClick(position) {
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    // Allow moves if not navigating, OR if navigating but at current position
    if (STATE.navigation.isNavigating && STATE.navigation.currentMoveIndex !== -1) {
        return;
    }

    if (STATE.gameStatus !== 'active' || !isPlayersTurn()) {
        return;
    }

    // Auto-exit navigation if we're at current position
    autoExitNavigationIfAtCurrent();

    const { file, rank } = positionToFileRank(position);
    const index = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;

    const pieceAtClicked = STATE.currentPosition[index];
    const isCurrentPlayerPiece = pieceAtClicked &&
        ChessRules.getPieceColor(pieceAtClicked) === ChessRules.gameState.activeColor;

    if (STATE.selectedSquare === null) {
        if (isCurrentPlayerPiece) {
            STATE.selectedSquare = index;
            showPossibleMoves(index);
        }
    } else {
        if (STATE.selectedSquare === index) {
            clearPossibleMoves();
            STATE.selectedSquare = null;
            return;
        }

        if (isCurrentPlayerPiece && STATE.selectedSquare !== index) {
            clearPossibleMoves();
            STATE.selectedSquare = index;
            showPossibleMoves(index);
            return;
        }

        if (STATE.selectedSquare !== index) {
            const legalMoves = STATE.legalMoves[STATE.selectedSquare] || [];
            const legalMove = legalMoves.find(move => move.to === index);

            if (legalMove) {
                makeMove(STATE.selectedSquare, index, legalMove);
            } else {
                clearPossibleMoves();
                STATE.selectedSquare = null;
            }
        }
    }
}


function makeMove(fromIndex, toIndex, moveObj) {
    const piece = STATE.currentPosition[fromIndex];
    const isPawn = piece.toLowerCase() === 'p';
    const toRank = Math.floor(toIndex / 8);
    const isLastRank = (piece === 'P' && toRank === 0) || (piece === 'p' && toRank === 7);

    if (isPawn && isLastRank) {
        showPromotionDialog({from: fromIndex, to: toIndex}, (promotionPiece) => {
            const move = {
                from: fromIndex,
                to: toIndex,
                flags: 'promotion',
                promotionPiece: promotionPiece
            };

            const result = executeLocalMove(move, true);

            if (result.success) {
                const uciMove = moveToUci(move);
                sendMoveToServer(uciMove);
            }
        });
    } else {
        const result = executeLocalMove(moveObj, true);

        if (result.success) {
            const uciMove = moveToUci(moveObj);
            sendMoveToServer(uciMove);
        }
    }
}

function setInitialBoardOrientation() {
    console.log("Setting initial board orientation. User color:", STATE.userColor);

    if (STATE.userColor === 'black') {
        console.log("Player is black, flipping board");
        STATE.flipped = true;
        STATE.manuallyFlipped = false;
        updateBoard();
    } else {
        console.log("Player is white, normal orientation");
        STATE.flipped = false;
        STATE.manuallyFlipped = false;
        updateBoard();
    }

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

    if (playerInfo.parentNode) {
        playerInfo.parentNode.removeChild(playerInfo);
    }

    if (opponentInfo.parentNode) {
        opponentInfo.parentNode.removeChild(opponentInfo);
    }

    if (STATE.manuallyFlipped) {
        console.log("Manual flip: player on top, opponent on bottom");
        topPlayerBox.appendChild(playerInfo);
        bottomPlayerBox.appendChild(opponentInfo);
    } else {
        console.log("Natural orientation: player on bottom, opponent on top");
        topPlayerBox.appendChild(opponentInfo);
        bottomPlayerBox.appendChild(playerInfo);
    }
}

function executeLocalMove(moveObj, shouldAnimate = true) {
    const move = {...moveObj};

    const piece = STATE.currentPosition[move.from];

    const fromSquare = getSquareElement(move.from);
    const toSquare = getSquareElement(move.to);

    if (!fromSquare || !toSquare) {
        console.error('Cannot find squares for animation');
        return { success: false, reason: 'animation_error' };
    }

    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Failed to execute move in rules engine:', result.reason);
        return result;
    }

    STATE.currentPosition = [...ChessRules.gameState.position];

    // FIXED: Improved move notation generation
    let notation;
    if (piece.toLowerCase() === 'p') {
        if (move.flags === 'promotion') {
            const captureFile = result.capturedPiece ? indexToAlgebraic(move.from)[0] + 'x' : '';
            notation = captureFile + indexToAlgebraic(move.to) + '=' + move.promotionPiece.toUpperCase();
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

    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

    const uciNotation = indexToAlgebraic(move.from) + indexToAlgebraic(move.to);

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

    // NEW: Store position after this move for navigation
    STATE.navigation.positions.push(STATE.currentPosition.slice());

    updateMovesList();

    if (shouldAnimate) {
        if (move.flags === 'kingside_castle' || move.flags === 'queenside_castle') {
            const color = ChessRules.getPieceColor(piece);
            const isKingside = move.flags === 'kingside_castle';

            const rookFromIndex = color === 'w' ?
                (isKingside ? 63 : 56) :
                (isKingside ? 7 : 0);

            const rookToIndex = color === 'w' ?
                (isKingside ? 61 : 59) :
                (isKingside ? 5 : 3);

            const rookFromSquare = getSquareElement(rookFromIndex);
            const rookToSquare = getSquareElement(rookToIndex);

            if (rookFromSquare && rookToSquare) {
                const rookData = {
                    rookFromSquare,
                    rookToSquare,
                    rookPiece: color === 'w' ? 'R' : 'r'
                };

                animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                    updateBoard();
                }, true, rookData);
            } else {
                animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                    updateBoard();
                });
            }
        } else {
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                updateBoard();
            });
        }
    }

    clearPossibleMoves();
    STATE.selectedSquare = null;
    
    if (result.success) {
        const playerColor = STATE.userColor;
        handleClockAfterMove(playerColor);
    }

    if (result.success) {
        const gameState = ChessRules.checkGameState();
        if (gameState === 'checkmate' || gameState === 'stalemate' ||
            gameState === 'draw_fifty_move' || gameState.includes('draw')) {

            const gameResult = {
                game_id: STATE.gameId
            };

            if (gameState === 'checkmate') {
                gameResult.result = 'win';
                gameResult.winner = STATE.userId;
                gameResult.result_type = 'checkmate';
            } else {
                gameResult.result = 'draw';
                gameResult.winner = 'draw';

                if (gameState === 'stalemate') {
                    gameResult.result_type = 'stalemate';
                } else if (gameState === 'draw_fifty_move') {
                    gameResult.result_type = 'fifty_move';
                } else {
                    gameResult.result_type = 'other';
                }
            }

            if (shouldAnimate) {
                const originalCallback = STATE.animation.callback;
                STATE.animation.callback = () => {
                    if (originalCallback) originalCallback();

                    setTimeout(() => {
                        showGameResult(gameResult);
                    }, 100);
                };
            } else {
                setTimeout(() => {
                    showGameResult(gameResult);
                }, 100);
            }
        }
    }

    return result;
}

function handleOpponentMove(moveData) {
    console.log('Opponent move received:', moveData);

    const from = algebraicToIndex(moveData.move.substring(0, 2));
    const to = algebraicToIndex(moveData.move.substring(2, 4));

    if (from < 0 || from > 63 || to < 0 || to > 63) {
        console.error('Invalid move indices:', from, to);
        return;
    }

    const piece = STATE.currentPosition[from];
    if (!piece) {
        console.error('No piece found at source square:', from);
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }

    let flags = null;
    let promotionPiece = null;

    if (moveData.move.length === 5) {
        flags = 'promotion';
        promotionPiece = moveData.move[4].toLowerCase();
    }
    else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }
    else if (piece.toLowerCase() === 'p' && Math.abs(from % 8 - to % 8) === 1 &&
             STATE.currentPosition[to] === '') {
        flags = 'en_passant';
    }

    const move = { from, to, flags, promotionPiece };

    const fromSquare = getSquareElement(from);
    const toSquare = getSquareElement(to);

    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Failed to execute opponent move:', result.reason);
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }
    
    const opponentColor = STATE.userColor === 'white' ? 'black' : 'white';
    handleClockAfterMove(opponentColor);
    
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Generate notation for opponent move
    let notation;
    if (piece.toLowerCase() === 'p') {
        if (move.flags === 'promotion') {
            const captureFile = result.capturedPiece ? indexToAlgebraic(move.from)[0] + 'x' : '';
            notation = captureFile + indexToAlgebraic(move.to) + '=' + move.promotionPiece.toUpperCase();
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

    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

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

    // NEW: Store position after opponent move
    STATE.navigation.positions.push(STATE.currentPosition.slice());

    updateMovesList();
    
    if (moveData.status === 'completed') {
        let result = {
            game_id: STATE.gameId
        };

        if (moveData.winner === 'draw') {
            result.result = 'draw';

            if (result.result_type) {
                result.result = `draw_${result.result_type}`;
            } else {
                const gameState = ChessRules.checkGameState();
                if (gameState === 'stalemate') {
                    result.result = 'draw_stalemate';
                } else if (gameState === 'draw_fifty_move') {
                    result.result = 'draw_fifty_move';
                }
            }
        } else if (moveData.winner === STATE.userId) {
            result.result = 'win';
            result.winner = STATE.userId;
        } else {
            result.result = 'loss';
            result.winner = moveData.winner;
        }

        const originalCallback = STATE.animation.callback;
        STATE.animation.callback = () => {
            if (originalCallback) originalCallback();
            showGameResult(result);
        };
    }
    
    animatePieceMove(fromSquare, toSquare, piece, 200, () => {
        updateBoard();
    });
}

function loadFEN(fen) {
    try {
        const position = ChessRules.parseFEN(fen);
        STATE.currentPosition = [...position];
        updateBoard();
        return true;
    } catch (error) {
        console.error('Error parsing FEN:', error);
        return false;
    }
}

// ======= Server Communication =======
function initSocket() {
    const gameIdInput = document.getElementById('game-id');
    if (!gameIdInput || !gameIdInput.value) {
        console.error('No game ID found');
        alert('Game ID is missing. Please try joining the game from the dashboard.');
        return;
    }

    const gameId = gameIdInput.value;
    console.log('Initializing socket connection for game:', gameId);

    STATE.gameId = gameId;
    STATE.userColor = document.getElementById('user-color').value || null;

    STATE.socket = io();

    STATE.socket.on('connect', () => {
        console.log('Connected to server');

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        STATE.socket.emit('join_game', {
            game_id: STATE.gameId,
            token: token
        });

        console.log('Joining game room:', STATE.gameId);

        setupClockSync();

        setTimeout(() => {
            fetchGameData(STATE.gameId, token);
        }, 100);
    });

    STATE.socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    STATE.socket.on('game_joined', (data) => {
        console.log('Game room joined', data);
    });

    STATE.socket.on('game_updated', (data) => {
        console.log('Game updated event received:', data);

        if (data.status === 'active' && STATE.gameStatus === 'waiting') {
            console.log('Game is now active, refreshing data...');

            const token = localStorage.getItem('token');
            fetchGameData(STATE.gameId, token);

            showNotification('Game is now active!', 'success');
        }
    });

    STATE.socket.on('move_made', (moveData) => {
        console.log('Opponent made a move', moveData);
        handleOpponentMove(moveData);
    });

    STATE.socket.on('game_started', (gameData) => {
        console.log('Game started', gameData);

        updateOpponentInfo(gameData.opponent);

        STATE.gameStatus = 'active';

        updateGameStateUI();

        showNotification('Opponent joined the game!', 'success');

        const gameCodeContainer = document.getElementById('game-code-container');
        if (gameCodeContainer) {
            gameCodeContainer.style.display = 'none';
        }

        const inviteModal = document.getElementById('invite-modal');
        if (inviteModal && inviteModal.style.display !== 'none') {
            inviteModal.style.display = 'none';
        }
    });
    
    STATE.socket.on('clock_update', (data) => {
        console.log('Clock update received:', data);

        if (STATE.animation.inProgress) {
            console.log('Animation in progress, delaying clock update');
            setTimeout(() => {
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

                updateClockDisplay('white', STATE.clock.white);
                updateClockDisplay('black', STATE.clock.black);
            }, 100);
        } else {
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

            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);
        }
    });
    
    STATE.socket.on('game_result', (result) => {
        console.log('Game result received:', result);

        stopClockInterval();
        STATE.clock.started = false;

        STATE.gameStatus = 'completed';

        if (result.result_type) {
            if (!result.result) {
                if (result.winner === 'draw') {
                    result.result = 'draw';
                } else if (result.winner === STATE.userId) {
                    result.result = 'win';
                } else {
                    result.result = 'loss';
                }
            }

            if (result.result === 'draw') {
                result.result = `draw_${result.result_type}`;
            } else {
                result.result = `${result.result}_${result.result_type}`;
            }
        }

        showGameResult(result);
    });

    STATE.socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(error.message || 'An error occurred with the game connection');
    });
    
    STATE.socket.on('draw_offered', (data) => {
        console.log('Draw offered by opponent:', data);

        if (data.user_id !== STATE.userId) {
            showDrawOfferModal();
            showNotification('Your opponent offered a draw', 'info');
        }
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

        STATE.gameStatus = gameData.status;

        if (gameData.your_color) {
            STATE.userColor = gameData.your_color;
            document.getElementById('user-color').value = gameData.your_color;
        }

        updatePlayerInfo(gameData);

        const opponent = STATE.userColor === 'white' ? gameData.black_player : gameData.white_player;
        if (opponent) {
            updateOpponentInfo(opponent);
        }
        
        if (gameData.time_control) {
            updateTimeControlDisplay(gameData.time_control);
        }
        
        if (gameData.moves && gameData.moves.length > 0) {
            loadMoveHistory(gameData.moves);
        } else if (gameData.fen) {
            loadFEN(gameData.fen);
        } else {
            setupStartingPosition();
        }

        setInitialBoardOrientation();

        initClocks(gameData);

        updateBoard();

        updatePlayerBoxes();

        if (gameData.status === 'completed') {
            showGameResult(gameData.winner || 'draw');
        } else if (gameData.status === 'waiting') {
                       
            showGameInviteModal(gameData.game_code);
            
        }

        console.log('Game loaded successfully. Current position:', [...STATE.currentPosition]);

    } catch (error) {
        console.error('Error loading game data:', error);
        showNotification('Failed to load game data. Please refresh the page.', 'error');
    }
}

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

    modal.style.display = 'flex';
}

function updatePlayerInfo(gameData) {
    const playerName = document.getElementById('player-name');
    const playerRating = document.getElementById('player-rating');

    if (!playerName || !playerRating) return;

    const player = STATE.userColor === 'white' ? gameData.white_player : gameData.black_player;

    if (player) {
        playerName.textContent = player.username;
        playerRating.textContent = `ELO: ${player.elo || '?'}`;

        STATE.userId = player.user_id;
    } else {
        playerName.textContent = localStorage.getItem('username') || 'You';
        playerRating.textContent = '';
        STATE.userId = localStorage.getItem('userId');
    }

    console.log(`Player info updated. User is ${STATE.userColor}.`);
}

function loadMoveHistory(moves) {
    STATE.moveHistory = [];

    // Reset navigation positions
    STATE.navigation.positions = [];

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

    // Store starting position
    STATE.navigation.positions.push(ChessRules.gameState.position.slice());

    for (const move of moves) {
        const from = algebraicToIndex(move.move.substring(0, 2));
        const to = algebraicToIndex(move.move.substring(2, 4));

        if (from < 0 || to < 0 || from > 63 || to > 63) {
            console.error('Invalid move in history:', move);
            continue;
        }

        const piece = ChessRules.gameState.position[from];
        if (!piece) {
            console.error('No piece found at position:', from, 'for move:', move);
            continue;
        }

        let flags = null;
        let promotionPiece = null;

        if (move.move.length === 5) {
            flags = 'promotion';
            promotionPiece = move.move[4].toLowerCase();
        }
        else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
            flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
        }
        else if (piece.toLowerCase() === 'p' &&
                Math.abs(from % 8 - to % 8) === 1 &&
                ChessRules.gameState.position[to] === '') {
            flags = 'en_passant';
        }

        const moveObj = { from, to, flags, promotionPiece };

        const result = ChessRules.makeMove(moveObj);

        if (!result.success) {
            console.error('Failed to execute move in history:', move);
            continue;
        }

        // Store position after this move
        STATE.navigation.positions.push(ChessRules.gameState.position.slice());

        let notation;
        if (piece.toLowerCase() === 'p') {
            if (flags === 'promotion') {
                const captureFile = result.capturedPiece ? indexToAlgebraic(from)[0] + 'x' : '';
                notation = captureFile + indexToAlgebraic(to) + '=' + promotionPiece.toUpperCase();
            } else if (result.capturedPiece || flags === 'en_passant') {
                notation = indexToAlgebraic(from)[0] + 'x' + indexToAlgebraic(to);
            } else {
                notation = indexToAlgebraic(to);
            }
        } else if (flags === 'kingside_castle') {
            notation = 'O-O';
        } else if (flags === 'queenside_castle') {
            notation = 'O-O-O';
        } else {
            notation = piece.toUpperCase();
            if (result.capturedPiece) {
                notation += 'x';
            }
            notation += indexToAlgebraic(to);
        }

        if (result.isCheck) {
            notation += '+';
        }

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

    STATE.currentPosition = [...ChessRules.gameState.position];

    updateMovesList();
}

async function sendMoveToServer(uciMove) {
    const token = localStorage.getItem('token');

    try {
        console.log('Sending move to server:', uciMove);

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

            fetchGameData(STATE.gameId, token);
            return;
        }

        const gameData = await response.json();
        console.log('Move accepted by server:', gameData);

        if (gameData.status === 'completed') {
            console.log('Game completed with result:', gameData.winner);
        }
    } catch (error) {
        console.error('Error sending move to server:', error);
        alert('Failed to send move to server. Please try again.');
    }
}

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

    updatePlayerBoxes();

    if (STATE.gameStatus === 'waiting') {
        STATE.gameStatus = 'active';
        updateGameStateUI();
    }

    showNotification(`${opponent.username} joined the game!`, 'success');
}

function showNotification(message, type = 'info') {
    let notification = document.querySelector('.notification');

    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    notification.className = `notification ${type}`;
    notification.textContent = message;

    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showDrawOfferModal() {
    const modal = document.getElementById('draw-offer-modal');
    if (!modal) {
        console.error('Draw offer modal not found');
        return;
    }

    modal.style.display = 'flex';

    const acceptBtn = document.getElementById('accept-draw');
    if (acceptBtn) {
        acceptBtn.onclick = () => {
            if (STATE.socket) {
                STATE.socket.emit('accept_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                disableGameInteraction();

                showNotification('You accepted the draw offer', 'info');
            }
            modal.style.display = 'none';
        };
    }

    const declineBtn = document.getElementById('decline-draw');
    if (declineBtn) {
        declineBtn.onclick = () => {
            if (STATE.socket) {
                STATE.socket.emit('decline_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                showNotification('You declined the draw offer', 'info');
            }
            modal.style.display = 'none';
        };
    }
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ======= Event Listeners and Initialization =======
function initGame() {
    STATE.userId = localStorage.getItem('userId');
    STATE.username = localStorage.getItem('username');

    const playerName = document.getElementById('player-name');
    if (playerName) {
        playerName.textContent = STATE.username;
    }

    initBoard();

    const userColorInput = document.getElementById('user-color');
    if (userColorInput && userColorInput.value) {
        STATE.userColor = userColorInput.value;
        console.log("Initial user color from input:", STATE.userColor);
    }

    initSocket();

    addEventListeners();
}

function addEventListeners() {
    const flipBoardBtn = document.getElementById('flip-board');
    if (flipBoardBtn) {
        flipBoardBtn.addEventListener('click', () => {
            STATE.flipped = !STATE.flipped;
            STATE.manuallyFlipped = !STATE.manuallyFlipped;
            console.log(`Board manually flipped. Flipped: ${STATE.flipped}, Manual: ${STATE.manuallyFlipped}`);
            updateBoard();
            updatePlayerBoxes();
        });
    }

    const resignBtn = document.getElementById('resign-btn');
    if (resignBtn) {
        resignBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to resign? This action cannot be undone.')) {
                resignBtn.disabled = true;
                resignBtn.textContent = 'Resigning...';

                if (STATE.socket) {
                    STATE.socket.emit('resign', {
                        game_id: STATE.gameId,
                        token: localStorage.getItem('token')
                    });

                    showNotification('Resignation submitted', 'info');
                } else {
                    resignBtn.disabled = false;
                    resignBtn.textContent = 'Resign';
                    alert('Connection error. Please try again.');
                }
            }
        });
    }

    const drawBtn = document.getElementById('draw-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => {
            if (STATE.socket) {
                STATE.socket.emit('offer_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                drawBtn.disabled = true;
                drawBtn.textContent = 'Draw offered';

                showNotification('Draw offer sent to your opponent', 'info');

                setTimeout(() => {
                    drawBtn.disabled = false;
                    drawBtn.textContent = 'Offer draw';
                }, 3000);
            }
        });
    }

    const rematchBtn = document.getElementById('rematch-btn');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            STATE.socket.emit('request_rematch', {
                game_id: STATE.gameId,
                token: localStorage.getItem('token')
            });

            rematchBtn.textContent = 'Rematch requested';
            rematchBtn.disabled = true;
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');

            window.location.href = '/login';
        });
    }

    // NEW: Add keyboard navigation for moves
    document.addEventListener('keydown', (e) => {
        // Only allow navigation when not in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateBackward();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateForward();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            exitNavigation();
        }
    });

    // NEW: Add close button to result panel
    const gameResult = document.getElementById('game-result');
    if (gameResult) {
        // Add close button if it doesn't exist
        let closeBtn = gameResult.querySelector('.close-result-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.className = 'close-result-btn btn-icon';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '10px';
            closeBtn.style.right = '10px';
            
            closeBtn.addEventListener('click', () => {
                hideGameResult();
            });
            
            gameResult.appendChild(closeBtn);
        }
    }
}

function checkAuth() {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '/login';
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    initGame();
});

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
            console.log('Time:', initialMinutes, '+', increment);
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