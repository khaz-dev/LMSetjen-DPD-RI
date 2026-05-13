"""
PHASE 43: Fix Missing variant_item Foreign Keys in CompletedLesson Records

Issue: Some CompletedLesson records have NULL variant_item_id, causing them to be 
silently excluded from API responses. This makes lessons disappear from the 
"completed_lesson" array returned by EnrolledCourseSerializer.

Impact: Last lesson (or any lesson) shows "ditonton XX.X%" instead of "Diselesaikan"

Solution: Find CompletedLesson records with NULL variant_item_id and delete them
(they're orphaned records anyway since no lesson can be completed without a lesson)
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from api import models as api_models
from django.db import connection

def diagnose_missing_fk():
    """Find all CompletedLesson records with missing variant_item FK"""
    print("\n" + "="*80)
    print("PHASE 43: Diagnosing Missing variant_item Foreign Keys")
    print("="*80 + "\n")
    
    # Raw SQL to find orphaned records
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT id, course_id, user_id, variant_item_id, date 
            FROM api_completedlesson 
            WHERE variant_item_id IS NULL
            ORDER BY date DESC
        """)
        orphaned_rows = cursor.fetchall()
    
    print(f"🔍 Found {len(orphaned_rows)} CompletedLesson records with NULL variant_item_id:\n")
    
    if orphaned_rows:
        for row in orphaned_rows:
            cl_id, course_id, user_id, variant_item_id, date = row
            print(f"  ID={cl_id}")
            print(f"    course_id={course_id}, user_id={user_id}")
            print(f"    variant_item_id={variant_item_id} (NULL - ORPHANED)")
            print(f"    date={date}\n")
    else:
        print("  ✅ No orphaned records found! variant_item_id is always set.")
        return 0
    
    return len(orphaned_rows)

def fix_missing_fk():
    """Delete orphaned CompletedLesson records"""
    print("\n" + "="*80)
    print("PHASE 43: Attempting to Fix Orphaned Records")
    print("="*80 + "\n")
    
    # Find and delete orphaned records
    orphaned = api_models.CompletedLesson.objects.filter(variant_item__isnull=True)
    count = orphaned.count()
    
    if count == 0:
        print("✅ No orphaned records to fix!\n")
        return 0
    
    print(f"⚠️  Found {count} orphaned CompletedLesson records (variant_item is NULL)")
    print(f"These records cannot contribute to lesson completion because they reference no lesson.\n")
    
    # Show details before deletion
    print("Records to be deleted:")
    for record in orphaned:
        print(f"  ID={record.id}, Course={record.course.title if record.course else 'Unknown'}, User={record.user.username if record.user else 'Unknown'}, Date={record.date}")
    
    # Backup query before deletion
    print(f"\nBefore deletion, raw SQL shows:")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM api_completedlesson WHERE variant_item_id IS NULL
        """)
        before_count = cursor.fetchone()[0]
    print(f"  {before_count} orphaned records exist\n")
    
    # Delete
    deleted_count, _ = orphaned.delete()
    print(f"✅ Deleted {deleted_count} orphaned records\n")
    
    # Verify deletion
    print(f"After deletion, raw SQL shows:")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM api_completedlesson WHERE variant_item_id IS NULL
        """)
        after_count = cursor.fetchone()[0]
    print(f"  {after_count} orphaned records remain\n")
    
    return deleted_count

def verify_fix():
    """Verify that all remaining CompletedLesson records have valid variant_item"""
    print("\n" + "="*80)
    print("PHASE 43: Verifying Fix")
    print("="*80 + "\n")
    
    # Check both ORM and raw SQL match
    orm_count = api_models.CompletedLesson.objects.filter(
        variant_item__isnull=False
    ).count()
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM api_completedlesson WHERE variant_item_id IS NOT NULL
        """)
        sql_count = cursor.fetchone()[0]
    
    print(f"ORM count (variant_item != NULL): {orm_count}")
    print(f"SQL count (variant_item_id IS NOT NULL): {sql_count}")
    
    if orm_count == sql_count:
        print("✅ Counts match - all records have valid variant_item FK\n")
        return True
    else:
        print(f"⚠️  Mismatch detected! ORM={orm_count} but SQL={sql_count}")
        print("This suggests some CompletedLesson records have variant_item set but it's returning NULL in ORM\n")
        return False

def main():
    print("\n🔧 PHASE 43: Fix Missing variant_item Foreign Keys")
    print("This script identifies and removes orphaned CompletedLesson records.\n")
    
    try:
        # Diagnose
        orphaned_count = diagnose_missing_fk()
        
        if orphaned_count == 0:
            print("✅ No issues found! All completed lessons have valid variant_item references.")
            verify_fix()
            return
        
        # Fix
        print("\nThis will DELETE orphaned records from the database.")
        response = input("Proceed with deletion? (yes/no): ").strip().lower()
        
        if response == 'yes':
            deleted = fix_missing_fk()
            verify_fix()
            
            print("\n" + "="*80)
            print("NEXT STEPS:")
            print("="*80)
            print("1. Students should refresh their course detail pages")
            print("2. The lesson completion modal may reappear if verification question exists")
            print("3. Monitor backend logs for [PHASE 13.3] diagnostics")
            print("4. Verify lesson badges now show 'Diselesaikan' correctly\n")
        else:
            print("❌ Cancelled - no changes made\n")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
