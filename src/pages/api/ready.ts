// Readiness Check API Endpoint - Task 3.4: Monitoring Setup
// Kubernetes-style readiness probe endpoint

import { handleReadinessCheck, logger } from '@/lib/observability';

export async function GET(): Promise<Response> {
  try {
    return await handleReadinessCheck();
  } catch (error) {
    logger.error('Readiness check error', error instanceof Error ? error : new Error(String(error)));
    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

export async function HEAD(): Promise<Response> {
  try {
    const response = await handleReadinessCheck();
    return new Response(null, {
      status: response.status,
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
    });
  }
}