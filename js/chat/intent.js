    async function processWithAI(message) {
      try {
        addChatMessage('assistant', 'Thinking...');

        const response = await aiSession.prompt(message);

        // Remove "Thinking..." message
        const messages = document.querySelectorAll('.chat-message.assistant');
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.textContent === 'Thinking...') {
          lastMsg.textContent = response;
        }


        // Check if AI wants to use a tool (simple heuristic)
        const toolMatch = tools.find(t =>
          response.toLowerCase().includes(t.name.toLowerCase()) ||
          response.toLowerCase().includes('let me search') ||
          response.toLowerCase().includes('i\'ll look')
        );

        if (toolMatch) {
          // Extract potential arguments from context
          await executeToolFromChat(toolMatch.name, {});
        }

      } catch (error) {
        addChatMessage('assistant', `Error: ${error.message}`);
      }
    }

    async function processWithSimpleMatching(message) {
      // Simple keyword matching to find relevant tool
      const lowerMessage = message.toLowerCase();

      let matchedTool = null;
      let args = {};

      // Check for specific tool patterns first
      if (lowerMessage.includes('stage') && lowerMessage.match(/\d/)) {
        // "stage 3 proposals" or "list stage 2"
        matchedTool = tools.find(t => t.name === 'list_proposals_by_stage');
      } else if (lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('versus')) {
        matchedTool = tools.find(t => t.name === 'compare_proposals');
      } else if (lowerMessage.includes('champion')) {
        matchedTool = tools.find(t => t.name === 'get_champions');
      } else if (lowerMessage.includes('summary') || lowerMessage.includes('count') || lowerMessage.includes('how many')) {
        matchedTool = tools.find(t => t.name === 'get_stage_summary');
      } else {
        // Try keyword matching from tool names/descriptions
        for (const tool of tools) {
          const toolWords = tool.name.toLowerCase().split('_');
          const descWords = (tool.description || '').toLowerCase().split(' ');

          if (toolWords.some(w => lowerMessage.includes(w)) ||
              descWords.some(w => w.length > 4 && lowerMessage.includes(w))) {
            matchedTool = tool;
            break;
          }
        }
      }

      // Default to search_proposals for any unmatched query
      if (!matchedTool && message.trim().length > 0) {
        matchedTool = tools.find(t => t.name === 'search_proposals') || tools[0];
      }

      if (matchedTool) {
        // Extract search term from natural language query
        args = extractArgsFromMessage(message, matchedTool);

        addChatMessage('tool-call', `Calling with args: ${JSON.stringify(args)}`, matchedTool.name);
        await executeToolFromChat(matchedTool.name, args);
      } else {
        addChatMessage('assistant', `I found ${tools.length} tools available. Try asking about: ${tools.slice(0, 5).map(t => t.name).join(', ')}...`);
      }
    }

    function extractArgsFromMessage(message, tool) {
      const args = {};
      const schema = tool.inputSchema;
      const properties = schema?.properties || {};
      const lowerMessage = message.toLowerCase();

      // Common filler words to remove
      const stopWords = [
        'what', 'are', 'is', 'the', 'a', 'an', 'that', 'which', 'how', 'do', 'does',
        'can', 'could', 'would', 'should', 'will', 'about', 'for', 'with', 'using',
        'uses', 'use', 'find', 'search', 'show', 'me', 'list', 'get', 'proposals',
        'proposal', 'stage', 'by', 'in', 'of', 'to', 'and', 'or', 'any', 'all'
      ];

      // Check if tool needs a 'query' parameter
      if (properties.query) {
        // Extract meaningful words from message
        const words = message.split(/\s+/);
        const meaningful = words.filter(w => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
          return clean.length > 1 && !stopWords.includes(clean);
        });

        // Use the most specific term (often capitalized or quoted)
        const quoted = message.match(/["']([^"']+)["']/);
        if (quoted) {
          args.query = quoted[1];
        } else if (meaningful.length > 0) {
          // Prefer capitalized words as they're likely proper terms
          const capitalized = meaningful.filter(w => /^[A-Z]/.test(w));
          args.query = capitalized.length > 0 ? capitalized.join(' ') : meaningful.join(' ');
        } else {
          args.query = message;
        }
      }

      // Check for 'stage' parameter (number extraction)
      if (properties.stage) {
        const stageMatch = lowerMessage.match(/stage\s*(\d+)/);
        if (stageMatch) {
          args.stage = parseInt(stageMatch[1]);
        }
      }

      // Check for 'id' parameter
      if (properties.id) {
        // Look for quoted strings or specific identifiers
        const quoted = message.match(/["']([^"']+)["']/);
        if (quoted) {
          args.id = quoted[1];
        }
      }

      // Check for comparison parameters (id1, id2)
      if (properties.id1 && properties.id2) {
        const quoted = message.match(/["']([^"']+)["']/g);
        if (quoted && quoted.length >= 2) {
          args.id1 = quoted[0].replace(/["']/g, '');
          args.id2 = quoted[1].replace(/["']/g, '');
        }
      }

      return args;
    }
