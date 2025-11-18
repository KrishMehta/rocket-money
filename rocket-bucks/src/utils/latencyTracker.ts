/**
 * Latency tracking utility for measuring dashboard load performance
 * Stores measurements in localStorage for persistence across sessions
 */

interface LatencyMeasurement {
    timestamp: number;
    totalLatency: number;
    accountsLatency: number;
    transactionsLatency: number;
    recurringLatency: number;
    spendingTrendsLatency: number;
  }
  
  interface LatencyStats {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
    recentMeasurements: LatencyMeasurement[];
  }
  
  class LatencyTracker {
    private readonly STORAGE_KEY = 'dashboard_latency_measurements';
    private readonly MAX_STORAGE = 1000; // Keep last 1000 measurements
    
    /**
     * Record a latency measurement
     */
    record(metrics: Omit<LatencyMeasurement, 'timestamp'>): void {
      const measurement: LatencyMeasurement = {
        ...metrics,
        timestamp: Date.now(),
      };
      
      const measurements = this.getMeasurements();
      measurements.push(measurement);
      
      // Keep only recent measurements
      if (measurements.length > this.MAX_STORAGE) {
        measurements.shift();
      }
      
      // Save to localStorage
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(measurements));
      } catch (error) {
        console.error('Failed to save latency measurements:', error);
      }
    }
    
    /**
     * Get all stored measurements
     */
    getMeasurements(): LatencyMeasurement[] {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored) as LatencyMeasurement[];
      } catch (error) {
        console.error('Failed to load latency measurements:', error);
        return [];
      }
    }
    
    /**
     * Get statistics for latency measurements
     */
    getStats(timeWindow?: number): LatencyStats {
      let measurements = this.getMeasurements();
      
      // Filter by time window if provided (in milliseconds)
      // e.g., 24 * 60 * 60 * 1000 for last 24 hours
      if (timeWindow) {
        const cutoff = Date.now() - timeWindow;
        measurements = measurements.filter(m => m.timestamp >= cutoff);
      }
      
      if (measurements.length === 0) {
        return {
          average: 0,
          min: 0,
          max: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          count: 0,
          recentMeasurements: [],
        };
      }
      
      // Sort latencies for percentile calculation
      const latencies = measurements
        .map(m => m.totalLatency)
        .sort((a, b) => a - b);
      
      const sum = latencies.reduce((a, b) => a + b, 0);
      
      // Get recent measurements (last 50)
      const recentMeasurements = measurements
        .slice(-50)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      return {
        average: sum / latencies.length,
        min: latencies[0],
        max: latencies[latencies.length - 1],
        p50: this.percentile(latencies, 50),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99),
        count: latencies.length,
        recentMeasurements,
      };
    }
    
    /**
     * Calculate percentile from sorted array
     */
    private percentile(sortedArray: number[], percentile: number): number {
      if (sortedArray.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
      return sortedArray[Math.max(0, index)];
    }
    
    /**
     * Clear all stored measurements
     */
    clear(): void {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear latency measurements:', error);
      }
    }
    
    /**
     * Get breakdown stats for individual API calls
     */
    getBreakdownStats(timeWindow?: number): {
      accounts: LatencyStats;
      transactions: LatencyStats;
      recurring: LatencyStats;
      spendingTrends: LatencyStats;
    } {
      let measurements = this.getMeasurements();
      
      if (timeWindow) {
        const cutoff = Date.now() - timeWindow;
        measurements = measurements.filter(m => m.timestamp >= cutoff);
      }
      
      const getStatsForField = (field: keyof Omit<LatencyMeasurement, 'timestamp'>): LatencyStats => {
        if (measurements.length === 0) {
          return {
            average: 0,
            min: 0,
            max: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            count: 0,
            recentMeasurements: [],
          };
        }
        
        const latencies = measurements
          .map(m => m[field] as number)
          .sort((a, b) => a - b);
        
        const sum = latencies.reduce((a, b) => a + b, 0);
        
        return {
          average: sum / latencies.length,
          min: latencies[0],
          max: latencies[latencies.length - 1],
          p50: this.percentile(latencies, 50),
          p95: this.percentile(latencies, 95),
          p99: this.percentile(latencies, 99),
          count: latencies.length,
          recentMeasurements: [],
        };
      };
      
      return {
        accounts: getStatsForField('accountsLatency'),
        transactions: getStatsForField('transactionsLatency'),
        recurring: getStatsForField('recurringLatency'),
        spendingTrends: getStatsForField('spendingTrendsLatency'),
      };
    }
  }
  
  // Export singleton instance
  export const latencyTracker = new LatencyTracker();
  