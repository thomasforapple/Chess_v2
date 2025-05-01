// Authentication handling for Chess Arena
// Handles login, registration, and token management

// API endpoint
const API_URL = '/api';


// Check if user is already logged in
function checkLoggedIn() {
    const token = localStorage.getItem('token');
    if (token) {
        // Redirect to dashboard if already logged in
        window.location.href = '/dashboard';
    }
}

// Show error message
function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store token and user info in local storage
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('username', data.username);
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
        
    } catch (error) {
        showError(error.message);
        console.error('Login error:', error);
    }
}

// Handle registration form submission
async function handleRegistration(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validate input
    if (!username || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        // Store token and user info
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('username', data.username);
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
        
    } catch (error) {
        showError(error.message);
        console.error('Registration error:', error);
    }
}

// Verify token validity
async function verifyToken() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // Token is invalid or expired
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Initialize auth page
function initAuthPage() {
    // Check if already logged in
    checkLoggedIn();
    
    // Add event listeners based on page type
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initAuthPage);