#!/usr/bin/env node

/**
 * This script loads environment variables and runs the development server
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const envPath = path.resolve(process.cwd(), '.env.local');
const nextDir = path.resolve(process.cwd(), '.next');

// Function to check if Next.js cache might be corrupted (only check on startup issues)
function isNextCacheCorrupted() {
  // If .next directory doesn't exist, it's not corrupted
  if (!fs.existsSync(nextDir)) {
    return false;
  }
  
  // Check for critical files that should exist in a healthy .next directory
  const criticalPaths = [
    path.join(nextDir, 'cache'),
    path.join(nextDir, 'types')
  ];
  
  // If any of these don't exist, the cache might be in a bad state
  for (const criticalPath of criticalPaths) {
    if (!fs.existsSync(criticalPath)) {
      return true;
    }
  }
  
  return false;
}

// Only check cache if there are startup issues (not on every dev start)
const forceCleanCache = process.argv.includes('--clean-cache');

if (forceCleanCache || isNextCacheCorrupted()) {
  console.log('⚠️ The Next.js cache directory appears to be in a bad state or clean requested.');
  console.log('🧹 Cleaning Next.js cache...');
  
  try {
    // Use rimraf-like approach for deleting directories
    if (process.platform === 'win32') {
      // On Windows, use rd command
      execSync(`rd /s /q "${nextDir}"`, { stdio: 'ignore' });
    } else {
      // On Unix-like systems, use rm command
      execSync(`rm -rf "${nextDir}"`, { stdio: 'ignore' });
    }
    console.log('✅ Next.js cache cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clean Next.js cache. Please run npm run clean manually.');
    process.exit(1);
  }
}

// Check if .env.local exists
if (!fs.existsSync(envPath)) {
  console.log('\n⚠️ No .env.local file found, creating one with default values...');
  
  // Create .env.local with default Supabase values
  const envContent = `NEXT_PUBLIC_SUPABASE_URL=https://hymravaveedguejtazsc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bXJhdmF2ZWVkZ3VlanRhenNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDI2NTgsImV4cCI6MjA2MjU3ODY1OH0.oLRhI41ul4OTd37TEgWkZRxQ-0Tg-0hBcYKQIkgb8Ag`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file with default Supabase credentials');
} else {
  console.log('✅ Found .env.local file');
  
  // Check if .env.local contains the required variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  const missingVars = [];
  
  if (!envContent.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  if (missingVars.length > 0) {
    console.log(`⚠️ Missing environment variables in .env.local: ${missingVars.join(', ')}`);
    console.log('✏️ Updating .env.local with the missing variables...');
    
    let updatedContent = envContent;
    
    if (missingVars.includes('NEXT_PUBLIC_SUPABASE_URL')) {
      updatedContent += '\nNEXT_PUBLIC_SUPABASE_URL=https://hymravaveedguejtazsc.supabase.co';
    }
    
    if (missingVars.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
      updatedContent += '\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bXJhdmF2ZWVkZ3VlanRhenNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDI2NTgsImV4cCI6MjA2MjU3ODY1OH0.oLRhI41ul4OTd37TEgWkZRxQ-0Tg-0hBcYKQIkgb8Ag';
    }
    
    fs.writeFileSync(envPath, updatedContent);
    console.log('✅ Updated .env.local file with missing variables');
  }
}

console.log('🚀 Starting development server...');

// Run the next dev command with better error handling
try {
  // Use spawn instead of execSync for better control and to avoid blocking
  const nextProcess = spawn('next', ['dev'], { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    nextProcess.kill('SIGTERM');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down development server...');
    nextProcess.kill('SIGTERM');
    process.exit(0);
  });
  
  nextProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Development server exited with code ${code}`);
      process.exit(code);
    }
  });
  
} catch (error) {
  console.error('❌ Failed to start development server:', error);
  process.exit(1);
} 