'use client';

import { useState, useEffect } from 'react';
import { warmupAPI } from '@/utils/warmup';

interface WarmupResult {
  route: string;
  success: boolean;
  duration: number;
  timestamp: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: string;
  environment: string;
  version: string;
}

export default function WarmupMonitorPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [warmupResults, setWarmupResults] = useState<WarmupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthData(data);
      setLastCheck(new Date().toISOString());
    } catch (error) {
      console.error('Failed to check health:', error);
    }
  };

  const runWarmup = async () => {
    setIsLoading(true);
    try {
      const routes = ['/api/health', '/api/warmup'];
      const results = await warmupAPI(routes);
      setWarmupResults(results);
    } catch (error) {
      console.error('Warmup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkServerWarmup = async () => {
    try {
      const response = await fetch('/api/warmup');
      const data = await response.json();
      console.log('Server warmup result:', data);
    } catch (error) {
      console.error('Server warmup failed:', error);
    }
  };

  useEffect(() => {
    checkHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔥 Warmup Monitor</h1>
        <p className="text-gray-600">Monitor and control your Vercel cold start prevention system</p>
      </div>

      {/* Health Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🏥 Health Status</h2>
          <button
            onClick={checkHealth}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
        
        {healthData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Status</div>
              <div className="font-semibold text-green-600">
                {healthData.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Uptime</div>
              <div className="font-semibold">{healthData.uptime}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Environment</div>
              <div className="font-semibold">{healthData.environment}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Version</div>
              <div className="font-semibold">{healthData.version}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading health data...</div>
        )}
        
        {lastCheck && (
          <div className="mt-4 text-sm text-gray-500">
            Last checked: {new Date(lastCheck).toLocaleString()}
          </div>
        )}
      </div>

      {/* Warmup Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">🌡️ Warmup Controls</h2>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={runWarmup}
            disabled={isLoading}
            className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? '🔄 Running...' : '🔥 Run Client Warmup'}
          </button>
          
          <button
            onClick={checkServerWarmup}
            className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          >
            🖥️ Test Server Warmup
          </button>
        </div>

        {warmupResults.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Latest Warmup Results:</h3>
            <div className="space-y-2">
              {warmupResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    result.success 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{result.route}</span>
                    <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.success ? '✅' : '❌'} {result.duration}ms
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(result.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Vercel Cron Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">⏰ Automated Warmup Schedule</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
            <div>
              <div className="font-medium">Health Check</div>
              <div className="text-sm text-gray-600">Keeps basic health endpoint warm</div>
            </div>
            <div className="text-sm font-mono bg-blue-100 px-2 py-1 rounded">
              Every 1 minute
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
            <div>
              <div className="font-medium">Full Warmup</div>
              <div className="text-sm text-gray-600">Warms all configured API routes</div>
            </div>
            <div className="text-sm font-mono bg-orange-100 px-2 py-1 rounded">
              Every 1 minute
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            💡 <strong>Note:</strong> Vercel cron jobs automatically call your endpoints to prevent cold starts. 
            You can monitor the effectiveness in your Vercel dashboard under Functions → Logs.
          </div>
        </div>
      </div>
    </div>
  );
} 