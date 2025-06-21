#!/usr/bin/env node

/**
 * This script kills any existing Next.js development servers to free up ports
 */
const { execSync } = require('child_process');

console.log('🔍 Checking for existing Next.js development servers...');

try {
  // Check what's running on port 3000
  const port3000Process = execSync('lsof -ti :3000', { encoding: 'utf8' }).trim();
  
  if (port3000Process) {
    console.log(`📌 Found process ${port3000Process} running on port 3000`);
    
    // Get process details (macOS compatible)
    try {
      const processDetails = execSync(`ps -p ${port3000Process} -o pid,ppid,command`, { encoding: 'utf8' });
      console.log('Process details:');
      console.log(processDetails);
      
      // Check if it's a Next.js server
      if (processDetails.includes('next-server') || processDetails.includes('next dev')) {
        console.log('🎯 Detected Next.js development server');
        
        // Kill the process
        execSync(`kill -TERM ${port3000Process}`);
        console.log('✅ Successfully terminated Next.js development server');
        
        // Wait a moment and verify
        setTimeout(() => {
          try {
            execSync('lsof -ti :3000', { encoding: 'utf8' });
            console.log('⚠️ Process still running, trying force kill...');
            execSync(`kill -9 ${port3000Process}`);
            console.log('✅ Force killed the process');
          } catch (error) {
            console.log('✅ Port 3000 is now free!');
          }
        }, 1000);
        
      } else {
        console.log('ℹ️ Not a Next.js server, leaving it running');
        console.log('   If you need to kill it manually, run: kill -TERM ' + port3000Process);
      }
    } catch (error) {
      console.log('⚠️ Could not get process details, attempting to kill anyway...');
      execSync(`kill -TERM ${port3000Process}`);
      console.log('✅ Terminated process');
    }
  } else {
    console.log('✅ Port 3000 is free!');
  }
} catch (error) {
  console.log('✅ No processes found on port 3000');
}

// Also check port 3001 and 3002 for completeness
[3001, 3002].forEach(port => {
  try {
    const process = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (process) {
      console.log(`📌 Found process ${process} running on port ${port}`);
      try {
        const processDetails = execSync(`ps -p ${process} -o command --no-headers`, { encoding: 'utf8' }).trim();
        if (processDetails.includes('next')) {
          execSync(`kill -TERM ${process}`);
          console.log(`✅ Killed Next.js process on port ${port}`);
        }
      } catch (error) {
        // Kill it anyway if we can't get details
        execSync(`kill -TERM ${process}`);
        console.log(`✅ Killed process on port ${port}`);
      }
    }
  } catch (error) {
    // Port is free
  }
});

console.log('🎉 Ready to start a fresh development server!'); 