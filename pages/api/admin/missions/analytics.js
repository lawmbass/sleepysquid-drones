import { loadJobs } from "@/libs/db/jobs";
import { analyticsDateRange, selectAnalyticsJobs, summarizeAnalytics } from "@/libs/jobs";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";

// Apply rate limiting middleware
const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many admin requests. Please wait before trying again.'
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  // Apply rate limiting
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return; // Response already sent by rate limiter
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed'
    });
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // SECURITY: Use NextAuth.js session-based authentication
  const session = await getServerSession(req, res, authOptions);
  
  // Check if user is authenticated
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.'
    });
  }
  
  // Check if user is authorized as admin
  const isAdmin = adminConfig.isAdmin(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Insufficient permissions.'
    });
  }

  try {
    // Extract query parameters for filtering
    const { 
      startDate,
      endDate,
      source,
      status,
      period = 'all'
    } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (source) filters.source = source;
    if (status) filters.status = status;

    const range = (filters.startDate || filters.endDate)
      ? { dateFrom: filters.startDate || null, dateTo: filters.endDate || null }
      : analyticsDateRange(period);
    const jobs = selectAnalyticsJobs(await loadJobs(), {
      period,
      source: filters.source,
      status: filters.status,
      dateFrom: filters.startDate,
      dateTo: filters.endDate,
    });
    const report = summarizeAnalytics(jobs);

    res.status(200).json({
      success: true,
      data: {
        summary: report.summary,
        sourceBreakdown: report.sourceBreakdown,
        timeBasedAnalytics: report.timeBasedAnalytics,
        revenueByMonth: report.revenueByMonth,
        topServices: report.topServices,
        upcomingJobs: report.upcomingJobs,
        performanceMetrics: report.performanceMetrics,
        locationInsights: report.locationInsights,
        filters: {
          startDate: range.dateFrom,
          endDate: range.dateTo,
          source,
          status,
          period
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          currency: 'USD',
          distanceUnit: 'miles',
          timeUnit: 'minutes'
        }
      }
    });

  } catch (error) {
    console.error('Mission analytics error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch mission analytics'
    });
  }
} 