import { logger } from "@rharkor/logger";

export class CleanupManager {
  private static instance: CleanupManager;
  private cleanupFunctions: Array<() => void | Promise<void>> = [];
  private intervals: NodeJS.Timeout[] = [];
  private isShuttingDown = false;

  private constructor() {
    this.setupSignalHandlers();
  }

  static getInstance(): CleanupManager {
    if (!CleanupManager.instance) {
      CleanupManager.instance = new CleanupManager();
    }
    return CleanupManager.instance;
  }

  addCleanupFunction(fn: () => void | Promise<void>): void {
    this.cleanupFunctions.push(fn);
  }

  addInterval(interval: NodeJS.Timeout): void {
    this.intervals.push(interval);
  }

  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal as NodeJS.Signals, () => {
        logger.log(`Received ${signal}, initiating graceful shutdown...`);
        this.cleanup().then(() => {
          process.exit(0);
        }).catch((error) => {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        });
      });
    });

    process.on('exit', () => {
      if (!this.isShuttingDown) {
        this.cleanup();
      }
    });
  }

  async cleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    logger.log('Starting cleanup process...');

    // Clear all intervals first
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.length = 0;

    // Execute all cleanup functions
    const cleanupPromises = this.cleanupFunctions.map(async (fn, index) => {
      try {
        await fn();
        logger.debug(`Cleanup function ${index + 1} completed`);
      } catch (error) {
        logger.error(`Error in cleanup function ${index + 1}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    logger.log('Cleanup process completed');
  }

  // Force immediate cleanup (for testing or emergency situations)
  forceCleanup(): void {
    this.cleanup().catch((error) => {
      logger.error('Error during force cleanup:', error);
    });
  }
}

// Export singleton instance
export const cleanupManager = CleanupManager.getInstance();