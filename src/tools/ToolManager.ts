import { ToolBoxxConfig } from '../config/ConfigManager';
import { Tool, ToolResult } from './BaseTool';
import { CodeAnalysisTool } from './implementations/CodeAnalysisTool';
import { TestingTool } from './implementations/TestingTool';
import { DeploymentTool } from './implementations/DeploymentTool';
import { MonitoringTool } from './implementations/MonitoringTool';
import { SecurityTool } from './implementations/SecurityTool';
import { DocumentationTool } from './implementations/DocumentationTool';
import { CollaborationTool } from './implementations/CollaborationTool';
import chalk from 'chalk';

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private enabledTools: Set<string> = new Set();

  constructor(private config: ToolBoxxConfig) {
    this.initializeTools();
  }

  private initializeTools(): void {
    const toolInstances = [
      new CodeAnalysisTool(),
      new TestingTool(),
      new DeploymentTool(),
      new MonitoringTool(),
      new SecurityTool(),
      new DocumentationTool(),
      new CollaborationTool(),
    ];

    for (const tool of toolInstances) {
      this.tools.set(tool.id, tool);
      if (this.config.tools.enabled.includes(tool.id)) {
        this.enabledTools.add(tool.id);
        tool.enabled = true;
      }
    }
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🔧 Initializing tools...'));
    
    for (const toolId of this.enabledTools) {
      const tool = this.tools.get(toolId);
      if (tool) {
        try {
          await tool.initialize();
          console.log(chalk.green(`✅ ${tool.name} initialized`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to initialize ${tool.name}:`), error);
        }
      }
    }
  }

  async listTools(): Promise<void> {
    console.log(chalk.blue('\n📋 Available Tools:\n'));
    
    for (const [id, tool] of this.tools) {
      const status = tool.enabled ? chalk.green('✅ Enabled') : chalk.gray('⭕ Disabled');
      console.log(`${chalk.bold(tool.name)} (${id})`);
      console.log(`   ${tool.description}`);
      console.log(`   Version: ${tool.version} | Status: ${status}`);
      console.log(`   Commands: ${tool.commands.map(c => c.name).join(', ')}\n`);
    }
  }

  async enableTools(toolIds: string[]): Promise<void> {
    for (const toolId of toolIds) {
      const tool = this.tools.get(toolId);
      if (tool) {
        if (!tool.enabled) {
          try {
            await tool.initialize();
            tool.enabled = true;
            this.enabledTools.add(toolId);
            console.log(chalk.green(`✅ Enabled ${tool.name}`));
          } catch (error) {
            console.error(chalk.red(`❌ Failed to enable ${tool.name}:`), error);
          }
        } else {
          console.log(chalk.yellow(`⚠️  ${tool.name} is already enabled`));
        }
      } else {
        console.error(chalk.red(`❌ Tool not found: ${toolId}`));
      }
    }
  }

  async disableTools(toolIds: string[]): Promise<void> {
    for (const toolId of toolIds) {
      const tool = this.tools.get(toolId);
      if (tool) {
        if (tool.enabled) {
          try {
            await tool.shutdown();
            tool.enabled = false;
            this.enabledTools.delete(toolId);
            console.log(chalk.green(`✅ Disabled ${tool.name}`));
          } catch (error) {
            console.error(chalk.red(`❌ Failed to disable ${tool.name}:`), error);
          }
        } else {
          console.log(chalk.yellow(`⚠️  ${tool.name} is already disabled`));
        }
      } else {
        console.error(chalk.red(`❌ Tool not found: ${toolId}`));
      }
    }
  }

  async executeCommand(toolId: string, commandName: string, args: any[]): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        message: `Tool not found: ${toolId}`,
        errors: [`Tool ${toolId} does not exist`]
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        message: `Tool not enabled: ${tool.name}`,
        errors: [`Tool ${tool.name} is disabled`]
      };
    }

    const command = tool.commands.find(c => c.name === commandName);
    if (!command) {
      return {
        success: false,
        message: `Command not found: ${commandName}`,
        errors: [`Command ${commandName} does not exist in tool ${tool.name}`]
      };
    }

    try {
      return await command.execute(args);
    } catch (error) {
      return {
        success: false,
        message: `Command execution failed: ${error}`,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  getEnabledTools(): Tool[] {
    return Array.from(this.enabledTools).map(id => this.tools.get(id)!).filter(Boolean);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}