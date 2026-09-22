from urllib3.exceptions import InsecureRequestWarning
from django.shortcuts import render, redirect
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import models
from django.db.models import Q, F, Value, Count, Sum, Avg, Max
from django.db.models.functions import ExtractMonth
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.views.decorators.cache import cache_page
from django.core.cache import cache

try:
    from api.cache_utils import cache_search_results, cache_suggestions, SearchCacheManager, TrendingCacheManager
except ImportError:
    def cache_search_results(timeout=300):
        return lambda f: f
    def cache_suggestions(timeout=600):
        return lambda f: f

from api import serializer as api_serializer
from api import models as api_models
from userauths.models import User, Profile, OrganizationUnit, Position, UsedSSOToken

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, APIView
from rest_framework.pagination import PageNumberPagination

from api.permissions import IsAdminUser
from api.serializer import MyTokenObtainPairSerializer
from api.version import APP_VERSION, APP_NAME

import random
from decimal import Decimal
import requests

import logging
logger = logging.getLogger('api')
security_logger = logging.getLogger('security')
from datetime import datetime, timedelta
from django.utils.dateparse import parse_datetime
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding

from django.core.files.storage import default_storage
import os
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None
from django.core.files.base import ContentFile
import math
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from api.views.helpers import _SYNC_STATE, reset_sync_state, update_sync_state, get_sync_state, csrf_failure, generate_tokens_with_role


@method_decorator(csrf_exempt, name='dispatch')
class SyncExternalUsersAPIView(APIView):
    """
    API View to sync user data from external API
    
    CSRF exempt because:
    - Uses only JWT authentication (no session auth)
    - Admin-only endpoint with role verification
    - Protected by IsAuthenticated permission class
    """
    authentication_classes = [JWTAuthentication]  # Only JWT, no SessionAuthentication
    permission_classes = [IsAuthenticated]

    def parse_datetime_safe(self, datetime_str):
        """Safely parse datetime string with multiple format support."""
        if not datetime_str:
            return timezone.now()

        try:
            datetime_str = str(datetime_str)
            if datetime_str.endswith('Z'):
                datetime_str = datetime_str.replace('Z', '+00:00')

            parsed_dt = parse_datetime(datetime_str)
            if parsed_dt:
                return parsed_dt

            return datetime.fromisoformat(datetime_str)

        except (ValueError, TypeError) as e:
            print(f"DateTime parsing error for '{datetime_str}': {e}")
            return timezone.now()

    def _pick_first_value(self, data, keys, default=None):
        """Pick first non-empty value from multiple candidate keys."""
        if not isinstance(data, dict):
            return default
        for key in keys:
            value = data.get(key)
            if value is not None and str(value).strip() != '':
                return value
        return default

    def _build_external_api_url(self):
        """Build external API URL from settings with backward-compatible defaults."""
        endpoint = getattr(settings, 'EXTERNAL_API_USERS_ENDPOINT', '/api/pegawai')
        base_url = getattr(settings, 'EXTERNAL_API_BASE_URL', '').rstrip('/')

        if str(endpoint).startswith('http://') or str(endpoint).startswith('https://'):
            return endpoint

        endpoint = f"/{str(endpoint).lstrip('/')}"

        # Compatibility guard: some deployments still set EXTERNAL_API_USERS_ENDPOINT=/api.
        # For user sync we need the pegawai collection endpoint.
        if endpoint.rstrip('/') in {'/api', '/pegawai', '/users'}:
            print(
                f"Normalizing EXTERNAL_API_USERS_ENDPOINT from '{endpoint}' to '/api/pegawai' "
                "for external user sync compatibility"
            )
            endpoint = '/api/pegawai'

        parsed_base = urlparse(base_url)
        base_path = (parsed_base.path or '').rstrip('/')

        # If base URL already includes /api and endpoint also starts with /api,
        # avoid generating duplicated paths such as /api/api/pegawai.
        if base_path == '/api' and endpoint.startswith('/api'):
            joined_path = endpoint
        elif not base_path:
            joined_path = endpoint
        else:
            joined_path = f"{base_path}{endpoint}"

        return urlunparse((
            parsed_base.scheme,
            parsed_base.netloc,
            joined_path,
            '',
            '',
            ''
        ))

    def _normalize_external_api_token(self, token_value):
        """Normalize token from env: trims quotes and optional header prefix."""
        token = str(token_value or '').strip()
        if not token:
            return ''

        if len(token) >= 2 and token[0] == token[-1] and token[0] in {'"', "'"}:
            token = token[1:-1].strip()

        # Accept pasted formats like: "X-API-TOKEN: <token>" or "Authorization: Bearer <token>"
        header_match = re.match(r'^\s*(x-api-token|authorization)\s*[:=]\s*(.+)$', token, flags=re.IGNORECASE)
        if header_match:
            token = header_match.group(2).strip()

        if token.lower().startswith('bearer '):
            token = token[7:].strip()

        if len(token) >= 2 and token[0] == token[-1] and token[0] in {'"', "'"}:
            token = token[1:-1].strip()

        # Treat placeholders as unset values.
        placeholders = {'set-me-in-env-file', 'your-api-token-here', '<token>', 'changeme'}
        if token.lower() in placeholders:
            return ''

        return token

    def _is_encrypted_external_api_token(self, token_value):
        token = self._normalize_external_api_token(token_value)
        return token.startswith('v1.aes:')

    def _encrypt_external_api_token(self, token_value, salt_value=None):
        """Encrypt token using CMB-compatible scheme: v1.aes:base64(iv+ciphertext)."""
        token = self._normalize_external_api_token(token_value)
        if not token:
            return ''

        # Pass-through if already encrypted.
        if token.startswith('v1.aes:'):
            return token

        salt = str(salt_value if salt_value is not None else '').strip()
        if not salt:
            salt = token

        # Key derivation matches provided frontend logic:
        # SHA-256( token + salt ) => 32-byte AES-256 key
        key = hashlib.sha256((token + salt).encode('utf-8')).digest()

        iv = os.urandom(16)
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(token.encode('utf-8')) + padder.finalize()

        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        payload = base64.b64encode(iv + ciphertext).decode('utf-8')
        return f"v1.aes:{payload}"

    def _build_external_api_encrypted_candidates(self, raw_token):
        """Build encrypted variants for a raw token using supported salts."""
        token = self._normalize_external_api_token(raw_token)
        if not token or token.startswith('v1.aes:'):
            return []

        if not getattr(settings, 'EXTERNAL_API_TOKEN_ENABLE_ENCRYPTED_CANDIDATES', True):
            return []

        candidates = []
        seen = set()

        salt_candidates = []

        # Primary mode from provided implementation example: salt=token.
        if getattr(settings, 'EXTERNAL_API_TOKEN_ENCRYPT_WITH_SELF_SALT', True):
            salt_candidates.append(token)

        # Optional fixed salt mode for compatibility with older integrations.
        configured_salt = str(getattr(settings, 'EXTERNAL_API_TOKEN_ENCRYPTION_SALT', '') or '').strip()
        if configured_salt:
            salt_candidates.append(configured_salt)

        # Final compatibility fallback from shared snippet.
        if not salt_candidates:
            salt_candidates.append('nusa-dpd-salt')

        for salt in salt_candidates:
            encrypted = self._encrypt_external_api_token(token, salt)
            if encrypted and encrypted not in seen:
                seen.add(encrypted)
                candidates.append(encrypted)

        return candidates

    def _build_external_api_token_candidates(self):
        """Build ordered token candidates to support primary/fallback tokens."""
        primary = self._normalize_external_api_token(getattr(settings, 'EXTERNAL_API_TOKEN', ''))
        fallback = self._normalize_external_api_token(getattr(settings, 'EXTERNAL_API_TOKEN_FALLBACK', ''))
        raw_candidates = str(getattr(settings, 'EXTERNAL_API_TOKEN_CANDIDATES', '') or '').strip()

        candidates = []
        seen = set()

        for token in (primary, fallback):
            if token and token not in seen:
                seen.add(token)
                candidates.append(token)

        if raw_candidates:
            for part in re.split(r'\n|\|\|', raw_candidates):
                token = self._normalize_external_api_token(part)
                if token and token not in seen:
                    seen.add(token)
                    candidates.append(token)

        # Auto-add encrypted token candidates for each raw token.
        encrypted_candidates = []
        for token in list(candidates):
            for encrypted in self._build_external_api_encrypted_candidates(token):
                if encrypted and encrypted not in seen:
                    seen.add(encrypted)
                    encrypted_candidates.append(encrypted)

        candidates.extend(encrypted_candidates)

        return candidates

    def _build_external_api_headers(self, token_value):
        """Build authentication headers for external API request."""
        token_header = getattr(settings, 'EXTERNAL_API_TOKEN_HEADER', 'X-API-TOKEN')
        token_value = self._normalize_external_api_token(token_value)

        headers = {'Accept': 'application/json'}
        headers['origin'] = getattr(settings, 'BACKEND_SITE_URL', 'https://example.com')
        if token_value:
            headers[token_header] = token_value
            # Send legacy casing as compatibility fallback.
            headers['X-API-Token'] = token_value
        return headers

    def _build_external_api_verify(self):
        """Build TLS verification mode for requests (bool or CA bundle path)."""
        verify_ssl = getattr(settings, 'EXTERNAL_API_VERIFY_SSL', True)
        ca_bundle = str(getattr(settings, 'EXTERNAL_API_CA_BUNDLE', '') or '').strip()

        if not verify_ssl:
            return False

        if ca_bundle:
            return ca_bundle

        return True

    def _bool_to_query_value(self, value):
        return 'true' if bool(value) else 'false'

    def _append_external_api_query_params(self, base_url):
        """Append configurable query params for external API calls."""
        parsed = urlparse(base_url)
        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        query_map = {k: v for k, v in query_pairs}

        include_json = getattr(settings, 'EXTERNAL_API_INCLUDE_JSON', False)
        with_pagination = getattr(settings, 'EXTERNAL_API_WITH_PAGINATION', False)
        query_all = getattr(settings, 'EXTERNAL_API_QUERY_ALL', False)

        query_map['include_json'] = self._bool_to_query_value(include_json)
        query_map['with_pagination'] = self._bool_to_query_value(with_pagination)
        if query_all:
            query_map['all'] = '1'

        encoded_query = urlencode(query_map)
        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            encoded_query,
            parsed.fragment,
        ))

    def _get_nested(self, data, key):
        """Safely get nested dictionary value by key."""
        if isinstance(data, dict):
            return data.get(key)
        return None

    def _extract_next_page_url(self, external_data):
        """Extract next page URL from various API pagination shapes."""
        if not isinstance(external_data, dict):
            return None

        data_obj = self._get_nested(external_data, 'data')
        meta_obj = self._get_nested(external_data, 'meta')
        links_obj = self._get_nested(external_data, 'links')

        candidates = [
            self._get_nested(external_data, 'next_page_url'),
            self._get_nested(data_obj, 'next_page_url'),
            self._get_nested(meta_obj, 'next_page_url'),
            self._get_nested(links_obj, 'next'),
            self._get_nested(data_obj, 'next'),
            self._get_nested(meta_obj, 'next'),
        ]

        for candidate in candidates:
            if candidate and str(candidate).strip():
                return str(candidate).strip()

        return None

    def _extract_page_numbers(self, external_data):
        """Extract pagination numbers from multiple response formats."""
        if not isinstance(external_data, dict):
            return None, None

        data_obj = self._get_nested(external_data, 'data')
        meta_obj = self._get_nested(external_data, 'meta')

        def as_int(value):
            try:
                if value is None or str(value).strip() == '':
                    return None
                return int(value)
            except (TypeError, ValueError):
                return None

        current_page = (
            as_int(self._get_nested(external_data, 'current_page'))
            or as_int(self._get_nested(meta_obj, 'current_page'))
            or as_int(self._get_nested(data_obj, 'current_page'))
            or as_int(self._get_nested(external_data, 'page'))
        )

        last_page = (
            as_int(self._get_nested(external_data, 'last_page'))
            or as_int(self._get_nested(meta_obj, 'last_page'))
            or as_int(self._get_nested(data_obj, 'last_page'))
            or as_int(self._get_nested(external_data, 'total_pages'))
            or as_int(self._get_nested(meta_obj, 'total_pages'))
            or as_int(self._get_nested(data_obj, 'total_pages'))
        )

        return current_page, last_page

    def _set_page_query_param(self, url, page_number):
        """Return URL with updated page query parameter."""
        page_param = str(getattr(settings, 'EXTERNAL_API_PAGE_PARAM', 'page') or 'page').strip() or 'page'
        parsed = urlparse(url)
        query_map = {k: v for k, v in parse_qsl(parsed.query, keep_blank_values=True)}
        query_map[page_param] = str(page_number)

        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query_map),
            parsed.fragment,
        ))

    def _collect_all_external_users(self, initial_url, initial_data, token_value, verify_mode):
        """Collect all users by following pagination when external API returns paged payloads."""
        success, message, first_batch = self._extract_users_payload(initial_data)
        if not success:
            return success, message, first_batch, []

        all_users = list(first_batch)
        pagination_errors = []

        # If pagination is disabled by query and upstream honors it, there is nothing else to fetch.
        next_page_url = self._extract_next_page_url(initial_data)
        current_page, last_page = self._extract_page_numbers(initial_data)

        # Initialize page tracking in sync state
        update_sync_state(current_page=1, total_pages=last_page or 1)

        if not next_page_url and not (current_page and last_page and last_page > current_page):
            return True, message, all_users, pagination_errors

        headers = self._build_external_api_headers(token_value)
        timeout = getattr(settings, 'EXTERNAL_API_TIMEOUT', 30)
        max_pages = max(int(getattr(settings, 'EXTERNAL_API_PAGINATION_MAX_PAGES', 200)), 1)

        page_fetch_count = 0
        seen_signatures = set()

        def signature_for_users(raw_users):
            if not isinstance(raw_users, list):
                return None
            ids = []
            for idx, item in enumerate(raw_users[:10]):
                if isinstance(item, dict):
                    ids.append(str(self._pick_first_value(item, ['id', 'external_id', 'pegawai_id', 'id_pegawai', 'nip', 'email'], default=f'idx-{idx}')))
                else:
                    ids.append(f'idx-{idx}:{type(item).__name__}')
            return '|'.join(ids)

        while page_fetch_count < max_pages:
            if next_page_url:
                target_url = next_page_url
            elif current_page and last_page and last_page > current_page:
                target_url = self._set_page_query_param(initial_url, current_page + 1)
            else:
                break

            try:
                page_response = requests.get(
                    target_url,
                    headers=headers,
                    verify=verify_mode,
                    timeout=timeout,
                )
                page_response.raise_for_status()
                page_data = page_response.json()
            except Exception as page_error:
                pagination_errors.append(f"Failed to fetch page from {target_url}: {page_error}")
                break

            page_success, page_message, page_users = self._extract_users_payload(page_data)
            if not page_success:
                pagination_errors.append(
                    f"Pagination halted due upstream error on {target_url}: {page_message or 'Unknown error'}"
                )
                break

            page_signature = signature_for_users(page_users)
            if page_signature and page_signature in seen_signatures:
                # Prevent accidental infinite loops when upstream repeatedly returns same page.
                break

            if page_signature:
                seen_signatures.add(page_signature)

            if page_users:
                all_users.extend(page_users)

            page_fetch_count += 1
            next_page_url = self._extract_next_page_url(page_data)
            current_page, last_page = self._extract_page_numbers(page_data)

            # Update sync state with current page progress
            if current_page and last_page:
                print(f"Fetching page {current_page}/{last_page}...")
                update_sync_state(current_page=current_page, total_pages=last_page)

            if not next_page_url and not (current_page and last_page and last_page > current_page):
                break

        return True, message, all_users, pagination_errors

    def _normalize_nested_entity(self, value, fallback_key='name'):
        """Normalize nested org/position payload into expected dict shape."""
        if isinstance(value, dict):
            return {
                'id': value.get('id') or value.get('kode') or value.get('code') or value.get(fallback_key),
                'name': value.get('name') or value.get('nama') or value.get(fallback_key),
                'description': value.get('description') or value.get('deskripsi', '')
            }

        if value is None or str(value).strip() == '':
            return None

        text = str(value).strip()
        return {
            'id': text,
            'name': text,
            'description': ''
        }

    def _normalize_external_user(self, raw_user, idx):
        """Normalize external API user payload to serializer-compatible shape."""
        normalized = {
            'id': self._pick_first_value(raw_user, ['id', 'external_id', 'pegawai_id', 'id_pegawai', 'nip']),
            'name': self._pick_first_value(raw_user, ['name', 'nama', 'full_name', 'nama_pegawai'], default='Unknown User'),
            'email': self._pick_first_value(raw_user, ['email', 'mail']),
            'created_at': self._pick_first_value(raw_user, ['created_at', 'createdAt', 'tgl_buat', 'tanggal_dibuat']),
            'updated_at': self._pick_first_value(raw_user, ['updated_at', 'updatedAt', 'tgl_ubah', 'tanggal_diubah']),
            'status': self._pick_first_value(raw_user, ['status', 'active_status', 'state'], default='ACTIVE'),
            'timezone': self._pick_first_value(raw_user, ['timezone', 'tz'], default='Asia/Jakarta'),
            'nip': self._pick_first_value(raw_user, ['nip', 'no_induk_pegawai', 'nomor_induk']),
            'golongan': self._pick_first_value(raw_user, ['golongan', 'gol']),
            'kelas_jabatan': self._pick_first_value(raw_user, ['kelas_jabatan', 'kelasjabatan']),
            'jenis_jabatan': self._pick_first_value(raw_user, ['jenis_jabatan', 'jenisjabatan']),
            'unit_organisasi': self._normalize_nested_entity(
                self._pick_first_value(raw_user, ['unit_organisasi', 'unit_kerja', 'organisasi', 'unit'])
            ),
            'jabatan': self._normalize_nested_entity(
                self._pick_first_value(raw_user, ['jabatan', 'position', 'posisi'])
            )
        }

        if not normalized['id']:
            fallback_id = normalized.get('nip') or normalized.get('email')
            if fallback_id:
                normalized['id'] = str(fallback_id)
            else:
                normalized['id'] = f"row-{idx + 1}"

        return normalized

    def _extract_users_payload(self, external_data):
        """Extract success flag, message, and user list from multiple API response formats."""
        if isinstance(external_data, list):
            return True, None, external_data

        if not isinstance(external_data, dict):
            return False, 'Invalid response format: expected JSON object or array.', []

        message = external_data.get('message') or external_data.get('error') or external_data.get('detail')

        if 'status' in external_data:
            success = str(external_data.get('status')).strip().lower() in {'success', 'ok', 'true'}
        elif 'success' in external_data:
            success = bool(external_data.get('success'))
        else:
            success = True

        users_data = external_data.get('data', [])
        if isinstance(users_data, dict):
            users_data = (
                users_data.get('data')
                or users_data.get('results')
                or users_data.get('items')
                or users_data.get('pegawai')
                or users_data.get('users')
                or []
            )

        if not isinstance(users_data, list):
            users_data = []

        return success, message, users_data

    def _is_active_external_status(self, raw_status):
        value = str(raw_status or '').strip().lower()
        return value in {'active', 'aktif', '1', 'true', 'enabled'}

    def post(self, request):
        # Verify admin access
        if not hasattr(request.user, 'role') or not request.user.is_admin:
            return Response(
                {'error': 'Admin access required. Only admins can sync external users.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Reset sync state at the beginning
        reset_sync_state()

        # Create SyncHistory record to track this sync operation
        sync_record = api_models.SyncHistory.start_sync('external_users')

        try:
            external_api_url = self._build_external_api_url()
            token_candidates = self._build_external_api_token_candidates()
            verify_mode = self._build_external_api_verify()

            if not token_candidates:
                config_error = (
                    "External API token is missing or invalid placeholder. "
                    "Set EXTERNAL_API_TOKEN in .env/.env.staging."
                )
                sync_record.fail_sync(config_error)
                update_sync_state(
                    is_syncing=False,
                    status='error',
                    completion_timestamp=datetime.now().isoformat()
                )
                return Response({'error': config_error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            print(f"Attempting to fetch data from: {external_api_url}")

            full_api_url = self._append_external_api_query_params(external_api_url)

            try:
                response = None
                selected_token = None
                for idx, token in enumerate(token_candidates):
                    headers = self._build_external_api_headers(token)
                    response = requests.get(
                        full_api_url,
                        headers=headers,
                        verify=verify_mode,
                        timeout=getattr(settings, 'EXTERNAL_API_TIMEOUT', 30)
                    )
                    print(f"Response status code: {response.status_code} (token candidate {idx + 1}/{len(token_candidates)})")

                    # Try next token candidate for auth failures only.
                    if response.status_code in {401, 403} and idx < len(token_candidates) - 1:
                        print(f"Auth failed with token candidate {idx + 1}, trying fallback token...")
                        continue

                    selected_token = token
                    break
            except requests.exceptions.SSLError as ssl_error:
                ssl_hint = (
                    "TLS certificate verification failed when calling external API. "
                    "Configure EXTERNAL_API_CA_BUNDLE with trusted CA chain or set "
                    "EXTERNAL_API_VERIFY_SSL=False only for temporary troubleshooting."
                )
                error_msg = f"External API SSL error: {str(ssl_error)}. {ssl_hint}"
                print(f"❌ SSL ERROR: {error_msg}")
                print(f"   Verify Mode: {verify_mode}")
                print(f"   API URL: {external_api_url}")
                sync_record.fail_sync(error_msg)
                update_sync_state(
                    is_syncing=False,
                    status='error',
                    completion_timestamp=datetime.now().isoformat()
                )
                return Response({'error': error_msg}, status=status.HTTP_502_BAD_GATEWAY)
            except requests.exceptions.RequestException as req_error:
                upstream_error_msg = f"External API request failed: {str(req_error)}"
                endpoint_config = str(getattr(settings, 'EXTERNAL_API_USERS_ENDPOINT', '/api/pegawai') or '').strip()
                if endpoint_config in {'/api', 'api'}:
                    upstream_error_msg += " Hint: EXTERNAL_API_USERS_ENDPOINT is '/api'. Use '/api/pegawai' for Pegawai sync."
                print(f"❌ REQUEST ERROR: {upstream_error_msg}")
                sync_record.fail_sync(upstream_error_msg)
                update_sync_state(
                    is_syncing=False,
                    status='error',
                    completion_timestamp=datetime.now().isoformat()
                )
                return Response({'error': upstream_error_msg}, status=status.HTTP_502_BAD_GATEWAY)

            try:
                external_data = response.json()
            except ValueError:
                raw_preview = (response.text or '')[:300]
                error_msg = f"External API returned non-JSON response (HTTP {response.status_code}). Preview: {raw_preview}"
                print(f"❌ JSON PARSE ERROR: {error_msg}")
                sync_record.fail_sync(error_msg)
                update_sync_state(
                    is_syncing=False,
                    status='error',
                    completion_timestamp=datetime.now().isoformat()
                )
                return Response({'error': error_msg}, status=status.HTTP_502_BAD_GATEWAY)

            print(f"Received data keys: {list(external_data.keys()) if isinstance(external_data, dict) else 'Not a dict'}")

            if response.status_code >= 400:
                upstream_msg = None
                if isinstance(external_data, dict):
                    upstream_msg = external_data.get('message') or external_data.get('error') or external_data.get('detail')
                error_msg = f"External API returned HTTP {response.status_code}: {upstream_msg or 'Unknown error'}"
                sync_record.fail_sync(error_msg)
                update_sync_state(
                    is_syncing=False,
                    status='error',
                    completion_timestamp=datetime.now().isoformat()
                )
                if response.status_code in {401, 403}:
                    auth_hint = (
                        " External API authentication failed. Verify EXTERNAL_API_TOKEN value "
                        "and confirm server IP whitelist with upstream provider."
                    )
                    return Response({'error': error_msg + auth_hint}, status=status.HTTP_403_FORBIDDEN)
                return Response({'error': error_msg}, status=status.HTTP_502_BAD_GATEWAY)

            success, upstream_message, raw_users_data, pagination_errors = self._collect_all_external_users(
                full_api_url,
                external_data,
                selected_token,
                verify_mode,
            )
            if not success:
                error_msg = f"External API returned error: {upstream_message or 'Unknown error'}"
                sync_record.fail_sync(error_msg)
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

            if pagination_errors:
                print(f"⚠️ Pagination warnings: {pagination_errors}")

            users_data = []
            normalization_errors = [{'external_id': 'pagination', 'error': err} for err in pagination_errors]
            for idx, item in enumerate(raw_users_data):
                if not isinstance(item, dict):
                    normalization_errors.append({
                        'external_id': f'row-{idx + 1}',
                        'error': f'Invalid user payload type: {type(item).__name__}'
                    })
                    continue
                users_data.append(self._normalize_external_user(item, idx))

            print(f"Processing {len(users_data)} users from external API")
            if users_data:
                print(f"Sample user structure: {list(users_data[0].keys()) if users_data[0] else 'No first user'}")

            sync_results = {
                'total_users': len(users_data),
                'created': 0,
                'updated': 0,
                'failed': len(normalization_errors),
                'errors': normalization_errors.copy()
            }

            update_sync_state(
                is_syncing=True,
                total=len(users_data),
                created=0,
                updated=0,
                failed=sync_results['failed'],
                errors=sync_results['errors'],
                new=0,
                changed=0,
                unchanged=0,
                comparison_complete=False
            )

            print("Starting user data comparison...")
            categorized_users = categorize_users_for_sync(users_data)

            update_sync_state(
                new=len(categorized_users['new']),
                changed=len(categorized_users['changed']),
                unchanged=len(categorized_users['unchanged']),
                comparison_complete=True
            )

            print(
                f"Comparison complete: {len(categorized_users['new'])} new, "
                f"{len(categorized_users['changed'])} changed, "
                f"{len(categorized_users['unchanged'])} unchanged"
            )

            users_to_process = categorized_users['new'] + categorized_users['changed']

            for user_data in users_to_process:
                try:
                    if not user_data.get('email') or user_data.get('email') == '':
                        nip = user_data.get('nip', user_data.get('id', ''))
                        user_data['email'] = f"{nip}@external-system.local"
                        print(f"Email missing for user {user_data.get('id')}, generated: {user_data['email']}")

                    serializer = api_serializer.ExternalUserDataSerializer(data=user_data)
                    if not serializer.is_valid():
                        sync_results['errors'].append({
                            'external_id': user_data.get('id'),
                            'errors': serializer.errors
                        })
                        sync_results['failed'] = len(sync_results['errors'])
                        update_sync_state(
                            failed=sync_results['failed'],
                            errors=sync_results['errors']
                        )
                        continue

                    validated_data = serializer.validated_data

                    org_unit = None
                    if validated_data.get('unit_organisasi'):
                        org_unit_data = validated_data['unit_organisasi']
                        org_unit, _ = OrganizationUnit.objects.get_or_create(
                            external_id=org_unit_data.get('id'),
                            defaults={
                                'name': org_unit_data.get('name', 'Unknown'),
                                'description': org_unit_data.get('description', '')
                            }
                        )

                    position = None
                    if validated_data.get('jabatan'):
                        position_data = validated_data['jabatan']
                        position, _ = Position.objects.get_or_create(
                            external_id=position_data.get('id'),
                            defaults={
                                'name': position_data.get('name', 'Unknown'),
                                'description': position_data.get('description', '')
                            }
                        )

                    user = None
                    user_created = False

                    try:
                        user = User.objects.get(external_id=validated_data['id'])
                        print(f"Found user by external_id: {user.email}")

                    except User.DoesNotExist:
                        try:
                            user = User.objects.get(email=validated_data['email'])
                            print(f"Found user by email: {user.email}, updating with external_id: {validated_data['id']}")
                            user.external_id = validated_data['id']

                        except User.DoesNotExist:
                            print(f"Creating new user: {validated_data['email']}")

                            email_username = validated_data['email'].split('@')[0]
                            username = email_username
                            counter = 1
                            while User.objects.filter(username=username).exists():
                                username = f"{email_username}_{counter}"
                                counter += 1

                            user = User.objects.create(
                                username=username,
                                email=validated_data['email'],
                                full_name=validated_data['name'],
                                external_id=validated_data['id'],
                                nip=validated_data.get('nip'),
                                golongan=validated_data.get('golongan'),
                                kelas_jabatan=validated_data.get('kelas_jabatan'),
                                jenis_jabatan=validated_data.get('jenis_jabatan'),
                                timezone=validated_data.get('timezone', 'Asia/Jakarta'),
                                external_status=validated_data.get('status'),
                                external_created_at=self.parse_datetime_safe(validated_data.get('created_at')),
                                external_updated_at=self.parse_datetime_safe(validated_data.get('updated_at')),
                                last_sync_date=timezone.now(),
                                is_active=self._is_active_external_status(validated_data.get('status')),
                                role='student'
                            )
                            user_created = True
                            sync_results['created'] += 1
                            update_sync_state(created=sync_results['created'])

                    if not user_created:
                        user.full_name = validated_data['name']
                        user.email = validated_data['email']
                        user.nip = validated_data.get('nip')
                        user.golongan = validated_data.get('golongan')
                        user.kelas_jabatan = validated_data.get('kelas_jabatan')
                        user.jenis_jabatan = validated_data.get('jenis_jabatan')
                        user.timezone = validated_data.get('timezone', 'Asia/Jakarta')
                        user.external_status = validated_data.get('status')
                        user.external_created_at = self.parse_datetime_safe(validated_data.get('created_at'))
                        user.external_updated_at = self.parse_datetime_safe(validated_data.get('updated_at'))
                        user.last_sync_date = timezone.now()
                        user.is_active = self._is_active_external_status(validated_data.get('status'))
                        user.save()

                        sync_results['updated'] += 1
                        update_sync_state(updated=sync_results['updated'])

                    profile, created = Profile.objects.get_or_create(
                        user=user,
                        defaults={
                            'organization_unit': org_unit,
                            'position': position,
                        }
                    )

                    if not created:
                        profile.organization_unit = org_unit
                        profile.position = position
                        profile.save()

                except Exception as e:
                    error_msg = str(e)
                    print(
                        f"Error processing user {user_data.get('id', 'unknown')} "
                        f"({user_data.get('email', 'no-email')}): {error_msg}"
                    )
                    sync_results['errors'].append({
                        'external_id': user_data.get('id'),
                        'name': user_data.get('name', 'Unknown'),
                        'email': user_data.get('email', 'Unknown'),
                        'error': error_msg
                    })
                    sync_results['failed'] = len(sync_results['errors'])
                    update_sync_state(
                        failed=sync_results['failed'],
                        errors=sync_results['errors']
                    )
                    continue

            print(
                f"Sync completed: {sync_results['created']} created, "
                f"{sync_results['updated']} updated, "
                f"{len(sync_results['errors'])} errors"
            )

            sync_record.complete_sync(
                created=sync_results['created'],
                updated=sync_results['updated'],
                failed=sync_results['failed'],
                total=len(users_data),
                notes=(
                    f"Successfully synced {len(users_data)} users from external API. "
                    f"{len(categorized_users['new'])} new, "
                    f"{len(categorized_users['changed'])} changed, "
                    f"{len(categorized_users['unchanged'])} unchanged."
                )
            )

            now_timestamp = datetime.now().isoformat()
            update_sync_state(
                is_syncing=False,
                status='completed',
                completion_timestamp=now_timestamp,
                last_successful_sync_timestamp=now_timestamp
            )

            return Response({
                'message': 'User synchronization completed successfully',
                'results': sync_results,
                'sync_record_id': sync_record.id,
                'last_sync_time': sync_record.completed_at
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Unexpected error in sync: {str(e)}")
            sync_record.fail_sync(f'Synchronization failed: {str(e)}')
            update_sync_state(
                is_syncing=False,
                status='error',
                completion_timestamp=datetime.now().isoformat()
            )
            return Response({
                'error': f'Synchronization failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class SyncProgressAPIView(APIView):
    """
    Get real-time progress of ongoing sync operation
    
    Provides live updates while sync is in progress from in-memory state.
    Also returns last successful sync info from database.
    Requires admin authentication.
    
    Response:
    {
        "is_syncing": boolean,
        "status": "idle|initializing|syncing|completed|error|cancelled",
        "completion_timestamp": ISO timestamp when sync completed,
        "last_successful_sync_timestamp": ISO timestamp of last successful sync,
        "created": integer,      # Users created so far
        "updated": integer,      # Users updated so far
        "failed": integer,       # Users failed
        "total": integer,        # Total users to sync
        "new": integer,          # New users detected (not in system)
        "changed": integer,      # Changed users detected (will be updated)
        "unchanged": integer,    # Unchanged users (skipped)
        "comparison_complete": boolean,  # Whether data comparison is done
        "errors": array,         # Error details
        "last_sync_info": {...}  # Last successful sync from database
    }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current sync progress"""
        # Verify admin access
        if not hasattr(request.user, 'role') or not (request.user.is_admin):
            return Response(
                {'error': 'Admin access required. Only admins can view sync progress.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return current sync state (in-memory for real-time progress)
        state = get_sync_state()
        
        # Get last successful sync from database
        last_successful_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
        
        last_sync_info = None
        if last_successful_sync:
            last_sync_info = {
                'id': last_successful_sync.id,
                'started_at': last_successful_sync.started_at.isoformat(),
                'completed_at': last_successful_sync.completed_at.isoformat() if last_successful_sync.completed_at else None,
                'status': last_successful_sync.status,
                'total_records': last_successful_sync.total_records,
                'created_records': last_successful_sync.created_records,
                'updated_records': last_successful_sync.updated_records,
                'failed_records': last_successful_sync.failed_records,
                'total_changed': last_successful_sync.total_changed,
                'duration': last_successful_sync.duration,
                'duration_seconds': last_successful_sync.duration_seconds,
                'notes': last_successful_sync.notes
            }
        
        return Response({
            'is_syncing': state['is_syncing'],
            'status': state.get('status', 'idle'),
            'completion_timestamp': state.get('completion_timestamp'),
            'last_successful_sync_timestamp': state.get('last_successful_sync_timestamp'),
            'created': state['created'],
            'updated': state['updated'],
            'failed': state['failed'],
            'total': state['total'],
            'new': state.get('new', 0),
            'changed': state.get('changed', 0),
            'unchanged': state.get('unchanged', 0),
            'comparison_complete': state.get('comparison_complete', False),
            'errors': state['errors'],
            'last_sync_info': last_sync_info
        }, status=status.HTTP_200_OK)




@method_decorator(csrf_exempt, name='dispatch')
class LastSyncInfoAPIView(APIView):
    """
    Get last sync time from database
    
    ✨ SPRINT 1 SECURITY FIX: Requires authentication to prevent information disclosure
    Returns the last successful sync timestamp and statistics.
    
    Response:
    {
        "last_sync_time": ISO timestamp or null,
        "sync_info": {
            "id": integer,
            "started_at": ISO timestamp,
            "completed_at": ISO timestamp,
            "status": "completed|in_progress|failed|cancelled",
            "total_records": integer,
            "created_records": integer,
            "updated_records": integer,
            "failed_records": integer,
            "duration": "HH:MM:SS",
            "duration_seconds": integer,
            "notes": string
        }
    }
    """
    # ✨ SPRINT 1 SECURITY: Require authentication instead of AllowAny
    # Prevents information disclosure about sync operations
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get(self, request):
        """Get last sync time info"""
        try:
            # Get last successful sync from database
            last_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
            
            if not last_sync:
                return Response({
                    'last_sync_time': None,
                    'sync_info': None,
                    'message': 'No sync history available'
                }, status=status.HTTP_200_OK)
            
            sync_info = {
                'id': last_sync.id,
                'started_at': last_sync.started_at.isoformat(),
                'completed_at': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
                'status': last_sync.status,
                'total_records': last_sync.total_records,
                'created_records': last_sync.created_records,
                'updated_records': last_sync.updated_records,
                'failed_records': last_sync.failed_records,
                'total_changed': last_sync.total_changed,
                'duration': last_sync.duration,
                'duration_seconds': last_sync.duration_seconds,
                'notes': last_sync.notes
            }
            
            return Response({
                'last_sync_time': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
                'sync_info': sync_info
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in LastSyncInfoAPIView: {str(e)}")
            return Response({
                'error': f'Error retrieving sync information: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ==================== TIER 1: CONTENT GAP ANALYSIS ====================

class ContentGapAnalysisView(generics.ListCreateAPIView):
    """
    Analyze failed searches to identify content creation gaps.
    GET: List all content gaps sorted by priority
    POST: Manually trigger analysis of failed searches
    """
    queryset = api_models.ContentGap.objects.all()
    serializer_class = api_serializer.ContentGapSerializer
    permission_classes = [IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """Get top content gaps"""
        gaps = api_models.ContentGap.objects.all()[:20]
        serializer = self.get_serializer(gaps, many=True)
        return Response({
            'success': True,
            'count': len(gaps),
            'gaps': serializer.data
        })
    
    def create(self, request, *args, **kwargs):
        """Trigger content gap analysis from failed searches"""
        try:
            days = request.data.get('days', 30)
            count = api_models.ContentGap.update_from_failed_searches(days=days)
            
            gaps = api_models.ContentGap.objects.all()[:20]
            serializer = self.get_serializer(gaps, many=True)
            
            return Response({
                'success': True,
                'message': f'Analyzed {count} failed searches',
                'gaps': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)




class ContentGapDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get or update specific content gap"""
    queryset = api_models.ContentGap.objects.all()
    serializer_class = api_serializer.ContentGapSerializer
    permission_classes = [IsAuthenticated]




# ==================== TIER 1: AT-RISK STUDENT DETECTION ====================

class StudentRiskAssessmentView(generics.ListAPIView):
    """
    Get list of at-risk students sorted by risk level.
    Filter options: risk_level, course_id
    """
    queryset = api_models.StudentRiskAssessment.objects.all()
    serializer_class = api_serializer.StudentRiskAssessmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = api_models.StudentRiskAssessment.objects.all()
        
        # Filter by risk level
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        
        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(enrollment__course_id=course_id)
        
        return queryset.order_by('-risk_score')




class StudentRiskAssessmentDetailView(generics.RetrieveAPIView):
    """Get detailed risk assessment for a specific student"""
    queryset = api_models.StudentRiskAssessment.objects.all()
    serializer_class = api_serializer.StudentRiskAssessmentSerializer
    permission_classes = [IsAuthenticated]




class StudentRiskAssessmentTriggerView(APIView):
    """
    Manually trigger risk assessment for all students.
    This would normally be called by Celery background job daily.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Trigger assessment of all enrolled students"""
        try:
            count = api_models.StudentRiskAssessment.assess_all_students()
            
            # Get HIGH risk students for response
            high_risk = api_models.StudentRiskAssessment.objects.filter(
                risk_level='HIGH'
            )[:10]
            serializer = api_serializer.StudentRiskAssessmentSerializer(
                high_risk, many=True
            )
            
            return Response({
                'success': True,
                'message': f'Assessed {count} students',
                'high_risk_count': api_models.StudentRiskAssessment.objects.filter(
                    risk_level='HIGH'
                ).count(),
                'medium_risk_count': api_models.StudentRiskAssessment.objects.filter(
                    risk_level='MEDIUM'
                ).count(),
                'high_risk_samples': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)




class StudentRiskSummaryView(APIView):
    """Get overall risk summary across platform"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get risk statistics"""
        from django.db.models import Count, Avg
        
        risk_counts = api_models.StudentRiskAssessment.objects.values(
            'risk_level'
        ).annotate(count=Count('id'))
        
        risk_dict = {item['risk_level']: item['count'] for item in risk_counts}
        
        avg_score = api_models.StudentRiskAssessment.objects.aggregate(
            avg=Avg('risk_score')
        )['avg'] or 0
        
        return Response({
            'success': True,
            'total_students': api_models.StudentRiskAssessment.objects.count(),
            'high_risk': risk_dict.get('HIGH', 0),
            'medium_risk': risk_dict.get('MEDIUM', 0),
            'low_risk': risk_dict.get('LOW', 0),
            'average_risk_score': round(avg_score, 2)
        })




# ==================== TIER 1: COURSE RECOMMENDATIONS ====================

class CourseRecommendationView(generics.ListCreateAPIView):
    """
    Get personalized course recommendations for a user.
    Supports content-based, collaborative, and trending algorithms.
    """
    queryset = api_models.CourseRecommendation.objects.all()
    serializer_class = api_serializer.CourseRecommendationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filter recommendations for current user
        user = self.request.user
        return api_models.CourseRecommendation.objects.filter(
            user=user
        ).order_by('-score')




class CourseRecommendationDetailView(generics.RetrieveUpdateAPIView):
    """Get or update specific recommendation"""
    queryset = api_models.CourseRecommendation.objects.all()
    serializer_class = api_serializer.CourseRecommendationSerializer
    permission_classes = [IsAuthenticated]




class RecommendationClickTrackView(APIView):
    """Track when user clicks on a recommendation"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        """Mark recommendation as clicked"""
        try:
            recommendation = api_models.CourseRecommendation.objects.get(pk=pk)
            recommendation.mark_clicked()
            
            serializer = api_serializer.CourseRecommendationSerializer(
                recommendation
            )
            return Response({
                'success': True,
                'message': 'Click tracked',
                'recommendation': serializer.data
            })
        except api_models.CourseRecommendation.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Recommendation not found'
            }, status=status.HTTP_404_NOT_FOUND)




class RecommendationConversionTrackView(APIView):
    """Track when user enrolls from a recommendation"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        """Mark recommendation as converted (enrolled)"""
        try:
            recommendation = api_models.CourseRecommendation.objects.get(pk=pk)
            recommendation.mark_enrolled()
            
            serializer = api_serializer.CourseRecommendationSerializer(
                recommendation
            )
            return Response({
                'success': True,
                'message': 'Enrollment tracked',
                'recommendation': serializer.data
            })
        except api_models.CourseRecommendation.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Recommendation not found'
            }, status=status.HTTP_404_NOT_FOUND)




class RecommendationStatsView(APIView):
    """Get recommendation performance statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get CTR and conversion metrics"""
        from django.db.models import Count
        
        total_recs = api_models.CourseRecommendation.objects.count()
        clicked = api_models.CourseRecommendation.objects.filter(
            clicked=True
        ).count()
        enrolled = api_models.CourseRecommendation.objects.filter(
            enrolled=True
        ).count()
        
        ctr = (clicked / total_recs * 100) if total_recs > 0 else 0
        conversion = (enrolled / clicked * 100) if clicked > 0 else 0
        
        # By reason
        by_reason = api_models.CourseRecommendation.objects.values(
            'reason'
        ).annotate(
            count=Count('id'),
            clicks=Count('id', filter=Q(clicked=True)),
            enrolls=Count('id', filter=Q(enrolled=True))
        )
        
        return Response({
            'success': True,
            'total_recommendations': total_recs,
            'total_clicks': clicked,
            'total_enrollments': enrolled,
            'ctr_percent': round(ctr, 2),
            'conversion_percent': round(conversion, 2),
            'by_reason': list(by_reason)
        })




