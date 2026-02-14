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

      await checkAISupport();

      if (!aiSession && window.LanguageModel) {
        await initAISession();
        await checkAISupport();
      }

      if (!aiSession) {
        addChatMessage(
          'assistant',
          `Prompt API is not available. ${promptApiState.reason} Enable Prompt API in your browser, then reconnect.`
        );
        return;
      }

      await processWithAI(message);
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
      return messageEl;
    }

    function addToolCallMessage(toolName, args = {}) {
      const messagesContainer = document.getElementById('chatMessages');
      const messageEl = document.createElement('div');
      messageEl.className = 'chat-message tool-call tool-call-subtle';

      const detailsEl = createElement('details', { className: 'tool-call-details' });
      const summaryEl = createElement('summary', { className: 'tool-call-summary' });
      summaryEl.appendChild(createElement('span', { className: 'tool-call-label', text: 'Using tool' }));
      summaryEl.appendChild(createElement('span', { className: 'tool-name', text: toolName || 'Tool' }));

      const argsPreEl = createElement('pre', { className: 'tool-call-args' });
      argsPreEl.textContent = JSON.stringify(args || {}, null, 2);

      detailsEl.appendChild(summaryEl);
      detailsEl.appendChild(argsPreEl);
      messageEl.appendChild(detailsEl);

      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return messageEl;
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
