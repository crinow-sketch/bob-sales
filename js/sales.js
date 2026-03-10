// === Sales Tracker Module ===
const Sales = {
  MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'],

  render() {
    this.renderGoalBar();
    this.renderTable();
    this.setupListeners();
  },

  setupListeners() {
    const el = document.getElementById('btn-add-sales');
    if (el && !el._bound) {
      el.addEventListener('click', () => this.openForm());
      el._bound = true;
    }
  },

  getCurrentMonth() {
    const now = new Date();
    const sales = DB.getSales();
    return sales.find(s => s.month === this.MONTHS[now.getMonth()] && s.year === now.getFullYear());
  },

  renderGoalBar() {
    const container = document.getElementById('sales-goal-bar');
    const current = this.getCurrentMonth();
    if (!current || !current.goal) {
      container.innerHTML = '';
      return;
    }
    const totalKegs = (current.kegsIPA_sixth || 0) + (current.kegsIPA_half || 0) +
                      (current.kegsLager_sixth || 0) + (current.kegsLager_half || 0);
    const pct = Math.min(Math.round((totalKegs / current.goal) * 100), 100);
    container.innerHTML = `
      <div class="goal-bar-wrapper">
        <div class="goal-bar-label">
          <span>${current.month} ${current.year} - ${totalKegs} kegs sold</span>
          <span>${pct}% of goal (${current.goal} kegs)</span>
        </div>
        <div class="goal-bar-track">
          <div class="goal-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  },

  renderTable() {
    const tbody = document.getElementById('sales-tbody');
    const sales = DB.getSales().sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return this.MONTHS.indexOf(b.month) - this.MONTHS.indexOf(a.month);
    });

    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><p>No sales data yet. Add your first month!</p></td></tr>';
      return;
    }

    tbody.innerHTML = sales.map(s => {
      const totalKegs = (s.kegsIPA_sixth || 0) + (s.kegsIPA_half || 0) +
                        (s.kegsLager_sixth || 0) + (s.kegsLager_half || 0);
      const pct = s.goal ? Math.round((totalKegs / s.goal) * 100) : '-';
      const pctColor = pct >= 100 ? 'var(--green)' : pct >= 75 ? 'var(--yellow)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
      return `
        <tr>
          <td><strong>${s.month}</strong></td>
          <td>${s.year}</td>
          <td>${s.kegsIPA_sixth || 0}</td>
          <td>${s.kegsIPA_half || 0}</td>
          <td>${s.kegsLager_sixth || 0}</td>
          <td>${s.kegsLager_half || 0}</td>
          <td style="font-weight:700;color:var(--amber)">${totalKegs}</td>
          <td>${s.casesCans || 0}</td>
          <td>${s.goal || '-'}</td>
          <td style="font-weight:700;color:${typeof pct === 'number' ? pctColor : 'inherit'}">${typeof pct === 'number' ? pct + '%' : pct}</td>
          <td>
            <button class="btn-icon" onclick="Sales.openForm('${s.id}')" title="Edit">&#9998;</button>
            <button class="btn-icon delete" onclick="Sales.remove('${s.id}')" title="Delete">&#10006;</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openForm(id) {
    const item = id ? DB.getById('sales', id) : {};
    const isEdit = !!id;
    const currentYear = new Date().getFullYear();

    const html = `
      <div class="form-row">
        <div class="form-group">
          <label>Month *</label>
          <select class="input" id="f-sales-month">
            ${this.MONTHS.map(m => `<option ${m === (item.month || this.MONTHS[new Date().getMonth()]) ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Year *</label>
          <input class="input" id="f-sales-year" type="number" min="2020" max="2030" value="${item.year || currentYear}">
        </div>
      </div>
      <h4 style="color:var(--amber);margin:12px 0 8px;font-size:14px">Iron Island IPA</h4>
      <div class="form-row">
        <div class="form-group">
          <label>1/6 Barrel Kegs</label>
          <input class="input" id="f-sales-ipa6" type="number" min="0" value="${item.kegsIPA_sixth || 0}">
        </div>
        <div class="form-group">
          <label>1/2 Barrel Kegs</label>
          <input class="input" id="f-sales-ipa2" type="number" min="0" value="${item.kegsIPA_half || 0}">
        </div>
      </div>
      <h4 style="color:var(--amber);margin:12px 0 8px;font-size:14px">Lovejoy Lager</h4>
      <div class="form-row">
        <div class="form-group">
          <label>1/6 Barrel Kegs</label>
          <input class="input" id="f-sales-lag6" type="number" min="0" value="${item.kegsLager_sixth || 0}">
        </div>
        <div class="form-group">
          <label>1/2 Barrel Kegs</label>
          <input class="input" id="f-sales-lag2" type="number" min="0" value="${item.kegsLager_half || 0}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cases of Cans</label>
          <input class="input" id="f-sales-cases" type="number" min="0" value="${item.casesCans || 0}">
        </div>
        <div class="form-group">
          <label>Monthly Goal (kegs)</label>
          <input class="input" id="f-sales-goal" type="number" min="0" value="${item.goal || 20}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="input" id="f-sales-notes">${this.esc(item.notes || '')}</textarea>
      </div>
    `;

    App.openModal(isEdit ? 'Edit Sales Month' : 'Add Sales Month', html, () => {
      const month = document.getElementById('f-sales-month').value;
      const year = parseInt(document.getElementById('f-sales-year').value);
      if (!month || !year) { App.toast('Month and year required'); return; }

      const data = {
        month,
        year,
        kegsIPA_sixth: parseInt(document.getElementById('f-sales-ipa6').value) || 0,
        kegsIPA_half: parseInt(document.getElementById('f-sales-ipa2').value) || 0,
        kegsLager_sixth: parseInt(document.getElementById('f-sales-lag6').value) || 0,
        kegsLager_half: parseInt(document.getElementById('f-sales-lag2').value) || 0,
        casesCans: parseInt(document.getElementById('f-sales-cases').value) || 0,
        goal: parseInt(document.getElementById('f-sales-goal').value) || 0,
        notes: document.getElementById('f-sales-notes').value.trim(),
      };
      data.kegsSold = data.kegsIPA_sixth + data.kegsIPA_half + data.kegsLager_sixth + data.kegsLager_half;

      if (isEdit) {
        DB.updateSales(id, data);
        App.toast('Sales updated');
      } else {
        DB.addSales(data);
        App.toast('Sales month added');
      }
      App.closeModal();
      this.render();
    });
  },

  remove(id) {
    if (confirm('Delete this sales entry?')) {
      DB.removeSales(id);
      App.toast('Sales entry deleted');
      this.render();
    }
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
