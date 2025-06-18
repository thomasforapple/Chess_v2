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
// Moteur principal du jeu pour validation et génération de coups
const ChessRules = {
    // Constantes pour l'état du jeu
    CASTLING_RIGHTS: {
        WHITE_KINGSIDE: 0x1,
        WHITE_QUEENSIDE: 0x2,
        BLACK_KINGSIDE: 0x4,
        BLACK_QUEENSIDE: 0x8
    },
    PIECE_OFFSETS: {
        'p': [], // Les coups de pions sont gérés séparément
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

    // Suivi de l'état du jeu
    gameState: {
        position: [], // Position actuelle (sera remplie dans setupPosition)
        activeColor: 'w', // 'w' ou 'b'
        castlingRights: 0x0F, // Tous les droits de roque par défaut
        enPassantTarget: null, // Case où la prise en passant est possible
        halfMoveClock: 0, // Pour la règle des 50 coups
        fullMoveNumber: 1,
        kingPositions: {w: -1, b: -1} // Suivi des positions des rois pour la détection d'échecs
    },

    // Initialiser l'état du jeu à partir d'un tableau de position
    setupPosition: function (position) {
        this.gameState.position = [...position];

        // Trouver les positions des rois
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

    // Analyser la notation FEN et mettre à jour l'état interne
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

        // Droits de roque
        this.gameState.castlingRights = 0;
        if (parts[2].includes('K')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_KINGSIDE;
        if (parts[2].includes('Q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.WHITE_QUEENSIDE;
        if (parts[2].includes('k')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_KINGSIDE;
        if (parts[2].includes('q')) this.gameState.castlingRights |= this.CASTLING_RIGHTS.BLACK_QUEENSIDE;

        // Cible en passant
        this.gameState.enPassantTarget = parts[3] !== '-' ? this.algebraicToIndex(parts[3]) : null;

        // Compteur de demi-coups et numéro de coup complet
        this.gameState.halfMoveClock = parseInt(parts[4]) || 0;
        this.gameState.fullMoveNumber = parseInt(parts[5]) || 1;

        return position;
    },

    // Générer la FEN à partir de la position actuelle
    generateFEN: function () {
        let fen = '';

        // Placement des pièces
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

        // Couleur active
        fen += ' ' + this.gameState.activeColor;

        // Droits de roque
        let castling = '';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE) castling += 'K';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE) castling += 'Q';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE) castling += 'k';
        if (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE) castling += 'q';
        fen += ' ' + (castling || '-');

        // Cible en passant
        fen += ' ' + (this.gameState.enPassantTarget !== null ?
            this.indexToAlgebraic(this.gameState.enPassantTarget) : '-');

        // Compteur de demi-coups et numéro de coup complet
        fen += ' ' + this.gameState.halfMoveClock;
        fen += ' ' + this.gameState.fullMoveNumber;

        return fen;
    },

    // Convertir la notation algébrique en index de l'échiquier
    algebraicToIndex: function (algebraic) {
        const file = algebraic.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, ...
        const rank = 8 - parseInt(algebraic[1]); // Correction du bug typo
        return rank * 8 + file;
    },

    // Convertir l'index de l'échiquier en notation algébrique
    indexToAlgebraic: function (index) {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        return String.fromCharCode(97 + file) + (8 - rank);
    },

    // Vérifier si une case est sur l'échiquier
    isOnBoard: function (rank, file) {
        return rank >= 0 && rank < 8 && file >= 0 && file < 8;
    },

    // Obtenir la couleur de la pièce ('w' ou 'b' ou null si vide)
    getPieceColor: function (piece) {
        if (piece === '') return null;
        return piece === piece.toUpperCase() ? 'w' : 'b';
    },

    // Vérifier si une pièce est d'une couleur spécifique
    isPieceColor: function (piece, color) {
        if (piece === '') return false;
        return color === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
    },

    // Vérifier si le roi est en échec
    isInCheck: function (position, kingPos, color) {
        const enemyColor = color === 'w' ? 'b' : 'w';

        // Vérifier les attaques de chaque pièce ennemie
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

    // Générer tous les coups possibles pour une pièce spécifique
    generatePieceMoves: function (position, fromIndex, checkLegality = true) {
        const piece = position[fromIndex];
        if (piece === '') return [];

        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const fromRank = Math.floor(fromIndex / 8);
        const fromFile = fromIndex % 8;
        const moves = [];

        // Gérer les coups de pions
        if (pieceType === 'p') {
            const direction = color === 'w' ? -1 : 1;
            const startRank = color === 'w' ? 6 : 1;

            // Coup en avant
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

                // Capture normale
                if (position[toIndex] !== '' && this.isPieceColor(position[toIndex], color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }

                // Capture en passant
                if (toIndex === this.gameState.enPassantTarget) {
                    moves.push({from: fromIndex, to: toIndex, flags: 'en_passant'});
                }
            }
        }
        // Coups de cavalier
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
        // Pièces glissantes (fou, tour, dame)
        else if (this.SLIDING_PIECES.includes(pieceType)) {
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                let toRank = fromRank + rankOffset;
                let toFile = fromFile + fileOffset;

                while (this.isOnBoard(toRank, toFile)) {
                    const toIndex = toRank * 8 + toFile;
                    const targetPiece = position[toIndex];

                    // Case vide
                    if (targetPiece === '') {
                        moves.push({from: fromIndex, to: toIndex});
                    }
                    // Capture
                    else if (this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                        moves.push({from: fromIndex, to: toIndex});
                        break;
                    }
                    // Pièce propre - arrêter de regarder dans cette direction
                    else {
                        break;
                    }

                    toRank += rankOffset;
                    toFile += fileOffset;
                }
            }
        }
        // Coups de roi
        else if (pieceType === 'k') {
            // Coups normaux de roi
            for (const [rankOffset, fileOffset] of this.PIECE_OFFSETS[piece]) {
                const toRank = fromRank + rankOffset;
                const toFile = fromFile + fileOffset;

                if (!this.isOnBoard(toRank, toFile)) continue;

                const toIndex = toRank * 8 + toFile;
                const targetPiece = position[toIndex];

                // Case vide ou capture
                if (targetPiece === '' || this.isPieceColor(targetPiece, color === 'w' ? 'b' : 'w')) {
                    moves.push({from: fromIndex, to: toIndex});
                }
            }

            // Roque
            if (!checkLegality || !this.isInCheck(position, fromIndex, color)) {
                // Petit roque
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_KINGSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_KINGSIDE))) {

                    const kingFinalPos = color === 'w' ? 62 : 6;
                    const kingStartPos = color === 'w' ? 60 : 4;

                    if (position[kingFinalPos - 1] === '' && position[kingFinalPos] === '') {
                        // Vérifier si les cases ne sont pas sous attaque
                        if (!checkLegality ||
                            (!this.isSquareAttacked(position, kingStartPos + 1, color) &&
                                !this.isSquareAttacked(position, kingFinalPos, color))) {
                            moves.push({from: fromIndex, to: kingFinalPos, flags: 'kingside_castle'});
                        }
                    }
                }

                // Grand roque
                if ((color === 'w' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.WHITE_QUEENSIDE)) ||
                    (color === 'b' && (this.gameState.castlingRights & this.CASTLING_RIGHTS.BLACK_QUEENSIDE))) {

                    const kingFinalPos = color === 'w' ? 58 : 2;
                    const kingStartPos = color === 'w' ? 60 : 4;

                    if (position[kingFinalPos + 1] === '' && position[kingFinalPos] === '' && position[kingFinalPos - 1] === '') {
                        // Vérifier si les cases ne sont pas sous attaque
                        if (!checkLegality ||
                            (!this.isSquareAttacked(position, kingStartPos - 1, color) &&
                                !this.isSquareAttacked(position, kingFinalPos, color))) {
                            moves.push({from: fromIndex, to: kingFinalPos, flags: 'queenside_castle'});
                        }
                    }
                }
            }
        }

        // Filtrer les coups illégaux qui laisseraient le roi en échec
        if (checkLegality) {
            return moves.filter(move => this.isMoveLegal(position, move, color));
        }

        return moves;
    },

    // Vérifier si un coup est légal (ne laisse pas le roi en échec)
    isMoveLegal: function (position, move, color) {
        // Créer une copie de la position pour faire le coup
        const newPosition = [...position];

        // Déplacer la pièce
        const piece = newPosition[move.from];
        newPosition[move.to] = piece;
        newPosition[move.from] = '';

        // Gestion spéciale pour la capture en passant
        if (move.flags === 'en_passant') {
            const capturedPawnPos = move.to + (color === 'w' ? 8 : -8);
            newPosition[capturedPawnPos] = '';
        }

        // Gestion spéciale pour le roque
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

        // Trouver la position du roi après le coup
        let kingPos;
        if (piece.toLowerCase() === 'k') {
            kingPos = move.to;
        } else {
            kingPos = this.findKing(newPosition, color);
        }

        // Vérifier si le roi est en échec après le coup
        return !this.isInCheck(newPosition, kingPos, color);
    },

    // Vérifier si une case est attaquée par une pièce ennemie
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

    // Trouver la position du roi sur l'échiquier
    findKing: function (position, color) {
        const kingPiece = color === 'w' ? 'K' : 'k';
        for (let i = 0; i < 64; i++) {
            if (position[i] === kingPiece) {
                return i;
            }
        }
        return -1; // Cela ne devrait jamais arriver dans une position valide
    },

    // Générer tous les coups légaux pour le joueur actuel
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

    // Exécuter un coup sur l'échiquier
    makeMove: function (move) {
        // Obtenir des informations sur l'état actuel avant le coup
        const piece = this.gameState.position[move.from];
        const pieceType = piece.toLowerCase();
        const color = this.getPieceColor(piece);
        const isCapture = this.gameState.position[move.to] !== '';

        // Sauvegarder l'état précédent pour un éventuel retour en arrière
        const prevState = {
            position: [...this.gameState.position],
            activeColor: this.gameState.activeColor,
            castlingRights: this.gameState.castlingRights,
            enPassantTarget: this.gameState.enPassantTarget,
            halfMoveClock: this.gameState.halfMoveClock,
            fullMoveNumber: this.gameState.fullMoveNumber,
            kingPositions: {...this.gameState.kingPositions}
        };

        // Enregistrer la pièce capturée
        let capturedPiece = this.gameState.position[move.to];

        // Déplacer la pièce
        this.gameState.position[move.to] = piece;
        this.gameState.position[move.from] = '';

        // Mettre à jour les positions des rois si le roi a bougé
        if (pieceType === 'k') {
            this.gameState.kingPositions[color] = move.to;
        }

        // Gestion des coups spéciaux
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

        // Mettre à jour les droits de roque
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

        // Mettre à jour les droits de roque si une tour est capturée
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

        // Mettre à jour la cible en passant
        if (move.flags === 'double_push') {
            this.gameState.enPassantTarget = move.from + (color === 'w' ? 8 : -8);
        } else {
            this.gameState.enPassantTarget = null;
        }

        // Mettre à jour le compteur de demi-coups
        if (pieceType === 'p' || isCapture) {
            this.gameState.halfMoveClock = 0;
        } else {
            this.gameState.halfMoveClock++;
        }

        // Mettre à jour le numéro de coup complet
        if (color === 'b') {
            this.gameState.fullMoveNumber++;
        }

        // Changer la couleur active
        this.gameState.activeColor = color === 'w' ? 'b' : 'w';

        // Vérifier si le coup était légal (le roi n'est pas en échec)
        const kingPos = this.gameState.kingPositions[color];
        if (this.isInCheck(this.gameState.position, kingPos, color)) {
            // Coup illégal, revenir à l'état précédent
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

    // Vérifier l'état actuel du jeu (normal, échec, échec et mat, pat)
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

    // Générer la notation algébrique pour un coup
    generateMoveNotation: function (move, isCheck, isCheckmate) {
        const piece = this.getPieceAt(move.from);
        const pieceType = piece.toLowerCase();
        const pieceSymbol = pieceType === 'p' ? '' : pieceType.toUpperCase();

        // Gérer le roque
        if (piece.toUpperCase() === 'K' && Math.abs(move.from % 8 - move.to % 8) > 1) {
            const isKingside = move.to % 8 > move.from % 8;
            const notation = isKingside ? 'O-O' : 'O-O-O';
            return isCheckmate ? notation + '#' : (isCheck ? notation + '+' : notation);
        }

        let notation = pieceSymbol;

        // Ajouter la désambiguïsation si nécessaire
        if (pieceType !== 'p' && pieceType !== 'k') {
            const ambiguousMoves = this.findAmbiguousMoves(move);
            if (ambiguousMoves.length > 0) {
                // Vérifier si la désambiguïsation par colonne est suffisante
                const sameFileCount = ambiguousMoves.filter(m => m.from % 8 === move.from % 8).length;
                if (sameFileCount === 0) {
                    // La colonne est suffisante pour la désambiguïsation
                    notation += String.fromCharCode(97 + (move.from % 8));
                } else {
                    // Besoin de la rangée ou de la coordonnée complète
                    const sameRankCount = ambiguousMoves.filter(m => Math.floor(m.from / 8) === Math.floor(move.from / 8)).length;
                    if (sameRankCount === 0) {
                        // La rangée est suffisante
                        notation += 8 - Math.floor(move.from / 8);
                    } else {
                        // Besoin de la coordonnée complète
                        notation += this.indexToAlgebraic(move.from);
                    }
                }
            }
        }

        // Ajouter le symbole de capture
        const isCapture = this.getPieceAt(move.to) !== '' || move.flags === 'en_passant';
        if (isCapture) {
            // Pour les pions, ajouter la colonne d'origine
            if (pieceSymbol === '' && !notation.includes(String.fromCharCode(97 + (move.from % 8)))) {
                notation += String.fromCharCode(97 + (move.from % 8));
            }
            notation += 'x';
        }

        // Ajouter la case de destination
        notation += this.indexToAlgebraic(move.to);

        // Ajouter la pièce de promotion
        if (move.flags === 'promotion') {
            notation += '=' + move.promotionPiece.toUpperCase();
        }

        // Ajouter le symbole d'échec ou d'échec et mat
        if (isCheckmate) {
            notation += '#';
        } else if (isCheck) {
            notation += '+';
        }

        return notation;
    },

    // Trouver les coups qui pourraient être ambigus dans la notation
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

    // Obtenir la pièce à un index spécifique
    getPieceAt: function (index) {
        return this.gameState.position[index];
    },

    // Définir la position à partir d'un état de plateau existant
    setPositionFromState: function (position, activeColor = 'w') {
        this.setupPosition(position);
        this.gameState.activeColor = activeColor;

        // Réinitialiser la cible en passant lors du chargement d'une nouvelle position
        this.gameState.enPassantTarget = null;
    }
};

// ======= Gestion de l'état du jeu =======
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
    legalMoves: {}, // Stocker les coups légaux pré-calculés pour le joueur actuel
    animation: {
        inProgress: false,
        elements: [],
        callback: null
    },
    clock: {
        white: null,         // Temps du joueur blanc en millisecondes
        black: null,         // Temps du joueur noir en millisecondes
        increment: 0,        // Incrément en millisecondes
        lastMoveTime: null,  // Horodatage du serveur du dernier coup
        started: false,      // L'horloge a-t-elle commencé ?
        intervalId: null     // ID de l'intervalle de mise à jour de l'horloge
    },
    dragAndDrop: {
        isDragging: false,
        draggedPiece: null,
        draggedFromIndex: null,
        draggedElement: null,
        originalPosition: null
    }
};

// Initialiser les horloges basées sur les données du jeu
function initClocks(gameData) {
    console.log('Initialisation des horloges avec les données:', gameData);

    // Effacer tout intervalle existant
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }

    // Vérifier si le jeu a un contrôle du temps
    if (!gameData.time_control || gameData.time_control === 'unlimited') {
        console.log('Le jeu a un temps illimité');
        STATE.clock.white = null;
        STATE.clock.black = null;
        STATE.clock.increment = 0;
        STATE.clock.started = false;
        updateClockDisplay('white', null);
        updateClockDisplay('black', null);
        return;
    }
    
    // Gérer les contrôles de temps basés sur des chaînes (par exemple, 'blitz', 'rapid', 'classical')
    if (typeof gameData.time_control === 'string') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control;
        }
        
        console.log('Le jeu a un contrôle du temps:', gameData.time_control);
        
        // Définir les temps en fonction du type de contrôle du temps
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
                STATE.clock.white = 10 * 60 * 1000; // Par défaut 10 minutes
                STATE.clock.black = 10 * 60 * 1000;
        }
        
        STATE.clock.increment = 0; // Par défaut pas d'incrément pour les contrôles basés sur des chaînes
    } 
    // Gérer les contrôles de temps basés sur des objets (avec des propriétés comme initial_time_ms, increment, type)
    else if (typeof gameData.time_control === 'object') {
        const timeControlText = document.getElementById('time-control-text');
        if (timeControlText) {
            timeControlText.textContent = gameData.time_control.type || 'Personnalisé';
        }
        
        console.log('Le jeu a un contrôle du temps:', gameData.time_control.type);
        
        // Utiliser initial_time_ms de l'objet time_control pour les deux horloges
        if (gameData.time_control.initial_time_ms !== undefined) {
            STATE.clock.white = gameData.time_control.initial_time_ms;
            STATE.clock.black = gameData.time_control.initial_time_ms;
            STATE.clock.increment = gameData.time_control.increment || 0;
        } else {
            // Fallback basé sur le type si initial_time_ms n'est pas fourni
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
    
    // Si le serveur fournit des valeurs de temps explicites pour chaque joueur, les utiliser à la place
    if (gameData.white_time_ms !== undefined && gameData.white_time_ms !== null) {
        STATE.clock.white = gameData.white_time_ms;
    }
    
    if (gameData.black_time_ms !== undefined && gameData.black_time_ms !== null) {
        STATE.clock.black = gameData.black_time_ms;
    }
    
    if (gameData.increment_ms !== undefined) {
        STATE.clock.increment = gameData.increment_ms;
    }

    // Définir des propriétés d'horloge supplémentaires
    STATE.clock.lastMoveTime = gameData.last_move_timestamp ? new Date(gameData.last_move_timestamp).getTime() : null;
    STATE.clock.started = gameData.status === 'active';

    // Forcer une synchronisation immédiate avec le serveur pour obtenir les temps les plus précis
    if (STATE.clock.started) {
        // D'abord mettre à jour l'affichage avec ce que nous avons (pour éviter le scintillement)
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
        
        // Puis synchroniser immédiatement avec le serveur
        syncClockWithServer(true); // Passer true pour indiquer que c'est la synchronisation initiale
    } else {
        // Juste mettre à jour l'affichage pour un jeu qui n'a pas commencé
        updateClockDisplay('white', STATE.clock.white);
        updateClockDisplay('black', STATE.clock.black);
    }

    console.log('Horloges initialisées (v3):', STATE.clock);
}

// Analyser la chaîne de contrôle du temps en temps initial et incrément
function parseTimeControl(timeControlStr) {
    // Valeurs par défaut
    const result = {
        initial: null,   // Pas de limite de temps par défaut
        increment: 0     // Pas d'incrément par défaut
    };

    // Gérer les formats de chaîne simples
    if (!timeControlStr || timeControlStr === 'unlimited') {
        return result;
    }

    if (typeof timeControlStr === 'object') {
        // Si c'est déjà un objet, l'utiliser directement
        return {
            initial: timeControlStr.initial_time_ms || null,
            increment: timeControlStr.increment_ms || 0
        };
    }

    // Sinon analyser le format de chaîne
    switch (timeControlStr) {
        case 'blitz':
            result.initial = 5 * 60 * 1000; // 5 minutes en ms
            break;
        case 'rapid':
            result.initial = 10 * 60 * 1000; // 10 minutes en ms
            break;
        case 'classical':
            result.initial = 30 * 60 * 1000; // 30 minutes en ms
            break;
        default:
            // Essayer d'analyser au format "initial+incrément" (par exemple, "5+2")
            const match = timeControlStr.match(/^(\d+)(?:\+(\d+))?$/);
            if (match) {
                result.initial = parseInt(match[1]) * 60 * 1000; // Minutes en ms
                if (match[2]) {
                    result.increment = parseInt(match[2]) * 1000; // Secondes en ms
                }
            }
    }

    return result;
}

// Commencer l'intervalle d'horloge pour mettre à jour l'horloge du joueur actif
function startClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
    }

    const updateRate = 100; // Mettre à jour toutes les 100ms pour un affichage plus fluide
    STATE.clock.intervalId = setInterval(() => {
        updateActiveClock();
    }, updateRate);
}

// Arrêter l'intervalle d'horloge
function stopClockInterval() {
    if (STATE.clock.intervalId) {
        clearInterval(STATE.clock.intervalId);
        STATE.clock.intervalId = null;
    }
}

// Mettre à jour l'horloge du joueur actif
function updateActiveClock() {
    if (!STATE.clock.started || STATE.gameStatus !== 'active') {
        stopClockInterval();
        return;
    }

    // Déterminer à qui c'est le tour
    const activeColor = ChessRules.gameState.activeColor === 'w' ? 'white' : 'black';

    // Mettre à jour l'horloge active
    if (STATE.clock[activeColor] !== null) {
        // Décrémenter le temps
        STATE.clock[activeColor] -= 100; // Soustraire 100ms

        // Vérifier le dépassement de temps
        if (STATE.clock[activeColor] <= 0) {
            STATE.clock[activeColor] = 0;
            handleTimeout(activeColor);
        }

        // Mettre à jour l'affichage
        updateClockDisplay(activeColor, STATE.clock[activeColor]);
    }
}

// Gérer un joueur qui dépasse le temps
function handleTimeout(color) {
    console.log(`Le joueur ${color} a manqué de temps`);
    stopClockInterval();
    STATE.clock.started = false;

    // Émettre un événement au serveur pour gérer le dépassement de temps
    if (STATE.socket) {
        STATE.socket.emit('time_out', {
            game_id: STATE.gameId,
            token: localStorage.getItem('token'),
            color: color
        });
    }

    // Gérer les changements d'interface utilisateur pour le dépassement de temps
    const winner = color === 'white' ? 'black' : 'white';
    showGameResult({
        result: 'timeout',
        winner: winner === STATE.userColor ? STATE.userId : STATE.opponentId
    });
}

// Mettre à jour l'affichage de l'horloge pour un joueur
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

    // Formater le temps
    const formattedTime = formatClockTime(timeMs);
    clockElement.textContent = formattedTime;

    // Ajouter des indicateurs visuels
    clockElement.classList.remove('clock-active', 'clock-low');

    // Vérifier si c'est l'horloge active
    if (STATE.clock.started && ChessRules.gameState.activeColor === (color === 'white' ? 'w' : 'b')) {
        clockElement.classList.add('clock-active');
    }

    // Vérifier si le temps s'épuise (moins de 30 secondes)
    if (timeMs < 30000) {
        clockElement.classList.add('clock-low');
    }
}

// Formater les millisecondes en chaîne d'affichage d'horloge
function formatClockTime(ms) {
    if (ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Pour les temps inférieurs à 10 secondes, afficher les décisecondes
    if (totalSeconds < 10) {
        const deciseconds = Math.floor((ms % 1000) / 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${deciseconds}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function setupClockSync() {
    // Faire une synchronisation immédiate
    syncClockWithServer();

    // Puis configurer un intervalle pour synchroniser toutes les 10 secondes
    // Cela aide à prévenir la dérive entre les horloges client et serveur
    setInterval(() => {
        if (STATE.gameStatus === 'active' && STATE.clock.started) {
            syncClockWithServer();
        }
    }, 10000);
}

// Synchroniser l'horloge avec le serveur
function syncClockWithServer(isInitialSync = false) {
    if (!STATE.socket || !STATE.gameId) return;

    console.log('Synchronisation de l\'horloge avec le serveur...');

    // Stocker l'heure de la demande de synchronisation
    const syncRequestTime = Date.now();

    STATE.socket.emit('get_remaining_time', {
        game_id: STATE.gameId,
        token: localStorage.getItem('token')
    });

    // Si c'est la synchronisation initiale, nous configurerons un écouteur unique pour la réponse
    if (isInitialSync) {
        // Utiliser once() pour s'assurer que cela ne se produit qu'une seule fois
        STATE.socket.once('clock_update', (data) => {
            console.log('Synchronisation d\'horloge initiale reçue:', data);

            // Calculer la latence réseau (très simplifiée)
            const latency = Math.floor((Date.now() - syncRequestTime) / 2);
            console.log('Latence unidirectionnelle estimée:', latency, 'ms');

            // Mettre à jour l'état de l'horloge avec les valeurs du serveur
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

            // Mettre à jour les affichages
            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);

            // Commencer l'intervalle d'horloge si le jeu est actif
            if (STATE.clock.started && STATE.gameStatus === 'active' &&
                STATE.clock.white !== null && STATE.clock.black !== null) {
                startClockInterval();
            }
        });
    }
}

// Gérer un coup fait - changer l'horloge
function handleClockAfterMove(color) {
    if (STATE.clock.white === null || STATE.clock.black === null) {
        return; // Pas de contrôle du temps
    }

    // Obtenir la couleur qui vient de jouer
    const movingColor = color ||
        (ChessRules.gameState.activeColor === 'w' ? 'black' : 'white');

    // Ajouter l'incrément au joueur qui vient de jouer
    if (STATE.clock.increment > 0) {
        STATE.clock[movingColor] += STATE.clock.increment;
    }

    // S'assurer que les horloges sont démarrées après le premier coup
    if (!STATE.clock.started && STATE.gameStatus === 'active') {
        STATE.clock.started = true;
        startClockInterval();
    }

    // Mettre à jour les deux affichages
    updateClockDisplay('white', STATE.clock.white);
    updateClockDisplay('black', STATE.clock.black);
}

// ======= Fonctions utilitaires =======

// Convertir file (0-7) et rank (0-7) en notation algébrique (a1, h8, etc.)
function fileRankToPosition(file, rank) {
    const fileChar = String.fromCharCode(97 + file);
    const rankChar = 8 - rank;
    return fileChar + rankChar;
}

// Convertir la notation algébrique en file et rank
function positionToFileRank(position) {
    const file = position.charCodeAt(0) - 97;
    const rank = 8 - parseInt(position[1]);
    return { file, rank };
}

// Convertir l'index de position en notation algébrique
function indexToAlgebraic(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return fileRankToPosition(file, rank);
}

// Convertir la notation algébrique en index de position
function algebraicToIndex(algebraic) {
    const { file, rank } = positionToFileRank(algebraic);
    return rank * 8 + file;
}

// Obtenir l'élément case pour un index d'échiquier donné
function getSquareElement(index) {
    // Convertir l'index interne en file et rank
    const file = index % 8;
    const rank = Math.floor(index / 8);

    // Convertir en notation algébrique, en tenant compte de l'orientation de l'échiquier
    let position;
    if (STATE.flipped) {
        position = fileRankToPosition(7 - file, 7 - rank);
    } else {
        position = fileRankToPosition(file, rank);
    }

    // Obtenir l'élément case
    return document.querySelector(`.square[data-position="${position}"]`);
}

// Convertir un objet coup en notation UCI
function moveToUci(move) {
    const from = indexToAlgebraic(move.from);
    const to = indexToAlgebraic(move.to);

    // Gérer la promotion
    if (move.flags === 'promotion' && move.promotionPiece) {
        return `${from}${to}${move.promotionPiece}`;
    }

    return `${from}${to}`;
}

// Convertir la notation UCI en objet coup
function uciToMove(uci) {
    if (typeof uci !== 'string' || uci.length < 4) {
        console.error('Notation UCI invalide:', uci);
        return null;
    }

    const from = algebraicToIndex(uci.substring(0, 2));
    const to = algebraicToIndex(uci.substring(2, 4));

    let flags = null;
    let promotionPiece = null;

    // Vérifier la promotion
    if (uci.length === 5) {
        flags = 'promotion';
        promotionPiece = uci[4];
    }
    // Vérifier la prise en passant
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'p' &&
             Math.abs(from % 8 - to % 8) === 1 &&
             ChessRules.gameState.position[to] === '') {
        flags = 'en_passant';
    }
    // Vérifier le roque
    else if (ChessRules.gameState.position[from] &&
             ChessRules.gameState.position[from].toLowerCase() === 'k' &&
             Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }

    return { from, to, flags, promotionPiece };
}

// Vérifier si c'est le tour du joueur actuel
function isPlayersTurn() {
    const userColor = document.getElementById('user-color').value;
    const fen = ChessRules.generateFEN();
    const isWhiteTurn = fen.split(' ')[1] === 'w';

    return (userColor === 'white' && isWhiteTurn) || (userColor === 'black' && !isWhiteTurn);
}

// ======= Fonctions de manipulation du DOM =======

// Initialiser les éléments de l'échiquier
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
            
            // Ajouter les événements de drag and drop
            square.addEventListener('dragover', handleDragOver);
            square.addEventListener('drop', handleDrop);
            square.addEventListener('dragenter', handleDragEnter);
            square.addEventListener('dragleave', handleDragLeave);
            
            board.appendChild(square);
        }
    }

    setupStartingPosition();
}

// Configurer la position de départ
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

    // Initialiser le moteur de règles d'échecs
    ChessRules.setupPosition(STATE.currentPosition);

    // Pré-calculer les coups légaux pour la position de départ
    precomputeLegalMoves();

    updateBoard();
    updateGameStateUI();
}

// Mettre à jour l'échiquier visuel basé sur la position actuelle
function updateBoard() {
    const squares = document.querySelectorAll('.square');

    // Effacer toutes les cases d'abord
    squares.forEach(square => {
        // Supprimer toutes les pièces existantes
        const img = square.querySelector('img');
        if (img) {
            square.removeChild(img);
        }
    });

    // Maintenant ajouter les pièces basées sur la position actuelle
    squares.forEach(square => {
        // Obtenir la position de la case (comme "a1", "e4", etc.)
        const position = square.dataset.position;
        const {file, rank} = positionToFileRank(position);

        // Ajuster pour l'orientation de l'échiquier
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
            
            // Ajouter les événements de drag
            img.addEventListener('dragstart', handleDragStart);
            img.addEventListener('dragend', handleDragEnd);
            
            square.appendChild(img);
        }
    });

    // Synchroniser le moteur de règles avec la position actuelle
    ChessRules.setPositionFromState(STATE.currentPosition,
        STATE.gameStatus === 'active' ? ChessRules.gameState.activeColor : 'w');

    // Pré-calculer les coups légaux pour la position actuelle
    precomputeLegalMoves();

    // Mettre à jour l'affichage de l'état du jeu
    updateGameStateUI();

    console.log('Échiquier mis à jour avec la position:', [...STATE.currentPosition]);
}

// ======= Fonctions Drag and Drop =======

function handleDragStart(e) {
    // Vérifier si le jeu est actif et si c'est le tour du joueur
    if (STATE.gameStatus !== 'active' || !isPlayersTurn()) {
        e.preventDefault();
        return;
    }
    
    const img = e.target;
    const piece = img.dataset.piece;
    const index = parseInt(img.dataset.index);
    
    // Vérifier si c'est une pièce du joueur actuel
    const isCurrentPlayerPiece = piece && 
        ChessRules.getPieceColor(piece) === ChessRules.gameState.activeColor;
    
    if (!isCurrentPlayerPiece) {
        e.preventDefault();
        return;
    }
    
    // Configurer l'état de drag
    STATE.dragAndDrop.isDragging = true;
    STATE.dragAndDrop.draggedPiece = piece;
    STATE.dragAndDrop.draggedFromIndex = index;
    STATE.dragAndDrop.draggedElement = img;
    STATE.dragAndDrop.originalPosition = {
        parent: img.parentNode,
        nextSibling: img.nextSibling
    };
    
    // Effacer toute sélection existante
    clearPossibleMoves();
    STATE.selectedSquare = null;
    
    // Montrer les coups possibles pour la pièce glissée
    showPossibleMoves(index);
    
    // Configurer les données de transfert
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    
    // Ajouter une classe visuelle
    img.classList.add('dragging');
    
    console.log('Démarrage du glissement pour la pièce:', piece, 'depuis l\'index:', index);
}

function handleDragEnd(e) {
    // Nettoyer l'état de drag
    const img = e.target;
    img.classList.remove('dragging');
    
    // Effacer les indicateurs de coups possibles
    clearPossibleMoves();
    
    // Si le glissement était annulé, remettre la pièce à sa position d'origine
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
    
    // Réinitialiser l'état de drag
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
    
    // Ajuster pour l'orientation de l'échiquier
    const toIndex = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;
    
    // Vérifier si c'est un coup légal
    const legalMoves = STATE.legalMoves[STATE.dragAndDrop.draggedFromIndex] || [];
    const isLegalMove = legalMoves.some(move => move.to === toIndex);
    
    if (isLegalMove) {
        square.classList.add('drag-over-valid');
    }
    // SUPPRIMÉ: Plus de feedback pour cases illégales
}

function handleDragLeave(e) {
    const square = e.currentTarget;
    square.classList.remove('drag-over-valid');
    // SUPPRIMÉ: drag-over-invalid
}

function handleDrop(e) {
    e.preventDefault();
    
    if (!STATE.dragAndDrop.isDragging) return;
    
    const square = e.currentTarget;
    square.classList.remove('drag-over-valid'); // SUPPRIMÉ: drag-over-invalid
    
    const position = square.dataset.position;
    const {file, rank} = positionToFileRank(position);
    
    // Ajuster pour l'orientation de l'échiquier
    const toIndex = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;
    
    const fromIndex = STATE.dragAndDrop.draggedFromIndex;
    
    // Vérifier si c'est un coup légal
    const legalMoves = STATE.legalMoves[fromIndex] || [];
    const legalMove = legalMoves.find(move => move.to === toIndex);
    
    if (legalMove) {
        // Coup légal - l'exécuter SANS animation pour le drag & drop
        const result = executeLocalMove(legalMove, false); // false = pas d'animation
        
        if (result.success) {
            // Mettre à jour immédiatement l'échiquier sans animation
            updateBoard();
            
            // Envoyer le coup au serveur
            const uciMove = moveToUci(legalMove);
            sendMoveToServer(uciMove);
        }
        
        // Marquer que le glissement a réussi
        STATE.dragAndDrop.isDragging = false;
    } else {
        // Coup illégal - la pièce retournera à sa position d'origine dans handleDragEnd
        console.log('Coup illégal tenté via drag & drop');
    }
}

// Mettre à jour l'interface utilisateur basée sur l'état actuel du jeu
function updateGameStateUI() {
    // Vérifier l'échec, l'échec et mat, le pat
    const gameState = ChessRules.checkGameState();

    // Effacer tous les indicateurs existants
    document.querySelectorAll('.check-indicator').forEach(el => el.remove());

    // Gérer les fins de partie
    if (gameState === 'checkmate') {
        const winner = ChessRules.gameState.activeColor === 'w' ? 'Noirs' : 'Blancs';
        // Montrer l'interface utilisateur de résultat du jeu
        showGameResult(winner.toLowerCase() === STATE.userColor ? 'win' : 'loss');
    } else if (gameState === 'stalemate' || gameState === 'draw_fifty_move') {
        // Montrer l'interface utilisateur de résultat du jeu
        showGameResult('draw');
    } else if (gameState === 'check') {
        // Marquer le roi qui est en échec (indication visuelle sur l'échiquier)
        const kingPos = ChessRules.gameState.kingPositions[ChessRules.gameState.activeColor];
        highlightKingInCheck(kingPos);
    }

    // Pré-calculer les coups légaux pour la position actuelle
    precomputeLegalMoves();
}

function showGameResult(result) {
    const gameResult = document.getElementById('game-result');
    const resultMessage = document.getElementById('result-message');

    if (!gameResult || !resultMessage) {
        console.error('Éléments de résultat du jeu non trouvés');
        return;
    }

    console.log('Affichage du résultat du jeu:', result);

    // Déterminer le type de résultat et le message
    let message = '';
    let cause = '';
    let resultClass = '';

    // Vérifier si l'utilisateur actuel est le gagnant
    const isWinner = result.winner === STATE.userId;
    const isLoser = result.loser === STATE.userId;
    const isDraw = result.result === 'draw' || result.winner === 'draw';

    // Gérer différents types de résultats
    if (isDraw) {
        message = 'Nulle';
        resultClass = 'draw';
        
        if (result.result_type) {
            switch(result.result_type) {
                case 'agreement':
                    cause = 'Par accord';
                    break;
                case 'stalemate':
                    cause = 'Par pat';
                    break;
                case 'fifty_move':
                    cause = 'Par la règle des cinquante coups';
                    break;
                case 'insufficient':
                    cause = 'Par matériel insuffisant';
                    break;
                default:
                    cause = 'Par ' + result.result_type;
            }
        } else {
            cause = 'Par accord';
        }
    } 
    else if (result.result === 'timeout') {
        if (isLoser) {
            message = 'Vous avez perdu';
            resultClass = 'loss';
            cause = 'Au temps';
        } else {
            message = 'Vous avez gagné';
            resultClass = 'win';
            cause = 'L\'adversaire a manqué de temps';
        }
    }
    else if (result.result === 'resigned' || result.result === 'resignation') {
        if (isLoser) {
            message = 'Vous avez perdu';
            resultClass = 'loss';
            cause = 'Par abandon';
        } else {
            message = 'Vous avez gagné';
            resultClass = 'win';
            cause = 'L\'adversaire a abandonné';
        }
    }
    else if (isWinner) {
        message = 'Vous avez gagné';
        resultClass = 'win';
        cause = result.result_type ? 'Par ' + result.result_type : 'Par échec et mat';
    } 
    else {
        message = 'Vous avez perdu';
        resultClass = 'loss';
        cause = result.result_type ? 'Par ' + result.result_type : 'Par échec et mat';
    }

    // Définir le contenu du message
    resultMessage.innerHTML = `
        <div class="result-header">${message}</div>
        <div class="result-cause">${cause}</div>
    `;
    
    // Animation fluide : Réinitialiser les classes et configurer pour l'animation
    gameResult.className = 'game-result-panel'; // Effacer toutes les classes
    gameResult.style.display = 'block'; // Rendre visible mais toujours caché via CSS
    
    // Forcer le reflow : S'assurer que l'état initial est appliqué
    gameResult.offsetHeight;
    
    // Déclencher l'animation : Ajouter des classes pour démarrer la transition fluide
    gameResult.classList.add('show', resultClass);

    // Désactiver l'interaction du jeu
    disableGameInteraction();

    // Montrer une notification
    showNotification(`${message} - ${cause}`, resultClass === 'win' ? 'success' :
        (resultClass === 'loss' ? 'error' : 'info'));

    // Défilement fluide : Faire défiler le résultat en vue en douceur
    setTimeout(() => {
        gameResult.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
        });
    }, 100); // Petit délai pour laisser l'animation commencer
}

// Cacher le résultat du jeu avec animation
function hideGameResult() {
    const gameResult = document.getElementById('game-result');
    if (!gameResult) return;
    
    // Supprimer la classe show et ajouter la classe hide
    gameResult.classList.remove('show');
    gameResult.classList.add('hide');
    
    // Après la fin de l'animation, cacher complètement
    setTimeout(() => {
        gameResult.style.display = 'none';
        gameResult.classList.remove('hide');
    }, 300); // Correspondre à la durée de transition CSS
}

// Mettre à jour le panneau de résultat pour charger des jeux existants
function showGameResultForExistingGame(gameData) {
    if (gameData.status !== 'completed') return;
    
    // Déterminer le résultat basé sur les données du jeu
    const result = {
        game_id: gameData.game_id,
        winner: gameData.winner,
        result_type: gameData.result_type || 'checkmate'
    };
    
    // Petit délai pour s'assurer que l'échiquier est chargé en premier
    setTimeout(() => {
        showGameResult(result);
    }, 500); // Donner le temps à l'échiquier de se rendre
}

function disableGameInteraction() {
    // Supprimer les gestionnaires de clic des cases
    document.querySelectorAll('.square').forEach(square => {
        const newSquare = square.cloneNode(true);
        square.parentNode.replaceChild(newSquare, square);
    });

    // Désactiver les boutons d'action du jeu
    const drawBtn = document.getElementById('draw-btn');
    const resignBtn = document.getElementById('resign-btn')
    if (resignBtn) resignBtn.disabled = true;
    if (drawBtn) drawBtn.disabled = true;
}

// Mettre en évidence le roi qui est en échec
function highlightKingInCheck(kingPos) {
    const kingRank = Math.floor(kingPos / 8);
    const kingFile = kingPos % 8;

    // Convertir en position visuelle (en ajustant pour le retournement de l'échiquier)
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

// Pré-calculer les coups légaux pour le joueur actuel
function precomputeLegalMoves() {
    STATE.legalMoves = {}; // Réinitialiser le cache des coups légaux

    // Calculer les coups légaux seulement si c'est le tour du joueur
    if (!isPlayersTurn()) return;

    const color = ChessRules.gameState.activeColor;

    // Parcourir toutes les cases
    for (let i = 0; i < 64; i++) {
        const piece = STATE.currentPosition[i];
        // Si la case a une pièce de la couleur du joueur actuel
        if (piece && ChessRules.getPieceColor(piece) === color) {
            // Calculer les coups légaux pour cette pièce
            const moves = ChessRules.generatePieceMoves(STATE.currentPosition, i, true);
            if (moves.length > 0) {
                STATE.legalMoves[i] = moves;
            }
        }
    }
}

// Afficher les coups possibles pour une pièce sélectionnée
function showPossibleMoves(index) {
    // Effacer tous les indicateurs existants
    clearPossibleMoves();

    // Obtenir les coups légaux pour la pièce sélectionnée à partir du cache pré-calculé
    const legalMoves = STATE.legalMoves[index] || [];

    for (const move of legalMoves) {
        // Convertir en position visuelle (en ajustant pour le retournement de l'échiquier)
        const toRank = Math.floor(move.to / 8);
        const toFile = move.to % 8;
        const visualPos = STATE.flipped
            ? fileRankToPosition(7 - toFile, 7 - toRank)
            : fileRankToPosition(toFile, toRank);

        const targetSquare = document.querySelector(`.square[data-position="${visualPos}"]`);
        if (!targetSquare) continue;

        // Vérifier si c'est une capture en passant
        const isEnPassant = move.flags === 'en_passant';

        // Créer l'indicateur approprié basé sur le type de coup
        if (STATE.currentPosition[move.to] !== '' || isEnPassant) {
            // Coup de capture - y compris la prise en passant
            const captureIndicator = document.createElement('div');
            captureIndicator.className = 'possible-capture';
            targetSquare.appendChild(captureIndicator);
        } else {
            // Coup normal
            const moveIndicator = document.createElement('div');
            moveIndicator.className = 'possible-move';
            targetSquare.appendChild(moveIndicator);
        }
    }
}

// Effacer tous les indicateurs de coups possibles
function clearPossibleMoves() {
    document.querySelectorAll('.possible-move, .possible-capture').forEach(el => el.remove());
}

// SUPPRIMÉ: highlightSquare et clearHighlights - Plus de coloration de pièce cliquée

// Mettre à jour l'affichage de la liste des coups
function updateMovesList() {
    const movesList = document.getElementById('moves-list');
    if (!movesList) return;

    movesList.innerHTML = '';

    if (STATE.moveHistory.length === 0) {
        movesList.innerHTML = '<p>Aucun coup joué pour le moment.</p>';
        return;
    }

    let moveHtml = '';
    let moveNumber = 1;

    for (let i = 0; i < STATE.moveHistory.length; i += 2) {
        moveHtml += `<div class="move-row">`;
        moveHtml += `<span class="move-number">${moveNumber}.</span>`;

        // Coup des blancs
        moveHtml += `<span class="move">${STATE.moveHistory[i].notation}</span>`;

        // Coup des noirs (s'il existe)
        if (i + 1 < STATE.moveHistory.length) {
            moveHtml += `<span class="move">${STATE.moveHistory[i + 1].notation}</span>`;
        } else {
            moveHtml += `<span class="move-placeholder"></span>`;
        }

        moveHtml += `</div>`;
        moveNumber++;
    }

    movesList.innerHTML = moveHtml;

    // Faire défiler vers le bas
    movesList.scrollTop = movesList.scrollHeight;
}

// Montrer le dialogue de promotion quand un pion atteint la dernière rangée
function showPromotionDialog(move, callback) {
    const promotionOverlay = document.getElementById('promotion-overlay');
    const promotionPieces = document.getElementById('promotion-pieces');

    // Effacer les pièces précédentes
    promotionPieces.innerHTML = '';

    // Obtenir la couleur du joueur
    const color = STATE.userColor === 'white' ? 'w' : 'b';

    // Ajouter les pièces de promotion (dame, tour, fou, cavalier)
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

    // Montrer le dialogue de promotion
    promotionOverlay.style.display = 'flex';
}

// Fonctions d'animation
function animatePieceMove(fromSquare, toSquare, piece, duration = 200, callback = null, isCastling = false, rookData = null) {
    // D'abord, terminer toute animation qui pourrait être en cours
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    // Définir l'état d'animation
    STATE.animation.inProgress = true;
    STATE.animation.elements = [];
    STATE.animation.callback = callback;

    // Créer l'élément de pièce animée
    const animatedPiece = document.createElement('img');
    const color = piece.toUpperCase() === piece ? 'w' : 'b';
    const pieceChar = piece.toLowerCase();
    const pieceName = PIECE_TYPES[pieceChar];

    animatedPiece.src = `/static/images/${pieceName}-${color}.svg`;
    animatedPiece.className = 'piece';

    // Ajouter à la liste des éléments d'animation pour le nettoyage
    STATE.animation.elements.push(animatedPiece);

    // Calculs de position - obtenir les coordonnées d'écran réelles
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();
    const boardContainer = document.querySelector('.board-container');
    const boardRect = boardContainer.getBoundingClientRect();

    // Calculs de taille
    const squareSize = fromRect.width;
    const pieceSize = Math.round(squareSize * 0.95);
    animatedPiece.style.width = `${pieceSize}px`;
    animatedPiece.style.height = `${pieceSize}px`;

    // Ajouter au DOM
    boardContainer.appendChild(animatedPiece);

    // Calculer le décalage de centrage
    const offsetX = (squareSize - pieceSize) / 2;

    // Définir la position initiale basée sur fromRect visuel
    animatedPiece.style.left = `${fromRect.left - boardRect.left + offsetX}px`;
    animatedPiece.style.top = `${fromRect.top - boardRect.top + offsetX}px`;

    // Cacher l'image originale pendant l'animation
    const originalImg = fromSquare.querySelector('img');
    if (originalImg) {
        // Définir explicitement l'opacité à 0 en plus d'ajouter la classe
        originalImg.style.opacity = '0';
        originalImg.classList.add('animating');
    }

    // Pour le roque, nous devons animer à la fois le roi et la tour
    if (isCastling && rookData) {
        const { rookFromSquare, rookToSquare, rookPiece } = rookData;

        // Créer l'élément d'animation de la tour
        const animatedRook = document.createElement('img');
        const rookColor = rookPiece.toUpperCase() === rookPiece ? 'w' : 'b';
        animatedRook.src = `/static/images/rook-${rookColor}.svg`;
        animatedRook.className = 'piece';

        // Ajouter à la liste des éléments d'animation pour le nettoyage
        STATE.animation.elements.push(animatedRook);

        // Positionner la tour en utilisant les coordonnées DOM
        const rookFromRect = rookFromSquare.getBoundingClientRect();
        const rookToRect = rookToSquare.getBoundingClientRect();

        animatedRook.style.width = `${pieceSize}px`;
        animatedRook.style.height = `${pieceSize}px`;

        // Ajouter au DOM
        boardContainer.appendChild(animatedRook);

        // Définir la position initiale de la tour basée sur le rect visuel
        animatedRook.style.left = `${rookFromRect.left - boardRect.left + offsetX}px`;
        animatedRook.style.top = `${rookFromRect.top - boardRect.top + offsetX}px`;

        // Cacher la tour originale pendant l'animation
        const originalRookImg = rookFromSquare.querySelector('img');
        if (originalRookImg) {
            // Définir explicitement l'opacité à 0 en plus d'ajouter la classe
            originalRookImg.style.opacity = '0';
            originalRookImg.classList.add('animating');
        }

        // Nous utilisons une astuce requestAnimationFrame pour nous assurer que toute la mise en page est terminée
        // avant de commencer la transition pour une animation plus fluide
        requestAnimationFrame(() => {
            // Définir les transitions pour les deux pièces
            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
            animatedRook.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            // Déplacer le roi vers la destination en utilisant les coordonnées visuelles
            const destXKing = toRect.left - boardRect.left + offsetX;
            const destYKing = toRect.top - boardRect.top + offsetX;
            animatedPiece.style.left = `${destXKing}px`;
            animatedPiece.style.top = `${destYKing}px`;

            // Déplacer la tour vers la destination en utilisant les coordonnées visuelles
            const destXRook = rookToRect.left - boardRect.left + offsetX;
            const destYRook = rookToRect.top - boardRect.top + offsetX;
            animatedRook.style.left = `${destXRook}px`;
            animatedRook.style.top = `${destYRook}px`;

            // Utiliser l'événement transitionend pour la fin
            let animationsCompleted = 0;
            const onTransitionEnd = () => {
                animationsCompleted++;

                // Quand les deux pièces ont terminé leurs transitions
                if (animationsCompleted === 2) {
                    // Vérifier si l'animation a été annulée
                    if (!STATE.animation.inProgress) return;

                    // Mettre à jour l'interface utilisateur après la fin de l'animation
                    finishCurrentAnimation();
                }
            };

            animatedPiece.addEventListener('transitionend', onTransitionEnd, { once: true });
            animatedRook.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Délai de sécurité au cas où les transitions ne déclencheraient pas leurs événements
            setTimeout(() => {
                if (STATE.animation.inProgress &&
                    STATE.animation.elements.includes(animatedPiece)) {
                    finishCurrentAnimation();
                }
            }, duration + 50);
        });
    } else {
        // Animation de coup normal (non-roque)
        requestAnimationFrame(() => {
            // Calculer la destination en utilisant les coordonnées visuelles
            const destX = toRect.left - boardRect.left + offsetX;
            const destY = toRect.top - boardRect.top + offsetX;

            // Définir la transition
            animatedPiece.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;

            // Déplacer vers la destination
            animatedPiece.style.left = `${destX}px`;
            animatedPiece.style.top = `${destY}px`;

            // Écouter la fin de la transition
            animatedPiece.addEventListener('transitionend', () => {
                // Vérifier si l'animation a été annulée
                if (!STATE.animation.inProgress) return;

                // Terminer l'animation
                finishCurrentAnimation();
            }, { once: true });

            // Délai de sécurité au cas où la transition ne déclencherait pas son événement
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

    // Supprimer toutes les pièces animées
    STATE.animation.elements.forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });

    // S'assurer que toutes les pièces qui étaient cachées pour l'animation sont à nouveau visibles
    document.querySelectorAll('.animating').forEach(el => {
        el.classList.remove('animating');
        // Restaurer explicitement l'opacité
        el.style.opacity = '1';
    });

    // Exécuter le callback de manière synchrone plutôt que d'attendre la fin de l'animation
    if (STATE.animation.callback) {
        const callback = STATE.animation.callback;
        STATE.animation.callback = null;
        callback();
    }

    // Réinitialiser l'état d'animation
    STATE.animation.inProgress = false;
    STATE.animation.elements = [];
}

// ======= Fonctions de logique de jeu =======

// Gérer le clic sur une case
function handleSquareClick(position) {
    // Si l'animation est en cours, la terminer
    if (STATE.animation.inProgress) {
        finishCurrentAnimation();
    }

    // Vérifier si le jeu est actif et si c'est le tour du joueur
    if (STATE.gameStatus !== 'active' || !isPlayersTurn()) {
        return;
    }

    const { file, rank } = positionToFileRank(position);
    const index = STATE.flipped
        ? (7 - rank) * 8 + (7 - file)
        : rank * 8 + file;

    // Vérifier si une pièce est à la position cliquée et si c'est le tour du joueur actuel
    const pieceAtClicked = STATE.currentPosition[index];
    const isCurrentPlayerPiece = pieceAtClicked &&
        ChessRules.getPieceColor(pieceAtClicked) === ChessRules.gameState.activeColor;

    if (STATE.selectedSquare === null) {
        // Si aucune case n'est sélectionnée et on clique sur une pièce du joueur actuel, la sélectionner
        if (isCurrentPlayerPiece) {
            STATE.selectedSquare = index;
            showPossibleMoves(index);
        }
    } else {
        // Si une case est déjà sélectionnée

        // Si on clique sur la même pièce qui est déjà sélectionnée, la désélectionner
        if (STATE.selectedSquare === index) {
            clearPossibleMoves();
            STATE.selectedSquare = null;
            return;
        }

        // Si on clique sur une autre pièce du joueur actuel, la sélectionner à la place
        if (isCurrentPlayerPiece && STATE.selectedSquare !== index) {
            clearPossibleMoves();
            STATE.selectedSquare = index;
            showPossibleMoves(index);
            return;
        }

        // Si on clique sur une case différente, essayer de déplacer la pièce
        if (STATE.selectedSquare !== index) {
            // Obtenir les coups légaux pour la pièce sélectionnée à partir du cache pré-calculé
            const legalMoves = STATE.legalMoves[STATE.selectedSquare] || [];
            const legalMove = legalMoves.find(move => move.to === index);

            if (legalMove) {
                // Gérer le coup
                makeMove(STATE.selectedSquare, index, legalMove);
            } else {
                // Effacer la sélection si on clique sur une destination illégale
                clearPossibleMoves();
                STATE.selectedSquare = null;
            }
        }
    }
}

// Exécuter un coup et l'envoyer au serveur
function makeMove(fromIndex, toIndex, moveObj) {
    // Vérifier la promotion
    const piece = STATE.currentPosition[fromIndex];
    const isPawn = piece.toLowerCase() === 'p';
    const toRank = Math.floor(toIndex / 8);
    const isLastRank = (piece === 'P' && toRank === 0) || (piece === 'p' && toRank === 7);

    if (isPawn && isLastRank) {
        // Montrer le dialogue de promotion
        showPromotionDialog({from: fromIndex, to: toIndex}, (promotionPiece) => {
            // Créer l'objet coup avec promotion
            const move = {
                from: fromIndex,
                to: toIndex,
                flags: 'promotion',
                promotionPiece: promotionPiece
            };

            // Exécuter le coup localement avec animation
            const result = executeLocalMove(move, true);

            if (result.success) {
                // Envoyer le coup au serveur
                const uciMove = moveToUci(move);
                sendMoveToServer(uciMove);
            }
        });
    } else {
        // Exécuter le coup localement avec animation
        const result = executeLocalMove(moveObj, true);

        if (result.success) {
            // Envoyer le coup au serveur
            const uciMove = moveToUci(moveObj);
            sendMoveToServer(uciMove);
        }
    }
}

// Mettre à jour setInitialBoardOrientation
function setInitialBoardOrientation() {
    console.log("Définition de l'orientation initiale de l'échiquier. Couleur de l'utilisateur:", STATE.userColor);

    // Retourner automatiquement l'échiquier pour le joueur noir
    if (STATE.userColor === 'black') {
        console.log("Le joueur est noir, retournement de l'échiquier");
        STATE.flipped = true;
        STATE.manuallyFlipped = false; // C'est l'orientation naturelle pour les noirs
        updateBoard();
    } else {
        // S'assurer que l'échiquier n'est pas retourné pour le joueur blanc
        console.log("Le joueur est blanc, orientation normale");
        STATE.flipped = false;
        STATE.manuallyFlipped = false; // C'est l'orientation naturelle pour les blancs
        updateBoard();
    }

    // Toujours mettre à jour les boîtes de joueurs après avoir défini l'orientation
    updatePlayerBoxes();
}

function updatePlayerBoxes() {
    const topPlayerBox = document.getElementById('top-player-box');
    const bottomPlayerBox = document.getElementById('bottom-player-box');
    const playerInfo = document.getElementById('player-info');
    const opponentInfo = document.getElementById('opponent-info');

    if (!topPlayerBox || !bottomPlayerBox || !playerInfo || !opponentInfo) {
        console.error('Éléments de boîte de joueur non trouvés');
        return;
    }

    console.log(`Mise à jour des boîtes de joueurs. Échiquier retourné: ${STATE.flipped}, Retourné manuellement: ${STATE.manuallyFlipped}, Couleur de l'utilisateur: ${STATE.userColor}`);

    // D'abord, supprimer les divs d'informations de leurs parents actuels si nécessaire
    if (playerInfo.parentNode) {
        playerInfo.parentNode.removeChild(playerInfo);
    }

    if (opponentInfo.parentNode) {
        opponentInfo.parentNode.removeChild(opponentInfo);
    }

    // Si l'échiquier est dans son état de retournement manuel (l'utilisateur a cliqué sur le bouton de retournement)
    // alors le joueur devrait être en haut, l'adversaire en bas
    if (STATE.manuallyFlipped) {
        console.log("Retournement manuel: joueur en haut, adversaire en bas");
        topPlayerBox.appendChild(playerInfo);
        bottomPlayerBox.appendChild(opponentInfo);
    } else {
        // Orientation naturelle: joueur en bas, adversaire en haut
        console.log("Orientation naturelle: joueur en bas, adversaire en haut");
        topPlayerBox.appendChild(opponentInfo);
        bottomPlayerBox.appendChild(playerInfo);
    }
}

// Exécuter un coup localement (sur le client)
function executeLocalMove(moveObj, shouldAnimate = true) {
    // Faire une copie de l'objet coup
    const move = {...moveObj};

    // Sauvegarder la pièce qui est déplacée avant tout changement
    const piece = STATE.currentPosition[move.from];

    // Obtenir les éléments de case de départ et d'arrivée pour l'animation
    const fromSquare = getSquareElement(move.from);
    const toSquare = getSquareElement(move.to);

    if (!fromSquare || !toSquare) {
        console.error('Impossible de trouver les cases pour l\'animation');
        return { success: false, reason: 'animation_error' };
    }

    // Exécuter le coup dans le moteur de règles
    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Échec de l\'exécution du coup dans le moteur de règles:', result.reason);
        return result;
    }

    // Mettre à jour la position actuelle après un coup réussi
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Générer une notation algébrique appropriée
    let notation;
    if (piece.toLowerCase() === 'p') {
        // Gestion spéciale pour les coups de pions
        if (move.flags === 'promotion') {
            notation = indexToAlgebraic(move.to) + '=' + move.promotionPiece.toUpperCase();
        } else if (result.capturedPiece || move.flags === 'en_passant') {
            // Capture
            notation = indexToAlgebraic(move.from)[0] + 'x' + indexToAlgebraic(move.to);
        } else {
            // Coup normal de pion
            notation = indexToAlgebraic(move.to);
        }
    } else if (move.flags === 'kingside_castle') {
        notation = 'O-O';
    } else if (move.flags === 'queenside_castle') {
        notation = 'O-O-O';
    } else {
        // Coup de pièce standard
        notation = piece.toUpperCase();
        if (result.capturedPiece) {
            notation += 'x';
        }
        notation += indexToAlgebraic(move.to);
    }

    // Ajouter l'indicateur d'échec ou d'échec et mat
    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

    // Créer le format UCI pour la communication serveur (par exemple, "e2e4")
    const uciNotation = indexToAlgebraic(move.from) + indexToAlgebraic(move.to);

    // Ajouter le coup à l'historique
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

    // Mettre à jour l'interface utilisateur
    updateMovesList();

    // Gérer l'animation seulement si demandée (pour les clics, pas pour le drag & drop)
    if (shouldAnimate) {
        if (move.flags === 'kingside_castle' || move.flags === 'queenside_castle') {
            // Animation spéciale de roque avec roi et tour
            const color = ChessRules.getPieceColor(piece);
            const isKingside = move.flags === 'kingside_castle';

            // Calculer les positions logiques pour la tour
            const rookFromIndex = color === 'w' ?
                (isKingside ? 63 : 56) :
                (isKingside ? 7 : 0);

            const rookToIndex = color === 'w' ?
                (isKingside ? 61 : 59) :
                (isKingside ? 5 : 3);

            // Obtenir les cases visuelles pour l'animation de la tour
            const rookFromSquare = getSquareElement(rookFromIndex);
            const rookToSquare = getSquareElement(rookToIndex);

            if (rookFromSquare && rookToSquare) {
                const rookData = {
                    rookFromSquare,
                    rookToSquare,
                    rookPiece: color === 'w' ? 'R' : 'r'
                };

                // Animer le roi et la tour ensemble
                animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                    // S'assurer de mettre à jour l'échiquier après la fin de l'animation
                    updateBoard();
                }, true, rookData);
            } else {
                // Fallback si les cases de la tour ne sont pas trouvées
                animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                    updateBoard();
                });
            }
        } else {
            // Animation de coup normal
            animatePieceMove(fromSquare, toSquare, piece, 200, () => {
                // Critique: mettre à jour l'échiquier après la fin de l'animation
                updateBoard();
            });
        }
    }

    // Effacer la sélection
    clearPossibleMoves();
    STATE.selectedSquare = null;
    
    if (result.success) {
        // Obtenir la couleur du joueur qui vient de jouer
        const playerColor = STATE.userColor;

        // Mettre à jour l'horloge après le coup
        handleClockAfterMove(playerColor);
    }

    if (result.success) {
        // Vérifier si le jeu s'est terminé
        const gameState = ChessRules.checkGameState();
        if (gameState === 'checkmate' || gameState === 'stalemate' ||
            gameState === 'draw_fifty_move' || gameState.includes('draw')) {

            // Créer un objet de résultat avec des détails spécifiques
            const gameResult = {
                game_id: STATE.gameId
            };

            if (gameState === 'checkmate') {
                // Échec et mat - le joueur actuel a gagné
                gameResult.result = 'win';
                gameResult.winner = STATE.userId;
                gameResult.result_type = 'checkmate';
            } else {
                // Nulle avec raison spécifique
                gameResult.result = 'draw';
                gameResult.winner = 'draw';

                if (gameState === 'stalemate') {
                    gameResult.result_type = 'stalemate';
                } else if (gameState === 'draw_fifty_move') {
                    gameResult.result_type = 'fifty_move';
                } else {
                    // Par défaut nulle générique si on ne peut pas déterminer la raison spécifique
                    gameResult.result_type = 'other';
                }
            }

            // Montrer le résultat après les mises à jour de l'échiquier et l'animation
            if (shouldAnimate) {
                const originalCallback = STATE.animation.callback;
                STATE.animation.callback = () => {
                    if (originalCallback) originalCallback();

                    // Petit délai pour s'assurer que l'interface utilisateur est mise à jour en premier
                    setTimeout(() => {
                        showGameResult(gameResult);
                    }, 100);
                };
            } else {
                // Pour le drag & drop, montrer immédiatement
                setTimeout(() => {
                    showGameResult(gameResult);
                }, 100);
            }
        }
    }

    return result;
}

// Gérer le coup de l'adversaire reçu du serveur
function handleOpponentMove(moveData) {
    console.log('Coup de l\'adversaire reçu:', moveData);

    // Analyser le coup UCI
    const from = algebraicToIndex(moveData.move.substring(0, 2));
    const to = algebraicToIndex(moveData.move.substring(2, 4));

    // Vérification de sécurité pour les indices invalides
    if (from < 0 || from > 63 || to < 0 || to > 63) {
        console.error('Indices de coup invalides:', from, to);
        return;
    }

    const piece = STATE.currentPosition[from];
    if (!piece) {
        console.error('Aucune pièce trouvée à la case source:', from);
        // Essayer de récupérer en chargeant la FEN si disponible
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }

    // Déterminer le type/flags du coup
    let flags = null;
    let promotionPiece = null;

    // Vérifier la promotion
    if (moveData.move.length === 5) {
        flags = 'promotion';
        promotionPiece = moveData.move[4].toLowerCase();
    }
    // Vérifier le roque
    else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
        flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
    }
    // Vérifier la prise en passant
    else if (piece.toLowerCase() === 'p' && Math.abs(from % 8 - to % 8) === 1 &&
             STATE.currentPosition[to] === '') {
        flags = 'en_passant';
    }

    const move = { from, to, flags, promotionPiece };

    // Obtenir les éléments de case de départ et d'arrivée pour l'animation
    const fromSquare = getSquareElement(from);
    const toSquare = getSquareElement(to);

    // Exécuter le coup dans le moteur de règles
    const result = ChessRules.makeMove(move);

    if (!result.success) {
        console.error('Échec de l\'exécution du coup de l\'adversaire:', result.reason);
        // Fallback pour charger la position à partir de la FEN si disponible
        if (moveData.fen) {
            loadFEN(moveData.fen);
        }
        return;
    }
    
    const opponentColor = STATE.userColor === 'white' ? 'black' : 'white';

    // Mettre à jour l'horloge après le coup
    handleClockAfterMove(opponentColor);
    
    // Mettre à jour la position actuelle
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Générer une notation appropriée (même logique que dans executeLocalMove)
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

    // Ajouter l'indicateur d'échec ou d'échec et mat
    if (ChessRules.checkGameState() === 'checkmate') {
        notation += '#';
    } else if (result.isCheck) {
        notation += '+';
    }

    // Ajouter le coup à l'historique
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

    // Mettre à jour l'interface utilisateur
    updateMovesList();
    
    if (moveData.status === 'completed') {
        // Déterminer le résultat du jeu
        let result = {
            game_id: STATE.gameId
        };

        if (moveData.winner === 'draw') {
            result.result = 'draw';

            // Essayer de déterminer la raison de la nulle
            if (result.result_type) {
                result.result = `draw_${result.result_type}`;
            } else {
                // Si aucune raison spécifique, vérifier l'état de l'échiquier
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

        // Après l'animation, montrer le résultat du jeu
        const originalCallback = STATE.animation.callback;
        STATE.animation.callback = () => {
            if (originalCallback) originalCallback();
            showGameResult(result);
        };
    }
    
    // Animer le coup
    animatePieceMove(fromSquare, toSquare, piece, 200, () => {
        // Critique: mettre à jour l'échiquier après la fin de l'animation
        updateBoard();
    });
}

// Charger une position à partir de la FEN
function loadFEN(fen) {
    try {
        // Utiliser le moteur de règles pour analyser la FEN
        const position = ChessRules.parseFEN(fen);

        // Mettre à jour l'état de l'application
        STATE.currentPosition = [...position];

        // Mettre à jour l'affichage de l'échiquier
        updateBoard();

        return true;
    } catch (error) {
        console.error('Erreur lors de l\'analyse de la FEN:', error);
        return false;
    }
}

// ======= Communication serveur =======

// Initialiser la connexion Socket.IO
function initSocket() {
    // Charger l'ID du jeu à partir de l'URL ou de l'entrée cachée
    const gameIdInput = document.getElementById('game-id');
    if (!gameIdInput || !gameIdInput.value) {
        console.error('Aucun ID de jeu trouvé');
        alert('L\'ID du jeu est manquant. Veuillez essayer de rejoindre le jeu depuis le tableau de bord.');
        return;
    }

    const gameId = gameIdInput.value;
    console.log('Initialisation de la connexion socket pour le jeu:', gameId);

    STATE.gameId = gameId;
    STATE.userColor = document.getElementById('user-color').value || null;

    // Se connecter au serveur Socket.IO
    STATE.socket = io();

    // Événement de connexion
    STATE.socket.on('connect', () => {
        console.log('Connecté au serveur');

        // Rejoindre la salle de jeu immédiatement lors de la connexion
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Aucun token d\'authentification trouvé');
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        // D'abord rejoindre la salle de jeu AVANT d'obtenir les données du jeu
        STATE.socket.emit('join_game', {
            game_id: STATE.gameId,
            token: token
        });

        console.log('Rejoindre la salle de jeu:', STATE.gameId);

        // Configurer la synchronisation de l\'horloge
        setupClockSync();

        // Petit délai avant de charger les données du jeu pour s'assurer que le rejoignement de la salle se termine
        setTimeout(() => {
            // Charger les données du jeu via l'API
            fetchGameData(STATE.gameId, token);
        }, 100);
    });

    // Événement de déconnexion
    STATE.socket.on('disconnect', () => {
        console.log('Déconnecté du serveur');
    });

    // Événement de jeu rejoint
    STATE.socket.on('game_joined', (data) => {
        console.log('Salle de jeu rejointe', data);
    });

    // Événement de jeu mis à jour
    STATE.socket.on('game_updated', (data) => {
        console.log('Événement de jeu mis à jour reçu:', data);

        // Si le jeu est maintenant actif (quelqu\'un a rejoint), actualiser les données du jeu
        if (data.status === 'active' && STATE.gameStatus === 'waiting') {
            console.log('Le jeu est maintenant actif, actualisation des données...');

            // Actualiser les données du jeu depuis le serveur
            const token = localStorage.getItem('token');
            fetchGameData(STATE.gameId, token);

            // Montrer une notification
            showNotification('Le jeu est maintenant actif !', 'success');
        }
    });

    // Événement de coup joué
    STATE.socket.on('move_made', (moveData) => {
        console.log('L\'adversaire a joué un coup', moveData);

        // Gérer le coup de l'adversaire
        handleOpponentMove(moveData);
    });

    // Événement de jeu commencé
    STATE.socket.on('game_started', (gameData) => {
        console.log('Jeu commencé', gameData);

        // Mettre à jour les informations de l'adversaire
        updateOpponentInfo(gameData.opponent);

        // Définir le jeu comme actif
        STATE.gameStatus = 'active';

        // Mettre à jour l'interface utilisateur
        updateGameStateUI();

        // Montrer une notification
        showNotification('L\'adversaire a rejoint le jeu !', 'success');

        // Cacher le conteneur de code de jeu s'il est affiché
        const gameCodeContainer = document.getElementById('game-code-container');
        if (gameCodeContainer) {
            gameCodeContainer.style.display = 'none';
        }

        // Fermer le modal d'invitation s'il est ouvert
        const inviteModal = document.getElementById('invite-modal');
        if (inviteModal && inviteModal.style.display !== 'none') {
            inviteModal.style.display = 'none';
        }
    });
    
    STATE.socket.on('clock_update', (data) => {
        console.log('Mise à jour de l\'horloge reçue:', data);

        // Ne pas mettre à jour si une animation est en cours pour éviter les problèmes visuels
        if (STATE.animation.inProgress) {
            console.log('Animation en cours, retard de la mise à jour de l\'horloge');
            // Stocker la mise à jour pour l'appliquer après l'animation
            setTimeout(() => {
                // Mettre à jour l'état de l'horloge
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

                // Mettre à jour les affichages
                updateClockDisplay('white', STATE.clock.white);
                updateClockDisplay('black', STATE.clock.black);
            }, 100); // Court délai pour permettre à l'animation de se terminer
        } else {
            // Mise à jour normale
            // Mettre à jour l'état de l'horloge
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

            // Mettre à jour les affichages
            updateClockDisplay('white', STATE.clock.white);
            updateClockDisplay('black', STATE.clock.black);
        }
    });
    
    STATE.socket.on('game_result', (result) => {
        console.log('Résultat du jeu reçu:', result);

        // Arrêter l'horloge quand le jeu se termine
        stopClockInterval();
        STATE.clock.started = false;

        // Mettre à jour le statut du jeu
        STATE.gameStatus = 'completed';

        // Traiter le résultat avec les informations de résultat améliorées
        if (result.result_type) {
            // Si nous avons un type de résultat spécifique, l'ajouter à l'objet résultat
            if (!result.result) {
                // Définir un résultat par défaut basé sur le gagnant
                if (result.winner === 'draw') {
                    result.result = 'draw';
                } else if (result.winner === STATE.userId) {
                    result.result = 'win';
                } else {
                    result.result = 'loss';
                }
            }

            // Créer un type de résultat combiné pour la fonction showGameResult
            if (result.result === 'draw') {
                result.result = `draw_${result.result_type}`;
            } else {
                // Pour les victoires/défaites, les préfixer avec la cause spécifique
                result.result = `${result.result}_${result.result_type}`;
            }
        }

        // Montrer le résultat du jeu
        showGameResult(result);
    });

    // Événement d'erreur
    STATE.socket.on('error', (error) => {
        console.error('Erreur socket:', error);
        alert(error.message || 'Une erreur s\'est produite avec la connexion du jeu');
    });
    
    // Offre de nulle reçue
    STATE.socket.on('draw_offered', (data) => {
        console.log('Nulle offerte par l\'adversaire:', data);

        // Montrer le modal d'offre de nulle seulement s'il n'a pas été envoyé par l'utilisateur actuel
        if (data.user_id !== STATE.userId) {
            // Montrer le modal d'offre de nulle
            showDrawOfferModal();

            // Montrer une notification
            showNotification('Votre adversaire a offert une nulle', 'info');
        }
    });
}

async function fetchGameData(gameId, token) {
    try {
        console.log('Récupération des données du jeu...');

        const response = await fetch(`/api/games/${gameId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Échec du chargement des données du jeu');
        }

        const gameData = await response.json();
        console.log('Données du jeu chargées:', gameData);

        // Mettre à jour l'état du jeu
        STATE.gameStatus = gameData.status;

        // Mettre à jour la couleur de l'utilisateur - CRITIQUE pour l'orientation correcte de l'échiquier
        if (gameData.your_color) {
            STATE.userColor = gameData.your_color;
            document.getElementById('user-color').value = gameData.your_color;
        }

        // Mettre à jour les informations du joueur
        updatePlayerInfo(gameData);

        // Mettre à jour les informations de l'adversaire
        const opponent = STATE.userColor === 'white' ? gameData.black_player : gameData.white_player;
        if (opponent) {
            updateOpponentInfo(opponent);
        }
        
        if (gameData.time_control) {
            updateTimeControlDisplay(gameData.time_control);
        }
        
        // Important: D'abord charger l'historique des coups pour reconstruire le jeu
        if (gameData.moves && gameData.moves.length > 0) {
            loadMoveHistory(gameData.moves);
        } else if (gameData.fen) {
            // Si pas de coups mais FEN disponible, l'utiliser
            loadFEN(gameData.fen);
        } else {
            // Réinitialiser à la position de départ si pas de coups ou FEN
            setupStartingPosition();
        }

        // Définir l'orientation de l'échiquier APRÈS avoir chargé les positions
        setInitialBoardOrientation();

        // Initialiser les horloges avec les données du serveur
        initClocks(gameData);

        // Forcer la mise à jour de l'échiquier après avoir chargé la position
        updateBoard();

        // Mettre à jour les boîtes de joueurs
        updatePlayerBoxes();

        // Mettre à jour l'interface utilisateur basée sur le statut du jeu
        if (gameData.status === 'completed') {
            showGameResult(gameData.winner || 'draw');
        } else if (gameData.status === 'waiting') {
            // Montrer le code de jeu si nous sommes le créateur
            const whitePlayerId = gameData.white_player ? gameData.white_player.user_id : null;
            if (whitePlayerId === localStorage.getItem('userId')) {
                showGameInviteModal(gameData.game_code);
            }
        }

        console.log('Jeu chargé avec succès. Position actuelle:', [...STATE.currentPosition]);

    } catch (error) {
        console.error('Erreur lors du chargement des données du jeu:', error);
        showNotification('Échec du chargement des données du jeu. Veuillez actualiser la page.', 'error');
    }
}

// Ajouter une fonction pour montrer le modal d'invitation de jeu
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
            copyCodeBtn.textContent = 'Copié !';
            setTimeout(() => {
                copyCodeBtn.textContent = 'Copier';
            }, 2000);
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(linkInput.value);
            copyLinkBtn.textContent = 'Copié !';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copier';
            }, 2000);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Montrer le modal
    modal.style.display = 'flex';
}

// Fonction pour mettre à jour les informations du joueur
function updatePlayerInfo(gameData) {
    const playerName = document.getElementById('player-name');
    const playerRating = document.getElementById('player-rating');

    if (!playerName || !playerRating) return;

    // Déterminer les données du joueur basées sur la couleur de l'utilisateur
    const player = STATE.userColor === 'white' ? gameData.white_player : gameData.black_player;

    if (player) {
        // Nous avons des données de joueur du jeu
        playerName.textContent = player.username;
        playerRating.textContent = `ELO: ${player.elo || '?'}`;

        // Stocker notre ID utilisateur pour les comparaisons ultérieures
        STATE.userId = player.user_id;
    } else {
        // Fallback aux données de stockage local
        playerName.textContent = localStorage.getItem('username') || 'Vous';
        playerRating.textContent = '';
        STATE.userId = localStorage.getItem('userId');
    }

    console.log(`Informations du joueur mises à jour. L'utilisateur est ${STATE.userColor}.`);
}

// Fonction pour charger l'historique des coups
function loadMoveHistory(moves) {
    // Effacer l'historique des coups existant
    STATE.moveHistory = [];

    // Réinitialiser la position à la position de départ
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

    // Rejouer les coups pour reconstruire la notation appropriée et la position actuelle
    for (const move of moves) {
        // Convertir le coup UCI en format interne
        const from = algebraicToIndex(move.move.substring(0, 2));
        const to = algebraicToIndex(move.move.substring(2, 4));

        // Ignorer les coups invalides
        if (from < 0 || to < 0 || from > 63 || to > 63) {
            console.error('Coup invalide dans l\'historique:', move);
            continue;
        }

        // Obtenir la pièce qui est déplacée
        const piece = ChessRules.gameState.position[from];
        if (!piece) {
            console.error('Aucune pièce trouvée à la position:', from, 'pour le coup:', move);
            continue;
        }

        // Déterminer la pièce de promotion si nécessaire
        let flags = null;
        let promotionPiece = null;

        if (move.move.length === 5) {
            flags = 'promotion';
            promotionPiece = move.move[4].toLowerCase();
        }
        // Vérifier le roque
        else if (piece.toLowerCase() === 'k' && Math.abs(from - to) > 1) {
            flags = (to % 8 > from % 8) ? 'kingside_castle' : 'queenside_castle';
        }
        // Vérifier la prise en passant
        else if (piece.toLowerCase() === 'p' &&
                Math.abs(from % 8 - to % 8) === 1 &&
                ChessRules.gameState.position[to] === '') {
            flags = 'en_passant';
        }

        // Créer l'objet coup
        const moveObj = { from, to, flags, promotionPiece };

        // Exécuter le coup dans le moteur de règles
        const result = ChessRules.makeMove(moveObj);

        if (!result.success) {
            console.error('Échec de l\'exécution du coup dans l\'historique:', move);
            continue;
        }

        // Générer une notation algébrique appropriée
        let notation;
        if (piece.toLowerCase() === 'p') {
            // Coup de pion
            if (flags === 'promotion') {
                notation = indexToAlgebraic(to) + '=' + promotionPiece.toUpperCase();
            } else if (result.capturedPiece || flags === 'en_passant') {
                // Capture
                notation = indexToAlgebraic(from)[0] + 'x' + indexToAlgebraic(to);
            } else {
                // Coup normal de pion
                notation = indexToAlgebraic(to);
            }
        } else if (flags === 'kingside_castle') {
            notation = 'O-O';
        } else if (flags === 'queenside_castle') {
            notation = 'O-O-O';
        } else {
            // Coup de pièce standard
            notation = piece.toUpperCase();
            if (result.capturedPiece) {
                notation += 'x';
            }
            notation += indexToAlgebraic(to);
        }

        // Ajouter l'indicateur d'échec ou d'échec et mat
        if (result.isCheck) {
            notation += '+';
        }

        // Ajouter le coup à l'historique
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

    // Mettre à jour la position actuelle pour correspondre à la position finale des coups rejoués
    STATE.currentPosition = [...ChessRules.gameState.position];

    // Mettre à jour l'affichage de la liste des coups
    updateMovesList();
}

// Envoyer un coup au serveur
async function sendMoveToServer(uciMove) {
    const token = localStorage.getItem('token');

    try {
        console.log('Envoi du coup au serveur:', uciMove);

        // Envoyer le coup via l'API REST
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
            console.error('Le serveur a rejeté le coup:', errorData);
            alert('Coup échoué: ' + (errorData.error || 'Erreur inconnue'));

            // Recharger l'état actuel du jeu depuis le serveur pour corriger toute désynchronisation
            fetchGameData(STATE.gameId, token);
            return;
        }

        const gameData = await response.json();
        console.log('Coup accepté par le serveur:', gameData);

        // Optionnel: mettre à jour avec d'autres changements d'état du jeu de la réponse
        if (gameData.status === 'completed') {
            // Gérer la fin du jeu si nécessaire
            console.log('Jeu terminé avec le résultat:', gameData.winner);
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi du coup au serveur:', error);
        alert('Échec de l\'envoi du coup au serveur. Veuillez réessayer.');
    }
}

// Mettre à jour les informations de l'adversaire dans l'interface utilisateur
function updateOpponentInfo(opponent) {
    if (!opponent) return;

    console.log('Mise à jour des informations de l\'adversaire:', opponent);

    STATE.opponentId = opponent.user_id;
    STATE.opponentName = opponent.username;

    const opponentName = document.getElementById('opponent-name');
    const opponentRating = document.getElementById('opponent-rating');

    if (opponentName) {
        opponentName.textContent = opponent.username || 'Adversaire';
    }

    if (opponentRating) {
        opponentRating.textContent = `ELO: ${opponent.elo || '?'}`;
    }

    // Mettre à jour les boîtes de joueurs après avoir mis à jour les informations de l'adversaire
    updatePlayerBoxes();

    // Mettre à jour le statut du jeu puisque nous avons maintenant un adversaire
    if (STATE.gameStatus === 'waiting') {
        STATE.gameStatus = 'active';
        updateGameStateUI();
    }

    // Montrer une notification
    showNotification(`${opponent.username} a rejoint le jeu !`, 'success');
}

// Montrer une notification
function showNotification(message, type = 'info') {
    // Vérifier si la notification existe déjà
    let notification = document.querySelector('.notification');

    // Créer si elle n'existe pas
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Définir le type et le message
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Montrer la notification
    notification.style.display = 'block';

    // Cacher après 3 secondes
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Montrer le modal d'offre de nulle
function showDrawOfferModal() {
    const modal = document.getElementById('draw-offer-modal');
    if (!modal) {
        console.error('Modal d\'offre de nulle non trouvé');
        return;
    }

    modal.style.display = 'flex';

    // Gérer le bouton d'acceptation
    const acceptBtn = document.getElementById('accept-draw');
    if (acceptBtn) {
        acceptBtn.onclick = () => {
            if (STATE.socket) {
                // Envoyer l'acceptation de nulle au serveur
                STATE.socket.emit('accept_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Désactiver l'interaction du jeu
                disableGameInteraction();

                // Montrer une notification
                showNotification('Vous avez accepté l\'offre de nulle', 'info');
            }
            modal.style.display = 'none';
        };
    }

    // Gérer le bouton de refus
    const declineBtn = document.getElementById('decline-draw');
    if (declineBtn) {
        declineBtn.onclick = () => {
            if (STATE.socket) {
                // Envoyer le refus de nulle au serveur
                STATE.socket.emit('decline_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Montrer une notification
                showNotification('Vous avez refusé l\'offre de nulle', 'info');
            }
            modal.style.display = 'none';
        };
    }
}

// Formater le temps pour les messages
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ======= Écouteurs d'événements et initialisation =======

// Initialiser le jeu
function initGame() {
    // Obtenir les informations utilisateur depuis localStorage
    STATE.userId = localStorage.getItem('userId');
    STATE.username = localStorage.getItem('username');

    // Définir le nom du joueur dans l'interface utilisateur
    const playerName = document.getElementById('player-name');
    if (playerName) {
        playerName.textContent = STATE.username;
    }

    // Initialiser l'échiquier
    initBoard();

    // Obtenir la couleur initiale de l'utilisateur depuis l'entrée cachée (si disponible)
    const userColorInput = document.getElementById('user-color');
    if (userColorInput && userColorInput.value) {
        STATE.userColor = userColorInput.value;
        console.log("Couleur initiale de l'utilisateur depuis l'entrée:", STATE.userColor);
    }

    // Initialiser la connexion Socket.IO
    initSocket();

    // Ajouter les écouteurs d'événements
    addEventListeners();
}

// Ajouter les écouteurs d'événements
function addEventListeners() {
    // Bouton de retournement de l'échiquier
    const flipBoardBtn = document.getElementById('flip-board');
    if (flipBoardBtn) {
        flipBoardBtn.addEventListener('click', () => {
            STATE.flipped = !STATE.flipped;
            STATE.manuallyFlipped = !STATE.manuallyFlipped; // Basculer l'état de retournement manuel
            console.log(`Échiquier retourné manuellement. Retourné: ${STATE.flipped}, Manuel: ${STATE.manuallyFlipped}`);
            updateBoard();
            updatePlayerBoxes();
        });
    }

    // Bouton d'abandon
    const resignBtn = document.getElementById('resign-btn');
    if (resignBtn) {
        resignBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir abandonner ? Cette action ne peut pas être annulée.')) {
                // Désactiver le bouton pour éviter les clics multiples
                resignBtn.disabled = true;
                resignBtn.textContent = 'Abandon en cours...';

                // Utiliser socket.io pour l'abandon (plus fiable que l'API REST pour l'état du jeu en temps réel)
                if (STATE.socket) {
                    STATE.socket.emit('resign', {
                        game_id: STATE.gameId,
                        token: localStorage.getItem('token')
                    });

                    // Montrer une notification que l'abandon a été envoyé
                    showNotification('Abandon soumis', 'info');
                } else {
                    // Socket non disponible
                    resignBtn.disabled = false;
                    resignBtn.textContent = 'Abandonner';
                    alert('Erreur de connexion. Veuillez réessayer.');
                }
            }
        });
    }

    // Bouton de nulle
    const drawBtn = document.getElementById('draw-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => {
            if (STATE.socket) {
                STATE.socket.emit('offer_draw', {
                    game_id: STATE.gameId,
                    token: localStorage.getItem('token')
                });

                // Désactiver temporairement le bouton pour éviter le spam
                drawBtn.disabled = true;
                drawBtn.textContent = 'Nulle offerte';

                // Montrer une notification à l'utilisateur
                showNotification('Offre de nulle envoyée à votre adversaire', 'info');

                // Réinitialiser après 3 secondes
                setTimeout(() => {
                    drawBtn.disabled = false;
                    drawBtn.textContent = 'Offrir nulle';
                }, 3000);
            }
        });
    }

    // Bouton de revanche
    const rematchBtn = document.getElementById('rematch-btn');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            STATE.socket.emit('request_rematch', {
                game_id: STATE.gameId,
                token: localStorage.getItem('token')
            });

            rematchBtn.textContent = 'Revanche demandée';
            rematchBtn.disabled = true;
        });
    }

    // Bouton de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Effacer les tokens
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');

            // Rediriger vers la connexion
            window.location.href = '/login';
        });
    }
}

// Vérifier l'authentification de l'utilisateur
function checkAuth() {
    const token = localStorage.getItem('token');

    if (!token) {
        // Rediriger vers la connexion
        window.location.href = '/login';
        return false;
    }

    return true;
}

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'authentification
    if (!checkAuth()) return;

    // Initialiser le jeu
    initGame();
});

// Mettre à jour l'affichage du contrôle du temps avec l'icône appropriée
function updateTimeControlDisplay(timeControl) {
    const timeControlText = document.getElementById('time-control-text');
    const timeControlIcon = document.getElementById('time-control-icon');
    
    if (!timeControlText || !timeControlIcon) return;

    let icon = '<i class="fas fa-infinity"></i>';
    let text = 'Illimité';
    
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
                    text = 'Illimité';
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
            console.log('Temps : ', initialMinutes,'+', increment);
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