    // ============================================
    // Copy to Clipboard
    // ============================================
    async function copyResults() {
      if (!lastResults) return;

      try {
        await navigator.clipboard.writeText(lastResults);
        const btn = document.getElementById('copyBtn');
        btn.classList.add('copied');
        btn.innerHTML = `
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Copied!
        `;
        showToast('Copied to clipboard', 'success');

        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            Copy
          `;
        }, 2000);
      } catch (err) {
        showToast('Failed to copy', 'error');
      }
    }

    // ============================================
    // JSON Syntax Highlighting
    // ============================================
    function highlightJSON(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }

      return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'json-key';
            } else {
              cls = 'json-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        });
    }

    function updateResults(content, isError = false) {
      const resultsEl = document.getElementById('results');
      const copyBtn = document.getElementById('copyBtn');

      if (isError) {
        resultsEl.innerHTML = `<pre style="color: var(--error);">${escapeHtml(content)}</pre>`;
        copyBtn.style.display = 'none';
        lastResults = '';
      } else {
        lastResults = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        resultsEl.innerHTML = `<pre>${highlightJSON(lastResults)}</pre>`;
        copyBtn.style.display = 'flex';
      }
    }
