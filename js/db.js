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

  // Get all items from a collection
  getAll(key) {
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
    const items = this.getAll(key);
    item.id = item.id || this.uid();
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    items.push(item);
    this.saveAll(key, items);
    return item;
  },

  // Update an existing item
  update(key, id, updates) {
    const items = this.getAll(key);
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveAll(key, items);
    return items[idx];
  },

  // Delete an item
  remove(key, id) {
    const items = this.getAll(key).filter(item => item.id !== id);
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
  importAll(data) {
    if (data.accounts) this.saveAll('accounts', data.accounts);
    if (data.activities) this.saveAll('activities', data.activities);
    if (data.pipeline) this.saveAll('pipeline', data.pipeline);
    if (data.sales) this.saveAll('sales', data.sales);
    if (data.routes) this.saveAll('routes', data.routes);
  },

  exportAll() {
    return {
      accounts: this.getAccounts(),
      activities: this.getActivities(),
      pipeline: this.getPipeline(),
      sales: this.getSales(),
      routes: this.getRoutes(),
      exportedAt: new Date().toISOString(),
    };
  },

  // Get account name by ID (for display)
  accountName(id) {
    const a = this.getById('accounts', id);
    return a ? a.name : 'Unknown';
  },
};
