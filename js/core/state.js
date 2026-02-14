    // State
    let tools = [];
    let prompts = [];
    let resources = [];
    let selectedTool = null;
    let selectedPrompt = null;
    let selectedResource = null;
    let serverUrl = '';
    let currentMode = 'tools';
    let currentCapability = 'tools';
    let aiSession = null;
    let debugLogs = [];
    let recentConnections = JSON.parse(localStorage.getItem('mcp_recent_connections') || '[]');
    let lastResults = '';
    const MAX_DEBUG_LOGS = 1000;
