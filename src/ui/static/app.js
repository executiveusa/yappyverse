let socket;
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
        appendOutput(`✅ ${data.toolId}: ${data.result}`);
    });
    
    socket.on('tool-error', (data) => {
        appendOutput(`❌ Error in ${data.toolId}: ${data.error}`);
    });
    
    socket.on('voice-result', (data) => {
        if (data.recognized) {
            appendOutput(`🎤 Voice: ${data.message}`);
            if (data.action) {
                executeTool(data.action.tool, data.action.command, data.action.args);
            }
        } else {
            appendOutput(`🎤 Not recognized: ${data.message}`);
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
    appendOutput(`🔧 Executing ${command} on ${toolId}...`);
    
    if (socket && socket.connected) {
        socket.emit('tool-execute', { toolId, command, args });
    } else {
        // Fallback to HTTP API
        fetch(`/api/tools/${toolId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, args })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appendOutput(`✅ ${toolId}: ${data.message}`);
            } else {
                appendOutput(`❌ ${toolId}: ${data.message || 'Command failed'}`);
            }
        })
        .catch(error => {
            appendOutput(`❌ Network error: ${error.message}`);
        });
    }
}

function appendOutput(text) {
    const output = document.getElementById('output');
    const timestamp = new Date().toLocaleTimeString();
    output.textContent += `[${timestamp}] ${text}\n`;
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
        voiceTranscript.textContent = `You said: "${transcript}"`;
        
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
                    appendOutput(`🎤 ${data.message}`);
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
        appendOutput(`❌ Voice recognition error: ${event.error}`);
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
});