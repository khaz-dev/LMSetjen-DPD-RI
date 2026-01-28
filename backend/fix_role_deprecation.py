#!/usr/bin/env python
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
        print(f"❌ File not found: {filepath}")
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
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
    
    # 4. Replace in conditionals
    content = re.sub(
        r"not\s+hasattr\((request\.user|user),\s*['\"]role['\"]\)\s+or\s+\1\.role\s*!=\s*['\"]admin['\"]",
        r"not (\1.is_admin)",
        content
    )
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"✅ Updated: {filepath}")
        return True
    else:
        print(f"⏭️  No changes needed: {filepath}")
        return False

if __name__ == "__main__":
    print("🔄 Starting multi-role system deprecation fix...")
    print()
    
    for filepath in files_to_process:
        replace_role_checks(filepath)
    
    print()
    print("✅ Script complete!")
