#!/usr/bin/env python
"""
CSRF Vulnerability Scanner
Detects views with AllowAny + state-changing methods without CSRF exemption

Usage: python csrf_audit.py
"""

import re
import sys
import os

def scan_views_file(filepath='backend/api/views.py'):
    """Scan Django REST Framework views for CSRF vulnerabilities"""
    
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        sys.exit(1)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all view classes
    view_pattern = r'class\s+(\w+)\((generics\.\w+|APIView)\):'
    views = re.findall(view_pattern, content)
    
    vulnerable_views = []
    safe_views = []
    protected_views = []
    
    for view_name, base_class in views:
        # Check if view has state-changing capability
        state_changing_bases = [
            'CreateAPIView', 'UpdateAPIView', 'DestroyAPIView',
            'ListCreateAPIView', 'RetrieveUpdateAPIView',
            'RetrieveDestroyAPIView', 'RetrieveUpdateDestroyAPIView'
        ]
        
        is_state_changing = any(base in base_class for base in state_changing_bases)
        
        # APIView can have any methods, consider it state-changing
        if base_class == 'APIView':
            is_state_changing = True
        
        if not is_state_changing:
            safe_views.append(view_name)
            continue
        
        # Get view definition (look at next 2000 characters)
        view_start = content.find(f'class {view_name}')
        if view_start == -1:
            continue
            
        view_section = content[view_start:view_start + 2000]
        
        # Check for AllowAny permission
        has_allow_any = 'AllowAny' in view_section
        if not has_allow_any:
            safe_views.append(f"{view_name} (IsAuthenticated)")
            continue
        
        # Check for CSRF exemption (look before class definition)
        csrf_exempt_before = content[max(0, view_start-300):view_start]
        has_csrf_exempt = '@method_decorator(csrf_exempt' in csrf_exempt_before or '@csrf_exempt' in csrf_exempt_before
        
        line_number = content[:view_start].count('\n') + 1
        
        if has_csrf_exempt:
            protected_views.append({
                'name': view_name,
                'base': base_class,
                'line': line_number
            })
        else:
            vulnerable_views.append({
                'name': view_name,
                'base': base_class,
                'line': line_number
            })
    
    return vulnerable_views, protected_views, safe_views

def print_report(vulnerabilities, protected, safe):
    """Print detailed vulnerability report"""
    
    print("\n" + "=" * 70)
    print("🔍 CSRF VULNERABILITY SCAN REPORT")
    print("=" * 70)
    
    # Summary
    total = len(vulnerabilities) + len(protected) + len(safe)
    print(f"\n📊 Summary:")
    print(f"   Total Views Scanned: {total}")
    print(f"   ✅ Protected (CSRF Exempt): {len(protected)}")
    print(f"   ✅ Safe (Read-Only): {len(safe)}")
    print(f"   ⚠️  Vulnerable: {len(vulnerabilities)}")
    
    # Protected views
    if protected:
        print(f"\n✅ Protected Views ({len(protected)}):")
        print("   These views have AllowAny + state-changing methods BUT are CSRF exempt:")
        for view in protected[:10]:  # Show first 10
            print(f"   ✓ {view['name']:<40} (Line {view['line']})")
        if len(protected) > 10:
            print(f"   ... and {len(protected) - 10} more")
    
    # Vulnerable views
    if vulnerabilities:
        print(f"\n⚠️  VULNERABLE VIEWS ({len(vulnerabilities)}):")
        print("   These views have AllowAny + state-changing methods WITHOUT CSRF exemption:\n")
        
        for vuln in vulnerabilities:
            print(f"   ❌ {vuln['name']}")
            print(f"      Base Class: {vuln['base']}")
            print(f"      Line: {vuln['line']}")
            print(f"      Severity: HIGH")
            print(f"      Fix: Add @method_decorator(csrf_exempt, name='dispatch')")
            print(f"      Also add: authentication_classes = []")
            print()
        
        print(f"\n🔧 FIX TEMPLATE:")
        print("""
   from django.views.decorators.csrf import csrf_exempt
   from django.utils.decorators import method_decorator
   
   @method_decorator(csrf_exempt, name='dispatch')
   class YourView(generics.CreateAPIView):
       \"\"\"
       Your View Description
       
       CSRF exempt because:
       - Uses JWT authentication
       - AllowAny for public access
       - Data validated by serializers
       \"\"\"
       permission_classes = [AllowAny]
       authentication_classes = []  # Disable SessionAuthentication
        """)
    else:
        print(f"\n🎉 NO VULNERABILITIES DETECTED!")
        print("   All views with AllowAny + state-changing methods are properly protected.")
    
    print("\n" + "=" * 70)
    
    return len(vulnerabilities) == 0

if __name__ == '__main__':
    print("\n🔒 Starting CSRF Vulnerability Scan...")
    print("   Analyzing: backend/api/views.py")
    
    try:
        vulnerabilities, protected, safe = scan_views_file()
        is_safe = print_report(vulnerabilities, protected, safe)
        
        if is_safe:
            print("\n✅ SCAN PASSED: No CSRF vulnerabilities detected\n")
            sys.exit(0)
        else:
            print(f"\n❌ SCAN FAILED: {len(vulnerabilities)} vulnerability(ies) detected")
            print("   Please fix the issues above before deploying\n")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}\n")
        sys.exit(1)
