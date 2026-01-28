#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Multi-Role System Deprecation Script
Replaces all deprecated role field checks with boolean role field checks
"""

import os
import re

# Files to process
files_to_process = [
    "backend/api/views.py",
    "backend/api/serializer.py",
]

def replace_role_checks(filepath):
    """Replace deprecated role field checks with boolean field checks"""
    
    if not os.path.exists(filepath):
        print(f"NOT FOUND: {filepath}")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR reading {filepath}: {e}")
        return False
    
    original_content = content
    
    # 1. Replace permission checks: user.role != 'admin' or request.user.role != 'admin'
    content = re.sub(
        r"(request\.user|user)\.role\s*!=\s*['\"]admin['\"]",
        r"not (\1.is_admin)",
        content
    )
    
    # 2. Replace permission checks: user.role == 'admin' or request.user.role == 'admin'
    content = re.sub(
        r"(request\.user|user|self\.request\.user)\.role\s*==\s*['\"]admin['\"]",
        r"\1.is_admin",
        content
    )
    
    # 3. Replace hasattr checks
    content = re.sub(
        r"hasattr\((request\.user|user|self\.request\.user),\s*['\"]role['\"]\)\s*and\s*\1\.role\s*!=\s*['\"]admin['\"]",
        r"not (\1.is_admin)",
        content
    )
    
    content = re.sub(
        r"hasattr\((request\.user|user|self\.request\.user),\s*['\"]role['\"]\)\s*and\s*\1\.role\s*==\s*['\"]admin['\"]",
        r"\1.is_admin",
        content
    )
    
    if content != original_content:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"OK: {filepath}")
            return True
        except Exception as e:
            print(f"ERROR writing {filepath}: {e}")
            return False
    else:
        print(f"NO CHANGES: {filepath}")
        return False

if __name__ == "__main__":
    print("Starting deprecation fix...")
    
    for filepath in files_to_process:
        replace_role_checks(filepath)
    
    print("Complete!")
