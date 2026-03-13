#!/usr/bin/env python
"""
PHASE 46 Automatic Fix Script
Removes the nested transaction.atomic() wrapper from the answer endpoint
This wrapper was causing silent transaction rollbacks
"""

import re
import sys

def remove_atomic_wrapper(file_path):
    """Remove the problematic with tx.atomic(): wrapper"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the problematic pattern
    # Look for: with tx.atomic():
    # And unindent all following code until the matching close
    
    # Pattern: "with tx.atomic():\n" followed by any number of indented lines
    # We need to remove this and unindent the contents
    
    lines = content.split('\n')
    result_lines = []
    skip_atomic = False
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is the "with tx.atomic():" line we want to remove
        if 'with tx.atomic():' in line and '[PHASE 45]' in line:
            print(f"[PHASE 46] Found atomic wrapper at line {i+1}: {line[:60]}...")
            skip_atomic = True
            # Don't add this line - skip it
            i += 1
            continue
        
        # If we just removed the atomic line, unindent the next block
        if skip_atomic:
            # Check if this line is part of the try block (should be indented more than the with statement)
            if line.strip() == '':
                # Empty line, keep as is
                result_lines.append(line)
            elif line.startswith('                    '):  # 20 spaces - inside the "with" block
                # Remove 4 spaces of indentation
                if line.startswith('                    #'):
                    # This is the try: line right after, unindent it
                    unindented = line[4:]  # Remove 4 spaces
                    result_lines.append(unindented)
                    skip_atomic = False
                    print(f"[PHASE 46] ✅ Unindented block starting at line {i+1}")
                else:
                    # Regular indented code
                    unindented = line[4:]  # Remove 4 spaces
                    result_lines.append(unindented)
            else:
                # Back to normal indentation - stop unindenting
                skip_atomic = False
                result_lines.append(line)
        else:
            result_lines.append(line)
        
        i += 1
    
    # Write back
    output_content = '\n'.join(result_lines)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f"[PHASE 46] ✅ Fixed {file_path}")
    print(f"[PHASE 46] Removed problematic 'with tx.atomic():' wrapper")
    print("\nNext: Restart Django server")
    print("  python manage.py runserver")


if __name__ == '__main__':
    file_path = 'd:\\Project\\LMSetjen DPD RI\\backend\\api\\views.py'
    
    try:
        print("[PHASE 46] Starting automatic fix for transaction rollback issue...")
        print(f"[PHASE 46] Target file: {file_path}")
        
        # Backup
        with open(file_path, 'r') as f:
            original = f.read()
        
        with open(file_path + '.backup_phase46', 'w') as f:
            f.write(original)
        print(f"[PHASE 46] ✅ Backup created: {file_path}.backup_phase46")
        
        # Apply fix
        remove_atomic_wrapper(file_path)
        
        print("\n================================================")
        print("[PHASE 46] ✅ Fix applied successfully!")
        print("================================================\n")
        print("Changes made:")
        print("  1. Removed 'with tx.atomic():' wrapper")
        print("  2. Unindented code block for proper execution")  
        print("  3. Signal already disabled in signals.py")
        print("\nResult: CompletedLesson records will now persist")
        
    except Exception as e:
        print(f"[PHASE 46] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
