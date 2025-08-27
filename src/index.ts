#!/usr/bin/env node

import { program } from 'commander';
import { ToolBoxx } from './core/ToolBoxx';
import { ConfigManager } from './config/ConfigManager';
import chalk from 'chalk';

async function main(): Promise<void> {
  console.log(chalk.blue('🛠️  THE TOOLBOXX - Universal Agentic Patch'));
  console.log(chalk.gray('Initializing comprehensive development toolkit...\n'));

  const config = await ConfigManager.initialize();
  const toolboxx = new ToolBoxx(config);

  program
    .name('toolboxx')
    .description('Universal Agentic Patch for enhanced development workflows')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize THE TOOLBOXX in current repository')
    .action(async () => {
      await toolboxx.initialize();
    });

  program
    .command('start')
    .description('Start THE TOOLBOXX services')
    .option('-p, --port <port>', 'Port for UI server', '3000')
    .action(async (options) => {
      await toolboxx.start(options);
    });

  program
    .command('tools')
    .description('Manage available tools')
    .option('-l, --list', 'List all available tools')
    .option('-e, --enable <tools>', 'Enable specific tools (comma-separated)')
    .option('-d, --disable <tools>', 'Disable specific tools (comma-separated)')
    .action(async (options) => {
      await toolboxx.manageTools(options);
    });

  program
    .command('agent')
    .description('Agent-to-Agent protocol operations')
    .option('-s, --status', 'Show agent status')
    .option('-c, --connect <agent-id>', 'Connect to another agent')
    .action(async (options) => {
      await toolboxx.agentOperations(options);
    });

  program
    .command('monetize')
    .description('Monetization and analytics dashboard')
    .action(async () => {
      await toolboxx.showMonetizationDashboard();
    });

  await program.parseAsync(process.argv);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  });
}

export { main };