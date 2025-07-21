// Cloudflare Worker for R2 signed URL generation
// Handles secure access to PDF reports stored in R2

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Extract operation from path
      const pathParts = pathname.split('/').filter(part => part !== '');
      
      if (pathParts.length < 2) {
        return new Response('Invalid path', { 
          status: 400,
          headers: corsHeaders 
        });
      }

      const operation = pathParts[1]; // r2/[operation]
      
      switch (operation) {
        case 'upload':
          return handleUpload(request, env, corsHeaders);
        case 'download':
          return handleDownload(request, env, corsHeaders);
        case 'delete':
          return handleDelete(request, env, corsHeaders);
        default:
          return new Response('Operation not supported', { 
            status: 400,
            headers: corsHeaders 
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error', { 
        status: 500,
        headers: corsHeaders 
      });
    }
  },
};

// Handle file upload - generate presigned POST URL
async function handleUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const body = await request.json();
    const { filename, contentType, sessionId } = body;

    if (!filename || !sessionId) {
      return new Response('Missing required fields', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Generate unique key
    const timestamp = new Date().toISOString().slice(0, 10);
    const key = `reports/${timestamp}/${sessionId}/${filename}`;

    // Generate presigned URL (24-hour expiry)
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);

    const signedUrl = await env.REPORTS_BUCKET.createPresignedUrl('PUT', key, {
      expiresIn: 86400, // 24 hours
      httpMethod: 'PUT',
      customMetadata: {
        'session-id': sessionId,
        'uploaded-at': new Date().toISOString(),
      },
      contentType: contentType || 'application/pdf',
    });

    return new Response(JSON.stringify({
      success: true,
      uploadUrl: signedUrl,
      key: key,
      expiresAt: expirationDate.toISOString(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate upload URL',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

// Handle file download - generate presigned GET URL
async function handleDownload(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const sessionId = url.searchParams.get('sessionId');

    if (!key || !sessionId) {
      return new Response('Missing required parameters', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Verify session has access to this file
    if (!key.includes(sessionId)) {
      return new Response('Access denied', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    // Check if file exists
    const object = await env.REPORTS_BUCKET.head(key);
    if (!object) {
      return new Response('File not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Generate presigned URL (1-hour expiry)
    const signedUrl = await env.REPORTS_BUCKET.createPresignedUrl('GET', key, {
      expiresIn: 3600, // 1 hour
      httpMethod: 'GET',
    });

    return new Response(JSON.stringify({
      success: true,
      downloadUrl: signedUrl,
      filename: key.split('/').pop(),
      size: object.size,
      lastModified: object.lastModified,
      contentType: object.httpMetadata?.contentType || 'application/pdf',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate download URL',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

// Handle file deletion
async function handleDelete(request, env, corsHeaders) {
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const body = await request.json();
    const { key, sessionId } = body;

    if (!key || !sessionId) {
      return new Response('Missing required fields', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Verify session has access to this file
    if (!key.includes(sessionId)) {
      return new Response('Access denied', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    // Delete the file
    await env.REPORTS_BUCKET.delete(key);

    return new Response(JSON.stringify({
      success: true,
      message: 'File deleted successfully',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to delete file',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}