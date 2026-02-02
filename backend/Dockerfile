# ============================================
# Multi-Stage Dockerfile for Django Backend
# LMSetjen DPD RI - Learning Management System
# ============================================

# Stage 1: Base Python Image
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

WORKDIR /app

# ============================================
# Stage 2: Dependencies
FROM base as dependencies

# Copy requirements first (for better caching)
COPY --chown=appuser:appuser requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 3: Production Image
FROM base as production

# Copy installed packages from dependencies stage
COPY --from=dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/media /app/static /app/staticfiles /app/logs /app/temp_uploads && \
    chown -R appuser:appuser /app/media /app/static /app/staticfiles /app/logs /app/temp_uploads && \
    chmod -R 755 /app/media /app/static /app/staticfiles /app/logs /app/temp_uploads && \
    chmod -R g+w /app/media /app/static /app/staticfiles /app/logs /app/temp_uploads

# Ensure /app directory itself is writable by appuser
RUN chmod -R 755 /app && chmod g+w /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8001

# Health check - follow redirects and check for 200 status
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; req = urllib.request.Request('https://lms.dpd.go.id/api/api/v1/health/', headers={'Host': 'localhost'}); response = urllib.request.urlopen(req, timeout=5); exit(0 if response.status in [200, 301] else 1)" || exit 1

# Default command - migrations and collectstatic are handled in docker-compose
CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "2", "--threads", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info", "backend.wsgi:application"]
