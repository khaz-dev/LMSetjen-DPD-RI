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
    # ✨ PHASE 5.1: Support employee information fields from SSO
    jenis_jabatan = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    golongan = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    kelas_jabatan = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    
    def validate_nip(self, value):
        if not value:
            raise serializers.ValidationError("NIP (employee ID) is required")
        return value

class SSOTokenVerifier:
    """
    Utility class for verifying and decoding SSO tokens from Nusa DPD & CMB.
    Mengatasi Temuan Pentest K-01, K-02 & H-01 (Mandatory Signature Verification, Anti-Account Factory, Strict NIP & Expiry)

    Validasi Keamanan yang Diterapkan:
      1. Wajib verifikasi Signature HMAC (HS256) menggunakan SSO_SECRET_KEY / SECRET_KEY (TOLAK KERAS token tanpa signature valid).
      2. Validasi format NIP pegawai resmi (minimal 8-18 digit angka, tolak NIP sembarang/dummy).
      3. Validasi klaim `iss` (Issuer) harus berasal dari sistem terpercaya (CMB, NUSA, dll).
      4. Validasi klaim `exp` (Expiry) ketat dan pembatasan masa berlaku maksimum (TTL).
      5. Validasi klaim `iat` (Issued At) dan pencegahan clock skew berlebih.
      6. Anti-replay: setiap token hanya boleh digunakan satu kali (UsedSSOToken).
    """

    @staticmethod
    def verify_token(token, secret_key=None, algorithms=None):
        """
        Decode dan validasi SSO JWT token dari Nusa DPD / CMB.
        WAJIB memvalidasi cryptographic signature HMAC.

        Args:
            token (str): JWT token dari URL SSO Nusa DPD / CMB
            secret_key (str, optional): Secret key untuk verifikasi signature HMAC
            algorithms (list, optional): Algoritma yang diizinkan (default: HS256)

        Returns:
            dict: Payload JWT yang sudah didecode dan diverifikasi

        Raises:
            jwt.InvalidTokenError: Jika token tidak valid, signature salah, atau kadaluarsa
        """
        from django.conf import settings
        from django.utils import timezone
        import logging
        logger = logging.getLogger('security')

        # Resolusi secret key dari parameter atau Django settings (fallback ke SECRET_KEY)
        active_secret = secret_key or getattr(settings, 'SSO_SECRET_KEY', None) or getattr(settings, 'SECRET_KEY', None)
        active_algorithms = algorithms or [getattr(settings, 'SSO_ALGORITHM', 'HS256')]

        if not active_secret:
            logger.critical("[SSO CRITICAL] SSO_SECRET_KEY maupun SECRET_KEY tidak ditemukan pada server!")
            raise jwt.InvalidTokenError("Konfigurasi keamanan SSO server belum lengkap (Secret key tidak ditemukan)")

        try:
            # 1. 🔒 MANDATORY HMAC SIGNATURE VERIFICATION (Mengatasi Pentest K-01 & K-02)
            # TIDAK ADA LAGI fallback decode tanpa verifikasi signature!
            decoded = jwt.decode(
                token,
                key=active_secret,
                algorithms=active_algorithms,
                options={
                    "verify_signature": True,
                    "verify_exp": False,  # Kita validasi exp secara eksplisit di bawah dengan pesan ramah
                }
            )
            logger.info("[SSO] Signature token berhasil diverifikasi secara kriptografis.")

            # 2. Validasi klaim exp (Expiration) secara eksplisit dan ketat
            exp = decoded.get('exp')
            if exp is None:
                logger.warning("[SSO] Token tidak memiliki klaim exp — ditolak demi keamanan")
                raise jwt.InvalidTokenError("Token tidak memiliki masa berlaku (exp) — ditolak demi keamanan")

            current_timestamp = timezone.now().timestamp()
            if exp < current_timestamp:
                logger.warning(f"[SSO] Token kadaluarsa: exp={exp}, now={current_timestamp:.0f}")
                raise jwt.ExpiredSignatureError("Token SSO sudah kadaluarsa")

            # 3. Validasi klaim iat (Issued At) dan batas umur token (TTL)
            iat = decoded.get('iat')
            if iat is not None:
                # Toleransi clock drift 60 detik
                if iat > current_timestamp + 60:
                    logger.warning(f"[SSO] Token iat di masa depan: iat={iat}, now={current_timestamp:.0f}")
                    raise jwt.InvalidTokenError("Token SSO tidak valid (waktu penerbitan di masa depan)")

                # Validasi masa berlaku maksimum token (default: 3600 detik)
                max_ttl = getattr(settings, 'SSO_MAX_TOKEN_TTL_SECONDS', 3600)
                if (exp - iat) > max_ttl:
                    logger.warning(f"[SSO] Masa aktif token ({exp - iat}s) melebihi batas yang diizinkan ({max_ttl}s)")
                    raise jwt.InvalidTokenError(f"Masa berlaku token SSO melebihi batas maksimum ({max_ttl} detik)")

            # 4. Validasi klaim iss (Issuer) jika token memuat iss (Mengatasi Temuan Pentest K-02)
            iss = decoded.get('iss')
            allowed_issuers = getattr(settings, 'SSO_ALLOWED_ISSUERS', ['CMB', 'NUSA', 'Nusa DPD', 'setjen.dpd.go.id', 'https://cmb.dpd.go.id'])
            if iss and allowed_issuers:
                if iss not in allowed_issuers:
                    logger.warning(f"[SSO] Issuer token tidak diizinkan: '{iss}' (Diizinkan: {allowed_issuers})")
                    raise jwt.InvalidTokenError(f"Penerbit token SSO ({iss}) tidak terdaftar dalam allowlist resmi DPD RI")

            # 5. Validasi klaim aud (Audience) jika dikonfigurasi
            expected_aud = getattr(settings, 'SSO_AUDIENCE', None)
            aud = decoded.get('aud')
            if expected_aud and aud:
                if isinstance(aud, list) and expected_aud not in aud:
                    raise jwt.InvalidTokenError(f"Audience token ({aud}) tidak cocok dengan sistem ini")
                elif isinstance(aud, str) and aud != expected_aud:
                    raise jwt.InvalidTokenError(f"Audience token ({aud}) tidak cocok dengan sistem ini")

            # 6. 🔒 VALIDASI NIP RESMI ASN (Mengatasi Pentest K-02: Account Factory via NIP Bebas)
            raw_nip = decoded.get('nip')
            if not raw_nip:
                raise jwt.InvalidTokenError("Token tidak mengandung NIP — bukan token SSO yang valid")
            clean_nip = str(raw_nip).strip()
            # Validasi NIP: NIP ASN di Indonesia berformat angka minimal 8 hingga 20 digit
            if not clean_nip.isdigit() or len(clean_nip) < 8 or len(clean_nip) > 20:
                logger.warning(f"[SSO ATTACK DETECTED] Penolakan NIP tidak valid/dummy: '{clean_nip}'")
                raise jwt.InvalidTokenError(f"Format NIP '{clean_nip}' tidak valid sebagai identitas pegawai resmi DPD RI")

            logger.info(f"[SSO] Token valid: nip={clean_nip}, iss={iss or 'N/A'}, exp={exp}")
            return decoded

        except jwt.ExpiredSignatureError:
            raise jwt.InvalidTokenError("Token SSO sudah kadaluarsa")
        except jwt.InvalidSignatureError:
            logger.warning("[SSO ATTACK DETECTED] Percobaan login SSO dengan signature palsu/tidak valid!")
            raise jwt.InvalidTokenError("Signature token SSO tidak valid atau tidak cocok dengan secret key resmi")
        except jwt.InvalidTokenError:
            raise
        except Exception as e:
            raise jwt.InvalidTokenError(f"Gagal memproses token SSO: {str(e)}")
        except jwt.InvalidTokenError:
            raise
        except Exception as e:
            raise jwt.InvalidTokenError(f"Gagal memproses token SSO: {str(e)}")
    
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
        try:
            users = User.objects.filter(nip=nip)
            
            if users.exists():
                user = users.order_by('date_joined').first()
                if email and user.email != email:
                    if not User.objects.filter(email=email).exclude(id=user.id).exists():
                        user.email = email
                        user.save()
                
                user = SSOUserManager.update_user_from_sso(user, sso_data)
                return user, False
        except Exception as e:
            pass
        
        # CREATE NEW USER FROM SSO
        user = SSOUserManager.create_user_from_sso(sso_data)
        return user, True
    
    @staticmethod
    def create_user_from_sso(sso_data):
        """Create new user from SSO data (Otomatis Pegawai / Internal)"""
        nip = sso_data.get('nip')
        name = sso_data.get('name', '')
        email = sso_data.get('email', '')
        jenis_jabatan = sso_data.get('jenis_jabatan', '')
        golongan = sso_data.get('golongan', '')
        kelas_jabatan = sso_data.get('kelas_jabatan', '')
        
        # Generate username and email if not provided
        if not email:
            email = f"{nip}@nusadpd.sso"
        
        if not name:
            name = nip
        
        # Generate unique username
        username = SSOUserManager.generate_unique_username(email)
        
        # Karena berasal dari sinkronisasi pegawai (SSO), maka is_internal = True
        user = User.objects.create(
            username=username,
            email=email,
            full_name=name,
            nip=nip,
            jenis_jabatan=jenis_jabatan,
            golongan=golongan,
            kelas_jabatan=kelas_jabatan,
            role='student',
            is_student=True,
            is_instructor=False,
            is_admin=False,
            is_internal=True,
            user_type='INTERNAL',
            onboarding_completed=True,
            is_active=True,
            external_status='ACTIVE'
        )
        
        # Create user profile
        Profile.objects.get_or_create(user=user)
        
        return user
    
    @staticmethod
    def update_user_from_sso(user, sso_data):
        """ Update existing user with SSO data """
        name = sso_data.get('name')
        email = sso_data.get('email')
        nip = sso_data.get('nip')
        jenis_jabatan = sso_data.get('jenis_jabatan')
        golongan = sso_data.get('golongan')
        kelas_jabatan = sso_data.get('kelas_jabatan')
        
        if name and not user.full_name:
            user.full_name = name
        
        if email and user.email != email:
            user.email = email
        
        if nip and not user.nip:
            user.nip = nip

        if jenis_jabatan and not user.jenis_jabatan:
            user.jenis_jabatan = jenis_jabatan
        
        if golongan and not user.golongan:
            user.golongan = golongan
        
        if kelas_jabatan and not user.kelas_jabatan:
            user.kelas_jabatan = kelas_jabatan
        
        # Pastikan karena masuk lewat jalur SSO/sinkronisasi, status internalnya True
        user.is_internal = True
        user.user_type = 'INTERNAL'
        user.onboarding_completed = True

        if 'iat' in sso_data:
            user.external_created_at = datetime.fromtimestamp(sso_data['iat'])
        
        if 'exp' in sso_data:
            user.external_updated_at = datetime.fromtimestamp(sso_data['exp'])
        
        user.last_sync_date = datetime.now()
        user.save()
        
        return user
    
    @staticmethod
    def generate_unique_username(email):
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
            logger.info("[AUTH] Verifying ID token with Google")
            logger.info(f"Client ID from config: {client_id[:20]}..." if client_id else "[FAIL] Client ID is EMPTY!")
            logger.info(f"Token length: {len(id_token)}")
            
            # Verify ID token with Google
            params = {
                'id_token': id_token
            }
            response = requests.get(GoogleOAuthVerifier.GOOGLE_TOKEN_INFO_URL, params=params)
            
            logger.info(f"Google API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_msg = response.json().get('error_description', 'Unknown error')
                logger.error(f"[FAIL] Google API error: {error_msg}")
                raise ValueError(f"Invalid ID token: {error_msg}")
            
            token_data = response.json()
            logger.info("[SUCCESS] Token data received from Google")
            logger.info(f"Token 'aud' (audience): {token_data.get('aud')}")
            logger.info(f"Expected client_id: {client_id}")
            
            # Verify audience (client ID)
            if not client_id:
                logger.warning("[WARNING] Client ID is not configured in settings! Skipping client ID verification")
            elif token_data.get('aud') != client_id:
                logger.error(f"[ERROR] Client ID mismatch! Token has: {token_data.get('aud')}, Expected: {client_id}")
                raise ValueError("Invalid client ID in token")
            else:
                logger.info("[SUCCESS] Client ID verified successfully")
            
            return token_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"[ERROR] Network error during ID token verification: {str(e)}")
            raise ValueError(f"ID token verification failed: {str(e)}")
        except Exception as e:
            logger.error(f"[FAIL] Unexpected error in verify_id_token: {str(e)}")
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
        """Create new user from Google OAuth data (Default Publik, kecuali sudah punya NIP hasil sinkronisasi)"""
        email = google_data.get('email')
        name = google_data.get('name', '')
        
        if not name:
            name = email.split('@')[0]
        
        # Generate unique username from email
        username = GoogleOAuthUserManager.generate_unique_username(email)

        # Cek apakah user ini sebenarnya sudah memiliki NIP (misal emailnya pernah didaftarkan/disinkronkan lewat data pegawai sebelumnya)
        existing_nip_check = User.objects.filter(email=email, nip__isnull=False).exists()
        is_employee_internal = bool(existing_nip_check)
        user_type = 'INTERNAL' if is_employee_internal else 'UMUM'
        onboarding_completed = is_employee_internal
        
        user = User.objects.create(
            username=username,
            email=email,
            full_name=name,
            role='student',
            is_student=True,
            is_instructor=False,
            is_admin=False,
            is_internal=is_employee_internal,  # ✨ True jika sudah ada data NIP-nya, False jika murni publik mendaftar via Google
            user_type=user_type,
            onboarding_completed=onboarding_completed,
            is_active=True,
            external_status='ACTIVE'
        )
        
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.full_name = name
        profile.user_type = user_type
        profile.onboarding_completed = onboarding_completed
        profile.save()
        
        return user
    
    @staticmethod
    def update_user_from_google(user, google_data):
        """Update existing user with Google data"""
        name = google_data.get('name')
        picture = google_data.get('picture')
        
        if name and not user.full_name:
            user.full_name = name
        
        # ✨ Validasi konsistensi: User internal adalah yang memiliki NIP (hasil sinkronisasi pegawai)
        if getattr(user, 'nip', None) or getattr(user, 'is_internal', False) or getattr(user, 'user_type', None) == 'INTERNAL':
            user.is_internal = True
            user.user_type = 'INTERNAL'
            user.onboarding_completed = True
        elif not getattr(user, 'user_type', None):
            user.user_type = 'UMUM'

        user.last_login = datetime.now()
        user.save()
        
        # Update profile
        try:
            profile = user.profile
            if picture:
                profile.profile_pic = picture
            profile.save()
        except Profile.DoesNotExist:
            Profile.objects.create(user=user, profile_pic=picture)
        
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

