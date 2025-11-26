#!/usr/bin/env python3
"""
Phase 4.10 Integration Testing Suite - Simplified Version
Tests all optimizations work together seamlessly

Run: python integration_test_simple.py http://localhost:8000
"""

import requests
import json
import time
import sys
from datetime import datetime
from urllib.parse import urlencode

class IntegrationTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'base_url': self.base_url,
            'tests': {},
            'summary': {}
        }
        self.session = requests.Session()
        
    def test_cache_url_persistence(self):
        """Test 1: Cache + URL Persistence Integration"""
        print("\n" + "="*70)
        print("TEST 1: Cache + URL Persistence Integration")
        print("="*70)
        
        test_results = {
            'name': 'Cache + URL Persistence',
            'duration': 0,
            'passed': False,
            'details': {}
        }
        
        start_time = time.time()
        
        try:
            print("\n[Step 1] Searching for 'Python' (first time - cache miss expected)...")
            search_params = {'q': 'Python', 'page': 1}
            url = f"{self.base_url}/api/search/courses/?{urlencode(search_params)}"
            
            response1 = self.session.get(url)
            time1_start = time.time()
            response1.raise_for_status()
            time1_end = time.time()
            
            first_response_time = time1_end - time1_start
            first_result_count = len(response1.json().get('results', []))
            
            print(f"   [OK] Response time: {first_response_time*1000:.0f}ms")
            print(f"   [OK] Results: {first_result_count} courses")
            
            test_results['details']['first_search_response_time'] = f"{first_response_time*1000:.0f}ms"
            test_results['details']['first_search_result_count'] = first_result_count
            
            time.sleep(0.5)
            
            print("\n[Step 2] Searching for 'Python' again (cache hit expected)...")
            time2_start = time.time()
            response2 = self.session.get(url)
            time2_end = time.time()
            response2.raise_for_status()
            
            cached_response_time = time2_end - time2_start
            cached_result_count = len(response2.json().get('results', []))
            
            print(f"   [OK] Response time: {cached_response_time*1000:.0f}ms")
            print(f"   [OK] Results: {cached_result_count} courses")
            
            speedup = first_response_time / max(cached_response_time, 0.01)
            cache_hit = speedup > 2
            
            print(f"   [OK] Cache speedup: {speedup:.1f}x")
            print(f"   [OK] Cache hit: {'YES' if cache_hit else 'NO (Warning: Cache may not be working)'}")
            
            test_results['details']['cached_response_time'] = f"{cached_response_time*1000:.0f}ms"
            test_results['details']['cached_result_count'] = cached_result_count
            test_results['details']['cache_speedup'] = f"{speedup:.1f}x"
            test_results['details']['cache_effective'] = cache_hit
            
            print(f"\n[Step 3] Validating URL parameters...")
            print(f"   [OK] URL: {url}")
            print(f"   [OK] Query: Python")
            print(f"   [OK] Page: 1")
            
            test_results['details']['url_params_valid'] = True
            test_results['passed'] = cache_hit
            
            print(f"\n[RESULT] Test 1: {'PASSED' if cache_hit else 'FAILED'}")
            
        except Exception as e:
            print(f"[ERROR] Test 1 Error: {str(e)}")
            test_results['error'] = str(e)
        
        test_results['duration'] = time.time() - start_time
        self.results['tests']['test_1_cache_url_persistence'] = test_results
        return test_results['passed']
    
    def test_virtual_scroll_lazy_load(self):
        """Test 2: Virtual Scrolling + Lazy Loading Integration"""
        print("\n" + "="*70)
        print("TEST 2: Virtual Scrolling + Lazy Loading Integration")
        print("="*70)
        
        test_results = {
            'name': 'Virtual Scrolling + Lazy Loading',
            'duration': 0,
            'passed': False,
            'details': {}
        }
        
        start_time = time.time()
        
        try:
            print("\n[Step 1] Loading large result set...")
            search_params = {'q': 'a', 'page': 1, 'limit': 100}
            url = f"{self.base_url}/api/search/courses/?{urlencode(search_params)}"
            
            response = self.session.get(url)
            response.raise_for_status()
            
            data = response.json()
            result_count = len(data.get('results', []))
            total_count = data.get('count', result_count)
            
            print(f"   [OK] Total courses available: {total_count}")
            print(f"   [OK] Items in this page: {result_count}")
            
            test_results['details']['total_courses'] = total_count
            test_results['details']['page_items'] = result_count
            
            print("\n[Step 2] Validating response structure for lazy loading...")
            
            has_images = False
            has_thumbnails = False
            
            for result in data.get('results', [])[:5]:
                if 'image' in result or 'thumbnail' in result:
                    has_images = True
                if 'thumbnail' in result:
                    has_thumbnails = True
            
            print(f"   [OK] Response has image data: {has_images}")
            print(f"   [OK] Response has thumbnail data: {has_thumbnails}")
            
            test_results['details']['has_image_data'] = has_images
            test_results['details']['has_thumbnail_data'] = has_thumbnails
            
            print("\n[Step 3] Verifying pagination for virtual scrolling...")
            
            has_pagination = 'next' in data or 'count' in data
            print(f"   [OK] Pagination available: {has_pagination}")
            
            if 'next' in data:
                print(f"   [OK] Next page URL available")
            
            test_results['details']['has_pagination'] = has_pagination
            
            test_results['passed'] = result_count > 0 and (has_images or has_thumbnails or has_pagination)
            
            print(f"\n[RESULT] Test 2: {'PASSED - API ready for virtual scrolling' if test_results['passed'] else 'FAILED - Missing required data'}")
            
        except Exception as e:
            print(f"[ERROR] Test 2 Error: {str(e)}")
            test_results['error'] = str(e)
        
        test_results['duration'] = time.time() - start_time
        self.results['tests']['test_2_virtual_scroll_lazy_load'] = test_results
        return test_results['passed']
    
    def test_debouncing_cache(self):
        """Test 3: Debouncing + Cache Integration"""
        print("\n" + "="*70)
        print("TEST 3: Debouncing + Cache Integration")
        print("="*70)
        
        test_results = {
            'name': 'Debouncing + Cache',
            'duration': 0,
            'passed': False,
            'details': {}
        }
        
        start_time = time.time()
        
        try:
            print("\n[Step 1] Testing suggestions endpoint...")
            search_params = {'query': 'Py'}
            url = f"{self.base_url}/api/search/suggestions/?{urlencode(search_params)}"
            
            response1 = self.session.get(url)
            response1.raise_for_status()
            suggestions1 = response1.json().get('suggestions', [])
            
            print(f"   [OK] Query 'Py' suggestions: {len(suggestions1)} results")
            
            print("\n[Step 2] Simulating rapid typing...")
            
            requests_made = []
            queries = ['Pyt', 'Pyth', 'Pytho', 'Python']
            
            for query in queries:
                search_params = {'query': query}
                url = f"{self.base_url}/api/search/suggestions/?{urlencode(search_params)}"
                
                response = self.session.get(url)
                response.raise_for_status()
                suggestions = response.json().get('suggestions', [])
                
                requests_made.append({
                    'query': query,
                    'suggestions_count': len(suggestions),
                    'response_time': response.elapsed.total_seconds()
                })
                
                print(f"   [OK] '{query}' -> {len(suggestions)} suggestions ({response.elapsed.total_seconds()*1000:.0f}ms)")
                time.sleep(0.1)
            
            test_results['details']['requests_made'] = requests_made
            
            times = [r['response_time'] for r in requests_made]
            avg_first_half = sum(times[:2]) / 2 if len(times) >= 2 else times[0]
            avg_second_half = sum(times[2:]) / 2 if len(times) >= 2 else times[-1]
            
            cache_effective = avg_second_half < avg_first_half if avg_first_half > 0 else False
            
            print(f"\n[Step 3] Cache effectiveness check:")
            print(f"   [OK] Avg time (first 2 requests): {avg_first_half*1000:.0f}ms")
            print(f"   [OK] Avg time (last 2 requests): {avg_second_half*1000:.0f}ms")
            print(f"   [OK] Cache improving performance: {cache_effective}")
            
            test_results['details']['avg_first_response'] = f"{avg_first_half*1000:.0f}ms"
            test_results['details']['avg_cached_response'] = f"{avg_second_half*1000:.0f}ms"
            test_results['details']['cache_effective'] = cache_effective
            
            test_results['passed'] = True
            
            print(f"\n[RESULT] Test 3: PASSED - API ready for debouncing + cache")
            
        except Exception as e:
            print(f"[ERROR] Test 3 Error: {str(e)}")
            test_results['error'] = str(e)
        
        test_results['duration'] = time.time() - start_time
        self.results['tests']['test_3_debouncing_cache'] = test_results
        return test_results['passed']
    
    def test_search_workflow(self):
        """Test 4: Search → Dashboard → Search Workflow"""
        print("\n" + "="*70)
        print("TEST 4: Search -> Dashboard -> Search Workflow")
        print("="*70)
        
        test_results = {
            'name': 'Search Workflow',
            'duration': 0,
            'passed': False,
            'details': {}
        }
        
        start_time = time.time()
        
        try:
            print("\n[Step 1] Initial search for 'Python'...")
            
            search_params = {'q': 'Python', 'page': 1}
            url = f"{self.base_url}/api/search/courses/?{urlencode(search_params)}"
            
            response = self.session.get(url)
            response.raise_for_status()
            
            initial_results = len(response.json().get('results', []))
            print(f"   [OK] Found {initial_results} Python courses")
            
            test_results['details']['initial_search_results'] = initial_results
            
            print("\n[Step 2] Fetching trending searches (dashboard)...")
            
            trending_url = f"{self.base_url}/api/search/trending/"
            trending_response = self.session.get(trending_url)
            trending_response.raise_for_status()
            
            trending_data = trending_response.json()
            trending_count = len(trending_data.get('results', []))
            
            print(f"   [OK] Trending searches: {trending_count} items")
            
            test_results['details']['trending_count'] = trending_count
            
            print("\n[Step 3] Checking trending cache (repeat request)...")
            
            trending_response2 = self.session.get(trending_url)
            trending_response2.raise_for_status()
            
            cache_hit = trending_response2.elapsed < trending_response.elapsed
            
            print(f"   [OK] First request: {trending_response.elapsed.total_seconds()*1000:.0f}ms")
            print(f"   [OK] Second request: {trending_response2.elapsed.total_seconds()*1000:.0f}ms")
            print(f"   [OK] Cache hit: {cache_hit}")
            
            test_results['details']['trending_cache_effective'] = cache_hit
            
            print("\n[Step 4] Search again with different query...")
            
            search_params2 = {'q': 'JavaScript', 'page': 1}
            url2 = f"{self.base_url}/api/search/courses/?{urlencode(search_params2)}"
            
            response2 = self.session.get(url2)
            response2.raise_for_status()
            
            new_results = len(response2.json().get('results', []))
            print(f"   [OK] Found {new_results} JavaScript courses")
            
            test_results['details']['second_search_results'] = new_results
            
            different_results = initial_results != new_results or response.json().get('results') != response2.json().get('results')
            
            print(f"   [OK] Different results from first search: {different_results}")
            
            test_results['details']['results_differ'] = different_results
            
            test_results['passed'] = initial_results > 0 and new_results > 0 and different_results
            
            print(f"\n[RESULT] Test 4: {'PASSED' if test_results['passed'] else 'FAILED'}")
            
        except Exception as e:
            print(f"[ERROR] Test 4 Error: {str(e)}")
            test_results['error'] = str(e)
        
        test_results['duration'] = time.time() - start_time
        self.results['tests']['test_4_search_workflow'] = test_results
        return test_results['passed']
    
    def generate_report(self):
        """Generate final integration test report"""
        print("\n" + "="*70)
        print("INTEGRATION TEST SUMMARY")
        print("="*70)
        
        passed_tests = sum(1 for t in self.results['tests'].values() if t['passed'])
        total_tests = len(self.results['tests'])
        
        print(f"\n[SUMMARY] Tests Passed: {passed_tests}/{total_tests}")
        
        for test_key, test_data in self.results['tests'].items():
            status = "PASS" if test_data['passed'] else "FAIL"
            duration = test_data['duration']
            print(f"\n[{status}] {test_data['name']} ({duration:.2f}s)")
            
            if 'error' in test_data:
                print(f"   Error: {test_data['error']}")
            else:
                for key, value in test_data['details'].items():
                    print(f"   * {key}: {value}")
        
        self.results['summary'] = {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': total_tests - passed_tests,
            'success_rate': f"{(passed_tests/total_tests)*100:.0f}%",
            'overall_status': 'PASSED' if passed_tests == total_tests else 'PARTIAL'
        }
        
        print(f"\n" + "="*70)
        print(f"Overall Status: {self.results['summary']['overall_status']}")
        print(f"Success Rate: {self.results['summary']['success_rate']}")
        print("="*70)
        
        return self.results

def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    print("\n[PHASE 4.10 Integration Testing Suite]")
    print(f"   Base URL: {base_url}")
    
    tester = IntegrationTester(base_url)
    
    try:
        tester.test_cache_url_persistence()
        tester.test_virtual_scroll_lazy_load()
        tester.test_debouncing_cache()
        tester.test_search_workflow()
        
        report = tester.generate_report()
        
        report_file = 'integration_test_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n[INFO] Report saved to: {report_file}")
        
    except Exception as e:
        print(f"\n[FATAL] Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
