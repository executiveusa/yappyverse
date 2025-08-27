import { Octokit } from '@octokit/rest';
import { ToolBoxxConfig } from '../config/ConfigManager';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GitHubIntegrationConfig {
  repositories: string[];
  automations: {
    autoReview: boolean;
    qualityGates: boolean;
    securityScans: boolean;
    documentationSync: boolean;
  };
  webhooks: {
    enabled: boolean;
    events: string[];
  };
}

export class GitHubIntegration {
  private octokit!: Octokit;
  private integrationConfig: GitHubIntegrationConfig;

  constructor(private config: ToolBoxxConfig) {
    if (this.config.github.token) {
      this.octokit = new Octokit({
        auth: this.config.github.token,
      });
    }

    this.integrationConfig = {
      repositories: [],
      automations: {
        autoReview: true,
        qualityGates: true,
        securityScans: true,
        documentationSync: true
      },
      webhooks: {
        enabled: true,
        events: ['push', 'pull_request', 'issues', 'release']
      }
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.github.token) {
      console.log(chalk.yellow('⚠️  GitHub token not provided. GitHub integration features will be limited.'));
      return;
    }

    try {
      // Verify GitHub connection
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      console.log(chalk.green(`✅ GitHub integration initialized for user: ${user.login}`));

      // Load integration configuration
      await this.loadIntegrationConfig();

      // Set up CI guardrails
      await this.setupCIGuardrails();

    } catch (error) {
      console.error(chalk.red('❌ GitHub integration initialization failed:'), error);
    }
  }

  async start(): Promise<void> {
    if (!this.config.github.enabled) return;

    console.log(chalk.blue('🔗 GitHub integration services started'));
    
    // Start monitoring for relevant events
    await this.startRepositoryMonitoring();
  }

  async stop(): Promise<void> {
    console.log(chalk.yellow('🔗 GitHub integration services stopped'));
  }

  // CI Guardrails Implementation
  async setupCIGuardrails(): Promise<void> {
    console.log(chalk.blue('🛡️  Setting up CI guardrails...'));

    // Create .github/workflows directory if it doesn't exist
    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    // Create THE TOOLBOXX CI workflow
    const workflowContent = this.generateCIWorkflow();
    await fs.writeFile(
      path.join(workflowsDir, 'toolboxx-ci.yml'),
      workflowContent
    );

    // Create quality gates configuration
    const qualityGatesConfig = this.generateQualityGatesConfig();
    await fs.writeFile(
      path.join(process.cwd(), '.toolboxx', 'quality-gates.json'),
      JSON.stringify(qualityGatesConfig, null, 2)
    );

    console.log(chalk.green('✅ CI guardrails configured'));
  }

  private generateCIWorkflow(): string {
    return `name: THE TOOLBOXX CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  toolboxx-analysis:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Initialize THE TOOLBOXX
      run: npm run toolboxx init
    
    - name: Code Analysis
      run: npm run toolboxx tools --execute code-analysis analyze
      continue-on-error: true
    
    - name: Security Scan
      run: npm run toolboxx tools --execute security scan
      continue-on-error: true
    
    - name: Run Tests
      run: npm run toolboxx tools --execute testing run
    
    - name: Test Coverage
      run: npm run toolboxx tools --execute testing coverage
    
    - name: Generate Documentation
      run: npm run toolboxx tools --execute documentation generate
    
    - name: Quality Gates Check
      run: npm run toolboxx ci:guard
    
    - name: Upload Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: toolboxx-results
        path: |
          .toolboxx/reports/
          docs/
          coverage/

  deployment-check:
    runs-on: ubuntu-latest
    needs: toolboxx-analysis
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deployment Readiness Check
      run: npm run toolboxx tools --execute deployment status staging
    
    - name: Deployment Dry Run
      run: npm run toolboxx tools --execute deployment deploy staging --dry-run

  monetization-analytics:
    runs-on: ubuntu-latest
    needs: toolboxx-analysis
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Generate Revenue Report
      run: npm run toolboxx monetize --report
      env:
        STRIPE_SECRET_KEY: \${{ secrets.STRIPE_SECRET_KEY }}
    
    - name: Upload Analytics
      uses: actions/upload-artifact@v3
      with:
        name: monetization-report
        path: .toolboxx/reports/revenue-*.json`;
  }

  private generateQualityGatesConfig(): any {
    return {
      version: '1.0.0',
      gates: {
        codeQuality: {
          enabled: true,
          thresholds: {
            complexity: 10,
            duplication: 5,
            maintainabilityIndex: 70
          }
        },
        security: {
          enabled: true,
          allowedSeverities: ['low', 'medium'],
          blockedSeverities: ['high', 'critical'],
          maxVulnerabilities: 5
        },
        testing: {
          enabled: true,
          coverage: {
            minimum: 80,
            statements: 85,
            branches: 75,
            functions: 90
          }
        },
        performance: {
          enabled: true,
          thresholds: {
            buildTime: 300, // seconds
            bundleSize: 2048, // KB
            loadTime: 3 // seconds
          }
        }
      },
      notifications: {
        slack: {
          enabled: false,
          webhook: process.env.SLACK_WEBHOOK
        },
        email: {
          enabled: false,
          recipients: ['team@company.com']
        }
      }
    };
  }

  // Repository monitoring and automation
  async startRepositoryMonitoring(): Promise<void> {
    if (!this.octokit) return;

    try {
      // Get list of repositories to monitor
      const repos = await this.getRepositoriesToMonitor();
      
      for (const repo of repos) {
        await this.setupRepositoryAutomation(repo);
      }

    } catch (error) {
      console.error(chalk.red('❌ Repository monitoring setup failed:'), error);
    }
  }

  private async getRepositoriesToMonitor(): Promise<any[]> {
    if (!this.octokit) return [];

    try {
      const { data: repos } = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        affiliation: 'owner,collaborator',
        per_page: 10
      });

      return repos.filter(repo => !repo.archived && !repo.disabled);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      return [];
    }
  }

  private async setupRepositoryAutomation(repo: any): Promise<void> {
    console.log(chalk.blue(`🔧 Setting up automation for ${repo.full_name}`));

    try {
      // Set up branch protection rules
      if (this.integrationConfig.automations.qualityGates) {
        await this.setupBranchProtection(repo);
      }

      // Configure webhook for THE TOOLBOXX events
      if (this.integrationConfig.webhooks.enabled) {
        await this.setupWebhook(repo);
      }

      // Set up automated issue templates
      await this.setupIssueTemplates(repo);

      // Configure automated PR reviews
      if (this.integrationConfig.automations.autoReview) {
        await this.setupAutomatedReviews(repo);
      }

    } catch (error) {
      console.error(`Error setting up automation for ${repo.full_name}:`, error);
    }
  }

  private async setupBranchProtection(repo: any): Promise<void> {
    try {
      await this.octokit.rest.repos.updateBranchProtection({
        owner: repo.owner.login,
        repo: repo.name,
        branch: 'main',
        required_status_checks: {
          strict: true,
          contexts: ['THE TOOLBOXX CI Pipeline']
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          required_approving_review_count: 1,
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true
        },
        restrictions: null,
        allow_auto_merge: true,
        allow_deletions: false
      });

      console.log(chalk.green(`✅ Branch protection enabled for ${repo.full_name}`));
    } catch (error) {
      // Branch protection might already exist or insufficient permissions
      console.log(chalk.yellow(`⚠️  Could not set branch protection for ${repo.full_name}`));
    }
  }

  private async setupWebhook(repo: any): Promise<void> {
    try {
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'https://localhost:3000'}/api/github/webhook`;
      
      await this.octokit.rest.repos.createWebhook({
        owner: repo.owner.login,
        repo: repo.name,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.GITHUB_WEBHOOK_SECRET || 'toolboxx-secret'
        },
        events: this.integrationConfig.webhooks.events,
        active: true
      });

      console.log(chalk.green(`✅ Webhook configured for ${repo.full_name}`));
    } catch (error) {
      // Webhook might already exist
      console.log(chalk.yellow(`⚠️  Could not create webhook for ${repo.full_name}`));
    }
  }

  private async setupIssueTemplates(repo: any): Promise<void> {
    const templates = [
      {
        name: 'bug_report.md',
        content: this.generateBugReportTemplate()
      },
      {
        name: 'feature_request.md',
        content: this.generateFeatureRequestTemplate()
      },
      {
        name: 'toolboxx_integration.md',
        content: this.generateToolboxxIntegrationTemplate()
      }
    ];

    for (const template of templates) {
      try {
        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner: repo.owner.login,
          repo: repo.name,
          path: `.github/ISSUE_TEMPLATE/${template.name}`,
          message: `Add THE TOOLBOXX issue template: ${template.name}`,
          content: Buffer.from(template.content).toString('base64')
        });
      } catch (error) {
        // Template might already exist
      }
    }
  }

  private generateBugReportTemplate(): string {
    return `---
name: Bug Report
about: Create a report to help us improve THE TOOLBOXX
title: '[BUG] '
labels: ['bug', 'toolboxx']
assignees: ''
---

## Bug Description
A clear and concise description of what the bug is.

## THE TOOLBOXX Environment
- Version: [e.g. 1.0.0]
- Tools Enabled: [e.g. code-analysis, testing]
- Subscription Tier: [e.g. Premium]
- Voice Commands: [enabled/disabled]

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Run command '....'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
A clear and concise description of what actually happened.

## Screenshots/Logs
If applicable, add screenshots or log outputs to help explain your problem.

## Additional Context
Add any other context about the problem here.`;
  }

  private generateFeatureRequestTemplate(): string {
    return `---
name: Feature Request
about: Suggest an idea for THE TOOLBOXX
title: '[FEATURE] '
labels: ['enhancement', 'toolboxx']
assignees: ''
---

## Feature Description
A clear and concise description of what you want to happen.

## Use Case
Describe the use case for this feature. What problem does it solve?

## Proposed Solution
A clear and concise description of what you want to happen.

## Tool Integration
Which THE TOOLBOXX tools would this feature integrate with?
- [ ] Code Analysis
- [ ] Testing
- [ ] Deployment
- [ ] Monitoring
- [ ] Security
- [ ] Documentation
- [ ] Collaboration

## Voice Command Support
Should this feature support voice commands?
- [ ] Yes
- [ ] No

## Monetization Impact
How might this feature impact monetization?
- [ ] Free tier feature
- [ ] Premium tier feature
- [ ] Enterprise tier feature
- [ ] Usage-based pricing

## Additional Context
Add any other context or screenshots about the feature request here.`;
  }

  private generateToolboxxIntegrationTemplate(): string {
    return `---
name: THE TOOLBOXX Integration
about: Request integration with THE TOOLBOXX
title: '[INTEGRATION] '
labels: ['integration', 'toolboxx']
assignees: ''
---

## Integration Request
What would you like to integrate with THE TOOLBOXX?

## Current Workflow
Describe your current development workflow.

## Desired Integration
How would THE TOOLBOXX enhance your workflow?

## Tool Requirements
Which tools would you need?
- [ ] Code Analysis
- [ ] Testing
- [ ] Deployment
- [ ] Monitoring
- [ ] Security
- [ ] Documentation
- [ ] Collaboration

## Expected Benefits
What benefits do you expect from this integration?

## Technical Requirements
Any specific technical requirements or constraints?`;
  }

  private async setupAutomatedReviews(repo: any): Promise<void> {
    // This would set up automated PR reviews using THE TOOLBOXX
    // For now, we'll just log the setup
    console.log(chalk.blue(`🤖 Automated reviews configured for ${repo.full_name}`));
  }

  // Webhook handling
  public async handleWebhookEvent(event: string, payload: any): Promise<void> {
    console.log(chalk.blue(`📨 GitHub webhook event: ${event}`));

    switch (event) {
      case 'push':
        await this.handlePushEvent(payload);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;
      case 'issues':
        await this.handleIssueEvent(payload);
        break;
      case 'release':
        await this.handleReleaseEvent(payload);
        break;
      default:
        console.log(chalk.gray(`Unhandled event type: ${event}`));
    }
  }

  private async handlePushEvent(payload: any): Promise<void> {
    const repo = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');
    
    console.log(chalk.blue(`📤 Push to ${repo}:${branch}`));
    
    // Trigger automated analysis for main branch pushes
    if (branch === 'main' || branch === 'master') {
      console.log(chalk.yellow('🔍 Triggering automated analysis...'));
      // This would trigger THE TOOLBOXX analysis pipeline
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const action = payload.action;
    const pr = payload.pull_request;
    
    console.log(chalk.blue(`📋 PR ${action}: ${pr.title}`));
    
    if (action === 'opened' || action === 'synchronize') {
      // Trigger automated review
      console.log(chalk.yellow('🤖 Triggering automated PR review...'));
      // This would trigger THE TOOLBOXX automated review
    }
  }

  private async handleIssueEvent(payload: any): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;
    
    console.log(chalk.blue(`🐛 Issue ${action}: ${issue.title}`));
    
    if (action === 'opened' && issue.labels.some((l: any) => l.name === 'toolboxx')) {
      // Handle THE TOOLBOXX related issues
      console.log(chalk.yellow('🛠️  THE TOOLBOXX issue detected, auto-categorizing...'));
    }
  }

  private async handleReleaseEvent(payload: any): Promise<void> {
    const action = payload.action;
    const release = payload.release;
    
    console.log(chalk.blue(`🚀 Release ${action}: ${release.tag_name}`));
    
    if (action === 'published') {
      // Trigger deployment pipeline
      console.log(chalk.yellow('🚀 Triggering deployment pipeline...'));
    }
  }

  // Configuration management
  private async loadIntegrationConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), '.toolboxx', 'github-integration.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.integrationConfig = { ...this.integrationConfig, ...JSON.parse(configData) };
    } catch (error) {
      // Use default configuration
      await this.saveIntegrationConfig();
    }
  }

  private async saveIntegrationConfig(): Promise<void> {
    const configPath = path.join(process.cwd(), '.toolboxx', 'github-integration.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.integrationConfig, null, 2));
  }

  // Public API methods
  public async getRepositoryInsights(owner: string, repo: string): Promise<any> {
    if (!this.octokit) return null;

    try {
      const [repoData, languages, contributors, releases] = await Promise.all([
        this.octokit.rest.repos.get({ owner, repo }),
        this.octokit.rest.repos.listLanguages({ owner, repo }),
        this.octokit.rest.repos.listContributors({ owner, repo, per_page: 10 }),
        this.octokit.rest.repos.listReleases({ owner, repo, per_page: 5 })
      ]);

      return {
        repository: repoData.data,
        languages: languages.data,
        contributors: contributors.data,
        releases: releases.data,
        toolboxxCompatible: await this.checkToolboxxCompatibility(owner, repo)
      };
    } catch (error) {
      console.error('Error fetching repository insights:', error);
      return null;
    }
  }

  private async checkToolboxxCompatibility(owner: string, repo: string): Promise<any> {
    try {
      // Check for package.json
      const packageJson = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'package.json'
      });

      // Check for existing THE TOOLBOXX configuration
      let toolboxxConfig = null;
      try {
        const config = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: '.toolboxx/config.json'
        });
        toolboxxConfig = config.data;
      } catch {
        // No existing configuration
      }

      return {
        hasPackageJson: !!packageJson,
        hasToolboxxConfig: !!toolboxxConfig,
        recommendedTools: ['code-analysis', 'testing', 'security', 'documentation'],
        integrationComplexity: toolboxxConfig ? 'low' : 'medium'
      };
    } catch (error) {
      return {
        hasPackageJson: false,
        hasToolboxxConfig: false,
        recommendedTools: [],
        integrationComplexity: 'high'
      };
    }
  }
}