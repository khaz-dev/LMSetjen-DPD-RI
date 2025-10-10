"""
Database Performance Monitor Command
Usage: python manage.py monitor_performance
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.cache import cache
from django.conf import settings
import json
import time
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Monitor database performance and generate reports'

    def add_arguments(self, parser):
        parser.add_argument(
            '--report-type',
            type=str,
            choices=['queries', 'cache', 'connections', 'all'],
            default='all',
            help='Type of performance report to generate',
        )
        parser.add_argument(
            '--output',
            type=str,
            help='Output file path for the report',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('📊 Generating performance report...')
        )

        report = {}
        report_type = options['report_type']

        if report_type in ['queries', 'all']:
            report['database'] = self.analyze_database_performance()

        if report_type in ['cache', 'all']:
            report['cache'] = self.analyze_cache_performance()

        if report_type in ['connections', 'all']:
            report['connections'] = self.analyze_connection_pool()

        if report_type == 'all':
            report['system'] = self.get_system_stats()

        # Output report
        if options['output']:
            with open(options['output'], 'w') as f:
                json.dump(report, f, indent=2, default=str)
            self.stdout.write(
                self.style.SUCCESS(f'📄 Report saved to: {options["output"]}')
            )
        else:
            self.print_report(report)

    def analyze_database_performance(self):
        """Analyze database query performance"""
        self.stdout.write('🔄 Analyzing database performance...')
        
        with connection.cursor() as cursor:
            # Get slow queries
            cursor.execute("""
                SELECT query, calls, total_time, mean_time, max_time, stddev_time
                FROM pg_stat_statements 
                WHERE calls > 10 
                ORDER BY mean_time DESC 
                LIMIT 10;
            """)
            slow_queries = cursor.fetchall()

            # Get table sizes
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10;
            """)
            table_sizes = cursor.fetchall()

            # Get index usage
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes 
                ORDER BY idx_scan DESC 
                LIMIT 10;
            """)
            index_usage = cursor.fetchall()

            # Database connections
            cursor.execute("""
                SELECT 
                    state,
                    COUNT(*) as connection_count
                FROM pg_stat_activity 
                WHERE datname = %s
                GROUP BY state;
            """, [settings.DATABASES['default']['NAME']])
            connections_info = cursor.fetchall()

        return {
            'slow_queries': [
                {
                    'query': query[:100] + '...' if len(query) > 100 else query,
                    'calls': calls,
                    'total_time': total_time,
                    'mean_time': mean_time,
                    'max_time': max_time,
                    'stddev_time': stddev_time
                } for query, calls, total_time, mean_time, max_time, stddev_time in slow_queries
            ],
            'table_sizes': [
                {
                    'schema': schema,
                    'table': table,
                    'size': size,
                    'size_bytes': size_bytes
                } for schema, table, size, size_bytes in table_sizes
            ],
            'index_usage': [
                {
                    'schema': schema,
                    'table': table,
                    'index': index,
                    'scans': scans,
                    'tuples_read': tuples_read,
                    'tuples_fetched': tuples_fetched
                } for schema, table, index, scans, tuples_read, tuples_fetched in index_usage
            ],
            'connections': [
                {
                    'state': state,
                    'count': count
                } for state, count in connections_info
            ]
        }

    def analyze_cache_performance(self):
        """Analyze Redis cache performance"""
        self.stdout.write('🔄 Analyzing cache performance...')
        
        try:
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection("default")
            
            # Get Redis info
            redis_info = redis_conn.info()
            
            return {
                'redis_version': redis_info.get('redis_version'),
                'used_memory': redis_info.get('used_memory_human'),
                'connected_clients': redis_info.get('connected_clients'),
                'total_commands_processed': redis_info.get('total_commands_processed'),
                'keyspace_hits': redis_info.get('keyspace_hits'),
                'keyspace_misses': redis_info.get('keyspace_misses'),
                'hit_rate': (
                    redis_info.get('keyspace_hits', 0) / 
                    max(1, redis_info.get('keyspace_hits', 0) + redis_info.get('keyspace_misses', 0))
                ) * 100
            }
        except Exception as e:
            return {'error': str(e)}

    def analyze_connection_pool(self):
        """Analyze database connection pool"""
        self.stdout.write('🔄 Analyzing connection pool...')
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    datname,
                    usename,
                    client_addr,
                    state,
                    query_start,
                    state_change,
                    query
                FROM pg_stat_activity 
                WHERE datname = %s;
            """, [settings.DATABASES['default']['NAME']])
            
            connections = cursor.fetchall()
            
            return {
                'total_connections': len(connections),
                'active_connections': len([c for c in connections if c[3] == 'active']),
                'idle_connections': len([c for c in connections if c[3] == 'idle']),
                'connections_detail': [
                    {
                        'database': conn[0],
                        'user': conn[1],
                        'client_addr': str(conn[2]),
                        'state': conn[3],
                        'query_start': conn[4],
                        'state_change': conn[5],
                        'current_query': conn[6][:100] + '...' if conn[6] and len(conn[6]) > 100 else conn[6]
                    } for conn in connections
                ]
            }

    def get_system_stats(self):
        """Get general system statistics"""
        from api.models import Course, Teacher, User, EnrolledCourse
        
        return {
            'total_courses': Course.objects.count(),
            'published_courses': Course.objects.filter(platform_status='Published').count(),
            'total_teachers': Teacher.objects.count(),
            'total_users': User.objects.count(),
            'total_enrollments': EnrolledCourse.objects.count(),
            'timestamp': datetime.now().isoformat()
        }

    def print_report(self, report):
        """Print formatted report to console"""
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('📊 PERFORMANCE REPORT'))
        self.stdout.write('='*60)

        if 'database' in report:
            self.stdout.write('\n🗄️  DATABASE PERFORMANCE:')
            db = report['database']
            
            if db.get('slow_queries'):
                self.stdout.write('\n   Slowest Queries:')
                for i, query in enumerate(db['slow_queries'][:5], 1):
                    self.stdout.write(f'   {i}. {query["query"]} (avg: {query["mean_time"]:.2f}ms)')
            
            if db.get('table_sizes'):
                self.stdout.write('\n   Largest Tables:')
                for table in db['table_sizes'][:5]:
                    self.stdout.write(f'   • {table["table"]}: {table["size"]}')

        if 'cache' in report:
            self.stdout.write('\n🚀 CACHE PERFORMANCE:')
            cache_data = report['cache']
            if 'error' not in cache_data:
                self.stdout.write(f'   • Redis Version: {cache_data["redis_version"]}')
                self.stdout.write(f'   • Memory Used: {cache_data["used_memory"]}')
                self.stdout.write(f'   • Hit Rate: {cache_data["hit_rate"]:.1f}%')
                self.stdout.write(f'   • Connected Clients: {cache_data["connected_clients"]}')

        if 'connections' in report:
            self.stdout.write('\n🔗 CONNECTION POOL:')
            conn_data = report['connections']
            self.stdout.write(f'   • Total Connections: {conn_data["total_connections"]}')
            self.stdout.write(f'   • Active: {conn_data["active_connections"]}')
            self.stdout.write(f'   • Idle: {conn_data["idle_connections"]}')

        if 'system' in report:
            self.stdout.write('\n📈 SYSTEM STATISTICS:')
            sys_data = report['system']
            self.stdout.write(f'   • Total Courses: {sys_data["total_courses"]}')
            self.stdout.write(f'   • Published Courses: {sys_data["published_courses"]}')
            self.stdout.write(f'   • Total Teachers: {sys_data["total_teachers"]}')
            self.stdout.write(f'   • Total Users: {sys_data["total_users"]}')
            self.stdout.write(f'   • Total Enrollments: {sys_data["total_enrollments"]}')

        self.stdout.write('\n' + '='*60)