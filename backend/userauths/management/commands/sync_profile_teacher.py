from django.core.management.base import BaseCommand
from django.apps import apps
from userauths.models import Profile
from api.models import Teacher


class Command(BaseCommand):
    help = 'Synchronize Profile and Teacher models to ensure data consistency'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sync even if data might be overwritten',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        
        self.stdout.write(
            self.style.SUCCESS('Starting Profile-Teacher synchronization...')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE: No changes will be made')
            )
        
        # Sync Profile -> Teacher
        profiles_updated = 0
        teachers_created = 0
        
        for profile in Profile.objects.all():
            try:
                teacher = Teacher.objects.filter(user=profile.user).first()
                
                if teacher:
                    # Update existing teacher
                    changed = False
                    
                    if teacher.image != profile.image:
                        if not dry_run:
                            teacher.image = profile.image
                        changed = True
                        
                    if teacher.full_name != profile.full_name:
                        if not dry_run:
                            teacher.full_name = profile.full_name
                        changed = True
                        
                    if teacher.country != profile.country:
                        if not dry_run:
                            teacher.country = profile.country
                        changed = True
                        
                    if teacher.about != profile.about:
                        if not dry_run:
                            teacher.about = profile.about
                        changed = True
                    
                    if changed:
                        if not dry_run:
                            teacher._syncing = True  # Prevent recursive updates
                            teacher.save()
                        profiles_updated += 1
                        
                        if dry_run:
                            self.stdout.write(
                                f'Would update Teacher for user: {profile.user.email}'
                            )
                        else:
                            self.stdout.write(
                                f'Updated Teacher for user: {profile.user.email}'
                            )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error syncing profile {profile.user.email}: {e}'
                    )
                )
        
        # Sync Teacher -> Profile
        teachers_updated = 0
        
        for teacher in Teacher.objects.all():
            try:
                profile = Profile.objects.filter(user=teacher.user).first()
                
                if profile:
                    # Update existing profile
                    changed = False
                    
                    if profile.image != teacher.image:
                        if not dry_run:
                            profile.image = teacher.image
                        changed = True
                        
                    if profile.full_name != teacher.full_name:
                        if not dry_run:
                            profile.full_name = teacher.full_name
                        changed = True
                        
                    if profile.country != teacher.country:
                        if not dry_run:
                            profile.country = teacher.country
                        changed = True
                        
                    if profile.about != teacher.about:
                        if not dry_run:
                            profile.about = teacher.about
                        changed = True
                    
                    if changed:
                        if not dry_run:
                            profile._syncing = True  # Prevent recursive updates
                            profile.save()
                        teachers_updated += 1
                        
                        if dry_run:
                            self.stdout.write(
                                f'Would update Profile for user: {teacher.user.email}'
                            )
                        else:
                            self.stdout.write(
                                f'Updated Profile for user: {teacher.user.email}'
                            )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error syncing teacher {teacher.user.email}: {e}'
                    )
                )
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(
            self.style.SUCCESS(
                f'Synchronization complete!\n'
                f'Profiles that updated Teachers: {profiles_updated}\n'
                f'Teachers that updated Profiles: {teachers_updated}\n'
                f'Teachers created: {teachers_created}'
            )
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\nThis was a dry run. Run without --dry-run to apply changes.'
                )
            )
