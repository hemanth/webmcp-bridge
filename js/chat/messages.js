    // Chat functionality
    function handleChatKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    }

    async function sendChatMessage() {
      const input = document.getElementById('chatInput');
      const message = input.value.trim();
      if (!message) return;

      const messagesContainer = document.getElementById('chatMessages');

      // Clear empty state if present
      const emptyState = messagesContainer.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      // Add user message
      addChatMessage('user', message);
      input.value = '';

      // Process with AI or simple tool matching
      if (aiSession) {
        await processWithAI(message);
      } else {
        await processWithSimpleMatching(message);
      }
    }

    function addChatMessage(role, content, toolName = null) {
      const messagesContainer = document.getElementById('chatMessages');
      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${role}`;

      if (role === 'tool-call') {
        const toolNameEl = createElement('span', { className: 'tool-name', text: toolName || 'Tool' });
        messageEl.appendChild(toolNameEl);
        messageEl.appendChild(document.createTextNode(`: ${content}`));
      } else if (role === 'assistant') {
        // Render simple markdown: **bold**, - lists
        messageEl.innerHTML = renderSimpleMarkdown(content);
      } else {
        messageEl.textContent = content;
      }

      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderSimpleMarkdown(text) {
      return escapeHtml(text)
        // Bold: **text**
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic: *text*
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // List items: - item
        .replace(/^- (.+)$/gm, '• $1')
        // Line breaks
        .replace(/\n/g, '<br>');
    }
