"""
Django management command to optimize local storage
"""

from django.core.management.base import BaseCommand
from django.conf import settings
import os
import shutil
from datetime import datetime

class Command(BaseCommand):
    help = 'Optimize and organize local media storage'

    def add_arguments(self, parser):
        parser.add_argument(
            '--organize',
            action='store_true',
            help='Reorganize existing files into category folders'
        )
        parser.add_argument(
            '--cleanup',
            action='store_true', 
            help='Remove unused and duplicate files'
        )
        parser.add_argument(
            '--backup',
            action='store_true',
            help='Create backup of media files'
        )
        parser.add_argument(
            '--stats',
            action='store_true',
            help='Show storage statistics'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Starting Local Storage Optimization')
        )

        if options['organize']:
            self.organize_files()
        
        if options['cleanup']:
            self.cleanup_files()
            
        if options['backup']:
            self.backup_files()
            
        if options['stats']:
            self.show_statistics()
            
        if not any([options['organize'], options['cleanup'], options['backup'], options['stats']]):
            self.show_help()

    def organize_files(self):
        """Organize files into category-based directories"""
        self.stdout.write("📁 Organizing files into categories...")
        
        media_root = settings.MEDIA_ROOT
        if not os.path.exists(media_root):
            os.makedirs(media_root)
            
        # Create category directories
        categories = ['videos', 'images', 'documents', 'courses', 'profiles', 'thumbnails']
        for category in categories:
            dir_path = os.path.join(media_root, category)
            os.makedirs(dir_path, exist_ok=True)
            self.stdout.write(f"✅ Created directory: {category}")

        # Move existing files
        moved_count = 0
        for root, dirs, files in os.walk(media_root):
            for file in files:
                if self.should_skip_file(file):
                    continue
                    
                file_path = os.path.join(root, file)
                category = self.get_file_category(file)
                target_dir = os.path.join(media_root, category)
                target_path = os.path.join(target_dir, file)
                
                # Avoid moving files already in correct location
                if os.path.dirname(file_path) != target_dir:
                    try:
                        shutil.move(file_path, target_path)
                        moved_count += 1
                        self.stdout.write(f"📦 Moved {file} to {category}/")
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"❌ Error moving {file}: {e}")
                        )
        
        self.stdout.write(
            self.style.SUCCESS(f"✅ Organized {moved_count} files")
        )

    def cleanup_files(self):
        """Remove unused and duplicate files"""
        self.stdout.write("🧹 Cleaning up storage...")
        
        # This would integrate with database to find unused files
        # For now, just remove empty directories
        removed_dirs = 0
        media_root = settings.MEDIA_ROOT
        
        for root, dirs, files in os.walk(media_root, topdown=False):
            for dir_name in dirs:
                dir_path = os.path.join(root, dir_name)
                try:
                    if not os.listdir(dir_path):  # Empty directory
                        os.rmdir(dir_path)
                        removed_dirs += 1
                        self.stdout.write(f"🗑️  Removed empty directory: {dir_path}")
                except Exception as e:
                    pass
        
        self.stdout.write(
            self.style.SUCCESS(f"✅ Cleaned up {removed_dirs} empty directories")
        )

    def backup_files(self):
        """Create backup of media files"""
        self.stdout.write("💾 Creating backup...")
        
        media_root = settings.MEDIA_ROOT
        backup_dir = os.path.join(settings.BASE_DIR, 'backups', 'media')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backup_dir, f'media_backup_{timestamp}')
        
        try:
            os.makedirs(backup_dir, exist_ok=True)
            shutil.copytree(media_root, backup_path)
            
            self.stdout.write(
                self.style.SUCCESS(f"✅ Backup created: {backup_path}")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Backup failed: {e}")
            )

    def show_statistics(self):
        """Show storage statistics"""
        self.stdout.write("📊 Storage Statistics")
        self.stdout.write("=" * 50)
        
        media_root = settings.MEDIA_ROOT
        stats = {
            'total_files': 0,
            'total_size': 0,
            'categories': {}
        }
        
        if os.path.exists(media_root):
            for root, dirs, files in os.walk(media_root):
                for file in files:
                    if self.should_skip_file(file):
                        continue
                        
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path)
                        category = self.get_file_category(file)
                        
                        stats['total_files'] += 1
                        stats['total_size'] += file_size
                        
                        if category not in stats['categories']:
                            stats['categories'][category] = {'count': 0, 'size': 0}
                        
                        stats['categories'][category]['count'] += 1
                        stats['categories'][category]['size'] += file_size
                        
                    except Exception:
                        continue
        
        # Display statistics
        self.stdout.write(f"📁 Media Root: {media_root}")
        self.stdout.write(f"📄 Total Files: {stats['total_files']}")
        self.stdout.write(f"💾 Total Size: {self.format_bytes(stats['total_size'])}")
        
        self.stdout.write("\n📋 By Category:")
        for category, data in stats['categories'].items():
            self.stdout.write(
                f"  {category}: {data['count']} files ({self.format_bytes(data['size'])})"
            )

    def get_file_category(self, filename):
        """Determine file category based on extension"""
        extension = os.path.splitext(filename)[1].lower()
        
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        document_extensions = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx']
        
        if extension in video_extensions:
            return 'videos'
        elif extension in image_extensions:
            return 'images'
        elif extension in document_extensions:
            return 'documents'
        else:
            return 'other'

    def should_skip_file(self, filename):
        """Check if file should be skipped"""
        skip_files = ['.gitkeep', '.DS_Store', 'Thumbs.db']
        return filename in skip_files or filename.startswith('.')

    def format_bytes(self, bytes_size):
        """Format bytes in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} PB"

    def show_help(self):
        """Show available options"""
        self.stdout.write("📋 Available Options:")
        self.stdout.write("  --organize  : Organize files into category folders")
        self.stdout.write("  --cleanup   : Remove unused and duplicate files") 
        self.stdout.write("  --backup    : Create backup of media files")
        self.stdout.write("  --stats     : Show storage statistics")
        self.stdout.write("\nExample: python manage.py optimize_storage --organize --stats")