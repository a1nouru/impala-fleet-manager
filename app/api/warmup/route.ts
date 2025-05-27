export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`🔥 Warmup initiated at ${timestamp}`);
  
  // List of internal API routes to warm up
  const routes = [
    '/api/health',
    // Add other API routes you want to keep warm
    // '/api/vehicles',
    // '/api/drivers',
    // '/api/routes'
  ];
  
  const results = [];
  
  for (const route of routes) {
    try {
      const routeStart = Date.now();
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}${route}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Vercel-Warmup-Bot',
        },
      });
      
      const duration = Date.now() - routeStart;
      
      results.push({
        route,
        status: response.status,
        duration: `${duration}ms`,
        success: response.ok
      });
      
      console.log(`🌡️ Warmed ${route} - ${response.status} (${duration}ms)`);
      
    } catch (error) {
      console.error(`❌ Failed to warm ${route}:`, error);
      results.push({
        route,
        status: 'error',
        duration: '0ms',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  console.log(`✅ Warmup completed in ${totalDuration}ms`);
  
  return Response.json({
    status: 'warmup-complete',
    timestamp,
    totalDuration: `${totalDuration}ms`,
    routes: results,
    warmedRoutes: results.filter(r => r.success).length,
    totalRoutes: results.length
  });
} 