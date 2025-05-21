#!/usr/bin/env node

/**
 * This script cleans the Next.js cache and other temporary files
 * that might be causing runtime errors
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = process.cwd();
const nextCacheDir = path.join(rootDir, '.next');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const nextCacheFolder = path.join(rootDir, '.next/cache');

console.log('🧹 Cleaning Next.js cache and temporary files...');

// Helper function to delete directory recursively
function deleteDirectoryRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    console.log(`Removing ${directoryPath}...`);
    try {
      // Use rimraf-like approach for deleting directories
      if (process.platform === 'win32') {
        // On Windows, use rd command
        execSync(`rd /s /q "${directoryPath}"`, { stdio: 'ignore' });
      } else {
        // On Unix-like systems, use rm command
        execSync(`rm -rf "${directoryPath}"`, { stdio: 'ignore' });
      }
      console.log(`✅ Successfully removed ${directoryPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error removing ${directoryPath}:`, error.message);
      return false;
    }
  } else {
    console.log(`Directory ${directoryPath} does not exist, skipping...`);
    return true;
  }
}

// Delete .next directory
const nextDeleted = deleteDirectoryRecursive(nextCacheDir);

// If the complete .next deletion didn't work, try just deleting the cache folder
if (!nextDeleted && fs.existsSync(nextCacheFolder)) {
  deleteDirectoryRecursive(nextCacheFolder);
}

console.log('🚀 Next.js cache cleared successfully!');
console.log('');
console.log('To start the development server, run:');
console.log('npm run dev'); 