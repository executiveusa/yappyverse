import { ToolBoxxConfig } from '../config/ConfigManager';
import { ToolManager } from '../tools/ToolManager';
import { UIServer } from '../ui/UIServer';
import { AgentProtocol } from '../agent/AgentProtocol';
import { MonetizationManager } from '../monetization/MonetizationManager';
import { GitHubIntegration } from '../github/GitHubIntegration';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ToolBoxx {
  private toolManager: ToolManager;
  private uiServer: UIServer;
  private agentProtocol: AgentProtocol;
  private monetizationManager: MonetizationManager;
  private githubIntegration: GitHubIntegration;

  constructor(private config: ToolBoxxConfig) {
    this.toolManager = new ToolManager(config);
    this.uiServer = new UIServer(config);
    this.agentProtocol = new AgentProtocol(config);
    this.monetizationManager = new MonetizationManager(config);
    this.githubIntegration = new GitHubIntegration(config);
  }

  async initialize(): Promise<void> {
    console.log(chalk.yellow('🔧 Initializing THE TOOLBOXX in current repository...'));

    try {
      // Create toolboxx configuration directory
      const toolboxxDir = path.join(process.cwd(), '.toolboxx');
      await fs.mkdir(toolboxxDir, { recursive: true });

      // Create default configuration file
      const configFile = path.join(toolboxxDir, 'config.json');
      const defaultConfig = {
        version: '1.0.0',
        initialized: new Date().toISOString(),
        tools: this.config.tools.enabled,
        features: {
          monetization: this.config.monetization.enabled,
          voiceCommands: this.config.ui.voiceCommandsEnabled,
          agentProtocol: true,
          githubIntegration: this.config.github.enabled,
        }
      };
      
      await fs.writeFile(configFile, JSON.stringify(defaultConfig, null, 2));

      // Initialize each component
      await this.toolManager.initialize();
      await this.uiServer.initialize();
      await this.agentProtocol.initialize();
      
      if (this.config.monetization.enabled) {
        await this.monetizationManager.initialize();
      }
      
      if (this.config.github.enabled) {
        await this.githubIntegration.initialize();
      }

      console.log(chalk.green('✅ THE TOOLBOXX initialized successfully!'));
      console.log(chalk.gray(`📁 Configuration saved to: ${configFile}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error);
      throw error;
    }
  }

  async start(options: { port?: string }): Promise<void> {
    console.log(chalk.yellow('🚀 Starting THE TOOLBOXX services...'));

    try {
      // Start UI server
      const port = parseInt(options.port || this.config.ui.port.toString());
      await this.uiServer.start(port);

      // Start agent protocol
      await this.agentProtocol.start();

      // Start monetization services if enabled
      if (this.config.monetization.enabled) {
        await this.monetizationManager.start();
      }

      // Start GitHub integration services
      if (this.config.github.enabled) {
        await this.githubIntegration.start();
      }

      console.log(chalk.green('✅ All services started successfully!'));
      console.log(chalk.blue(`🌐 UI available at: http://localhost:${port}`));
      console.log(chalk.blue(`🤖 Agent protocol listening on port: ${this.config.agent.port}`));

    } catch (error) {
      console.error(chalk.red('❌ Failed to start services:'), error);
      throw error;
    }
  }

  async manageTools(options: { list?: boolean; enable?: string; disable?: string }): Promise<void> {
    if (options.list) {
      await this.toolManager.listTools();
    }

    if (options.enable) {
      const tools = options.enable.split(',').map(t => t.trim());
      await this.toolManager.enableTools(tools);
    }

    if (options.disable) {
      const tools = options.disable.split(',').map(t => t.trim());
      await this.toolManager.disableTools(tools);
    }
  }

  async agentOperations(options: { status?: boolean; connect?: string }): Promise<void> {
    if (options.status) {
      await this.agentProtocol.showStatus();
    }

    if (options.connect) {
      await this.agentProtocol.connectToAgent(options.connect);
    }
  }

  async showMonetizationDashboard(): Promise<void> {
    if (!this.config.monetization.enabled) {
      console.log(chalk.yellow('⚠️  Monetization is not enabled. Enable it in configuration.'));
      return;
    }

    await this.monetizationManager.showDashboard();
  }

  async stop(): Promise<void> {
    console.log(chalk.yellow('🛑 Stopping THE TOOLBOXX services...'));

    try {
      await this.uiServer.stop();
      await this.agentProtocol.stop();
      
      if (this.config.monetization.enabled) {
        await this.monetizationManager.stop();
      }
      
      if (this.config.github.enabled) {
        await this.githubIntegration.stop();
      }

      console.log(chalk.green('✅ All services stopped successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Error stopping services:'), error);
      throw error;
    }
  }
}