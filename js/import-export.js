// === Import/Export Module ===
const ImportExport = {
  init() {
    this.setupListeners();
  },

  setupListeners() {
    const bind = (id, evt, fn) => {
      const el = document.getElementById(id);
      if (el && !el._bound) {
        el.addEventListener(evt, fn);
        el._bound = true;
      }
    };
    bind('btn-import-accounts', 'click', () => this.importAccountsCSV());
    bind('btn-import-activity', 'click', () => this.importActivityCSV());
    bind('btn-export-json', 'click', () => this.exportJSON());
    bind('btn-import-json', 'click', () => this.importJSON());
    bind('btn-export-accounts-csv', 'click', () => this.exportAccountsCSV());
    bind('btn-export-sales-csv', 'click', () => this.exportSalesCSV());
    bind('btn-load-seed', 'click', () => this.loadSeedData());
  },

  // Parse CSV text into array of objects using first row as headers
  parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = this.splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = this.splitCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (vals[idx] || '').trim();
      });
      rows.push(obj);
    }
    return rows;
  },

  // Split a CSV line respecting quoted fields
  splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  },

  // Read file input
  readFile(inputId) {
    return new Promise((resolve, reject) => {
      const input = document.getElementById(inputId);
      if (!input.files || !input.files[0]) {
        reject('No file selected');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject('Failed to read file');
      reader.readAsText(input.files[0]);
    });
  },

  // === Import Accounts CSV ===
  async importAccountsCSV() {
    try {
      const text = await this.readFile('import-accounts-csv');
      const rows = this.parseCSV(text);
      if (!rows.length) {
        this.showStatus('import-accounts-status', 'No data found in CSV', 'error');
        return;
      }

      let imported = 0;
      rows.forEach(row => {
        // Try to match common column name variations
        const name = row['Account Name'] || row['Name'] || row['account_name'] || row['Account'] || '';
        if (!name) return;

        const acct = {
          name: name.trim(),
          address: row['Address'] || row['address'] || '',
          city: row['City'] || row['city'] || '',
          volumeRating: parseInt(row['Volume Rating'] || row['Volume'] || row['volume_rating'] || 0),
          likelihoodRating: parseInt(row['Likelihood Rating'] || row['Likelihood'] || row['likelihood_rating'] || 0),
          contactPerson: row['Contact Person'] || row['Contact'] || row['contact_person'] || '',
          contactPhone: row['Phone'] || row['Contact Phone'] || '',
          contactEmail: row['Email'] || row['Contact Email'] || '',
          status: row['Status'] || row['status'] || 'Prospect',
          onTap: row['On Tap'] || row['On Tap?'] || row['on_tap'] || '',
          notes: row['Notes'] || row['notes'] || '',
          lastVisitDate: row['Last Visit Date'] || row['Last Visit'] || '',
          lastOrderDate: row['Last Order Date'] || row['Last Order'] || '',
          productFormat: [],
        };
        acct.priorityScore = (acct.volumeRating || 0) + (acct.likelihoodRating || 0);
        DB.addAccount(acct);
        imported++;
      });

      this.showStatus('import-accounts-status', `Imported ${imported} accounts`, 'success');
      App.toast(`${imported} accounts imported`);
    } catch (err) {
      this.showStatus('import-accounts-status', String(err), 'error');
    }
  },

  // === Import Activity CSV ===
  async importActivityCSV() {
    try {
      const text = await this.readFile('import-activity-csv');
      const rows = this.parseCSV(text);
      if (!rows.length) {
        this.showStatus('import-activity-status', 'No data found in CSV', 'error');
        return;
      }

      const accounts = DB.getAccounts();
      let imported = 0;
      rows.forEach(row => {
        const acctName = row['Account Name'] || row['Account'] || '';
        if (!acctName) return;

        // Find matching account (case-insensitive)
        const acct = accounts.find(a => a.name.toLowerCase() === acctName.toLowerCase().trim());
        const accountId = acct ? acct.id : '';

        const activity = {
          accountId,
          visitDate: row['Visit Date'] || row['Date'] || '',
          contactName: row['Contact Name'] || row['Contact'] || '',
          interestLevel: row['Interest Level'] || row['Interest'] || '',
          outcome: row['Outcome'] || '',
          visitNotes: row['Visit Notes'] || row['Notes'] || '',
          followUpAction: row['Follow-Up Action'] || row['Follow Up Action'] || '',
          followUpDate: row['Follow-Up Date'] || row['Follow Up Date'] || '',
          kegsOrdered: parseInt(row['Kegs Ordered'] || row['Kegs'] || 0),
          productsDiscussed: [],
        };
        DB.addActivity(activity);
        imported++;
      });

      this.showStatus('import-activity-status', `Imported ${imported} activities${imported > 0 ? ' (unmatched accounts will show as Unknown)' : ''}`, 'success');
      App.toast(`${imported} activities imported`);
    } catch (err) {
      this.showStatus('import-activity-status', String(err), 'error');
    }
  },

  // === Load Seed Data ===
  async loadSeedData() {
    try {
      const resp = await fetch('data/seed.json');
      if (!resp.ok) throw new Error('Could not load seed.json');
      const data = await resp.json();
      DB.importAll(data);
      const counts = [
        `${(data.accounts || []).length} accounts`,
        `${(data.activities || []).length} activities`,
        `${(data.pipeline || []).length} pipeline items`,
        `${(data.sales || []).length} sales months`,
        `${(data.routes || []).length} route stops`,
      ].join(', ');
      this.showStatus('seed-status', `Loaded: ${counts}`, 'success');
      App.toast('All brewery data loaded!');
    } catch (err) {
      this.showStatus('seed-status', String(err), 'error');
    }
  },

  // === Export JSON ===
  exportJSON() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `bob-sales-backup-${new Date().toISOString().slice(0,10)}.json`);
    App.toast('JSON backup exported');
  },

  // === Import JSON ===
  async importJSON() {
    try {
      const text = await this.readFile('import-json-file');
      const data = JSON.parse(text);
      if (!data.accounts && !data.activities) {
        this.showStatus('import-json-status', 'Invalid backup file format', 'error');
        return;
      }
      DB.importAll(data);
      this.showStatus('import-json-status', 'All data restored from backup', 'success');
      App.toast('Data restored from backup');
      // Refresh current page
      App.refreshPage(App.currentPage);
    } catch (err) {
      this.showStatus('import-json-status', String(err), 'error');
    }
  },

  // === Export Accounts CSV ===
  exportAccountsCSV() {
    const accounts = DB.getAccounts();
    const headers = ['Account Name', 'Address', 'City', 'Volume Rating', 'Likelihood Rating', 'Priority Score', 'Contact Person', 'Phone', 'Email', 'Status', 'On Tap', 'Last Visit Date', 'Last Order Date', 'Notes'];
    const rows = accounts.map(a => [
      a.name, a.address, a.city, a.volumeRating, a.likelihoodRating, a.priorityScore,
      a.contactPerson, a.contactPhone, a.contactEmail, a.status, a.onTap,
      a.lastVisitDate, a.lastOrderDate, a.notes
    ]);
    this.downloadCSV(headers, rows, 'bob-accounts.csv');
    App.toast('Accounts CSV exported');
  },

  // === Export Sales CSV ===
  exportSalesCSV() {
    const sales = DB.getSales();
    const headers = ['Month', 'Year', 'IPA 1/6', 'IPA 1/2', 'Lager 1/6', 'Lager 1/2', 'Total Kegs', 'Cases', 'Goal', 'Notes'];
    const rows = sales.map(s => [
      s.month, s.year, s.kegsIPA_sixth, s.kegsIPA_half, s.kegsLager_sixth, s.kegsLager_half,
      s.kegsSold, s.casesCans, s.goal, s.notes
    ]);
    this.downloadCSV(headers, rows, 'bob-sales.csv');
    App.toast('Sales CSV exported');
  },

  // Helpers
  downloadCSV(headers, rows, filename) {
    const escape = (val) => {
      const s = String(val == null ? '' : val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(',')]
      .concat(rows.map(r => r.map(escape).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, filename);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  showStatus(containerId, message, type) {
    const el = document.getElementById(containerId);
    const color = type === 'success' ? 'var(--green)' : 'var(--red)';
    el.innerHTML = `<p style="margin-top:8px;font-size:13px;color:${color}">${message}</p>`;
  },
};
