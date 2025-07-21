// Metrics API Endpoint - Task 3.4: Monitoring Setup
// Prometheus-compatible metrics endpoint

import { metrics, logger } from '@/lib/observability';

export async function GET({ request }: { request: Request }): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'prometheus';

    logger.debug('Metrics endpoint accessed', { format });

    if (format === 'prometheus') {
      // Prometheus format
      const prometheusMetrics = metrics.exportPrometheusMetrics();
      
      return new Response(prometheusMetrics, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    } else if (format === 'json') {
      // JSON format for custom monitoring tools
      const jsonMetrics = metrics.getCurrentMetrics();
      
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        metrics: jsonMetrics,
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      return new Response(JSON.stringify({
        error: 'Unsupported format',
        supportedFormats: ['prometheus', 'json'],
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    logger.error('Metrics endpoint error', error instanceof Error ? error : new Error(String(error)));
    
    return new Response(JSON.stringify({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}