from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from pymongo import MongoClient
from bson.objectid import ObjectId
import chess
import os
import bcrypt
import uuid
from datetime import datetime, timedelta
import ssl
import certifi


# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'generate-a-secure-random-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'another-secure-random-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)

# Initialize extensions - using threading mode for Python 3.12 compatibility
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
jwt = JWTManager(app)

# MongoDB Atlas connection string (replace with your actual credentials)
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb+srv://admin:admin@cluster0.oydtfes.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

# Connect to MongoDB with proper SSL certificate handling
client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile=certifi.where()  # Use the correct certificate authority
)
db = client.get_database('chess_app')

# Test the connection (add this before your routes)
try:
    # The ismaster command is cheap and does not require auth
    client.admin.command('ismaster')
    print("✅ MongoDB connection successful")
except Exception as e:
    print(f"❌ MongoDB connection error: {e}")
def decode_token(token):
    try:
        from flask_jwt_extended.utils import decode_token as jwt_decode_token
        decoded = jwt_decode_token(token)
        return decoded['sub']  # The subject is now the user_id string
    except Exception as e:
        print(f"Error decoding token: {e}")
        return None

# Models
class User:
    @staticmethod
    def create(username, email, password):
        """Create a new user"""
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'ratings': {
                'blitz': {'rating': 1200, 'games': 0},
                'rapid': {'rating': 1200, 'games': 0},
                'classical': {'rating': 1200, 'games': 0}
            },
            'games_played': 0,
            'games_won': 0,
            'games_lost': 0,
            'games_drawn': 0,
            'created_at': datetime.utcnow()
        }
        
        result = db.users.insert_one(user)
        return str(result.inserted_id)
    
    @staticmethod
    def update_rating(user_id, time_control, result):
        """Update user rating based on game result and time control"""
        user = User.get_by_id(user_id)
        if not user:
            return
            
        # Default K-factor for rating changes
        k_factor = 32
        
        # Get current rating
        current_rating = user.get('ratings', {}).get(time_control, {}).get('rating', 1200)
        games_count = user.get('ratings', {}).get(time_control, {}).get('games', 0) + 1
        
        # Simple rating adjustment based on result
        # In a real ELO system, this would be based on opponent rating too
        if result == 'win':
            new_rating = current_rating + k_factor
        elif result == 'loss':
            new_rating = current_rating - k_factor
        else:  # draw
            new_rating = current_rating
            
        # Update the rating in the database
        update_field = f'ratings.{time_control}'
        db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                f'{update_field}.rating': new_rating,
                f'{update_field}.games': games_count
            }}
        )
        
        return new_rating
    @staticmethod
    def create(username, email, password):
        """Create a new user"""
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'elo': 1200,
            'games_played': 0,
            'games_won': 0,
            'games_lost': 0,
            'games_drawn': 0,
            'created_at': datetime.utcnow()
        }
        
        result = db.users.insert_one(user)
        return str(result.inserted_id)
    
    @staticmethod
    def authenticate(username, password):
        """Authenticate a user"""
        user = db.users.find_one({'username': username})
        
        if not user:
            return None
            
        if bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return user
        
        return None
        
    @staticmethod
    def get_by_id(user_id):
        """Get user by ID"""
        if not ObjectId.is_valid(user_id):
            return None
            
        return db.users.find_one({'_id': ObjectId(user_id)})
        
    @staticmethod
    def update_stats(user_id, result):
        """Update user stats after a game"""
        update = {'$inc': {'games_played': 1}}
        
        if result == 'win':
            update['$inc']['games_won'] = 1
        elif result == 'loss':
            update['$inc']['games_lost'] = 1
        else:  # draw
            update['$inc']['games_drawn'] = 1
            
        db.users.update_one({'_id': ObjectId(user_id)}, update)

class Game:
    @staticmethod
    def create(white_player_id, color_preference="white", time_control=None):
        """Create a new game"""
        game_code = str(uuid.uuid4())[:8].upper()  # Generate unique game code

        # Handle color preference
        player_is_white = color_preference == "white" or (color_preference == "random" and uuid.uuid4().int % 2 == 0)

        # Set the player as either white or black based on preference
        white_id = ObjectId(white_player_id) if player_is_white else None
        black_id = None if player_is_white else ObjectId(white_player_id)

        # Initialize time control values
        white_time_ms = None
        black_time_ms = None
        increment_ms = 0

        # Parse time control
        if time_control:
            if time_control == "blitz":
                white_time_ms = 5 * 60 * 1000  # 5 minutes in ms
                black_time_ms = 5 * 60 * 1000
            elif time_control == "rapid":
                white_time_ms = 10 * 60 * 1000  # 10 minutes in ms
                black_time_ms = 10 * 60 * 1000
            elif time_control == "classical":
                white_time_ms = 30 * 60 * 1000  # 30 minutes in ms
                black_time_ms = 30 * 60 * 1000
            elif isinstance(time_control, dict):
                # Handle custom time control with increment
                if "initial_time_ms" in time_control:
                    white_time_ms = time_control["initial_time_ms"]
                    black_time_ms = time_control["initial_time_ms"]
                if "increment" in time_control:
                    increment_ms = time_control["increment"]

        game = {
            'white_player_id': white_id,
            'black_player_id': black_id,
            'status': 'waiting',  # waiting, active, completed
            'fen': chess.STARTING_FEN,
            'moves': [],
            'game_code': game_code,
            'time_control': time_control,
            'white_time_ms': white_time_ms,
            'black_time_ms': black_time_ms,
            'increment_ms': increment_ms,
            'last_move_timestamp': None,
            'winner': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = db.games.insert_one(game)
        return str(result.inserted_id), game_code
    
    @staticmethod
    def join(game_code, player_id):
        """Join a game"""
        game = db.games.find_one({'game_code': game_code, 'status': 'waiting'})
        
        if not game:
            return None
            
        # Determine if joining as white or black
        if game['white_player_id'] is None:
            update = {'white_player_id': ObjectId(player_id)}
        elif game['black_player_id'] is None:
            update = {'black_player_id': ObjectId(player_id)}
        else:
            return None  # Game already full
            
        # Check if both players are now present
        both_players_present = (
            (game['white_player_id'] is not None or update.get('white_player_id') is not None) and
            (game['black_player_id'] is not None or update.get('black_player_id') is not None)
        )
        
        if both_players_present:
            update['status'] = 'active'
            
        update['updated_at'] = datetime.utcnow()
        
        result = db.games.update_one(
            {'_id': game['_id']},
            {'$set': update}
        )
        
        if result.modified_count > 0:
            return str(game['_id'])
        
        return None
    
    @staticmethod
    def get_by_id(game_id):
        """Get game by ID"""
        if not ObjectId.is_valid(game_id):
            return None
            
        return db.games.find_one({'_id': ObjectId(game_id)})
    
    @staticmethod
    def get_active_games(user_id):
        """Get active games for a user"""
        query = {
            '$or': [
                {'white_player_id': ObjectId(user_id)},
                {'black_player_id': ObjectId(user_id)}
            ],
            'status': {'$in': ['waiting', 'active']}
        }
        
        games = list(db.games.find(query).sort('updated_at', -1))
        
        # Format game data
        formatted_games = []
        for game in games:
            formatted_games.append(Game.format_game_data(game, user_id))
            
        return formatted_games
    
    @staticmethod
    def get_recent_games(user_id, limit=5):
        """Get recent completed games for a user"""
        query = {
            '$or': [
                {'white_player_id': ObjectId(user_id)},
                {'black_player_id': ObjectId(user_id)}
            ],
            'status': 'completed'
        }
        
        games = list(db.games.find(query).sort('updated_at', -1).limit(limit))
        
        # Format game data
        formatted_games = []
        for game in games:
            formatted_games.append(Game.format_game_data(game, user_id))
            
        return formatted_games

    @staticmethod
    def format_game_data(game, user_id):
        """Format game data for API response"""
        # Get player information
        white_player = db.users.find_one({'_id': game['white_player_id']}) if game['white_player_id'] else None
        black_player = db.users.find_one({'_id': game['black_player_id']}) if game['black_player_id'] else None

        # Format response
        formatted_game = {
            'game_id': str(game['_id']),
            'status': game['status'],
            'created_at': game['created_at'].isoformat(),
            'updated_at': game['updated_at'].isoformat(),
            'game_code': game['game_code'],
            'winner': game['winner'],
            'time_control': game['time_control'],
            'white_time_ms': game.get('white_time_ms'),
            'black_time_ms': game.get('black_time_ms'),
            'increment_ms': game.get('increment_ms', 0),
            'last_move_timestamp': game.get('last_move_timestamp').isoformat() if game.get(
                'last_move_timestamp') else None
        }

        # Add player info
        if white_player:
            formatted_game['white_player'] = {
                'user_id': str(white_player['_id']),
                'username': white_player['username'],
                'elo': white_player.get('elo', 1200)
            }

        if black_player:
            formatted_game['black_player'] = {
                'user_id': str(black_player['_id']),
                'username': black_player['username'],
                'elo': black_player.get('elo', 1200)
            }

        return formatted_game

    @staticmethod
    def make_move(game_id, player_id, move_uci):
        """Make a move in the game"""
        game = Game.get_by_id(game_id)

        if not game:
            return None, "Game not found"

        # Check if player is in the game
        player_id_obj = ObjectId(player_id)
        is_white = game['white_player_id'] == player_id_obj
        is_black = game['black_player_id'] == player_id_obj

        if not (is_white or is_black):
            return None, "You are not a player in this game"

        # Check if game is active
        if game['status'] != 'active':
            return None, "Game is not active"

        # Load current position
        board = chess.Board(game['fen'])

        # Check if it's player's turn
        if (board.turn == chess.WHITE and not is_white) or (board.turn == chess.BLACK and not is_black):
            return None, "Not your turn"

        # Get the current time
        current_time = datetime.utcnow()

        # Update player's clock
        time_update = {}

        # Only update time if the game has a time control
        if game.get('white_time_ms') is not None and game.get('black_time_ms') is not None:
            # Determine which player's clock to update
            player_clock_field = 'white_time_ms' if is_white else 'black_time_ms'
            player_time_remaining = game.get(player_clock_field)

            # Calculate time spent if this is not the first move
            if game['last_move_timestamp'] and player_time_remaining is not None:
                time_spent = int((current_time - game['last_move_timestamp']).total_seconds() * 1000)
                player_time_remaining -= time_spent

                # Ensure time doesn't go below zero
                if player_time_remaining < 0:
                    player_time_remaining = 0

                # Check if player has run out of time
                if player_time_remaining == 0:
                    # Player lost on time
                    time_update[player_clock_field] = 0
                    time_update['status'] = 'completed'
                    time_update['winner'] = str(game['black_player_id'] if is_white else game['white_player_id'])

                    # Update game in database with time out
                    db.games.update_one(
                        {'_id': ObjectId(game_id)},
                        {'$set': time_update}
                    )

                    # Update user stats
                    opponent_id = str(game['black_player_id'] if is_white else game['white_player_id'])
                    User.update_stats(player_id, 'loss')
                    User.update_stats(opponent_id, 'win')

                    updated_game = Game.get_by_id(game_id)
                    return Game.format_game_data(updated_game, player_id), "You lost on time"

                # Add increment if applicable
                if game.get('increment_ms', 0) > 0:
                    player_time_remaining += game.get('increment_ms')

                time_update[player_clock_field] = player_time_remaining

        # Validate move
        try:
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                return None, "Illegal move"

            # Make the move
            board.push(move)
            new_fen = board.fen()

            # Record the move
            move_record = {
                'player_id': player_id,
                'move': move_uci,
                'fen': new_fen,
                'timestamp': current_time
            }

            # Check game status
            status = game['status']
            winner = game['winner']

            if board.is_checkmate():
                status = 'completed'
                winner = player_id
            elif board.is_stalemate() or board.is_insufficient_material() or board.is_seventyfive_moves() or board.is_fivefold_repetition():
                status = 'completed'
                winner = 'draw'

            # Update game in database
            update_data = {
                'fen': new_fen,
                'status': status,
                'winner': winner,
                'last_move_timestamp': current_time,
                'updated_at': current_time
            }

            # Add any time updates
            update_data.update(time_update)

            db.games.update_one(
                {'_id': ObjectId(game_id)},
                {
                    '$set': update_data,
                    '$push': {'moves': move_record}
                }
            )

            # Update user stats if game completed
            if status == 'completed':
                if winner == player_id:
                    # Current player won
                    User.update_stats(player_id, 'win')
                    opponent_id = str(game['white_player_id'] if is_black else game['black_player_id'])
                    User.update_stats(opponent_id, 'loss')
                elif winner == 'draw':
                    # Game was a draw
                    User.update_stats(player_id, 'draw')
                    opponent_id = str(game['white_player_id'] if is_black else game['black_player_id'])
                    User.update_stats(opponent_id, 'draw')

            updated_game = Game.get_by_id(game_id)
            return Game.format_game_data(updated_game, player_id), None

        except Exception as e:
            return None, str(e)

# Routes

# Main page routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')

@app.route('/game/<game_id>')
def game_page(game_id):
    # Check if game exists
    game = Game.get_by_id(game_id)
    if not game:
        return redirect(url_for('dashboard_page'))
        
    # Pass the game_id to the template
    return render_template('game.html', game_id=game_id)

@app.route('/game/join/<game_code>')
def join_game_page(game_code):
    # Redirect to login if not authenticated
    if 'token' not in request.cookies:
        return redirect(url_for('login_page'))
        
    # Try to join the game
    return render_template('join_game.html', game_code=game_code)

# API routes

# Auth API
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    # Check if username already exists
    if db.users.find_one({'username': username}):
        return jsonify({'error': 'Username already exists'}), 400
        
    # Create user
    user_id = User.create(username, email, password)
    
    # Generate JWT token - FIX: Use user_id as identity (string)
    access_token = create_access_token(
        identity=user_id,  # This must be a string
        additional_claims={'username': username}  # Store username in claims
    )
    
    return jsonify({
        'message': 'Registration successful',
        'access_token': access_token,
        'user_id': user_id,
        'username': username
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({'error': 'Missing username or password'}), 400
        
    # Authenticate user
    user = User.authenticate(username, password)
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
        
    # Generate JWT token - FIX: Use user_id as identity (string)
    user_id = str(user['_id'])
    access_token = create_access_token(
        identity=user_id,  # This must be a string
        additional_claims={'username': username}  # Store username in claims
    )
    
    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user_id': user_id,
        'username': username
    }), 200

@app.route('/api/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    user = User.get_by_id(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Return user profile without sensitive info
    return jsonify({
        'user_id': str(user['_id']),
        'username': user['username'],
        'email': user['email'],
        'elo': user.get('elo', 1200),
        'games': {
            'played': user.get('games_played', 0),
            'won': user.get('games_won', 0),
            'lost': user.get('games_lost', 0),
            'drawn': user.get('games_drawn', 0)
        }
    }), 200

@app.route('/api/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    return jsonify({'message': 'Token is valid'}), 200

# Games API
@app.route('/api/games/create', methods=['POST'])
@jwt_required()
def create_game():
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    data = request.get_json()
    color_preference = data.get('color_preference', 'white')
    time_control = data.get('time_control')
    
    # Create new game
    game_id, game_code = Game.create(user_id, color_preference, time_control)
    
    return jsonify({
        'message': 'Game created successfully',
        'game_id': game_id,
        'game_code': game_code
    }), 201


@app.route('/api/games/join/<game_code>', methods=['POST'])
@jwt_required()
def join_game(game_code):
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()

    # Join the game
    game_id = Game.join(game_code, user_id)

    if not game_id:
        return jsonify({'error': 'Failed to join game. Game may not exist or is already full.'}), 400

    # Get user info for the notification
    user = User.get_by_id(user_id)
    username = user['username'] if user else 'Unknown Player'
    elo = user.get('elo', 1200) if user else 1200

    # Get the game to determine player colors
    game = Game.get_by_id(game_id)
    if game and game['status'] == 'active':
        # Determine if joiner is white or black
        is_white = str(game['white_player_id']) == user_id
        color = 'white' if is_white else 'black'

        # Send game_started notification to all users in the room
        socketio.emit('game_started', {
            'game_id': game_id,
            'status': 'active',
            'opponent': {
                'user_id': user_id,
                'username': username,
                'elo': elo,
                'color': color
            }
        }, room=game_id)

        # Also emit a general game_updated event to refresh data
        socketio.emit('game_updated', {
            'game_id': game_id,
            'status': 'active'
        }, room=game_id)

    return jsonify({
        'message': 'Successfully joined game',
        'game_id': game_id
    }), 200

@app.route('/api/games/<game_id>', methods=['GET'])
@jwt_required()
def get_game(game_id):
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    # Find the game
    game = Game.get_by_id(game_id)
    
    if not game:
        return jsonify({'error': 'Game not found'}), 404
        
    # Format and return the game data
    formatted_game = Game.format_game_data(game, user_id)
    
    # Add move history
    formatted_game['moves'] = []
    for move in game.get('moves', []):
        player_id = str(move['player_id'])
        is_white = str(game['white_player_id']) == player_id
        
        formatted_game['moves'].append({
            'move': move['move'],
            'player': 'white' if is_white else 'black',
            'timestamp': move['timestamp'].isoformat()
        })
        
    # Add user's color
    if game['white_player_id'] and str(game['white_player_id']) == user_id:
        formatted_game['your_color'] = 'white'
    elif game['black_player_id'] and str(game['black_player_id']) == user_id:
        formatted_game['your_color'] = 'black'
    else:
        formatted_game['your_color'] = 'spectator'
        
    return jsonify(formatted_game), 200

@app.route('/api/games/active', methods=['GET'])
@jwt_required()
def get_active_games():
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    # Get active games
    games = Game.get_active_games(user_id)
    
    return jsonify(games), 200

@app.route('/api/games/recent', methods=['GET'])
@jwt_required()
def get_recent_games():
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    # Get recent games
    games = Game.get_recent_games(user_id)
    
    return jsonify(games), 200

@app.route('/api/games/<game_id>/move', methods=['POST'])
@jwt_required()
def make_move(game_id):
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()
    
    data = request.get_json()
    move_uci = data.get('move')
    
    if not move_uci:
        return jsonify({'error': 'Move is required'}), 400
        
    # Make the move
    game_data, error = Game.make_move(game_id, user_id, move_uci)
    
    if error:
        return jsonify({'error': error}), 400
        
    # Emit the move to all players via Socket.IO
    socketio.emit('move_made', {
        'game_id': game_id,
        'move': move_uci,
        'player_id': user_id
    }, room=game_id)
    
    # If game ended, emit the result
    if game_data['status'] == 'completed':
        socketio.emit('game_result', {
            'game_id': game_id,
            'result': game_data['winner']
        }, room=game_id)
    
    return jsonify(game_data), 200

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@socketio.on('join_game')
def handle_join_game(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id:
        return emit('error', {'message': 'Game ID is required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Join the game room
    join_room(game_id)
    emit('game_joined', {'status': 'success', 'game_id': game_id})

    # Check if this user is joining an existing game (not the creator)
    # and update the game state for all users in the room if needed
    game = Game.get_by_id(game_id)
    if game:
        # Get user info for potential opponent update
        user = User.get_by_id(user_id)
        username = user['username'] if user else 'Unknown User'
        elo = user.get('elo', 1200) if user else 1200

        # Check if this completes the game (second player joining)
        if (game['status'] == 'waiting' and
                (str(game['white_player_id']) == user_id or str(game['black_player_id']) == user_id)):
            # Check if the game is now full by joining of this player
            game_full = (game['white_player_id'] is not None and game['black_player_id'] is not None)

            if game_full:
                # Update all clients in the room about the new opponent
                is_white = str(game['white_player_id']) == user_id
                opponent_color = 'white' if is_white else 'black'

                emit('game_started', {
                    'game_id': game_id,
                    'status': 'active',
                    'opponent': {
                        'user_id': user_id,
                        'username': username,
                        'elo': elo,
                        'color': opponent_color
                    }
                }, room=game_id, include_self=False)  # Broadcast to everyone except this user

@socketio.on('leave_game')
def handle_leave_game(data):
    game_id = data.get('game_id')
    
    if game_id:
        leave_room(game_id)
        emit('game_left', {'status': 'success', 'game_id': game_id})

@socketio.on('chat_message')
def handle_chat_message(data):
    game_id = data.get('game_id')
    message = data.get('message')
    token = data.get('token')
    
    if not all([game_id, message]):
        return emit('error', {'message': 'Game ID and message are required'})
        
    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})
    
    # Get username from database
    user = User.get_by_id(user_id)
    username = user['username'] if user else 'Unknown User'
    
    # Broadcast message to all players in the game room
    emit('chat_message', {
        'message': message,
        'timestamp': datetime.utcnow().isoformat(),
        'user_id': user_id,
        'username': username
    }, room=game_id)


@socketio.on('offer_draw')
def handle_offer_draw(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id:
        return emit('error', {'message': 'Game ID is required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Check if game exists and is active
    game = Game.get_by_id(game_id)
    if not game or game['status'] != 'active':
        return emit('error', {'message': 'Game not found or not active'})

    # Check if user is a player in the game
    if not (str(game['white_player_id']) == user_id or str(game['black_player_id']) == user_id):
        return emit('error', {'message': 'You are not a player in this game'})

    # Broadcast draw offer to all players in the game room
    emit('draw_offered', {'user_id': user_id}, room=game_id)


@socketio.on('accept_draw')
def handle_accept_draw(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id:
        return emit('error', {'message': 'Game ID is required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Update game in database to mark as draw
    game = Game.get_by_id(game_id)
    if not game or game['status'] != 'active':
        return emit('error', {'message': 'Game not found or not active'})

    # Check if user is a player in the game
    if not (str(game['white_player_id']) == user_id or str(game['black_player_id']) == user_id):
        return emit('error', {'message': 'You are not a player in this game'})

    # Update the game status
    db.games.update_one(
        {'_id': ObjectId(game_id)},
        {
            '$set': {
                'status': 'completed',
                'winner': 'draw',
                'result_type': 'agreement',  # Add specific result type
                'updated_at': datetime.utcnow()
            }
        }
    )

    # Update player stats
    if game['white_player_id'] and game['black_player_id']:
        User.update_stats(str(game['white_player_id']), 'draw')
        User.update_stats(str(game['black_player_id']), 'draw')

    # Broadcast game result to all players
    emit('game_result', {
        'game_id': game_id,
        'result': 'draw',
        'result_type': 'agreement'  # Specify draw by agreement
    }, room=game_id)


@socketio.on('decline_draw')
def handle_decline_draw(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id:
        return emit('error', {'message': 'Game ID is required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Broadcast decline to all players in the game room
    emit('draw_declined', {'user_id': user_id}, room=game_id)


@socketio.on('resign')
def handle_resign(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id:
        return emit('error', {'message': 'Game ID is required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Update game in database
    game = Game.get_by_id(game_id)
    if game and game['status'] == 'active':
        # Determine the winner (opponent of the resigning player)
        is_white = str(game['white_player_id']) == user_id
        winner = str(game['black_player_id'] if is_white else game['white_player_id'])

        db.games.update_one(
            {'_id': ObjectId(game_id)},
            {
                '$set': {
                    'status': 'completed',
                    'winner': winner,
                    'result_type': 'resignation',  # Add specific result type
                    'updated_at': datetime.utcnow()
                }
            }
        )

        # Update player stats
        User.update_stats(user_id, 'loss')
        User.update_stats(winner, 'win')

        # Broadcast game result to all players
        emit('game_result', {
            'game_id': game_id,
            'result': 'resigned',
            'winner': winner,
            'loser': user_id,
            'result_type': 'resignation'  # Specify resignation
        }, room=game_id)
    else:
        emit('error', {'message': 'Game not found or not active'})


@socketio.on('time_out')
def handle_time_out(data):
    game_id = data.get('game_id')
    token = data.get('token')
    color = data.get('color')

    if not game_id or not token or not color:
        return emit('error', {'message': 'Missing required parameters'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Get the game
    game = Game.get_by_id(game_id)
    if not game or game['status'] != 'active':
        return emit('error', {'message': 'Game not found or not active'})

    # Check if the user is a player in the game
    is_white = str(game['white_player_id']) == user_id
    is_black = str(game['black_player_id']) == user_id

    if not (is_white or is_black):
        return emit('error', {'message': 'You are not a player in this game'})

    # Determine which player timed out
    if (color == 'white' and is_white) or (color == 'black' and is_black):
        # Player is reporting their own timeout
        loser_id = user_id
        winner_id = str(game['black_player_id'] if is_white else game['white_player_id'])
    else:
        # Player is reporting opponent's timeout (suspicious, but we'll handle it)
        # In real production we would verify server-side instead
        loser_id = str(game['white_player_id'] if color == 'white' else game['black_player_id'])
        winner_id = user_id

    # Update the game status
    db.games.update_one(
        {'_id': ObjectId(game_id)},
        {
            '$set': {
                'status': 'completed',
                'winner': winner_id,
                'result_type': 'timeout',  # Add specific result type
                'updated_at': datetime.utcnow()
            }
        }
    )

    # Update player stats
    User.update_stats(loser_id, 'loss')
    User.update_stats(winner_id, 'win')

    # Broadcast game result to all players
    emit('game_result', {
        'game_id': game_id,
        'result': 'timeout',
        'winner': winner_id,
        'loser': loser_id
    }, room=game_id)


@socketio.on('get_remaining_time')
def handle_get_remaining_time(data):
    game_id = data.get('game_id')
    token = data.get('token')

    if not game_id or not token:
        return emit('error', {'message': 'Game ID and token are required'})

    # Authenticate user from token
    user_id = decode_token(token)
    if not user_id:
        return emit('error', {'message': 'Invalid token'})

    # Get the game
    game = Game.get_by_id(game_id)
    if not game:
        return emit('error', {'message': 'Game not found'})

    # Check if the game has time control
    if game.get('white_time_ms') is None or game.get('black_time_ms') is None:
        emit('clock_update', {
            'white_time_ms': None,
            'black_time_ms': None,
            'increment_ms': 0,
            'last_move_timestamp': None
        })
        return

    # Calculate current time remaining
    current_time = datetime.utcnow()
    white_time_ms = game.get('white_time_ms')
    black_time_ms = game.get('black_time_ms')

    # If a move has been made and the game is active, update the active player's clock
    if game['status'] == 'active' and game.get('last_move_timestamp'):
        # Determine whose turn it is
        board = chess.Board(game['fen'])
        active_player_time = white_time_ms if board.turn == chess.WHITE else black_time_ms

        # Calculate time spent since last move
        if active_player_time is not None:
            time_spent = int((current_time - game['last_move_timestamp']).total_seconds() * 1000)

            # Update the appropriate clock
            if board.turn == chess.WHITE:
                white_time_ms = max(0, white_time_ms - time_spent)
            else:
                black_time_ms = max(0, black_time_ms - time_spent)

    # Send updated clock times to client
    emit('clock_update', {
        'white_time_ms': white_time_ms,
        'black_time_ms': black_time_ms,
        'increment_ms': game.get('increment_ms', 0),
        'last_move_timestamp': game['last_move_timestamp'].isoformat() if game.get('last_move_timestamp') else None
    })


@app.route('/api/games/<game_id>/resign', methods=['POST'])
@jwt_required()
def resign_game(game_id):
    # FIX: Get user_id directly as a string
    user_id = get_jwt_identity()

    # Check if game exists and is active
    game = Game.get_by_id(game_id)
    if not game:
        return jsonify({'error': 'Game not found'}), 404

    if game['status'] != 'active':
        return jsonify({'error': 'Game is not active'}), 400

    # Check if user is a player in the game
    is_white = str(game['white_player_id']) == user_id
    is_black = str(game['black_player_id']) == user_id

    if not (is_white or is_black):
        return jsonify({'error': 'You are not a player in this game'}), 403

    # Determine the winner (opponent of the resigning player)
    winner = str(game['black_player_id']) if is_white else str(game['white_player_id'])

    # Update game status
    db.games.update_one(
        {'_id': ObjectId(game_id)},
        {
            '$set': {
                'status': 'completed',
                'winner': winner,
                'updated_at': datetime.utcnow()
            }
        }
    )

    # Update player stats
    User.update_stats(user_id, 'loss')
    User.update_stats(winner, 'win')

    # Emit game result event via Socket.IO
    socketio.emit('game_result', {
        'game_id': game_id,
        'result': 'resigned',
        'winner': winner,
        'player_id': user_id
    }, room=game_id)

    return jsonify({
        'message': 'Successfully resigned',
        'winner': winner
    }), 200
# Run the server
if __name__ == '__main__':
    # Use socketio.run for development
    socketio.run(app, debug=True)