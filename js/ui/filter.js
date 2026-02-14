    // ============================================
    // Search/Filter
    // ============================================
    function filterItems() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();

      if (currentCapability === 'tools') {
        filterToolList(query);
      } else if (currentCapability === 'prompts') {
        filterPromptList(query);
      } else if (currentCapability === 'resources') {
        filterResourceList(query);
      }
    }

    function filterToolList(query) {
      document.querySelectorAll('.tool-item').forEach(item => {
        const name = item.querySelector('.tool-name')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.tool-desc')?.textContent.toLowerCase() || '';
        const matches = !query || name.includes(query) || desc.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }

    function filterPromptList(query) {
      document.querySelectorAll('.prompt-item').forEach(item => {
        const name = item.querySelector('.prompt-name')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.prompt-desc')?.textContent.toLowerCase() || '';
        const matches = !query || name.includes(query) || desc.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }

    function filterResourceList(query) {
      document.querySelectorAll('.resource-item').forEach(item => {
        const uri = item.querySelector('.resource-uri')?.textContent.toLowerCase() || '';
        const type = item.querySelector('.resource-type')?.textContent.toLowerCase() || '';
        const matches = !query || uri.includes(query) || type.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }
