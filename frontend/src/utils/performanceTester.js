/**
 * Frontend Performance Testing Utility
 * Phase 4.9 - Performance Testing & Validation
 * 
 * Measures:
 * - API call count and timing
 * - Memory usage
 * - FPS during interactions
 * - Network performance
 */

class PerformanceTester {
  constructor() {
    this.metrics = {
      apiCalls: [],
      memorySnapshots: [],
      networkEvents: [],
      fpsSamples: [],
      componentRenderTimes: [],
      scrollPerformance: []
    };
    this.isMonitoring = false;
  }

  /**
   * Start monitoring API calls
   */
  startAPIMonitoring() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const [resource, config] = args;
      
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;
        
        this.metrics.apiCalls.push({
          url: resource,
          method: config?.method || 'GET',
          duration: duration.toFixed(2),
          status: response.status,
          timestamp: new Date().toISOString(),
          cached: response.headers.get('X-From-Cache') === 'true'
        });
        
        console.log(`API Call: ${resource} - ${duration.toFixed(2)}ms`);
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.metrics.apiCalls.push({
          url: resource,
          method: config?.method || 'GET',
          duration: duration.toFixed(2),
          status: 'ERROR',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };
  }

  /**
   * Measure memory usage
   */
  measureMemory() {
    if (performance.memory) {
      const memory = {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
        timestamp: new Date().toISOString()
      };
      this.metrics.memorySnapshots.push(memory);
      return memory;
    }
    return null;
  }

  /**
   * Monitor FPS during interactions
   */
  measureFPS(duration = 5000) {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();
      
      const countFrame = () => {
        frameCount++;
        const elapsed = performance.now() - startTime;
        
        if (elapsed < duration) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = (frameCount / (elapsed / 1000)).toFixed(2);
          this.metrics.fpsSamples.push({
            fps: fps,
            frameCount: frameCount,
            duration: elapsed.toFixed(2),
            timestamp: new Date().toISOString()
          });
          resolve({
            fps: fps,
            frameCount: frameCount,
            duration: elapsed.toFixed(2)
          });
        }
      };
      
      requestAnimationFrame(countFrame);
    });
  }

  /**
   * Measure scroll performance
   */
  async measureScrollPerformance(scrollContainer, scrollDistance = 500) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let framesDuringScroll = 0;
      const frameStartTime = performance.now();
      
      const countFrame = () => {
        framesDuringScroll++;
        if (scrollContainer.scrollTop < scrollDistance) {
          scrollContainer.scrollTop += 10;
          requestAnimationFrame(countFrame);
        } else {
          const duration = performance.now() - startTime;
          const fps = (framesDuringScroll / (duration / 1000)).toFixed(2);
          
          this.metrics.scrollPerformance.push({
            fps: fps,
            frameCount: framesDuringScroll,
            duration: duration.toFixed(2),
            scrollDistance: scrollDistance,
            timestamp: new Date().toISOString()
          });
          
          resolve({
            fps: fps,
            frameCount: framesDuringScroll,
            duration: duration.toFixed(2)
          });
        }
      };
      
      requestAnimationFrame(countFrame);
    });
  }

  /**
   * Measure component render time
   */
  measureComponentRender(componentName, renderFunction) {
    const startTime = performance.now();
    const result = renderFunction();
    const duration = performance.now() - startTime;
    
    this.metrics.componentRenderTimes.push({
      component: componentName,
      duration: duration.toFixed(2),
      timestamp: new Date().toISOString()
    });
    
    return { result, duration: duration.toFixed(2) };
  }

  /**
   * Get API call statistics
   */
  getAPIStats() {
    const calls = this.metrics.apiCalls;
    if (calls.length === 0) return null;
    
    const totalDuration = calls.reduce((sum, call) => sum + parseFloat(call.duration), 0);
    const avgDuration = (totalDuration / calls.length).toFixed(2);
    const cacheSavings = calls.filter(c => c.cached).length;
    
    return {
      totalCalls: calls.length,
      totalDuration: totalDuration.toFixed(2),
      avgDuration: avgDuration,
      fastestCall: Math.min(...calls.map(c => parseFloat(c.duration))).toFixed(2),
      slowestCall: Math.max(...calls.map(c => parseFloat(c.duration))).toFixed(2),
      cachedCalls: cacheSavings,
      uncachedCalls: calls.length - cacheSavings,
      cacheHitRate: ((cacheSavings / calls.length) * 100).toFixed(2)
    };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    const snapshots = this.metrics.memorySnapshots;
    if (snapshots.length === 0) return null;
    
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    return {
      initialMemory: firstSnapshot,
      finalMemory: lastSnapshot,
      memoryGrowth: (
        parseFloat(lastSnapshot.usedJSHeapSize) - parseFloat(firstSnapshot.usedJSHeapSize)
      ).toFixed(2),
      snapshotCount: snapshots.length
    };
  }

  /**
   * Get FPS statistics
   */
  getFPSStats() {
    const samples = this.metrics.fpsSamples;
    if (samples.length === 0) return null;
    
    const fpsValues = samples.map(s => parseFloat(s.fps));
    const avgFps = (fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length).toFixed(2);
    
    return {
      averageFPS: avgFps,
      minFPS: Math.min(...fpsValues).toFixed(2),
      maxFPS: Math.max(...fpsValues).toFixed(2),
      sampleCount: samples.length,
      samples: samples
    };
  }

  /**
   * Get scroll performance statistics
   */
  getScrollStats() {
    const scrollMetrics = this.metrics.scrollPerformance;
    if (scrollMetrics.length === 0) return null;
    
    const fpsValues = scrollMetrics.map(m => parseFloat(m.fps));
    const avgFps = (fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length).toFixed(2);
    
    return {
      averageFPS: avgFps,
      minFPS: Math.min(...fpsValues).toFixed(2),
      maxFPS: Math.max(...fpsValues).toFixed(2),
      measurements: scrollMetrics.length,
      metrics: scrollMetrics
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      apiStats: this.getAPIStats(),
      memoryStats: this.getMemoryStats(),
      fpsStats: this.getFPSStats(),
      scrollStats: this.getScrollStats(),
      componentRenderTimes: this.metrics.componentRenderTimes,
      rawMetrics: this.metrics
    };
  }

  /**
   * Export report to JSON
   */
  exportReport(filename = 'performance-report.json') {
    const report = this.generateReport();
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Print report to console
   */
  printReport() {
    const report = this.generateReport();
    console.log('=== PERFORMANCE REPORT ===');
    console.log('API Statistics:', report.apiStats);
    console.log('Memory Statistics:', report.memoryStats);
    console.log('FPS Statistics:', report.fpsStats);
    console.log('Scroll Performance:', report.scrollStats);
    console.log('Full Report:', report);
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      apiCalls: [],
      memorySnapshots: [],
      networkEvents: [],
      fpsSamples: [],
      componentRenderTimes: [],
      scrollPerformance: []
    };
  }
}

// Export for use
window.PerformanceTester = PerformanceTester;

/**
 * Usage Example:
 * 
 * const tester = new PerformanceTester();
 * tester.startAPIMonitoring();
 * ester.measureMemory();
 * await tester.measureFPS(5000);
 * await tester.measureScrollPerformance(document.querySelector('.results-container'));
 * tester.printReport();
 * tester.exportReport();
 */
