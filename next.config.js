/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Configure external packages for Supabase compatibility
  serverExternalPackages: ['@supabase/ssr'],
  
  // Add headers to prevent caching issues during cold starts
  async headers() {
    return [
      {
        // Strict no-cache for API routes to prevent session/state conflicts
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // No-cache for dynamic pages and admin routes
        source: '/(admin|dashboard|profile)/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Allow short-term caching for static assets but prevent long-term caching issues
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Optimize webpack configuration for vendor chunk handling
  webpack: (config, { dev, isServer }) => {
    // We only want to run validation in non-dev environments to avoid
    // disrupting the development experience
    if (!dev) {
      // This will be executed at build time
      console.log('\n🔍 Validating environment variables...');
      
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      ];
      
      const missingVars = requiredVars.filter(
        varName => !process.env[varName] || process.env[varName].trim() === ''
      );
      
      // Check if we're in a deployment platform (Railway, Vercel, etc.)
      const isRailwayDeployment = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID;
      const isVercelDeployment = process.env.VERCEL === '1';
      const isDeployment = isRailwayDeployment || isVercelDeployment;
      
      if (missingVars.length > 0) {
        if (isDeployment) {
          // In deployment platforms, warn but allow build to continue
          // The platform will inject variables at runtime
          const platform = isRailwayDeployment ? 'Railway' : isVercelDeployment ? 'Vercel' : 'deployment platform';
          console.warn('\n⚠️ WARNING: Missing environment variables during build:');
          missingVars.forEach(varName => {
            console.warn(`  - ${varName}`);
          });
          console.warn(`\nℹ️ If you're deploying to ${platform}, make sure to set these in your project settings.`);
          console.warn('Build will continue, but the app may not work correctly without these variables.\n');
        } else {
          // In local builds, fail with error
          console.error('\n❌ BUILD ERROR: Missing required environment variables:');
          missingVars.forEach(varName => {
            console.error(`  - ${varName}`);
          });
          console.error('\nPlease set these variables in your .env file or in your deployment environment.\n');
          
          // Exit the build process with an error
          process.exit(1);
        }
      } else {
        console.log('✅ All required environment variables are set!\n');
      }
    }

    return config;
  }
}

module.exports = nextConfig 