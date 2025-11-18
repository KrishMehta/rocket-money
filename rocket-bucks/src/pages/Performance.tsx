import { useState, useEffect } from 'react';
import { latencyTracker } from '../utils/latencyTracker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const Performance = () => {
  const [stats, setStats] = useState(latencyTracker.getStats());
  const [breakdownStats, setBreakdownStats] = useState(latencyTracker.getBreakdownStats());
  const [timeWindow, setTimeWindow] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Update stats every 2 seconds
    const interval = setInterval(() => {
      if (timeWindow) {
        setStats(latencyTracker.getStats(timeWindow));
        setBreakdownStats(latencyTracker.getBreakdownStats(timeWindow));
      } else {
        setStats(latencyTracker.getStats());
        setBreakdownStats(latencyTracker.getBreakdownStats());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [timeWindow]);

  const formatLatency = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const clearData = () => {
    if (confirm('Are you sure you want to clear all latency measurements? This cannot be undone.')) {
      latencyTracker.clear();
      setStats(latencyTracker.getStats());
      setBreakdownStats(latencyTracker.getBreakdownStats());
    }
  };

  // Prepare chart data from recent measurements
  const chartData = stats.recentMeasurements.slice(-20).map((m, index) => ({
    index: index + 1,
    total: m.totalLatency,
    accounts: m.accountsLatency,
    transactions: m.transactionsLatency,
    recurring: m.recurringLatency,
    spendingTrends: m.spendingTrendsLatency,
    timestamp: m.timestamp,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Dashboard Load Latency - Key Performance Indicator for Responsiveness
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={timeWindow ? timeWindow.toString() : 'all'}
            onChange={(e) => {
              const value = e.target.value;
              setTimeWindow(value === 'all' ? undefined : parseInt(value));
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Time</option>
            <option value={24 * 60 * 60 * 1000}>Last 24 Hours</option>
            <option value={7 * 24 * 60 * 60 * 1000}>Last 7 Days</option>
            <option value={30 * 24 * 60 * 60 * 1000}>Last 30 Days</option>
          </select>
          <button
            onClick={clearData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Key Metric: Average Latency */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-2">Average Latency</p>
            <h2 className="text-5xl font-bold mb-2">
              {formatLatency(stats.average)}
            </h2>
            <p className="text-blue-100 text-sm">
              Based on {stats.count} measurement{stats.count !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm mb-1">Min: {formatLatency(stats.min)}</p>
            <p className="text-blue-100 text-sm mb-1">Max: {formatLatency(stats.max)}</p>
            <p className="text-blue-100 text-sm">P95: {formatLatency(stats.p95)}</p>
          </div>
        </div>
      </div>

      {/* How We Compute Average Latency */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">How We Compute Average Latency</h2>
        <div className="space-y-3 text-gray-700">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">1.</span>
            <div>
              <p className="font-medium">Measurement:</p>
              <p className="text-sm text-gray-600">
                Every time the Dashboard loads, we measure the total time from when the component starts loading data 
                until all data is fetched and processed (including spending trends calculation).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">2.</span>
            <div>
              <p className="font-medium">Storage:</p>
              <p className="text-sm text-gray-600">
                Each measurement is stored with a timestamp. We keep the last 1,000 measurements for analysis.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">3.</span>
            <div>
              <p className="font-medium">Computation:</p>
              <p className="text-sm text-gray-600">
                Average latency = Sum of all latencies ÷ Number of measurements
              </p>
              <p className="text-sm text-gray-500 mt-1 font-mono">
                {stats.count > 0 
                  ? `Average = ${stats.recentMeasurements.reduce((sum, m) => sum + m.totalLatency, 0).toFixed(0)}ms ÷ ${stats.count} = ${stats.average.toFixed(0)}ms`
                  : 'No measurements yet'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">4.</span>
            <div>
              <p className="font-medium">Percentiles:</p>
              <p className="text-sm text-gray-600">
                We also calculate percentiles (P50, P95, P99) to understand the distribution of latencies. 
                P95 means 95% of requests complete faster than this value.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-1">Minimum</p>
          <p className="text-2xl font-bold text-gray-900">{formatLatency(stats.min)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-1">P50 (Median)</p>
          <p className="text-2xl font-bold text-gray-900">{formatLatency(stats.p50)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-1">P95</p>
          <p className="text-2xl font-bold text-orange-600">{formatLatency(stats.p95)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-1">P99</p>
          <p className="text-2xl font-bold text-red-600">{formatLatency(stats.p99)}</p>
        </div>
      </div>

      {/* Latency Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Latency Trend (Last 20 Measurements)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="index" 
                stroke="#888"
                label={{ value: 'Measurement #', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                stroke="#888"
                label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(0)}ms`}
                labelFormatter={(index) => `Measurement #${index}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Total Latency"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown by API Call */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Breakdown by API Call</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Accounts API</p>
            <p className="text-lg font-bold text-gray-900">{formatLatency(breakdownStats.accounts.average)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Min: {formatLatency(breakdownStats.accounts.min)} | Max: {formatLatency(breakdownStats.accounts.max)}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Transactions API</p>
            <p className="text-lg font-bold text-gray-900">{formatLatency(breakdownStats.transactions.average)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Min: {formatLatency(breakdownStats.transactions.min)} | Max: {formatLatency(breakdownStats.transactions.max)}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Recurring API</p>
            <p className="text-lg font-bold text-gray-900">{formatLatency(breakdownStats.recurring.average)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Min: {formatLatency(breakdownStats.recurring.min)} | Max: {formatLatency(breakdownStats.recurring.max)}
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Spending Trends</p>
            <p className="text-lg font-bold text-gray-900">{formatLatency(breakdownStats.spendingTrends.average)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Min: {formatLatency(breakdownStats.spendingTrends.min)} | Max: {formatLatency(breakdownStats.spendingTrends.max)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Measurements Table */}
      {stats.recentMeasurements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Measurements</h2>
            <p className="text-sm text-gray-600 mt-1">Last 20 dashboard loads</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-600">Timestamp</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-gray-600">Accounts</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-gray-600">Transactions</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-gray-600">Recurring</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-gray-600">Spending Trends</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMeasurements.slice(-20).reverse().map((measurement, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-6 text-sm text-gray-900">
                      {formatDate(measurement.timestamp)}
                    </td>
                    <td className="py-3 px-6 text-sm text-right font-medium text-gray-900">
                      {formatLatency(measurement.totalLatency)}
                    </td>
                    <td className="py-3 px-6 text-sm text-right text-gray-600">
                      {formatLatency(measurement.accountsLatency)}
                    </td>
                    <td className="py-3 px-6 text-sm text-right text-gray-600">
                      {formatLatency(measurement.transactionsLatency)}
                    </td>
                    <td className="py-3 px-6 text-sm text-right text-gray-600">
                      {formatLatency(measurement.recurringLatency)}
                    </td>
                    <td className="py-3 px-6 text-sm text-right text-gray-600">
                      {formatLatency(measurement.spendingTrendsLatency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.count === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-600 mb-4">No latency measurements yet.</p>
          <p className="text-sm text-gray-500">
            Navigate to the Dashboard to start collecting performance data.
          </p>
        </div>
      )}
    </div>
  );
};

export default Performance;

