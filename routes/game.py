from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.game import Game
from bson.objectid import ObjectId

game_bp = Blueprint('game', __name__)

@game_bp.route('/create', methods=['POST'])
@jwt_required()
def create_game():
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    
    # Create new game with current user as white
    game_id, game_code = Game.create(db, user_id)
    
    return jsonify({
        'message': 'Game created successfully',
        'game_id': game_id,
        'game_code': game_code
    }), 201

@game_bp.route('/join/<game_code>', methods=['POST'])
@jwt_required()
def join_game(game_code):
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    
    # Join the game as black
    game_id = Game.join(db, game_code, user_id)
    
    if not game_id:
        return jsonify({'error': 'Failed to join game. Game may not exist or is already full.'}), 400
        
    return jsonify({
        'message': 'Successfully joined game',
        'game_id': game_id
    }), 200

@game_bp.route('/<game_id>', methods=['GET'])
@jwt_required()
def get_game(game_id):
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    
    # Find the game
    game = db.games.find_one({'_id': ObjectId(game_id)})
    
    if not game:
        return jsonify({'error': 'Game not found'}), 404
        
    # Check if user is a player in this game
    if str(game['white_player_id']) != user_id and \
       (not game['black_player_id'] or str(game['black_player_id']) != user_id):
        return jsonify({'error': 'You are not a player in this game'}), 403
        
    # Get player information
    white_player = db.users.find_one({'_id': game['white_player_id']})
    black_player = db.users.find_one({'_id': game['black_player_id']}) if game['black_player_id'] else None
    
    # Format response
    response = {
        'game_id': str(game['_id']),
        'status': game['status'],
        'fen': game['fen'],
        'white_player': {
            'user_id': str(white_player['_id']),
            'username': white_player['username'],
            'elo': white_player['elo']
        },
        'your_color': 'white' if str(game['white_player_id']) == user_id else 'black',
        'game_code': game['game_code'],
        'created_at': game['created_at'].isoformat()
    }
    
    if black_player:
        response['black_player'] = {
            'user_id': str(black_player['_id']),
            'username': black_player['username'],
            'elo': black_player['elo']
        }
        
    # Add move history
    response['moves'] = []
    for move in game.get('moves', []):
        player = 'white' if str(move['player_id']) == str(game['white_player_id']) else 'black'
        response['moves'].append({
            'move': move['move'],
            'player': player,
            'timestamp': move['timestamp'].isoformat()
        })
        
    return jsonify(response), 200

@game_bp.route('/<game_id>/move', methods=['POST'])
@jwt_required()
def make_move(game_id):
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    data = request.get_json()
    
    move_uci = data.get('move')
    if not move_uci:
        return jsonify({'error': 'Move is required'}), 400
        
    updated_game, error = Game.make_move(db, game_id, user_id, move_uci)
    
    if error:
        return jsonify({'error': error}), 400
        
    # Return minimal game state after move
    return jsonify({
        'fen': updated_game['fen'],
        'status': updated_game['status'],
        'winner': updated_game['winner']
    }), 200

@game_bp.route('/<game_id>/end', methods=['POST'])
@jwt_required()
def end_game(game_id):
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    data = request.get_json()

    result = data.get('result')  # 'white', 'black', or 'draw'
    cause = data.get('cause')  # e.g., 'checkmate', 'resignation'

    game = db.games.find_one({'_id': ObjectId(game_id)})
    if not game:
        return jsonify({'error': 'Game not found'}), 404

    # Update game status
    db.games.update_one(
        {'_id': game['_id']},
        {'$set': {'status': 'completed', 'winner': result, 'cause': cause}}
    )

    # Update ELO
    Game.update_elo(db, game, result)

    return jsonify({'message': 'Game ended successfully'}), 200