    // Mode switching
    function setMode(mode) {
      currentMode = mode;

      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      document.getElementById('toolsContainer').classList.toggle('hidden', mode !== 'tools');
      document.getElementById('chatContainer').classList.toggle('active', mode === 'chat');
      document.getElementById('panelTitle').textContent = mode === 'tools' ? 'Test Tool' : 'Chat with AI';
    }
