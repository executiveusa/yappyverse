import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ToolBoxxConfig {
  github: {
    token?: string;
    enabled: boolean;
  };
  openai: {
    apiKey?: string;
    enabled: boolean;
  };
  monetization: {
    enabled: boolean;
    stripeSecretKey?: string;
    subscriptionTier: 'free' | 'premium' | 'enterprise';
    usageTracking: boolean;
    revenueAnalytics: boolean;
  };
  agent: {
    id: string;
    secret?: string;
    protocolVersion: string;
    port: number;
  };
  ui: {
    port: number;
    voiceCommandsEnabled: boolean;
  };
  tools: {
    enabled: string[];
    autoDiscovery: boolean;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ConfigManager {
  private static config: ToolBoxxConfig;

  static async initialize(): Promise<ToolBoxxConfig> {
    // Load environment variables
    dotenv.config();

    // Check for local .env file
    const envPath = path.join(process.cwd(), '.env');
    try {
      await fs.access(envPath);
      dotenv.config({ path: envPath });
    } catch {
      // .env file doesn't exist, use defaults
    }

    this.config = {
      github: {
        token: process.env.GITHUB_TOKEN,
        enabled: !!process.env.GITHUB_TOKEN,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        enabled: !!process.env.OPENAI_API_KEY,
      },
      monetization: {
        enabled: process.env.MONETIZATION_ENABLED === 'true',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        subscriptionTier: (process.env.SUBSCRIPTION_TIER as any) || 'free',
        usageTracking: process.env.USAGE_TRACKING === 'true',
        revenueAnalytics: process.env.REVENUE_ANALYTICS === 'true',
      },
      agent: {
        id: process.env.AGENT_ID || `toolboxx-${Date.now()}`,
        secret: process.env.AGENT_SECRET,
        protocolVersion: process.env.PROTOCOL_VERSION || '1.0.0',
        port: parseInt(process.env.AGENT_PROTOCOL_PORT || '3001'),
      },
      ui: {
        port: parseInt(process.env.UI_PORT || '3000'),
        voiceCommandsEnabled: process.env.VOICE_COMMANDS_ENABLED === 'true',
      },
      tools: {
        enabled: process.env.TOOLS_ENABLED?.split(',') || [
          'code-analysis',
          'testing',
          'deployment',
          'monitoring',
          'security',
          'documentation',
          'collaboration'
        ],
        autoDiscovery: process.env.AUTO_DISCOVERY === 'true',
      },
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    };

    return this.config;
  }

  static getConfig(): ToolBoxxConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call ConfigManager.initialize() first.');
    }
    return this.config;
  }

  static async saveConfig(newConfig: Partial<ToolBoxxConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Save to .env file
    const envPath = path.join(process.cwd(), '.env');
    const envContent = this.generateEnvContent();
    await fs.writeFile(envPath, envContent);
  }

  private static generateEnvContent(): string {
    const config = this.config;
    return `# THE TOOLBOXX Configuration
GITHUB_TOKEN=${config.github.token || ''}
OPENAI_API_KEY=${config.openai.apiKey || ''}
STRIPE_SECRET_KEY=${config.monetization.stripeSecretKey || ''}
MONETIZATION_ENABLED=${config.monetization.enabled}
VOICE_COMMANDS_ENABLED=${config.ui.voiceCommandsEnabled}
AGENT_PROTOCOL_PORT=${config.agent.port}
UI_PORT=${config.ui.port}
LOG_LEVEL=${config.logLevel}
AGENT_ID=${config.agent.id}
AGENT_SECRET=${config.agent.secret || ''}
PROTOCOL_VERSION=${config.agent.protocolVersion}
TOOLS_ENABLED=${config.tools.enabled.join(',')}
AUTO_DISCOVERY=${config.tools.autoDiscovery}
SUBSCRIPTION_TIER=${config.monetization.subscriptionTier}
USAGE_TRACKING=${config.monetization.usageTracking}
REVENUE_ANALYTICS=${config.monetization.revenueAnalytics}
`;
  }
}