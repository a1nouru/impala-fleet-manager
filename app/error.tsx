'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800 text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <h1 className="text-4xl font-bold mb-6">Something went wrong</h1>
        <p className="mb-8 text-white/80">
          An unexpected error occurred. Our team has been notified.
        </p>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={reset}
            className="bg-white text-blue-700 hover:bg-white/90 px-6 py-5 text-lg"
          >
            Try again
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
} 