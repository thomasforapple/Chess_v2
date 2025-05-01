from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.user import User
import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
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
    user_id = User.create(db, username, email, password)
    
    # Generate JWT token
    access_token = create_access_token(identity={'user_id': user_id, 'username': username})
    
    return jsonify({
        'message': 'Registration successful',
        'access_token': access_token,
        'user_id': user_id,
        'username': username
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({'error': 'Missing username or password'}), 400
        
    # Authenticate user
    user = User.authenticate(db, username, password)
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
        
    # Generate JWT token
    access_token = create_access_token(identity={'user_id': str(user['_id']), 'username': username})
    
    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user_id': str(user['_id']),
        'username': username
    }), 200

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user = get_jwt_identity()
    user_id = current_user.get('user_id')
    
    user = User.get_by_id(db, user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Return user profile without sensitive info
    return jsonify({
        'user_id': str(user['_id']),
        'username': user['username'],
        'email': user['email'],
        'elo': user['elo'],
        'games': {
            'played': user['games_played'],
            'won': user['games_won'],
            'lost': user['games_lost'],
            'drawn': user['games_drawn']
        }
    }), 200