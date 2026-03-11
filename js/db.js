// === Database Layer (localStorage) ===
const DB = {
  KEYS: {
    accounts: 'bob_accounts',
    activities: 'bob_activities',
    pipeline: 'bob_pipeline',
    sales: 'bob_sales',
    routes: 'bob_routes',
  },

  // Generate a simple unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Get all items from a collection (excludes soft-deleted items)
  getAll(key) {
    try {
      const items = JSON.parse(localStorage.getItem(this.KEYS[key])) || [];
      return items.filter(item => !item._deleted);
    } catch {
      return [];
    }
  },

  // Get ALL items including soft-deleted ones (for sync)
  getAllRaw(key) {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS[key])) || [];
    } catch {
      return [];
    }
  },

  // Save entire collection
  saveAll(key, data) {
    localStorage.setItem(this.KEYS[key], JSON.stringify(data));
    // Trigger sync after data change
    if (typeof Sync !== 'undefined' && Sync.nudge) Sync.nudge();
  },

  // Get single item by ID
  getById(key, id) {
    return this.getAll(key).find(item => item.id === id) || null;
  },

  // Add a new item
  add(key, item) {
    const items = this.getAllRaw(key);
    item.id = item.id || this.uid();
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    items.push(item);
    this.saveAll(key, items);
    return item;
  },

  // Update an existing item (only updates non-deleted items)
  update(key, id, updates) {
    const items = this.getAllRaw(key);
    const idx = items.findIndex(item => item.id === id && !item._deleted);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveAll(key, items);
    return items[idx];
  },

  // Soft-delete an item (marks _deleted so it propagates through sync)
  remove(key, id) {
    const items = this.getAllRaw(key);
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return;
    items[idx]._deleted = true;
    items[idx].updatedAt = new Date().toISOString();
    this.saveAll(key, items);
  },

  // === Account helpers ===
  getAccounts() { return this.getAll('accounts'); },
  addAccount(acct) { return this.add('accounts', acct); },
  updateAccount(id, data) { return this.update('accounts', id, data); },
  removeAccount(id) { this.remove('accounts', id); },

  // === Activity helpers ===
  getActivities() { return this.getAll('activities'); },
  addActivity(act) { return this.add('activities', act); },
  updateActivity(id, data) { return this.update('activities', id, data); },
  removeActivity(id) { this.remove('activities', id); },

  // === Pipeline helpers ===
  getPipeline() { return this.getAll('pipeline'); },
  addPipeline(p) { return this.add('pipeline', p); },
  updatePipeline(id, data) { return this.update('pipeline', id, data); },
  removePipeline(id) { this.remove('pipeline', id); },

  // === Sales helpers ===
  getSales() { return this.getAll('sales'); },
  addSales(s) { return this.add('sales', s); },
  updateSales(id, data) { return this.update('sales', id, data); },
  removeSales(id) { this.remove('sales', id); },

  // === Route helpers ===
  getRoutes() { return this.getAll('routes'); },
  addRoute(r) { return this.add('routes', r); },
  updateRoute(id, data) { return this.update('routes', id, data); },
  removeRoute(id) { this.remove('routes', id); },

  // === Bulk operations ===
  // Merge server data with local data (protects items added during sync).
  // Writes directly to localStorage to avoid triggering Sync.nudge().
  importAll(data) {
    const collections = ['accounts', 'activities', 'pipeline', 'sales', 'routes'];
    for (const key of collections) {
      if (!data[key]) continue;
      const serverItems = data[key];
      // Use getAllRaw so we merge WITH soft-deleted items (not losing them)
      const localItems = this.getAllRaw(key);

      // Build merged map: index by ID, keep the newest version of each item
      const merged = {};
      for (const item of localItems) {
        if (item.id) merged[item.id] = item;
      }
      for (const item of serverItems) {
        if (!item.id) continue;
        if (!merged[item.id]) {
          // New item from server — add it
          merged[item.id] = item;
        } else {
          // Both sides have it — newer updatedAt wins
          if ((item.updatedAt || '') >= (merged[item.id].updatedAt || '')) {
            merged[item.id] = item;
          }
        }
      }

      // Write directly (skip saveAll to avoid triggering Sync.nudge loop)
      localStorage.setItem(this.KEYS[key], JSON.stringify(Object.values(merged)));
    }
  },

  exportAll() {
    // Include soft-deleted items so deletions propagate through sync
    return {
      accounts: this.getAllRaw('accounts'),
      activities: this.getAllRaw('activities'),
      pipeline: this.getAllRaw('pipeline'),
      sales: this.getAllRaw('sales'),
      routes: this.getAllRaw('routes'),
      exportedAt: new Date().toISOString(),
    };
  },

  // Get account name by ID (for display)
  accountName(id) {
    const a = this.getById('accounts', id);
    return a ? a.name : 'Unknown';
  },
};
