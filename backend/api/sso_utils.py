"""
SSO (Single Sign-On) Integration with Nusa DPD & Google OAuth
Handles JWT token verification and user authentication from external SSO providers
"""

import jwt
import json
import requests
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
        
        ✨ PHASE 5: Unified authentication lookup
        - Primary: Look up by EMAIL (unique, matches Google OAuth approach)
        - Fallback: Look up by NIP if email not provided
        - Merge: If same person logs in via Google + SSO, treats as same account
        
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
        
        user = None
        created = False
        
        # PRIMARY LOOKUP: Try to find existing user by EMAIL first (unique field)
        # This ensures users logging in via Google + SSO are treated as the same account
        if email:
            try:
                user = User.objects.get(email=email)
                # Update user data from SSO
                user = SSOUserManager.update_user_from_sso(user, sso_data)
                return user, False
            except User.DoesNotExist:
                pass  # User doesn't exist by email, continue
        
        # FALLBACK: Try to find by NIP
        # ⚠️ Note: NIP is not unique, so this may return multiple users
        # Handle MultipleObjectsReturned gracefully by taking the first/primary one
        try:
            users = User.objects.filter(nip=nip)
            
            if users.exists():
                # If multiple users with same NIP, use the oldest (first created)
                # This handles duplicate NIP edge case
                user = users.order_by('date_joined').first()
                
                # Update NIP-based user with email if provided
                if email and user.email != email:
                    # Only update email if it's not already taken by another user
                    if not User.objects.filter(email=email).exclude(id=user.id).exists():
                        user.email = email
                        user.save()
                
                # Update other user data from SSO
                user = SSOUserManager.update_user_from_sso(user, sso_data)
                return user, False
        except Exception as e:
            # Continue to create new user if lookup fails
            pass
        
        # CREATE NEW USER: If not found by email or NIP, create new user
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
        """
        Update existing user with SSO data
        
        ✨ PHASE 5: Synchronize user data from SSO
        - Merge Gmail accounts with SSO accounts
        - Keep all existing role permissions
        - Preserve name from sync (Sinkronisasi Data Pegawai) process
        """
        name = sso_data.get('name')
        email = sso_data.get('email')
        nip = sso_data.get('nip')
        
        # ✨ PHASE 5: Only update full_name if currently blank
        # Preserve name set during sync, don't override on SSO login
        if name and not user.full_name:
            user.full_name = name
        
        if email and user.email != email:
            user.email = email
        
        # CRITICAL: Sync NIP from SSO if not already set
        # This merges users who first signed up via Google
        if nip and not user.nip:
            user.nip = nip
        
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


class GoogleOAuthVerifier:
    """
    Utility class for verifying Google OAuth tokens
    Handles ID token verification and user data extraction
    """
    
    GOOGLE_TOKEN_INFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo"
    
    @staticmethod
    def verify_token(access_token):
        """
        Verify Google access token and get user info
        
        Args:
            access_token (str): Google OAuth access token
            
        Returns:
            dict: User information (sub, email, name, picture, etc.)
            
        Raises:
            ValueError: If token is invalid or expired
        """
        try:
            # Verify token and get user info
            headers = {'Authorization': f'Bearer {access_token}'}
            response = requests.get(GoogleOAuthVerifier.GOOGLE_USERINFO_URL, headers=headers)
            
            if response.status_code != 200:
                raise ValueError(f"Invalid Google token: {response.json().get('error', 'Unknown error')}")
            
            user_info = response.json()
            return user_info
            
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Google token verification failed: {str(e)}")
    
    @staticmethod
    def verify_id_token(id_token, client_id):
        """
        Verify Google ID token (alternative method using ID token instead of access token)
        
        Args:
            id_token (str): Google ID token
            client_id (str): Your Google Client ID
            
        Returns:
            dict: Decoded ID token payload
            
        Raises:
            ValueError: If token is invalid
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"🔐 Verifying ID token with Google")
            logger.info(f"Client ID from config: {client_id[:20]}..." if client_id else "❌ Client ID is EMPTY!")
            logger.info(f"Token length: {len(id_token)}")
            
            # Verify ID token with Google
            params = {
                'id_token': id_token
            }
            response = requests.get(GoogleOAuthVerifier.GOOGLE_TOKEN_INFO_URL, params=params)
            
            logger.info(f"Google API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_msg = response.json().get('error_description', 'Unknown error')
                logger.error(f"❌ Google API error: {error_msg}")
                raise ValueError(f"Invalid ID token: {error_msg}")
            
            token_data = response.json()
            logger.info(f"✅ Token data received from Google")
            logger.info(f"Token 'aud' (audience): {token_data.get('aud')}")
            logger.info(f"Expected client_id: {client_id}")
            
            # Verify audience (client ID)
            if not client_id:
                logger.warning("⚠️  Client ID is not configured in settings! Skipping client ID verification")
            elif token_data.get('aud') != client_id:
                logger.error(f"❌ Client ID mismatch! Token has: {token_data.get('aud')}, Expected: {client_id}")
                raise ValueError("Invalid client ID in token")
            else:
                logger.info("✅ Client ID verified successfully")
            
            return token_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error during ID token verification: {str(e)}")
            raise ValueError(f"ID token verification failed: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Unexpected error in verify_id_token: {str(e)}")
            raise
    
    @staticmethod
    def get_user_data_from_token(user_info):
        """
        Extract relevant user data from Google user info
        
        Args:
            user_info (dict): User info from Google API
            
        Returns:
            dict: Normalized user data
        """
        return {
            'google_id': user_info.get('id'),  # Google user ID
            'email': user_info.get('email', ''),
            'name': user_info.get('name', ''),
            'picture': user_info.get('picture', ''),
            'verified_email': user_info.get('verified_email', False),
        }


class GoogleOAuthUserManager:
    """
    Manages user creation and updates from Google OAuth data
    """
    
    @staticmethod
    def get_or_create_user_from_google(google_data):
        """
        Get existing user or create new one from Google data
        
        Args:
            google_data (dict): User data from Google OAuth
            
        Returns:
            tuple: (user, created) where created is boolean
        """
        email = google_data.get('email')
        google_id = google_data.get('google_id')
        
        if not email:
            raise ValueError("Email is required from Google OAuth data")
        
        # Try to find existing user by email
        try:
            user = User.objects.get(email=email)
            # Update user data if changed
            GoogleOAuthUserManager.update_user_from_google(user, google_data)
            return user, False
        except User.DoesNotExist:
            # Create new user from Google data
            user = GoogleOAuthUserManager.create_user_from_google(google_data)
            return user, True
    
    @staticmethod
    def create_user_from_google(google_data):
        """Create new user from Google OAuth data"""
        email = google_data.get('email')
        name = google_data.get('name', '')
        google_id = google_data.get('google_id')
        
        if not name:
            name = email.split('@')[0]
        
        # Generate unique username from email
        username = GoogleOAuthUserManager.generate_unique_username(email)
        
        # Create user
        user = User.objects.create(
            username=username,
            email=email,
            full_name=name,
            role='student',  # Default role for Google OAuth users
            is_active=True,
            external_status='ACTIVE'
        )
        
        # Create user profile with Google ID
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.full_name = name
        profile.save()
        
        return user
    
    @staticmethod
    def update_user_from_google(user, google_data):
        """Update existing user with Google data"""
        name = google_data.get('name')
        picture = google_data.get('picture')
        
        # ✨ PHASE 5: Only update full_name if currently blank
        # Preserve name set during sync (Sinkronisasi Data Pegawai)
        # Only use Google name if user has no name yet (new user)
        if name and not user.full_name:
            user.full_name = name
        
        user.last_login = datetime.now()
        user.save()
        
        # Update profile
        try:
            profile = user.profile
            if picture:
                profile.profile_pic = picture
            profile.save()
        except Profile.DoesNotExist:
            profile = Profile.objects.create(user=user, profile_pic=picture)
        
        return user
    
    @staticmethod
    def generate_unique_username(email):
        """Generate unique username from email"""
        base_username = email.split('@')[0].lower()
        username = base_username
        counter = 1
        
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        return username

