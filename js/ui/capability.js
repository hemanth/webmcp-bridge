    // Capability tab switching
    function selectCapability(cap) {
      currentCapability = cap;

      // Update tab active states
      document.querySelectorAll('.capability-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cap === cap);
      });

      // Show/hide content
      document.querySelectorAll('.capability-content').forEach(content => {
        content.classList.toggle('active', content.id === `${cap}Content`);
      });

      // Update panel title and button
      const panelTitle = document.getElementById('panelTitle');
      const executeBtn = document.getElementById('executeBtn');
      const toolSelectGroup = document.getElementById('toolSelect').closest('.form-group');
      const jsonArgsGroup = document.getElementById('jsonArgs').closest('.form-group');

      if (cap === 'tools') {
        panelTitle.textContent = 'Test Tool';
        executeBtn.textContent = 'Execute Tool';
        executeBtn.disabled = tools.length === 0;
        toolSelectGroup.style.display = 'block';
        jsonArgsGroup.style.display = 'block';
        if (selectedTool) renderDynamicParams();
      } else if (cap === 'prompts') {
        panelTitle.textContent = 'Test Prompt';
        executeBtn.textContent = 'Get Prompt';
        executeBtn.disabled = prompts.length === 0;
        toolSelectGroup.style.display = 'none';
        jsonArgsGroup.style.display = 'none';
        if (selectedPrompt) renderPromptParams();
      } else if (cap === 'resources') {
        panelTitle.textContent = 'Read Resource';
        executeBtn.textContent = 'Read Resource';
        executeBtn.disabled = resources.length === 0;
        toolSelectGroup.style.display = 'none';
        jsonArgsGroup.style.display = 'none';
        renderSelectedResourceSummary();
      }
    }

    function renderSelectedResourceSummary() {
      const container = document.getElementById('dynamicParams');
      clearElement(container);
      const wrapper = createElement('div', {
        attrs: { style: 'color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;' }
      });
      wrapper.appendChild(createElement('span', { text: 'Selected: ' }));
      wrapper.appendChild(createElement('strong', {
        text: selectedResource?.name || selectedResource?.uri || 'None'
      }));
      if (selectedResource?.mimeType) {
        wrapper.appendChild(createElement('br'));
        wrapper.appendChild(createElement('span', { text: `Type: ${selectedResource.mimeType}` }));
      }
      if (selectedResource?.description) {
        wrapper.appendChild(createElement('br'));
        wrapper.appendChild(createElement('span', { text: selectedResource.description }));
      }
      container.appendChild(wrapper);
    }

