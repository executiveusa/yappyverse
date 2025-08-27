import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { ToolBoxxConfig } from '../config/ConfigManager';
import * as path from 'path';
import * as fs from 'fs/promises';

export class UIServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private isRunning = false;

  constructor(private config: ToolBoxxConfig) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  async initialize(): Promise<void> {
    await this.createStaticFiles();
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        this.isRunning = true;
        console.log(`🌐 UI Server running at http://localhost:${port}`);
        resolve();
      });

      this.server.on('error', (error: any) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.isRunning && this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      });
    }
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../ui/static')));
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  private setupRoutes(): void {
    // Main dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../ui/static/index.html'));
    });

    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        config: {
          voiceCommands: this.config.ui.voiceCommandsEnabled,
          monetization: this.config.monetization.enabled,
          agentProtocol: true
        }
      });
    });

    this.app.get('/api/tools', (req, res) => {
      res.json({
        enabled: this.config.tools.enabled,
        available: [
          'code-analysis',
          'testing',
          'deployment',
          'monitoring',
          'security',
          'documentation',
          'collaboration'
        ]
      });
    });

    this.app.post('/api/tools/:toolId/execute', (req, res) => {
      const { toolId } = req.params;
      const { command, args } = req.body;
      
      // This would integrate with ToolManager in a real implementation
      res.json({
        success: true,
        message: `Executed ${command} on ${toolId}`,
        data: { toolId, command, args },
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/voice/status', (req, res) => {
      res.json({
        enabled: this.config.ui.voiceCommandsEnabled,
        supported: true,
        commands: [
          'analyze code',
          'run tests',
          'deploy staging',
          'check health',
          'scan security',
          'generate docs',
          'start collaboration'
        ]
      });
    });

    this.app.post('/api/voice/command', (req, res) => {
      const { transcript } = req.body;
      const result = this.processVoiceCommand(transcript);
      res.json(result);
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('🔌 Client connected to UI server');

      socket.on('voice-command', (data) => {
        const result = this.processVoiceCommand(data.transcript);
        socket.emit('voice-result', result);
      });

      socket.on('tool-execute', async (data) => {
        try {
          // Simulate tool execution
          const result = {
            success: true,
            toolId: data.toolId,
            command: data.command,
            result: `Executed ${data.command} successfully`,
            timestamp: new Date().toISOString()
          };
          
          socket.emit('tool-result', result);
        } catch (error) {
          socket.emit('tool-error', {
            error: error instanceof Error ? error.message : String(error),
            toolId: data.toolId,
            command: data.command
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected from UI server');
      });
    });
  }

  private processVoiceCommand(transcript: string): any {
    const lowerTranscript = transcript.toLowerCase();
    
    const commands = [
      {
        patterns: ['analyze code', 'code analysis', 'analyze'],
        action: { tool: 'code-analysis', command: 'analyze' }
      },
      {
        patterns: ['run tests', 'test', 'testing'],
        action: { tool: 'testing', command: 'run' }
      },
      {
        patterns: ['deploy staging', 'deploy to staging'],
        action: { tool: 'deployment', command: 'deploy', args: ['staging'] }
      },
      {
        patterns: ['deploy production', 'deploy to production'],
        action: { tool: 'deployment', command: 'deploy', args: ['production'] }
      },
      {
        patterns: ['check health', 'health check', 'status'],
        action: { tool: 'monitoring', command: 'health' }
      },
      {
        patterns: ['scan security', 'security scan', 'vulnerability scan'],
        action: { tool: 'security', command: 'scan' }
      },
      {
        patterns: ['generate docs', 'create documentation', 'document'],
        action: { tool: 'documentation', command: 'generate' }
      },
      {
        patterns: ['start collaboration', 'team chat', 'collaborate'],
        action: { tool: 'collaboration', command: 'chat', args: ['status'] }
      }
    ];

    for (const cmd of commands) {
      if (cmd.patterns.some(pattern => lowerTranscript.includes(pattern))) {
        return {
          recognized: true,
          transcript,
          action: cmd.action,
          message: `Executing: ${cmd.action.command} on ${cmd.action.tool}`,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      recognized: false,
      transcript,
      message: 'Command not recognized. Try: "analyze code", "run tests", "deploy staging", etc.',
      timestamp: new Date().toISOString()
    };
  }

  private async createStaticFiles(): Promise<void> {
    const staticDir = path.join(__dirname, '../ui/static');
    await fs.mkdir(staticDir, { recursive: true });

    // Create main HTML file
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>THE TOOLBOXX - Universal Agentic Patch</title>
    <link rel="stylesheet" href="styles.css">
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🛠️ THE TOOLBOXX</h1>
            <p>Universal Agentic Patch Dashboard</p>
            <div class="status-indicator" id="status">
                <span class="status-dot"></span>
                <span>Initializing...</span>
            </div>
        </header>

        <main class="main-content">
            <div class="tools-grid">
                <div class="tool-card" data-tool="code-analysis">
                    <div class="tool-icon">🔍</div>
                    <h3>Code Analysis</h3>
                    <p>Static analysis and quality metrics</p>
                    <button onclick="executeTool('code-analysis', 'analyze')">Analyze</button>
                </div>
                
                <div class="tool-card" data-tool="testing">
                    <div class="tool-icon">🧪</div>
                    <h3>Testing</h3>
                    <p>Automated testing and coverage</p>
                    <button onclick="executeTool('testing', 'run')">Run Tests</button>
                </div>
                
                <div class="tool-card" data-tool="deployment">
                    <div class="tool-icon">🚀</div>
                    <h3>Deployment</h3>
                    <p>CI/CD and environment management</p>
                    <button onclick="executeTool('deployment', 'status')">Check Status</button>
                </div>
                
                <div class="tool-card" data-tool="monitoring">
                    <div class="tool-icon">📊</div>
                    <h3>Monitoring</h3>
                    <p>Performance metrics and alerting</p>
                    <button onclick="executeTool('monitoring', 'metrics')">View Metrics</button>
                </div>
                
                <div class="tool-card" data-tool="security">
                    <div class="tool-icon">🛡️</div>
                    <h3>Security</h3>
                    <p>Vulnerability scanning and compliance</p>
                    <button onclick="executeTool('security', 'scan')">Security Scan</button>
                </div>
                
                <div class="tool-card" data-tool="documentation">
                    <div class="tool-icon">📚</div>
                    <h3>Documentation</h3>
                    <p>Automated doc generation</p>
                    <button onclick="executeTool('documentation', 'generate')">Generate Docs</button>
                </div>
                
                <div class="tool-card" data-tool="collaboration">
                    <div class="tool-icon">🤝</div>
                    <h3>Collaboration</h3>
                    <p>Team communication and reviews</p>
                    <button onclick="executeTool('collaboration', 'team')">Team Status</button>
                </div>
            </div>

            <div class="voice-control" ${this.config.ui.voiceCommandsEnabled ? '' : 'style="display:none"'}>
                <h3>🎤 Voice Commands</h3>
                <button id="voiceBtn" onclick="startVoiceRecognition()">Start Listening</button>
                <div id="voiceStatus">Click to start voice commands</div>
                <div id="voiceTranscript"></div>
            </div>

            <div class="output-panel">
                <h3>📋 Output</h3>
                <div id="output" class="output-content">
                    Welcome to THE TOOLBOXX! Click on any tool to get started.
                </div>
            </div>
        </main>
    </div>

    <script src="app.js"></script>
</body>
</html>`;

    const cssContent = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    text-align: center;
    margin-bottom: 40px;
    color: white;
}

.header h1 {
    font-size: 3rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.header p {
    font-size: 1.2rem;
    opacity: 0.9;
}

.status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.2);
    padding: 8px 16px;
    border-radius: 20px;
    margin-top: 20px;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.main-content {
    background: white;
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.tool-card {
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 15px;
    padding: 25px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
}

.tool-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0,0,0,0.1);
    border-color: #667eea;
}

.tool-icon {
    font-size: 3rem;
    margin-bottom: 15px;
}

.tool-card h3 {
    font-size: 1.5rem;
    margin-bottom: 10px;
    color: #2d3748;
}

.tool-card p {
    color: #718096;
    margin-bottom: 20px;
}

.tool-card button {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.3s ease;
}

.tool-card button:hover {
    background: #5a67d8;
}

.voice-control {
    background: #f0fff4;
    border: 2px solid #68d391;
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 30px;
    text-align: center;
}

.voice-control h3 {
    margin-bottom: 15px;
    color: #2d3748;
}

#voiceBtn {
    background: #48bb78;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 15px;
}

#voiceBtn:hover {
    background: #38a169;
}

#voiceBtn.listening {
    background: #e53e3e;
    animation: pulse 1s infinite;
}

.output-panel {
    background: #1a202c;
    border-radius: 15px;
    padding: 25px;
    color: white;
}

.output-panel h3 {
    margin-bottom: 15px;
    color: #e2e8f0;
}

.output-content {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    max-height: 300px;
    overflow-y: auto;
    background: #2d3748;
    padding: 15px;
    border-radius: 8px;
    white-space: pre-wrap;
}

@media (max-width: 768px) {
    .tools-grid {
        grid-template-columns: 1fr;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .container {
        padding: 10px;
    }
}`;

    const jsContent = `let socket;
let recognition;

// Initialize WebSocket connection
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        updateStatus('Connected', 'connected');
    });
    
    socket.on('disconnect', () => {
        updateStatus('Disconnected', 'disconnected');
    });
    
    socket.on('tool-result', (data) => {
        appendOutput(\`✅ \${data.toolId}: \${data.result}\`);
    });
    
    socket.on('tool-error', (data) => {
        appendOutput(\`❌ Error in \${data.toolId}: \${data.error}\`);
    });
    
    socket.on('voice-result', (data) => {
        if (data.recognized) {
            appendOutput(\`🎤 Voice: \${data.message}\`);
            if (data.action) {
                executeTool(data.action.tool, data.action.command, data.action.args);
            }
        } else {
            appendOutput(\`🎤 Not recognized: \${data.message}\`);
        }
    });
}

function updateStatus(text, state) {
    const statusEl = document.getElementById('status');
    const statusDot = statusEl.querySelector('.status-dot');
    
    statusEl.querySelector('span:last-child').textContent = text;
    
    if (state === 'connected') {
        statusDot.style.background = '#4ade80';
    } else if (state === 'disconnected') {
        statusDot.style.background = '#ef4444';
    }
}

function executeTool(toolId, command, args = []) {
    appendOutput(\`🔧 Executing \${command} on \${toolId}...\`);
    
    if (socket && socket.connected) {
        socket.emit('tool-execute', { toolId, command, args });
    } else {
        // Fallback to HTTP API
        fetch(\`/api/tools/\${toolId}/execute\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, args })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appendOutput(\`✅ \${toolId}: \${data.message}\`);
            } else {
                appendOutput(\`❌ \${toolId}: \${data.message || 'Command failed'}\`);
            }
        })
        .catch(error => {
            appendOutput(\`❌ Network error: \${error.message}\`);
        });
    }
}

function appendOutput(text) {
    const output = document.getElementById('output');
    const timestamp = new Date().toLocaleTimeString();
    output.textContent += \`[\${timestamp}] \${text}\\n\`;
    output.scrollTop = output.scrollHeight;
}

function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        appendOutput('❌ Voice recognition not supported in this browser');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceTranscript = document.getElementById('voiceTranscript');
    
    recognition.onstart = () => {
        voiceBtn.textContent = 'Listening...';
        voiceBtn.classList.add('listening');
        voiceStatus.textContent = 'Listening for commands...';
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        voiceTranscript.textContent = \`You said: "\${transcript}"\`;
        
        if (socket && socket.connected) {
            socket.emit('voice-command', { transcript });
        } else {
            // Fallback to HTTP API
            fetch('/api/voice/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            })
            .then(response => response.json())
            .then(data => {
                if (data.recognized && data.action) {
                    executeTool(data.action.tool, data.action.command, data.action.args);
                } else {
                    appendOutput(\`🎤 \${data.message}\`);
                }
            });
        }
    };
    
    recognition.onend = () => {
        voiceBtn.textContent = 'Start Listening';
        voiceBtn.classList.remove('listening');
        voiceStatus.textContent = 'Click to start voice commands';
    };
    
    recognition.onerror = (event) => {
        appendOutput(\`❌ Voice recognition error: \${event.error}\`);
        voiceBtn.textContent = 'Start Listening';
        voiceBtn.classList.remove('listening');
    };
    
    recognition.start();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    appendOutput('🛠️ THE TOOLBOXX Dashboard initialized');
    appendOutput('Select a tool or use voice commands to get started');
});`;

    await fs.writeFile(path.join(staticDir, 'index.html'), htmlContent);
    await fs.writeFile(path.join(staticDir, 'styles.css'), cssContent);
    await fs.writeFile(path.join(staticDir, 'app.js'), jsContent);
  }
}