import chess
from bson.objectid import ObjectId
from datetime import datetime
import uuid

class Game:
    @staticmethod
    def create(db, white_player_id, time_control=None):
        """Create a new game"""
        game_code = str(uuid.uuid4())[:8]  # Generate unique game code
        
        game = {
            'white_player_id': ObjectId(white_player_id),
            'black_player_id': None,
            'status': 'waiting',  # waiting, active, completed
            'fen': chess.STARTING_FEN,
            'moves': [],
            'game_code': game_code,
            'time_control': time_control,
            'winner': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.games.insert_one(game)
        return str(result.inserted_id), game_code
    
    @staticmethod
    def join(db, game_code, black_player_id):
        """Join a game as black player"""
        game = db.games.find_one({'game_code': game_code, 'status': 'waiting'})
        
        if not game:
            return None
            
        # Check if trying to join own game
        if str(game['white_player_id']) == black_player_id:
            return None
            
        result = db.games.update_one(
            {'_id': game['_id']},
            {
                '$set': {
                    'black_player_id': ObjectId(black_player_id),
                    'status': 'active',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            return str(game['_id'])
        return None
    
    @staticmethod
    def make_move(db, game_id, player_id, move_uci):
        """Make a move in the game"""
        game = db.games.find_one({'_id': ObjectId(game_id)})
        
        if not game:
            return None, "Game not found"
            
        # Check if player is in the game
        if (str(game['white_player_id']) != player_id and 
            (not game['black_player_id'] or str(game['black_player_id']) != player_id)):
            return None, "Not your game"
            
        # Check if game is active
        if game['status'] != 'active':
            return None, "Game is not active"
            
        # Check if it's player's turn
        board = chess.Board(game['fen'])
        player_is_white = str(game['white_player_id']) == player_id
        is_black = not player_is_white
        
        if (board.turn == chess.WHITE and not player_is_white) or \
           (board.turn == chess.BLACK and player_is_white):
            return None, "Not your turn"
            
        # Validate move
        try:
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                return None, "Illegal move"
                
            # Make the move
            board.push(move)
            new_fen = board.fen()
            
            # Check game status
            status = game['status']
            winner = game['winner']
            
            if board.is_checkmate():
                status = 'completed'
                winner = player_id
            elif board.is_stalemate() or board.is_insufficient_material() or \
                 board.is_seventyfive_moves() or board.is_fivefold_repetition():
                status = 'completed'
                winner = 'draw'
                
            # Record the move
            move_record = {
                'player_id': player_id,
                'move': move_uci,
                'fen': new_fen,
                'timestamp': datetime.utcnow()
            }
            
            # Update game in database
            db.games.update_one(
                {'_id': ObjectId(game_id)},
                {
                    '$set': {
                        'fen': new_fen,
                        'status': status,
                        'winner': winner,
                        'updated_at': datetime.utcnow()
                    },
                    '$push': {'moves': move_record}
                }
            )
            
            # Handle game completion
            if status == 'completed':
                # Get the time control type
                time_control_type = 'unlimited'
                if isinstance(game['time_control'], str):
                    time_control_type = game['time_control']
                elif isinstance(game['time_control'], dict) and 'type' in game['time_control']:
                    time_control_type = game['time_control']['type']
                    
                if winner == player_id:
                    # Current player won
                    User.update_stats(player_id, 'win')
                    User.update_rating(player_id, time_control_type, 'win')
                    
                    opponent_id = str(game['white_player_id'] if is_black else game['black_player_id'])
                    User.update_stats(opponent_id, 'loss')
                    User.update_rating(opponent_id, time_control_type, 'loss')
                elif winner == 'draw':
                    # Game was a draw
                    User.update_stats(player_id, 'draw')
                    User.update_rating(player_id, time_control_type, 'draw')
                    
                    opponent_id = str(game['white_player_id'] if is_black else game['black_player_id'])
                    User.update_stats(opponent_id, 'draw')
                    User.update_rating(opponent_id, time_control_type, 'draw')
                else:
                    # Opponent won
                    User.update_stats(player_id, 'loss')
                    User.update_rating(player_id, time_control_type, 'loss')
                    
                    opponent_id = winner
                    User.update_stats(opponent_id, 'win')
                    User.update_rating(opponent_id, time_control_type, 'win')
                
                # Update ELO for both players
                if winner == player_id:
                    Game.update_elo(db, game, 'white' if player_is_white else 'black', time_control_type)
                elif winner == 'draw':
                    Game.update_elo(db, game, 'draw', time_control_type)
                else:
                    Game.update_elo(db, game, 'black' if player_is_white else 'white', time_control_type)
            
            updated_game = db.games.find_one({'_id': ObjectId(game_id)})
            return updated_game, None
            
        except Exception as e:
            return None, str(e)
    
    @staticmethod
    def calculate_elo_change(player_elo, opponent_elo, result):
        """Calculate new ELO based on the result."""
        k_factor = 32
        expected_score = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
        actual_score = 1 if result == 'win' else 0 if result == 'loss' else 0.5
        return round(player_elo + k_factor * (actual_score - expected_score))

    @staticmethod
    def update_elo(db, game, result, time_control_type):
        """Update ELO for both players after the game based on time control."""
        white_player = db.users.find_one({'_id': game['white_player_id']})
        black_player = db.users.find_one({'_id': game['black_player_id']})
        if not white_player or not black_player:
            return

        # Use rating keys based on time control
        rating_key = {
            'blitz': 'elo_blitz',
            'rapid': 'elo_rapid',
            'classical': 'elo_classical'
        }.get(time_control_type, 'elo_classical')

        white_rating = white_player.get(rating_key, 1200)
        black_rating = black_player.get(rating_key, 1200)

        if result == 'white':
            new_white_rating = Game.calculate_elo_change(white_rating, black_rating, 'win')
            new_black_rating = Game.calculate_elo_change(black_rating, white_rating, 'loss')
        elif result == 'black':
            new_white_rating = Game.calculate_elo_change(white_rating, black_rating, 'loss')
            new_black_rating = Game.calculate_elo_change(black_rating, white_rating, 'win')
        else:
            new_white_rating = Game.calculate_elo_change(white_rating, black_rating, 'draw')
            new_black_rating = Game.calculate_elo_change(black_rating, white_rating, 'draw')

        db.users.update_one({'_id': white_player['_id']}, {'$set': {rating_key: new_white_rating}})
        db.users.update_one({'_id': black_player['_id']}, {'$set': {rating_key: new_black_rating}})