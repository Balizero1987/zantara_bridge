import { Request, Response, Router } from 'express';

const router = Router();

interface Analytics {
  totalChats: number;
  totalUsers: Set<string>;
  documentsProcessed: number;
  apiCalls: { [endpoint: string]: number };
  timestamps: Date[];
}

const analytics: Analytics = {
  totalChats: 0,
  totalUsers: new Set(),
  documentsProcessed: 0,
  apiCalls: {},
  timestamps: []
};

// Track analytics
function trackAnalytics(endpoint: string, user?: string) {
  analytics.apiCalls[endpoint] = (analytics.apiCalls[endpoint] || 0) + 1;
  analytics.timestamps.push(new Date());
  if (user) analytics.totalUsers.add(user);
  if (endpoint === '/api/chat') analytics.totalChats++;
}

// Track document processing
function trackDocument() {
  analytics.documentsProcessed++;
}

// GET /api/analytics
router.get('/', (req: Request, res: Response) => {
  const last24h = analytics.timestamps.filter(t => 
    t.getTime() > Date.now() - 24*60*60*1000
  ).length;

  res.json({
    totalChats: analytics.totalChats,
    uniqueUsers: analytics.totalUsers.size,
    documentsProcessed: analytics.documentsProcessed,
    apiCalls: analytics.apiCalls,
    last24h,
    uptime: process.uptime(),
    version: '2.1.0-enhanced'
  });
});

// GET /api/analytics/export
router.get('/export', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=zantara-analytics.csv');
  
  const csv = [
    'Endpoint,Calls,LastAccess',
    ...Object.entries(analytics.apiCalls).map(([endpoint, calls]) => 
      `${endpoint},${calls},${new Date().toISOString()}`
    )
  ].join('\n');
  
  res.send(csv);
});

// GET /api/analytics/reset (admin only)
router.post('/reset', (req: Request, res: Response) => {
  analytics.totalChats = 0;
  analytics.totalUsers.clear();
  analytics.documentsProcessed = 0;
  analytics.apiCalls = {};
  analytics.timestamps = [];
  
  res.json({ message: 'Analytics reset successfully' });
});

export { router as analyticsRouter, analytics, trackAnalytics, trackDocument };