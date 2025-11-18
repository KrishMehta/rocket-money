import { latencyTracker } from '../utils/latencyTracker';

describe('latencyTracker', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all measurements
    latencyTracker.clear();
  });

  afterEach(() => {
    // Clean up after each test
    latencyTracker.clear();
  });

  describe('record', () => {
    it('records a latency measurement with timestamp', () => {
      const metrics = {
        totalLatency: 100,
        accountsLatency: 20,
        transactionsLatency: 30,
        recurringLatency: 25,
        spendingTrendsLatency: 25,
      };

      latencyTracker.record(metrics);

      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toHaveLength(1);
      expect(measurements[0]).toMatchObject(metrics);
      expect(measurements[0].timestamp).toBeGreaterThan(0);
    });

    it('stores multiple measurements', () => {
      latencyTracker.record({
        totalLatency: 100,
        accountsLatency: 20,
        transactionsLatency: 30,
        recurringLatency: 25,
        spendingTrendsLatency: 25,
      });

      latencyTracker.record({
        totalLatency: 150,
        accountsLatency: 30,
        transactionsLatency: 40,
        recurringLatency: 35,
        spendingTrendsLatency: 45,
      });

      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toHaveLength(2);
    });

    it('limits storage to MAX_STORAGE measurements', () => {
      // Record more than MAX_STORAGE (1000) measurements
      for (let i = 0; i < 1001; i++) {
        latencyTracker.record({
          totalLatency: i,
          accountsLatency: i,
          transactionsLatency: i,
          recurringLatency: i,
          spendingTrendsLatency: i,
        });
      }

      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toHaveLength(1000);
      // Should have kept the most recent ones
      expect(measurements[0].totalLatency).toBe(1); // First one should be the second recorded
      expect(measurements[999].totalLatency).toBe(1000); // Last one should be the most recent
    });

    it('handles localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        latencyTracker.record({
          totalLatency: 100,
          accountsLatency: 20,
          transactionsLatency: 30,
          recurringLatency: 25,
          spendingTrendsLatency: 25,
        });
      }).not.toThrow();

      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });

  describe('getMeasurements', () => {
    it('returns empty array when no measurements exist', () => {
      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toEqual([]);
    });

    it('returns stored measurements', () => {
      const metrics = {
        totalLatency: 100,
        accountsLatency: 20,
        transactionsLatency: 30,
        recurringLatency: 25,
        spendingTrendsLatency: 25,
      };

      latencyTracker.record(metrics);
      const measurements = latencyTracker.getMeasurements();

      expect(measurements).toHaveLength(1);
      expect(measurements[0]).toMatchObject(metrics);
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem('dashboard_latency_measurements', 'invalid json');

      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toEqual([]);
    });

    it('handles localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const measurements = latencyTracker.getMeasurements();
      expect(measurements).toEqual([]);

      // Restore original
      localStorage.getItem = originalGetItem;
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Add some test measurements
      for (let i = 0; i < 10; i++) {
        latencyTracker.record({
          totalLatency: (i + 1) * 10, // 10, 20, 30, ..., 100
          accountsLatency: (i + 1) * 2,
          transactionsLatency: (i + 1) * 3,
          recurringLatency: (i + 1) * 2.5,
          spendingTrendsLatency: (i + 1) * 2.5,
        });
      }
    });

    it('calculates statistics correctly', () => {
      const stats = latencyTracker.getStats();

      expect(stats.count).toBe(10);
      expect(stats.average).toBe(55); // (10+20+...+100)/10 = 55
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.p50).toBeGreaterThanOrEqual(50);
      expect(stats.p95).toBeGreaterThanOrEqual(90);
      expect(stats.p99).toBeGreaterThanOrEqual(99);
      expect(stats.recentMeasurements).toHaveLength(10);
    });

    it('returns zero stats when no measurements exist', () => {
      latencyTracker.clear();
      const stats = latencyTracker.getStats();

      expect(stats).toEqual({
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        recentMeasurements: [],
      });
    });

    it('filters measurements by time window', () => {
      const now = Date.now();
      
      // Add old measurement (more than 24 hours ago)
      const oldTimestamp = now - (25 * 60 * 60 * 1000);
      const oldMeasurement = {
        timestamp: oldTimestamp,
        totalLatency: 5,
        accountsLatency: 1,
        transactionsLatency: 1,
        recurringLatency: 1,
        spendingTrendsLatency: 2,
      };
      const measurements = latencyTracker.getMeasurements();
      measurements.push(oldMeasurement);
      localStorage.setItem('dashboard_latency_measurements', JSON.stringify(measurements));

      const stats = latencyTracker.getStats(24 * 60 * 60 * 1000); // Last 24 hours
      
      // Should only include the 10 recent measurements, not the old one
      expect(stats.count).toBe(10);
      expect(stats.min).toBeGreaterThanOrEqual(10);
    });

    it('returns recent measurements sorted by timestamp descending', () => {
      const stats = latencyTracker.getStats();

      expect(stats.recentMeasurements.length).toBeGreaterThan(0);
      // Check that timestamps are in descending order
      for (let i = 1; i < stats.recentMeasurements.length; i++) {
        expect(stats.recentMeasurements[i - 1].timestamp).toBeGreaterThanOrEqual(
          stats.recentMeasurements[i].timestamp,
        );
      }
    });

    it('limits recent measurements to 50', () => {
      // Add 60 measurements
      for (let i = 0; i < 60; i++) {
        latencyTracker.record({
          totalLatency: i,
          accountsLatency: i,
          transactionsLatency: i,
          recurringLatency: i,
          spendingTrendsLatency: i,
        });
      }

      const stats = latencyTracker.getStats();
      expect(stats.recentMeasurements).toHaveLength(50);
    });
  });

  describe('percentile calculation', () => {
    it('calculates p50 (median) correctly', () => {
      // Add 5 measurements: 10, 20, 30, 40, 50
      for (let i = 1; i <= 5; i++) {
        latencyTracker.record({
          totalLatency: i * 10,
          accountsLatency: i,
          transactionsLatency: i,
          recurringLatency: i,
          spendingTrendsLatency: i,
        });
      }

      const stats = latencyTracker.getStats();
      expect(stats.p50).toBe(30); // Median of [10, 20, 30, 40, 50]
    });

    it('calculates p95 correctly', () => {
      // Add 20 measurements
      for (let i = 1; i <= 20; i++) {
        latencyTracker.record({
          totalLatency: i * 10,
          accountsLatency: i,
          transactionsLatency: i,
          recurringLatency: i,
          spendingTrendsLatency: i,
        });
      }

      const stats = latencyTracker.getStats();
      // p95 should be close to the 95th percentile value
      expect(stats.p95).toBeGreaterThanOrEqual(190);
    });

    it('handles empty array in percentile calculation', () => {
      latencyTracker.clear();
      const stats = latencyTracker.getStats();
      expect(stats.p50).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all stored measurements', () => {
      latencyTracker.record({
        totalLatency: 100,
        accountsLatency: 20,
        transactionsLatency: 30,
        recurringLatency: 25,
        spendingTrendsLatency: 25,
      });

      expect(latencyTracker.getMeasurements()).toHaveLength(1);

      latencyTracker.clear();

      expect(latencyTracker.getMeasurements()).toHaveLength(0);
      expect(localStorage.getItem('dashboard_latency_measurements')).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
      // Mock localStorage.removeItem to throw an error
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => {
        latencyTracker.clear();
      }).not.toThrow();

      // Restore original
      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('getBreakdownStats', () => {
    beforeEach(() => {
      // Add test measurements with different latencies for each field
      latencyTracker.record({
        totalLatency: 100,
        accountsLatency: 10,
        transactionsLatency: 20,
        recurringLatency: 30,
        spendingTrendsLatency: 40,
      });

      latencyTracker.record({
        totalLatency: 200,
        accountsLatency: 20,
        transactionsLatency: 40,
        recurringLatency: 60,
        spendingTrendsLatency: 80,
      });
    });

    it('returns breakdown stats for each API call type', () => {
      const breakdown = latencyTracker.getBreakdownStats();

      expect(breakdown.accounts.count).toBe(2);
      expect(breakdown.accounts.average).toBe(15); // (10 + 20) / 2
      expect(breakdown.accounts.min).toBe(10);
      expect(breakdown.accounts.max).toBe(20);

      expect(breakdown.transactions.count).toBe(2);
      expect(breakdown.transactions.average).toBe(30); // (20 + 40) / 2
      expect(breakdown.transactions.min).toBe(20);
      expect(breakdown.transactions.max).toBe(40);

      expect(breakdown.recurring.count).toBe(2);
      expect(breakdown.recurring.average).toBe(45); // (30 + 60) / 2

      expect(breakdown.spendingTrends.count).toBe(2);
      expect(breakdown.spendingTrends.average).toBe(60); // (40 + 80) / 2
    });

    it('returns zero stats when no measurements exist', () => {
      latencyTracker.clear();
      const breakdown = latencyTracker.getBreakdownStats();

      expect(breakdown.accounts.count).toBe(0);
      expect(breakdown.transactions.count).toBe(0);
      expect(breakdown.recurring.count).toBe(0);
      expect(breakdown.spendingTrends.count).toBe(0);
    });

    it('filters measurements by time window', () => {
      const now = Date.now();
      
      // Add old measurement
      const oldTimestamp = now - (25 * 60 * 60 * 1000);
      const oldMeasurement = {
        timestamp: oldTimestamp,
        totalLatency: 5,
        accountsLatency: 1,
        transactionsLatency: 1,
        recurringLatency: 1,
        spendingTrendsLatency: 2,
      };
      const measurements = latencyTracker.getMeasurements();
      measurements.push(oldMeasurement);
      localStorage.setItem('dashboard_latency_measurements', JSON.stringify(measurements));

      const breakdown = latencyTracker.getBreakdownStats(24 * 60 * 60 * 1000);
      
      // Should only include the 2 recent measurements
      expect(breakdown.accounts.count).toBe(2);
    });

    it('calculates percentiles for each field', () => {
      // Add more measurements for better percentile testing
      for (let i = 3; i <= 10; i++) {
        latencyTracker.record({
          totalLatency: i * 10,
          accountsLatency: i,
          transactionsLatency: i * 2,
          recurringLatency: i * 3,
          spendingTrendsLatency: i * 4,
        });
      }

      const breakdown = latencyTracker.getBreakdownStats();

      expect(breakdown.accounts.p50).toBeGreaterThan(0);
      expect(breakdown.accounts.p95).toBeGreaterThan(0);
      expect(breakdown.accounts.p99).toBeGreaterThan(0);

      expect(breakdown.transactions.p50).toBeGreaterThan(0);
      expect(breakdown.recurring.p50).toBeGreaterThan(0);
      expect(breakdown.spendingTrends.p50).toBeGreaterThan(0);
    });
  });
});

