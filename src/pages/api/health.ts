// Health Check API Endpoint - Task 3.4: Monitoring Setup
// Comprehensive health monitoring endpoint for uptime monitoring

import { handleHealthCheck, logger } from '@/lib/observability';

export async function GET({ request }: { request: Request }): Promise<Response> {
  try {
    return await handleHealthCheck(request);
  } catch (error) {
    logger.error('Health check endpoint error', error instanceof Error ? error : new Error(String(error)));
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Health check execution failed',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Support for HEAD requests (commonly used by load balancers)
export async function HEAD({ request }: { request: Request }): Promise<Response> {
  try {
    const response = await handleHealthCheck(request);
    return new Response(null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
    });
  }
}