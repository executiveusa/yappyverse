import { BaseTool, ToolCommand, ToolResult } from '../BaseTool';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export class TestingTool extends BaseTool {
  id = 'testing';
  name = 'Testing Tool';
  description = 'Automated testing, test coverage, and test generation';
  version = '1.0.0';

  commands: ToolCommand[] = [
    {
      name: 'run',
      description: 'Run all tests',
      execute: this.runTests.bind(this)
    },
    {
      name: 'coverage',
      description: 'Generate test coverage report',
      execute: this.generateCoverage.bind(this)
    },
    {
      name: 'generate',
      description: 'Generate test templates',
      execute: this.generateTests.bind(this)
    },
    {
      name: 'watch',
      description: 'Run tests in watch mode',
      execute: this.watchTests.bind(this)
    }
  ];

  async initialize(): Promise<void> {
    // Check for test frameworks
    const frameworks = ['jest', 'mocha', 'vitest', 'playwright'];
    for (const framework of frameworks) {
      try {
        await execAsync(`which ${framework}`);
        console.log(`Found test framework: ${framework}`);
      } catch {
        // Framework not found
      }
    }
  }

  private async runTests(args: any[]): Promise<ToolResult> {
    const testPattern = args[0] || '';
    
    try {
      const packageJson = await this.getPackageJson();
      const testScript = packageJson?.scripts?.test;
      
      if (!testScript) {
        return this.createResult(false, 'No test script found in package.json');
      }

      const command = testPattern ? `${testScript} ${testPattern}` : testScript;
      const { stdout, stderr } = await execAsync(`npm run test ${testPattern}`, {
        cwd: process.cwd(),
        timeout: 60000
      });

      const results = this.parseTestResults(stdout);
      
      return this.createResult(true, 'Tests completed', {
        output: stdout,
        errors: stderr,
        ...results
      });
    } catch (error) {
      return this.createResult(false, 'Test execution failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async generateCoverage(args: any[]): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await execAsync('npm run test -- --coverage', {
        cwd: process.cwd(),
        timeout: 120000
      });

      const coverageData = await this.parseCoverageData();
      
      return this.createResult(true, 'Coverage report generated', {
        output: stdout,
        coverage: coverageData
      });
    } catch (error) {
      return this.createResult(false, 'Coverage generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async generateTests(args: any[]): Promise<ToolResult> {
    const targetFile = args[0];
    
    if (!targetFile) {
      return this.createResult(false, 'Target file required for test generation');
    }

    try {
      const testTemplate = await this.createTestTemplate(targetFile);
      const testFilePath = this.getTestFilePath(targetFile);
      
      await fs.writeFile(testFilePath, testTemplate);
      
      return this.createResult(true, `Test template created: ${testFilePath}`, {
        testFile: testFilePath,
        template: testTemplate
      });
    } catch (error) {
      return this.createResult(false, 'Test generation failed', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async watchTests(args: any[]): Promise<ToolResult> {
    try {
      // Start tests in watch mode (non-blocking)
      const childProcess = exec('npm run test -- --watch', {
        cwd: process.cwd()
      });

      return this.createResult(true, 'Test watcher started', {
        pid: childProcess.pid,
        message: 'Tests are running in watch mode'
      });
    } catch (error) {
      return this.createResult(false, 'Failed to start test watcher', null, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async getPackageJson(): Promise<any> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private parseTestResults(output: string): any {
    // Parse common test output patterns
    const testPatterns = {
      jest: {
        total: /Tests:\s+(\d+) total/,
        passed: /(\d+) passed/,
        failed: /(\d+) failed/,
        skipped: /(\d+) skipped/
      }
    };

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };

    // Try to extract Jest results
    const totalMatch = output.match(testPatterns.jest.total);
    if (totalMatch) {
      results.total = parseInt(totalMatch[1]);
    }

    const passedMatch = output.match(testPatterns.jest.passed);
    if (passedMatch) {
      results.passed = parseInt(passedMatch[1]);
    }

    const failedMatch = output.match(testPatterns.jest.failed);
    if (failedMatch) {
      results.failed = parseInt(failedMatch[1]);
    }

    const skippedMatch = output.match(testPatterns.jest.skipped);
    if (skippedMatch) {
      results.skipped = parseInt(skippedMatch[1]);
    }

    return results;
  }

  private async parseCoverageData(): Promise<any> {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      const content = await fs.readFile(coveragePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        lines: { pct: 0 },
        statements: { pct: 0 },
        functions: { pct: 0 },
        branches: { pct: 0 }
      };
    }
  }

  private async createTestTemplate(targetFile: string): Promise<string> {
    const fileName = path.basename(targetFile, path.extname(targetFile));
    const className = fileName.charAt(0).toUpperCase() + fileName.slice(1);

    try {
      const sourceContent = await fs.readFile(targetFile, 'utf-8');
      const functions = this.extractFunctions(sourceContent);
      
      const testCases = functions.map(func => `
  describe('${func}', () => {
    it('should ${func.toLowerCase()} successfully', () => {
      // TODO: Implement test for ${func}
      expect(true).toBe(true);
    });

    it('should handle edge cases for ${func}', () => {
      // TODO: Implement edge case tests
      expect(true).toBe(true);
    });
  });`).join('\n');

      return `import { ${className} } from '${targetFile.replace(/\.(ts|js)$/, '')}';

describe('${className}', () => {${testCases}
});`;
    } catch {
      return `// Test file for ${targetFile}
describe('${className}', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});`;
    }
  }

  private extractFunctions(content: string): string[] {
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|(\w+)\s*\([^)]*\)\s*{)/g;
    const functions: string[] = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      if (functionName && !functions.includes(functionName)) {
        functions.push(functionName);
      }
    }

    return functions;
  }

  private getTestFilePath(targetFile: string): string {
    const ext = path.extname(targetFile);
    const baseName = path.basename(targetFile, ext);
    const dir = path.dirname(targetFile);
    
    // Try to place in __tests__ directory if it exists, otherwise alongside the file
    const testsDir = path.join(dir, '__tests__');
    const testDir = fs.access(testsDir).then(() => testsDir).catch(() => dir);
    
    return path.join(dir, `${baseName}.test${ext}`);
  }
}