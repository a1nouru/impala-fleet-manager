/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Function to validate environment variables before build
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
      
      if (missingVars.length > 0) {
        console.error('\n❌ BUILD ERROR: Missing required environment variables:');
        missingVars.forEach(varName => {
          console.error(`  - ${varName}`);
        });
        console.error('\nPlease set these variables in your .env file or in your deployment environment.\n');
        
        // Exit the build process with an error
        process.exit(1);
      } else {
        console.log('✅ All required environment variables are set!\n');
      }
    }
    
    return config;
  }
}

module.exports = nextConfig 