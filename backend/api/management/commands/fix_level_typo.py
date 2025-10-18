"""
Data Migration Script: Fix 'Intemediate' typo to 'Intermediate'
Purpose: Update all existing Course records with the misspelled level value
Run this ONCE after deploying the model fix
"""

from django.core.management.base import BaseCommand
from api.models import Course

class Command(BaseCommand):
    help = 'Fix typo: Update Intemediate to Intermediate in Course level field'

    def handle(self, *args, **kwargs):
        # Find all courses with the typo
        courses_with_typo = Course.objects.filter(level='Intemediate')
        count = courses_with_typo.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No courses found with "Intemediate" typo.'))
            return
        
        self.stdout.write(f'Found {count} course(s) with "Intemediate" typo.')
        
        # Update all at once
        updated = courses_with_typo.update(level='Intermediate')
        
        self.stdout.write(self.style.SUCCESS(
            f'Successfully updated {updated} course(s) from "Intemediate" to "Intermediate"'
        ))
        
        # Verify
        remaining = Course.objects.filter(level='Intemediate').count()
        if remaining > 0:
            self.stdout.write(self.style.ERROR(
                f'Warning: {remaining} course(s) still have "Intemediate"'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All courses successfully migrated!'))
