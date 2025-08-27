import { BaseTool, ToolCommand, ToolResult } from '../BaseTool';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DocumentationTool extends BaseTool {
  id = 'documentation';
  name = 'Documentation Tool';
  description = 'Automated documentation generation, API docs, and knowledge management';
  version = '1.0.0';

  commands: ToolCommand[] = [
    {
      name: 'generate',
      description: 'Generate documentation from code',
      execute: this.generateDocs.bind(this)
    },
    {
      name: 'api',
      description: 'Generate API documentation',
      execute: this.generateApiDocs.bind(this)
    },
    {
      name: 'readme',
      description: 'Update README with project info',
      execute: this.updateReadme.bind(this)
    },
    {
      name: 'changelog',
      description: 'Generate changelog from commits',
      execute: this.generateChangelog.bind(this)
    }
  ];

  private async generateDocs(args: any[]): Promise<ToolResult> {
    const outputDir = args[0] || 'docs';
    try {
      const docs = await this.createDocumentation(outputDir);
      return this.createResult(true, `Documentation generated in ${outputDir}`, docs);
    } catch (error) {
      return this.createResult(false, 'Documentation generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async generateApiDocs(args: any[]): Promise<ToolResult> {
    const format = args[0] || 'openapi';
    try {
      const apiDocs = await this.createApiDocumentation(format);
      return this.createResult(true, `API documentation generated (${format})`, apiDocs);
    } catch (error) {
      return this.createResult(false, 'API documentation generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async updateReadme(): Promise<ToolResult> {
    try {
      const readmeContent = await this.generateReadmeContent();
      await fs.writeFile('README.md', readmeContent);
      return this.createResult(true, 'README.md updated successfully', { file: 'README.md' });
    } catch (error) {
      return this.createResult(false, 'README update failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async generateChangelog(): Promise<ToolResult> {
    try {
      const changelog = await this.createChangelog();
      await fs.writeFile('CHANGELOG.md', changelog);
      return this.createResult(true, 'CHANGELOG.md generated successfully', { file: 'CHANGELOG.md' });
    } catch (error) {
      return this.createResult(false, 'Changelog generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async createDocumentation(outputDir: string): Promise<any> {
    await fs.mkdir(outputDir, { recursive: true });

    const sourceFiles = await this.getSourceFiles('src');
    const docs = [];

    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const docContent = this.extractDocumentation(content, file);
      
      if (docContent) {
        const docFile = path.join(outputDir, `${path.basename(file, path.extname(file))}.md`);
        await fs.writeFile(docFile, docContent);
        docs.push(docFile);
      }
    }

    // Create index file
    const indexContent = this.createIndexFile(docs);
    const indexFile = path.join(outputDir, 'index.md');
    await fs.writeFile(indexFile, indexContent);

    return {
      outputDir,
      files: [...docs, indexFile],
      total: docs.length + 1
    };
  }

  private async createApiDocumentation(format: string): Promise<any> {
    const apiEndpoints = await this.extractApiEndpoints();
    
    if (format === 'openapi') {
      const openApiSpec = this.generateOpenApiSpec(apiEndpoints);
      await fs.writeFile('api-docs.json', JSON.stringify(openApiSpec, null, 2));
      return { format, file: 'api-docs.json', endpoints: apiEndpoints.length };
    } else {
      const markdownDocs = this.generateMarkdownApiDocs(apiEndpoints);
      await fs.writeFile('API.md', markdownDocs);
      return { format, file: 'API.md', endpoints: apiEndpoints.length };
    }
  }

  private async generateReadmeContent(): Promise<string> {
    const packageJson = await this.getPackageJson();
    const projectStats = await this.getProjectStats();

    return `# ${packageJson?.name || 'Project'}

${packageJson?.description || 'A modern development project powered by THE TOOLBOXX'}

## 🚀 Features

- **Universal Agentic Patch**: Enhanced with THE TOOLBOXX capabilities
- **Seven Integrated Tools**: Code analysis, testing, deployment, monitoring, security, documentation, and collaboration
- **Voice Commands**: AI-powered voice control interface
- **Agent-to-Agent Protocol**: Seamless communication between development agents
- **Monetization Ready**: Built-in revenue tracking and analytics
- **GitHub Integration**: Leveraging Lutra AI capabilities

## 📊 Project Statistics

- **Files**: ${projectStats.files}
- **Lines of Code**: ${projectStats.lines}
- **Languages**: ${Object.keys(projectStats.languages).join(', ')}
- **Last Updated**: ${new Date().toLocaleDateString()}

## 🛠️ THE TOOLBOXX Commands

\`\`\`bash
# Initialize THE TOOLBOXX
npm run toolboxx init

# Start all services
npm run toolboxx start

# Manage tools
npm run toolboxx tools --list
npm run toolboxx tools --enable code-analysis,testing

# Agent operations
npm run toolboxx agent --status

# View monetization dashboard
npm run toolboxx monetize
\`\`\`

## 🏗️ Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## 🧪 Testing

\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## 🚀 Deployment

\`\`\`bash
npm run toolboxx deploy staging
npm run toolboxx deploy production
\`\`\`

## 📝 License

${packageJson?.license || 'MIT'}

---

*Powered by THE TOOLBOXX - Universal Agentic Patch*
`;
  }

  private async createChangelog(): Promise<string> {
    // This is a simplified changelog generator
    return `# Changelog

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- 🛠️ THE TOOLBOXX Universal Agentic Patch integration
- 🎯 Seven comprehensive development tools
- 🎤 Voice command interface
- 🤖 Agent-to-Agent communication protocol
- 💰 Monetization and analytics framework
- 🔗 GitHub integration with Lutra AI capabilities
- 🛡️ CI guardrails and quality gates
- 📊 Real-time monitoring and metrics
- 🔒 Security scanning and compliance checking
- 📚 Automated documentation generation
- 🤝 Enhanced collaboration features

### Changed
- Enhanced project structure for scalability
- Improved developer experience with integrated tooling

### Security
- Added comprehensive security scanning
- Implemented secret detection
- Added compliance checking for OWASP and SOC2 standards

---

*Generated by THE TOOLBOXX Documentation Tool*
`;
  }

  private extractDocumentation(content: string, filePath: string): string | null {
    const comments = this.extractComments(content);
    if (comments.length === 0) return null;

    const fileName = path.basename(filePath, path.extname(filePath));
    let docContent = `# ${fileName}\n\n`;
    docContent += `**File**: \`${filePath}\`\n\n`;

    const functions = this.extractFunctions(content);
    const classes = this.extractClasses(content);

    if (classes.length > 0) {
      docContent += '## Classes\n\n';
      for (const cls of classes) {
        docContent += `### ${cls.name}\n\n${cls.description || 'No description available.'}\n\n`;
      }
    }

    if (functions.length > 0) {
      docContent += '## Functions\n\n';
      for (const func of functions) {
        docContent += `### ${func.name}\n\n${func.description || 'No description available.'}\n\n`;
        if (func.params.length > 0) {
          docContent += '**Parameters:**\n';
          for (const param of func.params) {
            docContent += `- \`${param}\`\n`;
          }
          docContent += '\n';
        }
      }
    }

    return docContent;
  }

  private extractComments(content: string): string[] {
    const commentRegex = /\/\*\*([\s\S]*?)\*\/|\/\/\s*(.*)/g;
    const comments = [];
    let match;

    while ((match = commentRegex.exec(content)) !== null) {
      comments.push(match[1] || match[2]);
    }

    return comments;
  }

  private extractFunctions(content: string): any[] {
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    const arrowFunctionRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
    const functions = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(',').map(p => p.trim()).filter(p => p),
        description: ''
      });
    }

    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(',').map(p => p.trim()).filter(p => p),
        description: ''
      });
    }

    return functions;
  }

  private extractClasses(content: string): any[] {
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    const classes = [];
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        description: ''
      });
    }

    return classes;
  }

  private createIndexFile(docFiles: string[]): string {
    let content = '# Documentation Index\n\n';
    content += 'This documentation was automatically generated by THE TOOLBOXX.\n\n';
    content += '## Files\n\n';

    for (const file of docFiles) {
      const fileName = path.basename(file, '.md');
      content += `- [${fileName}](./${path.basename(file)})\n`;
    }

    content += '\n---\n\n*Generated by THE TOOLBOXX Documentation Tool*\n';
    return content;
  }

  private async extractApiEndpoints(): Promise<any[]> {
    // Mock API endpoint extraction
    return [
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check endpoint',
        responses: { '200': 'OK' }
      },
      {
        method: 'POST',
        path: '/api/tools',
        description: 'Execute tool command',
        parameters: ['toolId', 'command', 'args'],
        responses: { '200': 'Success', '400': 'Bad Request' }
      }
    ];
  }

  private generateOpenApiSpec(endpoints: any[]): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'THE TOOLBOXX API',
        version: '1.0.0',
        description: 'Universal Agentic Patch API'
      },
      paths: endpoints.reduce((paths, endpoint) => {
        paths[endpoint.path] = {
          [endpoint.method.toLowerCase()]: {
            summary: endpoint.description,
            responses: endpoint.responses
          }
        };
        return paths;
      }, {})
    };
  }

  private generateMarkdownApiDocs(endpoints: any[]): string {
    let content = '# API Documentation\n\n';
    content += 'This API documentation was generated by THE TOOLBOXX.\n\n';

    for (const endpoint of endpoints) {
      content += `## ${endpoint.method} ${endpoint.path}\n\n`;
      content += `${endpoint.description}\n\n`;
      
      if (endpoint.parameters) {
        content += '**Parameters:**\n';
        for (const param of endpoint.parameters) {
          content += `- \`${param}\`\n`;
        }
        content += '\n';
      }

      content += '**Responses:**\n';
      for (const [code, desc] of Object.entries(endpoint.responses)) {
        content += `- \`${code}\`: ${desc}\n`;
      }
      content += '\n';
    }

    return content;
  }

  private async getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    
    try {
      async function walk(currentDir: string): Promise<void> {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
            files.push(fullPath);
          }
        }
      }
      
      await walk(dir);
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private async getPackageJson(): Promise<any> {
    try {
      const content = await fs.readFile('package.json', 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async getProjectStats(): Promise<any> {
    const files = await this.getSourceFiles('src');
    let totalLines = 0;
    const languages = {} as any;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        totalLines += content.split('\n').length;
        
        const ext = path.extname(file);
        languages[ext] = (languages[ext] || 0) + 1;
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      files: files.length,
      lines: totalLines,
      languages
    };
  }
}