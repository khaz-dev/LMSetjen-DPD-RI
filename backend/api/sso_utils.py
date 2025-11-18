"""
SSO (Single Sign-On) Integration with Nusa DPD
Handles JWT token verification and user authentication from external SSO provider
"""

import jwt
import json
from datetime import datetime
from functools import wraps
from rest_framework import serializers
from userauths.models import User, Profile

class SSOTokenSerializer(serializers.Serializer):
    """Serializer for verifying SSO tokens"""
    token = serializers.CharField(required=True)
    
    def validate_token(self, value):
        if not value:
            raise serializers.ValidationError("Token is required")
        return value


class SSOUserSerializer(serializers.Serializer):
    """Serializer for user data received from SSO"""
    nip = serializers.CharField(required=True)
    iat = serializers.IntegerField(required=False)  # Issued at
    exp = serializers.IntegerField(required=False)  # Expiration
    name = serializers.CharField(required=False, allow_null=True)
    email = serializers.CharField(required=False, allow_null=True)
    
    def validate_nip(self, value):
        if not value:
            raise serializers.ValidationError("NIP (employee ID) is required")
        return value


class SSOTokenVerifier:
    """
    Utility class for verifying and decoding SSO tokens from Nusa DPD
    
    Usage:
        verifier = SSOTokenVerifier()
        user_data = verifier.verify_token(token, secret_key)
    """
    
    @staticmethod
    def verify_token(token, secret_key=None, algorithms=['HS256']):
        """
        Verify and decode SSO JWT token
        
        Args:
            token (str): JWT token from SSO
            secret_key (str): Secret key to verify signature (if None, doesn't verify signature)
            algorithms (list): List of allowed algorithms
            
        Returns:
            dict: Decoded token payload
            
        Raises:
            jwt.InvalidTokenError: If token is invalid or expired
        """
        try:
            # If no secret key provided, decode without verification (not recommended for production)
            options = {}
            if secret_key is None:
                options = {"verify_signature": False}
                
            decoded = jwt.decode(
                token,
                secret_key or "",
                algorithms=algorithms,
                options=options
            )
            return decoded
        except jwt.ExpiredSignatureError:
            raise jwt.InvalidTokenError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise jwt.InvalidTokenError(f"Invalid token: {str(e)}")
        except Exception as e:
            raise jwt.InvalidTokenError(f"Token verification failed: {str(e)}")
    
    @staticmethod
    def decode_token_unsafe(token):
        """
        Decode token without verification (for debugging)
        WARNING: Only use for development, never in production
        """
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            raise jwt.InvalidTokenError(f"Failed to decode token: {str(e)}")


class SSOUserManager:
    """
    Manages user creation and updates from SSO data
    Handles user sync with LMS database
    """
    
    @staticmethod
    def get_or_create_user_from_sso(sso_data):
        """
        Get existing user or create new one from SSO data
        
        Args:
            sso_data (dict): User data from SSO token containing nip, name, email, etc.
            
        Returns:
            tuple: (user, created) where created is boolean indicating if user was created
            
        Raises:
            ValueError: If required fields missing
        """
        nip = sso_data.get('nip')
        name = sso_data.get('name', '')
        email = sso_data.get('email', '')
        
        if not nip:
            raise ValueError("NIP (employee ID) is required from SSO data")
        
        # Try to find existing user by NIP
        try:
            user = User.objects.get(nip=nip)
            # Update user data if changed
            user = SSOUserManager.update_user_from_sso(user, sso_data)
            return user, False
        except User.DoesNotExist:
            # Create new user from SSO data
            user = SSOUserManager.create_user_from_sso(sso_data)
            return user, True
    
    @staticmethod
    def create_user_from_sso(sso_data):
        """Create new user from SSO data"""
        nip = sso_data.get('nip')
        name = sso_data.get('name', '')
        email = sso_data.get('email', '')
        
        # Generate username and email if not provided
        if not email:
            email = f"{nip}@nusadpd.sso"
        
        if not name:
            name = nip
        
        # Generate unique username
        username = SSOUserManager.generate_unique_username(email)
        
        # Create user
        user = User.objects.create(
            username=username,
            email=email,
            full_name=name,
            nip=nip,
            role='student',  # Default role for SSO users
            is_active=True,
            external_status='ACTIVE'
        )
        
        # Create user profile
        Profile.objects.get_or_create(user=user)
        
        return user
    
    @staticmethod
    def update_user_from_sso(user, sso_data):
        """Update existing user with SSO data"""
        name = sso_data.get('name')
        email = sso_data.get('email')
        
        # Update fields if they differ
        if name and user.full_name != name:
            user.full_name = name
        
        if email and user.email != email:
            user.email = email
        
        # Update external fields
        if 'iat' in sso_data:
            user.external_created_at = datetime.fromtimestamp(sso_data['iat'])
        
        if 'exp' in sso_data:
            user.external_updated_at = datetime.fromtimestamp(sso_data['exp'])
        
        user.last_sync_date = datetime.now()
        user.save()
        
        return user
    
    @staticmethod
    def generate_unique_username(email):
        """Generate unique username from email"""
        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        return username
