// === App Initialization & Navigation ===
const App = {
  currentPage: 'dashboard',

  init() {
    this.setupNav();
    this.setupMobileMenu();
    this.setupModal();
    this.navigateTo('dashboard');
  },

  // Navigation
  setupNav() {
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(link.dataset.page);
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
      });
    });
  },

  navigateTo(page) {
    this.currentPage = page;
    // Update active states
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    document.querySelectorAll('.mobile-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    // Refresh page data
    this.refreshPage(page);
  },

  refreshPage(page) {
    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'accounts': Accounts.render(); break;
      case 'activity': Activity.render(); break;
      case 'pipeline': Pipeline.render(); break;
      case 'sales': Sales.render(); break;
      case 'routes': Routes.render(); break;
      case 'importexport': ImportExport.init(); break;
    }
  },

  // Mobile menu
  setupMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
    // Close sidebar on outside click
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
      }
    });
  },

  // Modal
  _modalSaveHandler: null,

  setupModal() {
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('modal-save').addEventListener('click', () => {
      if (this._modalSaveHandler) this._modalSaveHandler();
    });
  },

  openModal(title, bodyHTML, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
    this._modalSaveHandler = onSave;
    // Show/hide save button based on whether there's a save handler
    const saveBtn = document.getElementById('modal-save');
    const cancelBtn = document.getElementById('modal-cancel');
    if (onSave) {
      saveBtn.style.display = '';
      cancelBtn.textContent = 'Cancel';
      document.getElementById('modal').style.maxWidth = '560px';
    } else {
      saveBtn.style.display = 'none';
      cancelBtn.textContent = 'Close';
      document.getElementById('modal').style.maxWidth = '700px';
    }
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  // Toast notification
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  },

  // Utility: render rating dots
  ratingDots(value, max = 5) {
    let html = '<span class="rating">';
    for (let i = 1; i <= max; i++) {
      html += `<span class="rating-dot ${i <= value ? 'filled' : ''}"></span>`;
    }
    html += '</span>';
    return html;
  },

  // Utility: format date
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Utility: badge HTML
  badge(text, type) {
    return `<span class="badge badge-${type}">${text}</span>`;
  },

  // Utility: outcome badge
  outcomeBadge(outcome) {
    if (!outcome) return '-';
    const map = {
      'Converted': 'converted',
      'Strong Interest': 'strong',
      'Moderate Interest': 'moderate',
      'No Interest': 'nointerest',
      'Left Sample': 'leftsample',
      'No Contact': 'nocontact',
    };
    return this.badge(outcome, map[outcome] || 'nocontact');
  },

  // Utility: interest badge
  interestBadge(level) {
    if (!level) return '-';
    const map = {
      'Cold': 'cold', 'Warm': 'warm', 'Hot': 'hot',
      'Ordered': 'ordered', 'On Tap': 'ontap',
    };
    return this.badge(level, map[level] || 'cold');
  },

  // Utility: on-tap badge
  onTapBadge(val) {
    if (!val) return '-';
    const map = { 'Yes': 'yes', 'No': 'no', 'Pending': 'pending' };
    return this.badge(val, map[val] || 'no');
  },

  // Utility: get unique cities from accounts
  getCities() {
    const cities = [...new Set(DB.getAccounts().map(a => a.city).filter(Boolean))];
    return cities.sort();
  },

  // Utility: account options for selects
  accountOptions(selectedId) {
    return DB.getAccounts()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${a.name}</option>`)
      .join('');
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
