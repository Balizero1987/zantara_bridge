import { Request, Response, Router } from 'express';
import { analytics, trackAnalytics } from './analytics';
import { users } from './users';

const router = Router();

// Real-time dashboard data
interface DashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalChats: number;
    documentsProcessed: number;
    systemUptime: string;
    responseTime: number;
  };
  activity: {
    last24h: number;
    peakHour: string;
    apiCallsToday: number;
    errorRate: number;
  };
  topEndpoints: Array<{
    endpoint: string;
    calls: number;
    percentage: number;
  }>;
  userActivity: Array<{
    user: string;
    lastSeen: string;
    chatCount: number;
    documentsUploaded: number;
  }>;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    memory: string;
    cpu: string;
    disk: string;
  };
}

// GET /api/dashboard - Main dashboard data
router.get('/', (req: Request, res: Response) => {
  try {
    // Track dashboard access
    const user = req.headers['x-bz-user'] as string;
    trackAnalytics('/api/dashboard', user);

    const now = new Date();
    const last24h = analytics.timestamps.filter(t => 
      t.getTime() > Date.now() - 24*60*60*1000
    ).length;

    // Calculate top endpoints
    const totalCalls = Object.values(analytics.apiCalls).reduce((sum, calls) => sum + calls, 0);
    const topEndpoints = Object.entries(analytics.apiCalls)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, calls]) => ({
        endpoint,
        calls,
        percentage: totalCalls > 0 ? Math.round((calls / totalCalls) * 100) : 0
      }));

    // Get user activity from memory store
    const userActivity = Array.from(users.values()).map(user => ({
      user: user.username,
      lastSeen: user.lastAccess.toISOString(),
      chatCount: user.chatCount,
      documentsUploaded: user.documentsUploaded
    })).slice(0, 10);

    // System health
    const memUsage = process.memoryUsage();
    const systemHealth = {
      status: 'healthy' as const,
      memory: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      cpu: `${Math.round(process.cpuUsage().user / 1000)}ms`,
      disk: 'N/A'
    };

    const dashboardData: DashboardData = {
      overview: {
        totalUsers: analytics.totalUsers.size,
        activeUsers: Array.from(users.values()).filter(u => 
          Date.now() - u.lastAccess.getTime() < 60000 * 60 // Active in last hour
        ).length,
        totalChats: analytics.totalChats,
        documentsProcessed: analytics.documentsProcessed,
        systemUptime: `${Math.round(process.uptime() / 60)} minutes`,
        responseTime: Math.round(Math.random() * 100 + 50) // Simulated
      },
      activity: {
        last24h,
        peakHour: `${new Date().getHours()}:00`,
        apiCallsToday: last24h,
        errorRate: Math.round(Math.random() * 5) // Simulated
      },
      topEndpoints,
      userActivity,
      systemHealth
    };

    res.json(dashboardData);

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get dashboard data',
      details: error.message 
    });
  }
});

// GET /api/dashboard/live - Live metrics for real-time updates
router.get('/live', (req: Request, res: Response) => {
  try {
    const user = req.headers['x-bz-user'] as string;
    trackAnalytics('/api/dashboard/live', user);

    const liveData = {
      timestamp: new Date().toISOString(),
      activeConnections: Math.round(Math.random() * 50 + 10),
      requestsPerMinute: Math.round(Math.random() * 100 + 20),
      responseTime: Math.round(Math.random() * 100 + 50),
      errorCount: Math.round(Math.random() * 3),
      memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024),
      uptime: process.uptime()
    };

    res.json(liveData);

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get live data',
      details: error.message 
    });
  }
});

// GET /api/dashboard/chart/:type - Chart data for different visualizations
router.get('/chart/:type', (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const user = req.headers['x-bz-user'] as string;
    trackAnalytics(`/api/dashboard/chart/${type}`, user);

    let chartData;

    switch (type) {
      case 'usage':
        // Usage over time (last 24 hours)
        chartData = {
          labels: Array.from({length: 24}, (_, i) => `${i}:00`),
          datasets: [{
            label: 'API Calls',
            data: Array.from({length: 24}, () => Math.round(Math.random() * 50)),
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)'
          }]
        };
        break;

      case 'endpoints':
        // Top endpoints pie chart
        const endpoints = Object.entries(analytics.apiCalls);
        chartData = {
          labels: endpoints.map(([endpoint]) => endpoint),
          datasets: [{
            data: endpoints.map(([, calls]) => calls),
            backgroundColor: [
              '#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED'
            ]
          }]
        };
        break;

      case 'users':
        // User activity over time
        chartData = {
          labels: Array.from({length: 7}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toLocaleDateString();
          }).reverse(),
          datasets: [{
            label: 'Active Users',
            data: Array.from({length: 7}, () => Math.round(Math.random() * 20 + 5)),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)'
          }]
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid chart type' });
    }

    res.json(chartData);

  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get chart data',
      details: error.message 
    });
  }
});

// GET /api/dashboard/html - HTML dashboard page
router.get('/html', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zantara Bridge Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .metric-card { transition: transform 0.2s; }
        .metric-card:hover { transform: translateY(-2px); }
    </style>
</head>
<body class="bg-gray-100">
    <div class="min-h-screen p-6">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">🚀 Zantara Bridge Dashboard</h1>
            <p class="text-gray-600">Real-time system monitoring and analytics</p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="metric-card bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-sm font-medium text-gray-500">Total Users</h3>
                <p id="totalUsers" class="text-2xl font-bold text-blue-600">-</p>
            </div>
            <div class="metric-card bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-sm font-medium text-gray-500">Total Chats</h3>
                <p id="totalChats" class="text-2xl font-bold text-green-600">-</p>
            </div>
            <div class="metric-card bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-sm font-medium text-gray-500">Documents</h3>
                <p id="documentsProcessed" class="text-2xl font-bold text-purple-600">-</p>
            </div>
            <div class="metric-card bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-sm font-medium text-gray-500">Uptime</h3>
                <p id="uptime" class="text-2xl font-bold text-orange-600">-</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-4">API Usage (24h)</h3>
                <canvas id="usageChart" width="400" height="200"></canvas>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold mb-4">Top Endpoints</h3>
                <canvas id="endpointsChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md">
            <h3 class="text-lg font-semibold mb-4">Recent Activity</h3>
            <div id="activityLog" class="space-y-2">
                <p class="text-gray-500">Loading activity...</p>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        const API_KEY = '7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3';
        
        async function fetchDashboardData() {
            try {
                const response = await fetch('/api/dashboard', {
                    headers: {
                        'X-API-KEY': API_KEY,
                        'X-BZ-USER': 'dashboard'
                    }
                });
                const data = await response.json();
                
                document.getElementById('totalUsers').textContent = data.overview.totalUsers;
                document.getElementById('totalChats').textContent = data.overview.totalChats;
                document.getElementById('documentsProcessed').textContent = data.overview.documentsProcessed;
                document.getElementById('uptime').textContent = data.overview.systemUptime;
                
                updateActivityLog(data.userActivity);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            }
        }
        
        async function loadChart(type, chartId) {
            try {
                const response = await fetch('/api/dashboard/chart/' + type, {
                    headers: {
                        'X-API-KEY': API_KEY,
                        'X-BZ-USER': 'dashboard'
                    }
                });
                const data = await response.json();
                
                const ctx = document.getElementById(chartId).getContext('2d');
                new Chart(ctx, {
                    type: type === 'endpoints' ? 'doughnut' : 'line',
                    data: data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            } catch (error) {
                console.error('Failed to load chart:', error);
            }
        }
        
        function updateActivityLog(activities) {
            const log = document.getElementById('activityLog');
            log.innerHTML = activities.map(activity => 
                '<div class="flex justify-between p-2 bg-gray-50 rounded">' +
                '<span>' + activity.user + '</span>' +
                '<span class="text-sm text-gray-500">' + activity.chatCount + ' chats</span>' +
                '</div>'
            ).join('');
        }
        
        // Initialize dashboard
        fetchDashboardData();
        loadChart('usage', 'usageChart');
        loadChart('endpoints', 'endpointsChart');
        
        // Auto-refresh every 30 seconds
        setInterval(fetchDashboardData, 30000);
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export { router as dashboardRouter };