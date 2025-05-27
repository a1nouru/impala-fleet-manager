export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  
  // Log the health check for monitoring
  console.log(`🏥 Health check at ${timestamp} - Uptime: ${uptime}s`);
  
  return Response.json({ 
    status: 'healthy', 
    timestamp,
    uptime: `${uptime}s`,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
} 