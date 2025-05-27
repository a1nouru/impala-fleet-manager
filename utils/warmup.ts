/**
 * Client-side warmup utility for Vercel deployment
 * Helps prevent cold starts by preemptively calling API routes
 */

interface WarmupResult {
  route: string;
  success: boolean;
  duration: number;
  timestamp: string;
}

class WarmupService {
  private static instance: WarmupService;
  private isWarming = false;
  private lastWarmup: Date | null = null;
  private warmupInterval = 5 * 60 * 1000; // 5 minutes

  static getInstance(): WarmupService {
    if (!WarmupService.instance) {
      WarmupService.instance = new WarmupService();
    }
    return WarmupService.instance;
  }

  /**
   * Warm up critical API routes
   */
  async warmupRoutes(routes: string[] = ['/api/health']): Promise<WarmupResult[]> {
    if (this.isWarming) {
      console.log('🔥 Warmup already in progress...');
      return [];
    }

    this.isWarming = true;
    const results: WarmupResult[] = [];

    console.log('🌡️ Starting client-side warmup...');

    for (const route of routes) {
      const startTime = Date.now();
      try {
        const response = await fetch(route, {
          method: 'GET',
          headers: {
            'User-Agent': 'Client-Warmup-Service',
          },
        });

        const duration = Date.now() - startTime;
        const result: WarmupResult = {
          route,
          success: response.ok,
          duration,
          timestamp: new Date().toISOString(),
        };

        results.push(result);
        console.log(`✅ Warmed ${route} - ${duration}ms`);

      } catch (error) {
        const duration = Date.now() - startTime;
        const result: WarmupResult = {
          route,
          success: false,
          duration,
          timestamp: new Date().toISOString(),
        };

        results.push(result);
        console.error(`❌ Failed to warm ${route}:`, error);
      }
    }

    this.isWarming = false;
    this.lastWarmup = new Date();
    console.log('✅ Client-side warmup completed');

    return results;
  }

  /**
   * Auto warmup - only runs if enough time has passed since last warmup
   */
  async autoWarmup(routes?: string[]): Promise<WarmupResult[]> {
    if (this.lastWarmup && 
        Date.now() - this.lastWarmup.getTime() < this.warmupInterval) {
      return [];
    }

    return this.warmupRoutes(routes);
  }

  /**
   * Initialize warmup on page load
   */
  initializeOnPageLoad(routes?: string[]): void {
    if (typeof window !== 'undefined') {
      // Warmup after a short delay to not block initial page load
      setTimeout(() => {
        this.autoWarmup(routes);
      }, 2000);

      // Set up periodic warmup
      setInterval(() => {
        this.autoWarmup(routes);
      }, this.warmupInterval);
    }
  }
}

export const warmupService = WarmupService.getInstance();

// Convenience functions
export const warmupAPI = (routes?: string[]) => warmupService.warmupRoutes(routes);
export const autoWarmup = (routes?: string[]) => warmupService.autoWarmup(routes);
export const initializeWarmup = (routes?: string[]) => warmupService.initializeOnPageLoad(routes); 