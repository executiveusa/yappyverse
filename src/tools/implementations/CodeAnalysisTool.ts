import { BaseTool, ToolCommand, ToolResult } from '../BaseTool';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodeAnalysisTool extends BaseTool {
  id = 'code-analysis';
  name = 'Code Analysis Tool';
  description = 'Static code analysis, complexity metrics, and code quality assessment';
  version = '1.0.0';

  commands: ToolCommand[] = [
    {
      name: 'analyze',
      description: 'Analyze code quality and complexity',
      execute: this.analyzeCode.bind(this)
    },
    {
      name: 'lint',
      description: 'Run linting on codebase',
      execute: this.lintCode.bind(this)
    },
    {
      name: 'metrics',
      description: 'Generate code metrics report',
      execute: this.generateMetrics.bind(this)
    }
  ];

  async initialize(): Promise<void> {
    // Check for common analysis tools
    try {
      await execAsync('which eslint');
    } catch {
      console.warn('ESLint not found. Some features may be limited.');
    }
  }

  private async analyzeCode(args: any[]): Promise<ToolResult> {
    const targetPath = args[0] || process.cwd();
    
    try {
      const analysis = await this.performCodeAnalysis(targetPath);
      return this.createResult(true, 'Code analysis completed', analysis);
    } catch (error) {
      return this.createResult(false, 'Code analysis failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async lintCode(args: any[]): Promise<ToolResult> {
    const targetPath = args[0] || process.cwd();
    
    try {
      const { stdout, stderr } = await execAsync(`npx eslint "${targetPath}" --ext .ts,.js --format json`, {
        cwd: process.cwd()
      });
      
      const results = JSON.parse(stdout || '[]');
      const errorCount = results.reduce((sum: number, file: any) => sum + file.errorCount, 0);
      const warningCount = results.reduce((sum: number, file: any) => sum + file.warningCount, 0);
      
      return this.createResult(true, `Linting completed: ${errorCount} errors, ${warningCount} warnings`, {
        errorCount,
        warningCount,
        results
      });
    } catch (error) {
      return this.createResult(false, 'Linting failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async generateMetrics(args: any[]): Promise<ToolResult> {
    const targetPath = args[0] || process.cwd();
    
    try {
      const metrics = await this.calculateMetrics(targetPath);
      return this.createResult(true, 'Metrics generated successfully', metrics);
    } catch (error) {
      return this.createResult(false, 'Metrics generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async performCodeAnalysis(targetPath: string): Promise<any> {
    const files = await this.getSourceFiles(targetPath);
    const analysis = {
      totalFiles: files.length,
      totalLines: 0,
      languages: new Map<string, number>(),
      issues: [] as any[],
      complexity: 0
    };

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n').length;
      analysis.totalLines += lines;

      const ext = path.extname(file);
      analysis.languages.set(ext, (analysis.languages.get(ext) || 0) + 1);

      // Basic complexity analysis
      const complexity = this.calculateComplexity(content);
      analysis.complexity += complexity;
    }

    return {
      ...analysis,
      languages: Object.fromEntries(analysis.languages),
      averageComplexity: analysis.complexity / files.length
    };
  }

  private async getSourceFiles(targetPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c'];
    
    async function walk(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    }
    
    await walk(targetPath);
    return files;
  }

  private calculateComplexity(content: string): number {
    // Basic cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try',
      '&&', '||', '?', ':'
    ];
    
    let complexity = 1; // Base complexity
    
    for (const keyword of complexityKeywords) {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private async calculateMetrics(targetPath: string): Promise<any> {
    const files = await this.getSourceFiles(targetPath);
    let totalLines = 0;
    let totalFunctions = 0;
    let totalClasses = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      totalLines += content.split('\n').length;
      
      // Simple function/class counting
      totalFunctions += (content.match(/function\s+\w+/g) || []).length;
      totalFunctions += (content.match(/\w+\s*=\s*\([^)]*\)\s*=>/g) || []).length;
      totalClasses += (content.match(/class\s+\w+/g) || []).length;
    }

    return {
      files: files.length,
      totalLines,
      totalFunctions,
      totalClasses,
      averageLinesPerFile: Math.round(totalLines / files.length),
      functionsPerFile: Math.round(totalFunctions / files.length),
      classesPerFile: Math.round(totalClasses / files.length)
    };
  }
}