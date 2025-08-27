export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
  commands: ToolCommand[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ToolCommand {
  name: string;
  description: string;
  execute: (args: any[]) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

export abstract class BaseTool implements Tool {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract commands: ToolCommand[];
  
  enabled: boolean = false;
  dependencies?: string[];

  async initialize(): Promise<void> {
    // Default initialization - can be overridden
  }

  async shutdown(): Promise<void> {
    // Default shutdown - can be overridden
  }

  protected createResult(success: boolean, message: string, data?: any, errors?: string[]): ToolResult {
    return { success, message, data, errors };
  }
}