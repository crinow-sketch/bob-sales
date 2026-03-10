// === Sync Module ===
// Keeps data in sync between devices via the Python server.
// Works offline-first: localStorage is always the source of truth,
// and syncs merge with the server when connectivity is available.

const Sync = {
  // How often to auto-sync (in ms) — every 30 seconds
  INTERVAL: 30000,
  // Server URL — auto-detected from current page origin
  serverUrl: '',
  // State
  lastVersion: 0,
  isSyncing: false,
  isOnline: false,
  timer: null,

  init() {
    // Use the same origin the page was loaded from
    this.serverUrl = window.location.origin;
    this.lastVersion = parseInt(localStorage.getItem('bob_sync_version') || '0');

    // Set up UI
    this.createStatusIndicator();

    // Initial sync
    this.sync();

    // Auto-sync on interval
    this.timer = setInterval(() => this.sync(), this.INTERVAL);

    // Sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.sync();
    });

    // Sync when coming back online
    window.addEventListener('online', () => this.sync());
  },

  createStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-status';
    indicator.innerHTML = `
      <span id="sync-dot" class="sync-dot"></span>
      <span id="sync-text" class="sync-text">Connecting...</span>
    `;
    document.body.appendChild(indicator);
    this.updateUI('connecting');
  },

  updateUI(state, detail) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    dot.className = 'sync-dot sync-' + state;
    switch (state) {
      case 'synced':
        text.textContent = detail || 'Synced';
        break;
      case 'syncing':
        text.textContent = 'Syncing...';
        break;
      case 'offline':
        text.textContent = 'Offline';
        break;
      case 'connecting':
        text.textContent = 'Connecting...';
        break;
      case 'error':
        text.textContent = detail || 'Sync error';
        break;
    }
  },

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.updateUI('syncing');

    try {
      // Gather local data
      const localData = DB.exportAll();

      // Send to server and get merged result
      const response = await fetch(this.serverUrl + '/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localData),
      });

      if (!response.ok) throw new Error('Sync failed: ' + response.status);

      const merged = await response.json();

      // Check if server has newer data
      const serverVersion = merged.version || 0;
      if (serverVersion > this.lastVersion) {
        // Import merged data (this updates localStorage)
        DB.importAll(merged);
        this.lastVersion = serverVersion;
        localStorage.setItem('bob_sync_version', String(serverVersion));

        // Refresh the current page view if data changed
        if (App.currentPage) {
          App.refreshPage(App.currentPage);
        }
      }

      this.isOnline = true;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      this.updateUI('synced', 'Synced ' + timeStr);
    } catch (err) {
      if (!navigator.onLine || err.message.includes('fetch')) {
        this.isOnline = false;
        this.updateUI('offline');
      } else {
        this.updateUI('error', 'Sync error');
        console.warn('Sync error:', err);
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // Call this after any data change to trigger an immediate sync
  nudge() {
    // Debounce — wait 2 seconds after last change then sync
    clearTimeout(this._nudgeTimer);
    this._nudgeTimer = setTimeout(() => this.sync(), 2000);
  },
};
