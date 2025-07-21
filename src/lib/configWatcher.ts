// Hot-reload Configuration Watcher
// Enables dynamic scoring configuration updates without server restart

import { watch } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ScoringConfig } from '../types/scoring';
import { scoringEngine } from './scoring';
import { updateScoringConfig } from '../config/scoring';

export class ConfigWatcher {
  private watchers: Map<string, any> = new Map();
  private isEnabled: boolean = false;

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Start watching scoring configuration files for changes
   */
  public startWatching(): void {
    if (!this.isEnabled) {
      console.log('Config hot-reload disabled in production mode');
      return;
    }

    try {
      // Watch the main scoring configuration file
      const configPath = join(process.cwd(), 'src/config/scoring.ts');
      this.watchFile(configPath, 'scoring-config');

      // Watch for custom configuration files (JSON format for runtime updates)
      const customConfigPath = join(process.cwd(), 'config/custom-scoring.json');
      this.watchFile(customConfigPath, 'custom-scoring', true);

      console.log('✅ Config hot-reload watcher started');
    } catch (error) {
      console.error('Failed to start config watcher:', error);
    }
  }

  /**
   * Stop all file watchers
   */
  public stopWatching(): void {
    this.watchers.forEach((watcher, path) => {
      watcher.close();
      console.log(`Stopped watching: ${path}`);
    });
    this.watchers.clear();
  }

  /**
   * Watch a specific file for changes
   */
  private watchFile(filePath: string, configType: string, optional = false): void {
    try {
      const watcher = watch(filePath, { persistent: false }, async (eventType) => {
        if (eventType === 'change') {
          console.log(`📝 Config file changed: ${filePath}`);
          await this.reloadConfig(filePath, configType);
        }
      });

      this.watchers.set(filePath, watcher);
      console.log(`👀 Watching config file: ${filePath}`);
    } catch (error) {
      if (!optional) {
        console.error(`Failed to watch config file ${filePath}:`, error);
      }
    }
  }

  /**
   * Reload configuration from file
   */
  private async reloadConfig(filePath: string, configType: string): Promise<void> {
    try {
      if (configType === 'custom-scoring') {
        // Handle JSON configuration files
        const configData = await readFile(filePath, 'utf-8');
        const config: ScoringConfig = JSON.parse(configData);
        
        // Validate configuration structure
        this.validateConfig(config);
        
        // Update scoring engine
        scoringEngine.updateConfig(config);
        updateScoringConfig(config);
        
        console.log(`✅ Hot-reloaded scoring config: ${config.version}`);
      } else if (configType === 'scoring-config') {
        // Handle TypeScript configuration files (requires module reload)
        console.log('⚠️ TypeScript config changed - restart recommended for full reload');
      }
    } catch (error) {
      console.error(`Failed to reload config from ${filePath}:`, error);
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: ScoringConfig): void {
    if (!config.version) {
      throw new Error('Configuration must have a version');
    }
    
    if (!config.pillars || typeof config.pillars !== 'object') {
      throw new Error('Configuration must have pillars object');
    }
    
    if (!config.maxTotalScore || typeof config.maxTotalScore !== 'number') {
      throw new Error('Configuration must have maxTotalScore number');
    }

    // Validate pillar structure
    for (const [pillarName, pillarConfig] of Object.entries(config.pillars)) {
      if (!pillarConfig.weight || typeof pillarConfig.weight !== 'number') {
        throw new Error(`Pillar ${pillarName} must have weight number`);
      }
      
      if (!pillarConfig.questions || typeof pillarConfig.questions !== 'object') {
        throw new Error(`Pillar ${pillarName} must have questions object`);
      }

      // Validate question structure
      for (const [questionKey, questionConfig] of Object.entries(pillarConfig.questions)) {
        if (!questionConfig.weight || typeof questionConfig.weight !== 'number') {
          throw new Error(`Question ${questionKey} must have weight number`);
        }
        
        if (!questionConfig.scoringFunction || typeof questionConfig.scoringFunction !== 'string') {
          throw new Error(`Question ${questionKey} must have scoringFunction string`);
        }
        
        if (!questionConfig.maxScore || typeof questionConfig.maxScore !== 'number') {
          throw new Error(`Question ${questionKey} must have maxScore number`);
        }
      }
    }
  }

  /**
   * Create a sample custom configuration file
   */
  public async createSampleConfig(): Promise<void> {
    if (!this.isEnabled) return;

    const sampleConfig: ScoringConfig = {
      version: '1.0.0-custom',
      maxTotalScore: 100,
      pillars: {
        business_readiness: {
          weight: 0.3,
          questions: {
            company_size: {
              weight: 0.4,
              scoringFunction: 'weighted',
              maxScore: 10,
            },
          },
        },
      },
    };

    try {
      const configDir = join(process.cwd(), 'config');
      const configPath = join(configDir, 'custom-scoring.json');
      
      // Ensure config directory exists
      await import('fs/promises').then(fs => fs.mkdir(configDir, { recursive: true }));
      
      // Write sample configuration
      await import('fs/promises').then(fs => 
        fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2))
      );
      
      console.log(`📄 Created sample config: ${configPath}`);
    } catch (error) {
      console.error('Failed to create sample config:', error);
    }
  }
}

// Export singleton instance
export const configWatcher = new ConfigWatcher();

// Auto-start in development
if (process.env.NODE_ENV === 'development') {
  configWatcher.startWatching();
}

// Cleanup on process exit
process.on('SIGINT', () => {
  configWatcher.stopWatching();
  process.exit(0);
});

process.on('SIGTERM', () => {
  configWatcher.stopWatching();
  process.exit(0);
});