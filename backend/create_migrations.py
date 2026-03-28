#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command
import io
from contextlib import redirect_stdout, redirect_stderr

print("=" * 70)
print("RUNNING MAKEMIGRATIONS FOR ActivityLog MODELS")
print("=" * 70)

# Capture output
stdout_capture = io.StringIO()
stderr_capture = io.StringIO()

with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
    try:
        call_command('makemigrations', 'api', verbosity=2)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

stdout_text = stdout_capture.getvalue()
stderr_text = stderr_capture.getvalue()

if stdout_text:
    print("\nSTDOUT:")
    print(stdout_text)

if stderr_text:
    print("\nSTDERR:")
    print(stderr_text)

print("\n" + "=" * 70)
print("Check if migration file was created...")
print("=" * 70)

import glob
migration_files = glob.glob('api/migrations/00*.py')
migration_files.sort(reverse=True)
for f in migration_files[:5]:
    print(f"  {f}")

