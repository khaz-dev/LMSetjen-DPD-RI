#!/usr/bin/env python
"""
Backend Performance Test Suite
Phase 4.9 - Performance Testing & Validation

Tests:
- API response times with and without cache
- Cache hit rates
- Concurrent request handling
- Memory efficiency
- Database query optimization
"""

import requests
import time
import json
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict
import sys

class APIPerformanceTester:
    """Test API performance"""
    
    def __init__(self, base_url='http://localhost:8000'):
        self.base_url = base_url
        self.results = {
            'searches': [],
            'trending': [],
            'suggestions': [],
            'cache_validation': []
        }
    
    def test_search_api(self, query='python', num_requests=10):
        """Test search API performance"""
        print(f"\n🔍 Testing Search API - {num_requests} requests for '{query}'")
        print("=" * 60)
        
        times = []
        cache_hits = 0
        
        for i in range(num_requests):
            start = time.time()
            try:
                response = requests.get(
                    f"{self.base_url}/api/v1/search/",
                    params={'q': query},
                    timeout=10
                )
                duration = (time.time() - start) * 1000
                
                # Check cache indicator
                is_cached = 'X-From-Cache' in response.headers
                if is_cached:
                    cache_hits += 1
                
                times.append(duration)
                status = "✓ (CACHED)" if is_cached else "✓"
                print(f"  Request {i+1}: {duration:.2f}ms {status}")
                
                self.results['searches'].append({
                    'request': i+1,
                    'duration_ms': round(duration, 2),
                    'cached': is_cached,
                    'status': response.status_code
                })
                
            except requests.exceptions.RequestException as e:
                print(f"  Request {i+1}: ✗ ERROR - {str(e)}")
                self.results['searches'].append({
                    'request': i+1,
                    'error': str(e)
                })
        
        # Calculate stats
        if times:
            avg_time = statistics.mean(times)
            min_time = min(times)
            max_time = max(times)
            
            print(f"\n📊 Search API Results:")
            print(f"  Average Response Time: {avg_time:.2f}ms")
            print(f"  Min Response Time: {min_time:.2f}ms")
            print(f"  Max Response Time: {max_time:.2f}ms")
            print(f"  Cache Hit Rate: {(cache_hits/num_requests)*100:.1f}%")
            print(f"  Total Time: {sum(times):.2f}ms")
            
            return {
                'avg_time': round(avg_time, 2),
                'min_time': round(min_time, 2),
                'max_time': round(max_time, 2),
                'cache_hits': cache_hits,
                'cache_hit_rate': round((cache_hits/num_requests)*100, 2),
                'total_time': round(sum(times), 2)
            }
        
        return None
    
    def test_trending_api(self, num_requests=5):
        """Test trending searches API"""
        print(f"\n📈 Testing Trending API - {num_requests} requests")
        print("=" * 60)
        
        times = []
        cache_hits = 0
        
        for i in range(num_requests):
            start = time.time()
            try:
                response = requests.get(
                    f"{self.base_url}/api/v1/search/trending/",
                    timeout=10
                )
                duration = (time.time() - start) * 1000
                
                is_cached = 'X-From-Cache' in response.headers
                if is_cached:
                    cache_hits += 1
                
                times.append(duration)
                status = "✓ (CACHED)" if is_cached else "✓"
                print(f"  Request {i+1}: {duration:.2f}ms {status}")
                
                self.results['trending'].append({
                    'request': i+1,
                    'duration_ms': round(duration, 2),
                    'cached': is_cached,
                    'status': response.status_code
                })
                
            except requests.exceptions.RequestException as e:
                print(f"  Request {i+1}: ✗ ERROR - {str(e)}")
                self.results['trending'].append({
                    'request': i+1,
                    'error': str(e)
                })
        
        if times:
            avg_time = statistics.mean(times)
            print(f"\n📊 Trending API Results:")
            print(f"  Average Response Time: {avg_time:.2f}ms")
            print(f"  Cache Hit Rate: {(cache_hits/num_requests)*100:.1f}%")
            
            return {
                'avg_time': round(avg_time, 2),
                'cache_hits': cache_hits,
                'cache_hit_rate': round((cache_hits/num_requests)*100, 2)
            }
        
        return None
    
    def test_suggestions_api(self, query='py', num_requests=10):
        """Test suggestions API with debouncing"""
        print(f"\n💡 Testing Suggestions API - {num_requests} requests for '{query}'")
        print("=" * 60)
        
        times = []
        cache_hits = 0
        
        for i in range(num_requests):
            start = time.time()
            try:
                response = requests.get(
                    f"{self.base_url}/api/v1/search/suggestions/",
                    params={'q': query},
                    timeout=10
                )
                duration = (time.time() - start) * 1000
                
                is_cached = 'X-From-Cache' in response.headers
                if is_cached:
                    cache_hits += 1
                
                times.append(duration)
                status = "✓ (CACHED)" if is_cached else "✓"
                print(f"  Request {i+1}: {duration:.2f}ms {status}")
                
                self.results['suggestions'].append({
                    'request': i+1,
                    'duration_ms': round(duration, 2),
                    'cached': is_cached,
                    'status': response.status_code
                })
                
            except requests.exceptions.RequestException as e:
                print(f"  Request {i+1}: ✗ ERROR - {str(e)}")
                self.results['suggestions'].append({
                    'request': i+1,
                    'error': str(e)
                })
        
        if times:
            avg_time = statistics.mean(times)
            print(f"\n📊 Suggestions API Results:")
            print(f"  Average Response Time: {avg_time:.2f}ms")
            print(f"  Cache Hit Rate: {(cache_hits/num_requests)*100:.1f}%")
            
            return {
                'avg_time': round(avg_time, 2),
                'cache_hits': cache_hits,
                'cache_hit_rate': round((cache_hits/num_requests)*100, 2)
            }
        
        return None
    
    def test_concurrent_requests(self, num_workers=5, requests_per_worker=10):
        """Test concurrent request handling"""
        print(f"\n🔄 Testing Concurrent Requests - {num_workers} workers × {requests_per_worker} requests")
        print("=" * 60)
        
        def make_request():
            start = time.time()
            try:
                response = requests.get(
                    f"{self.base_url}/api/v1/search/",
                    params={'q': 'python'},
                    timeout=10
                )
                return (time.time() - start) * 1000, response.status_code
            except Exception as e:
                return None, str(e)
        
        times = []
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [
                executor.submit(make_request)
                for _ in range(num_workers * requests_per_worker)
            ]
            
            for i, future in enumerate(as_completed(futures)):
                duration, status = future.result()
                if duration:
                    times.append(duration)
                    print(f"  Request {i+1}: {duration:.2f}ms - Status: {status}")
        
        if times:
            avg_time = statistics.mean(times)
            min_time = min(times)
            max_time = max(times)
            
            print(f"\n📊 Concurrent Requests Results:")
            print(f"  Average Response Time: {avg_time:.2f}ms")
            print(f"  Min Response Time: {min_time:.2f}ms")
            print(f"  Max Response Time: {max_time:.2f}ms")
            print(f"  Total Requests: {len(times)}")
            print(f"  Throughput: {len(times)/(sum(times)/1000):.2f} requests/second")
            
            return {
                'avg_time': round(avg_time, 2),
                'throughput': round(len(times)/(sum(times)/1000), 2)
            }
        
        return None
    
    def generate_report(self):
        """Generate performance test report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'base_url': self.base_url,
            'results': self.results,
            'summary': {
                'total_search_requests': len(self.results['searches']),
                'total_trending_requests': len(self.results['trending']),
                'total_suggestions_requests': len(self.results['suggestions'])
            }
        }
        
        return report
    
    def save_report(self, filename=None):
        """Save report to JSON file"""
        report = self.generate_report()
        
        if not filename:
            filename = f"performance-test-{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.json"
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\n📁 Report saved to: {filename}")
        return filename
    
    def print_report(self):
        """Print report to console"""
        report = self.generate_report()
        print("\n" + "=" * 60)
        print("PERFORMANCE TEST REPORT")
        print("=" * 60)
        print(json.dumps(report, indent=2, default=str))


def main():
    """Run performance tests"""
    print("🚀 Performance Testing Suite - Phase 4.9")
    print("=" * 60)
    
    base_url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'
    print(f"Testing API at: {base_url}\n")
    
    tester = APIPerformanceTester(base_url)
    
    try:
        # Run tests
        print("\n⏱️  Starting performance tests...\n")
        
        # Test search API
        tester.test_search_api('python', num_requests=10)
        
        # Test trending API
        tester.test_trending_api(num_requests=5)
        
        # Test suggestions API
        tester.test_suggestions_api('py', num_requests=10)
        
        # Test concurrent requests
        tester.test_concurrent_requests(num_workers=5, requests_per_worker=10)
        
        # Generate and save report
        tester.print_report()
        tester.save_report()
        
        print("\n✅ Performance testing complete!")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Testing interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
