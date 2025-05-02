import bcrypt
from bson.objectid import ObjectId
from datetime import datetime

class User:
    @staticmethod
    def create(db, username, email, password):
        """Create a new user"""
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'elo': 1200,  # Keep the legacy field for backward compatibility
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
    def authenticate(db, username, password):
        """Authenticate a user"""
        user = db.users.find_one({'username': username})
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return user
        return None
        
    @staticmethod
    def get_by_id(db, user_id):
        """Get user by ID"""
        return db.users.find_one({'_id': ObjectId(user_id)})
        
    @staticmethod
    def update_stats(db, user_id, result):
        """Update user stats after a game"""
        update = {'$inc': {'games_played': 1}}
        
        if result == 'win':
            update['$inc']['games_won'] = 1
        elif result == 'loss':
            update['$inc']['games_lost'] = 1
        else:  # draw
            update['$inc']['games_drawn'] = 1
            
        db.users.update_one({'_id': ObjectId(user_id)}, update)