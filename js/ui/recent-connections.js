    // ============================================
    // Recent Connections
    // ============================================
    function addToRecentConnections(url) {
      try {
        new URL(url);
      } catch {
        return;
      }
      // Remove if already exists
      recentConnections = recentConnections.filter(c => c.url !== url);
      // Add to beginning
      recentConnections.unshift({ url, timestamp: Date.now() });
      // Keep only last 5
      recentConnections = recentConnections.slice(0, 5);
      localStorage.setItem('mcp_recent_connections', JSON.stringify(recentConnections));
    }

    function showRecentConnections() {
      const container = document.getElementById('recentConnections');
      if (recentConnections.length === 0) {
        container.classList.remove('active');
        return;
      }

      clearElement(container);
      recentConnections.forEach((conn) => {
        const item = createElement('div', {
          className: 'recent-item',
          attrs: { tabindex: '0', role: 'button', 'aria-label': `Connect to ${conn.url}` },
          on: {
            mousedown: () => selectRecentConnection(conn.url),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectRecentConnection(conn.url);
              }
            }
          }
        });
        item.appendChild(createElement('span', { className: 'recent-item-url', text: conn.url }));
        item.appendChild(createElement('span', { className: 'recent-item-time', text: getTimeAgo(conn.timestamp) }));
        item.appendChild(createElement('button', {
          className: 'recent-item-remove',
          text: '×',
          attrs: { 'aria-label': `Remove ${conn.url} from recent connections` },
          on: {
            mousedown: (event) => {
              event.stopPropagation();
              removeRecentConnection(conn.url);
            }
          }
        }));
        container.appendChild(item);
      });

      container.classList.add('active');
    }

    function hideRecentConnectionsDelayed() {
      setTimeout(() => {
        document.getElementById('recentConnections').classList.remove('active');
      }, 200);
    }

    function selectRecentConnection(url) {
      document.getElementById('serverUrl').value = url;
      document.getElementById('recentConnections').classList.remove('active');
      connectToServer();
    }

    function removeRecentConnection(url) {
      recentConnections = recentConnections.filter(c => c.url !== url);
      localStorage.setItem('mcp_recent_connections', JSON.stringify(recentConnections));
      showRecentConnections();
    }

    function getTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    }
