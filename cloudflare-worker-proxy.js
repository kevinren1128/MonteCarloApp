/**
 * Cloudflare Worker - Yahoo Finance CORS Proxy
 *
 * Deploy this to Cloudflare Workers (free tier: 100,000 requests/day)
 *
 * Setup Instructions:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Click "Workers & Pages" in the sidebar
 * 3. Click "Create Application" -> "Create Worker"
 * 4. Replace the default code with this file's contents
 * 5. Click "Save and Deploy"
 * 6. Copy your worker URL (e.g., https://yahoo-proxy.YOUR-SUBDOMAIN.workers.dev)
 * 7. Set it in your app's .env file: VITE_CORS_PROXY_URL=https://yahoo-proxy.YOUR-SUBDOMAIN.workers.dev
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Only allow Yahoo Finance URLs
    if (!targetUrl.startsWith('https://query1.finance.yahoo.com/') &&
        !targetUrl.startsWith('https://query2.finance.yahoo.com/')) {
      return new Response(JSON.stringify({ error: 'Only Yahoo Finance URLs allowed' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const data = await response.text();

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
