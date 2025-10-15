#!/usr/bin/env python
"""
Django management command to wait for database to be ready
"""
import time
import sys
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    """Django command to wait for database"""

    help = 'Wait for database to be available'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=60,
            help='Timeout in seconds (default: 60)'
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=1,
            help='Check interval in seconds (default: 1)'
        )

    def handle(self, *args, **options):
        """Handle the command"""
        timeout = options['timeout']
        interval = options['interval']
        start_time = time.time()

        self.stdout.write('⏳ Waiting for database...')

        db_conn = None
        while time.time() - start_time < timeout:
            try:
                db_conn = connections['default']
                db_conn.cursor()
                self.stdout.write(self.style.SUCCESS('✅ Database available!'))
                return
            except OperationalError:
                elapsed = int(time.time() - start_time)
                self.stdout.write(
                    f'⏳ Database unavailable, waiting... ({elapsed}s/{timeout}s)'
                )
                time.sleep(interval)

        self.stdout.write(
            self.style.ERROR(f'❌ Database not available after {timeout}s')
        )
        sys.exit(1)
