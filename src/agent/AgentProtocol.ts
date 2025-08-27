import { WebSocketServer, WebSocket } from 'ws';
import { ToolBoxxConfig } from '../config/ConfigManager';
import chalk from 'chalk';
import { EventEmitter } from 'events';

export interface AgentMessage {
  id: string;
  type: 'request' | 'response' | 'notification' | 'heartbeat';
  from: string;
  to: string;
  command?: string;
  data?: any;
  timestamp: string;
  version: string;
}

export interface ConnectedAgent {
  id: string;
  socket: WebSocket;
  lastSeen: Date;
  capabilities: string[];
  status: 'connected' | 'busy' | 'idle';
  metadata: any;
}

export class AgentProtocol extends EventEmitter {
  private server!: WebSocketServer;
  private connectedAgents: Map<string, ConnectedAgent> = new Map();
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;

  constructor(private config: ToolBoxxConfig) {
    super();
  }

  async initialize(): Promise<void> {
    // Set up message routing and handlers
    this.setupMessageHandlers();
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({ 
          port: this.config.agent.port,
          host: '0.0.0.0'
        });

        this.server.on('connection', (socket: WebSocket, request) => {
          this.handleNewConnection(socket, request);
        });

        this.server.on('listening', () => {
          console.log(chalk.blue(`🤖 Agent Protocol listening on port ${this.config.agent.port}`));
          this.startHeartbeat();
          resolve();
        });

        this.server.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(chalk.yellow('🤖 Agent Protocol stopped'));
          resolve();
        });
      });
    }
  }

  async showStatus(): Promise<void> {
    console.log(chalk.blue('\n🤖 Agent Protocol Status\n'));
    console.log(`${chalk.bold('Server Status')}: ${this.server ? chalk.green('Running') : chalk.red('Stopped')}`);
    console.log(`${chalk.bold('Port')}: ${this.config.agent.port}`);
    console.log(`${chalk.bold('Agent ID')}: ${this.config.agent.id}`);
    console.log(`${chalk.bold('Protocol Version')}: ${this.config.agent.protocolVersion}`);
    console.log(`${chalk.bold('Connected Agents')}: ${this.connectedAgents.size}\n`);

    if (this.connectedAgents.size > 0) {
      console.log(chalk.blue('Connected Agents:'));
      for (const [id, agent] of this.connectedAgents) {
        const lastSeen = Math.round((Date.now() - agent.lastSeen.getTime()) / 1000);
        console.log(`  ${chalk.green('●')} ${id} - ${agent.status} (last seen: ${lastSeen}s ago)`);
        console.log(`    Capabilities: ${agent.capabilities.join(', ')}`);
      }
    }
  }

  async connectToAgent(agentId: string): Promise<void> {
    console.log(chalk.yellow(`🔗 Attempting to connect to agent: ${agentId}`));
    
    // In a real implementation, this would establish an outbound connection
    // For now, we'll simulate the connection process
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: 'request',
      from: this.config.agent.id,
      to: agentId,
      command: 'connect',
      data: {
        capabilities: this.config.tools.enabled,
        version: this.config.agent.protocolVersion
      },
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    };

    // Add to message queue for when the agent connects
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
    this.messageQueue.get(agentId)!.push(message);

    console.log(chalk.green(`✅ Connection request queued for ${agentId}`));
  }

  private handleNewConnection(socket: WebSocket, _request: any): void {
    console.log(chalk.blue('🔗 New agent connection attempt'));

    socket.on('message', (data: Buffer) => {
      try {
        const message: AgentMessage = JSON.parse(data.toString());
        this.handleMessage(socket, message);
      } catch (error) {
        console.error(chalk.red('❌ Invalid message format:'), error);
        this.sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      this.handleDisconnection(socket);
    });

    socket.on('error', (error) => {
      console.error(chalk.red('❌ Agent socket error:'), error);
    });

    // Send welcome message
    this.sendMessage(socket, {
      id: this.generateMessageId(),
      type: 'notification',
      from: this.config.agent.id,
      to: 'unknown',
      command: 'welcome',
      data: {
        message: 'Welcome to THE TOOLBOXX Agent Protocol',
        version: this.config.agent.protocolVersion,
        serverCapabilities: this.config.tools.enabled
      },
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    });
  }

  private handleMessage(socket: WebSocket, message: AgentMessage): void {
    console.log(chalk.gray(`📨 Message from ${message.from}: ${message.command || message.type}`));

    switch (message.command) {
      case 'register':
        this.handleRegistration(socket, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(socket, message);
        break;
      case 'execute':
        this.handleExecuteRequest(socket, message);
        break;
      case 'status':
        this.handleStatusRequest(socket, message);
        break;
      case 'broadcast':
        this.handleBroadcast(socket, message);
        break;
      default:
        this.handleUnknownCommand(socket, message);
    }

    // Update last seen time if agent is registered
    const agent = this.connectedAgents.get(message.from);
    if (agent) {
      agent.lastSeen = new Date();
    }
  }

  private handleRegistration(socket: WebSocket, message: AgentMessage): void {
    const { data } = message;
    const agentId = message.from;

    if (!data || !data.capabilities) {
      this.sendError(socket, 'Registration requires capabilities information');
      return;
    }

    const agent: ConnectedAgent = {
      id: agentId,
      socket,
      lastSeen: new Date(),
      capabilities: data.capabilities || [],
      status: 'idle',
      metadata: data.metadata || {}
    };

    this.connectedAgents.set(agentId, agent);
    console.log(chalk.green(`✅ Agent registered: ${agentId}`));

    // Send confirmation
    this.sendMessage(socket, {
      id: this.generateMessageId(),
      type: 'response',
      from: this.config.agent.id,
      to: agentId,
      command: 'register',
      data: {
        success: true,
        agentId,
        serverCapabilities: this.config.tools.enabled
      },
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    });

    // Send any queued messages
    const queuedMessages = this.messageQueue.get(agentId);
    if (queuedMessages) {
      for (const queuedMessage of queuedMessages) {
        this.sendMessage(socket, queuedMessage);
      }
      this.messageQueue.delete(agentId);
    }

    this.emit('agent-connected', agent);
  }

  private handleHeartbeat(socket: WebSocket, message: AgentMessage): void {
    const agent = this.connectedAgents.get(message.from);
    if (agent) {
      agent.lastSeen = new Date();
      if (message.data?.status) {
        agent.status = message.data.status;
      }

      // Send heartbeat response
      this.sendMessage(socket, {
        id: this.generateMessageId(),
        type: 'response',
        from: this.config.agent.id,
        to: message.from,
        command: 'heartbeat',
        data: { received: true },
        timestamp: new Date().toISOString(),
        version: this.config.agent.protocolVersion
      });
    }
  }

  private handleExecuteRequest(socket: WebSocket, message: AgentMessage): void {
    const { data } = message;
    
    if (!data || !data.tool || !data.command) {
      this.sendError(socket, 'Execute request requires tool and command');
      return;
    }

    // Simulate tool execution
    console.log(chalk.blue(`🔧 Executing ${data.command} on ${data.tool} for agent ${message.from}`));

    // Send response
    this.sendMessage(socket, {
      id: this.generateMessageId(),
      type: 'response',
      from: this.config.agent.id,
      to: message.from,
      command: 'execute',
      data: {
        success: true,
        tool: data.tool,
        command: data.command,
        result: `Executed ${data.command} successfully`,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    });
  }

  private handleStatusRequest(socket: WebSocket, message: AgentMessage): void {
    const status = {
      agentId: this.config.agent.id,
      version: this.config.agent.protocolVersion,
      capabilities: this.config.tools.enabled,
      connectedAgents: Array.from(this.connectedAgents.keys()),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    this.sendMessage(socket, {
      id: this.generateMessageId(),
      type: 'response',
      from: this.config.agent.id,
      to: message.from,
      command: 'status',
      data: status,
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    });
  }

  private handleBroadcast(socket: WebSocket, message: AgentMessage): void {
    console.log(chalk.blue(`📢 Broadcasting message from ${message.from}`));

    // Forward message to all connected agents except sender
    for (const [agentId, agent] of this.connectedAgents) {
      if (agentId !== message.from && agent.socket !== socket) {
        this.sendMessage(agent.socket, {
          ...message,
          id: this.generateMessageId(),
          type: 'notification'
        });
      }
    }
  }

  private handleUnknownCommand(socket: WebSocket, message: AgentMessage): void {
    this.sendError(socket, `Unknown command: ${message.command}`);
  }

  private handleDisconnection(socket: WebSocket): void {
    // Find and remove the disconnected agent
    for (const [agentId, agent] of this.connectedAgents) {
      if (agent.socket === socket) {
        this.connectedAgents.delete(agentId);
        console.log(chalk.yellow(`🔌 Agent disconnected: ${agentId}`));
        this.emit('agent-disconnected', agentId);
        break;
      }
    }
  }

  private sendMessage(socket: WebSocket, message: AgentMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private sendError(socket: WebSocket, error: string): void {
    this.sendMessage(socket, {
      id: this.generateMessageId(),
      type: 'response',
      from: this.config.agent.id,
      to: 'unknown',
      data: { error },
      timestamp: new Date().toISOString(),
      version: this.config.agent.protocolVersion
    });
  }

  private setupMessageHandlers(): void {
    // Set up event handlers for different message types
    this.on('agent-connected', (agent: ConnectedAgent) => {
      console.log(chalk.green(`🤖 Agent ${agent.id} connected with capabilities: ${agent.capabilities.join(', ')}`));
    });

    this.on('agent-disconnected', (agentId: string) => {
      console.log(chalk.yellow(`🤖 Agent ${agentId} disconnected`));
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      // Check for stale connections (no heartbeat for 60 seconds)
      for (const [agentId, agent] of this.connectedAgents) {
        const timeSinceLastSeen = now - agent.lastSeen.getTime();
        
        if (timeSinceLastSeen > 60000) { // 60 seconds
          console.log(chalk.yellow(`⚠️  Agent ${agentId} appears stale, removing`));
          agent.socket.terminate();
          this.connectedAgents.delete(agentId);
          this.emit('agent-disconnected', agentId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external use
  public broadcastToAgents(message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>): void {
    const fullMessage: AgentMessage = {
      id: this.generateMessageId(),
      from: this.config.agent.id,
      timestamp: new Date().toISOString(),
      ...message
    };

    for (const agent of this.connectedAgents.values()) {
      this.sendMessage(agent.socket, fullMessage);
    }
  }

  public sendToAgent(agentId: string, message: Omit<AgentMessage, 'id' | 'from' | 'to' | 'timestamp'>): boolean {
    const agent = this.connectedAgents.get(agentId);
    if (!agent) {
      return false;
    }

    const fullMessage: AgentMessage = {
      id: this.generateMessageId(),
      from: this.config.agent.id,
      to: agentId,
      timestamp: new Date().toISOString(),
      ...message
    };

    this.sendMessage(agent.socket, fullMessage);
    return true;
  }

  public getConnectedAgents(): ConnectedAgent[] {
    return Array.from(this.connectedAgents.values());
  }
}