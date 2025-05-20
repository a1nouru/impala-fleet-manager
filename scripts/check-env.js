#!/usr/bin/env node

/**
 * This script checks for required environment variables
 * It can be run before starting the application or during the build process
 */

// List of required environment variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

// Check for missing variables
const missingVars = requiredVars.filter(varName => {
  const value = process.env[varName];
  return !value || value.trim() === '';
});

// Special case for Vercel deployment - don't fail the build
const isVercelDeployment = process.env.VERCEL === '1';

// Output results
if (missingVars.length > 0) {
  if (isVercelDeployment) {
    // In Vercel deployments, warn but don't fail the build
    console.warn('\n⚠️ VERCEL DEPLOYMENT WARNING ⚠️');
    console.warn('The following environment variables are missing:');
    missingVars.forEach(varName => {
      console.warn(`  - ${varName}`);
    });
    console.warn('\nThese should be configured in your Vercel project settings.');
    console.warn('Continuing with the build anyway...\n');
    console.log('✅ Proceeding with build despite missing environment variables');
  } else {
    // In local development, fail with an error
    console.error('\n🚨 ENVIRONMENT CONFIGURATION ERROR 🚨');
    console.error('The following required environment variables are missing:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease add these variables to your .env.local file or your environment.');
    console.error('If you\'re deploying to production, add these to your deployment environment.\n');
    
    // Exit with error code in development only
    process.exit(1);
  }
} else {
  console.log('✅ All required environment variables are set!');
} 