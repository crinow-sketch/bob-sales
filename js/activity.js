// === Activity Log Module ===
const Activity = {
  render() {
    this.populateAccountFilter();
    this.renderAlerts();
    this.renderTable();
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
    bind('btn-add-activity', 'click', () => this.openForm());
    bind('activity-account-filter', 'change', () => this.renderTable());
    bind('activity-outcome-filter', 'change', () => this.renderTable());
    bind('activity-date-from', 'change', () => this.renderTable());
    bind('activity-date-to', 'change', () => this.renderTable());
  },

  populateAccountFilter() {
    const sel = document.getElementById('activity-account-filter');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Accounts</option>' + App.accountOptions(current);
  },

  getFiltered() {
    let acts = DB.getActivities();
    const acctFilter = document.getElementById('activity-account-filter').value;
    const outcomeFilter = document.getElementById('activity-outcome-filter').value;
    const dateFrom = document.getElementById('activity-date-from').value;
    const dateTo = document.getElementById('activity-date-to').value;

    if (acctFilter) acts = acts.filter(a => a.accountId === acctFilter);
    if (outcomeFilter) acts = acts.filter(a => a.outcome === outcomeFilter);
    if (dateFrom) acts = acts.filter(a => a.visitDate >= dateFrom);
    if (dateTo) acts = acts.filter(a => a.visitDate <= dateTo);

    // Sort by date descending
    acts.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
    return acts;
  },

  renderAlerts() {
    const container = document.getElementById('followup-alerts');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = DB.getActivities().filter(a =>
      a.followUpDate && a.followUpDate <= today && a.outcome !== 'Converted'
    );
    if (!overdue.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = overdue.slice(0, 5).map(a => `
      <div class="followup-alert">
        <span><span class="overdue-label">OVERDUE</span> Follow-up: <strong>${DB.accountName(a.accountId)}</strong> - ${a.followUpAction || 'No action specified'} (due ${App.formatDate(a.followUpDate)})</span>
        <button class="btn btn-sm btn-primary" onclick="Activity.openForm(null, '${a.accountId}')">Log Visit</button>
      </div>
    `).join('');
  },

  renderTable() {
    const tbody = document.getElementById('activity-tbody');
    const acts = this.getFiltered();
    if (!acts.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No visits logged yet.</p></td></tr>';
      return;
    }
    tbody.innerHTML = acts.map(a => `
      <tr>
        <td>${App.formatDate(a.visitDate)}</td>
        <td>${a.accountId ? `<a href="#" class="acct-link" onclick="Accounts.showDetail('${a.accountId}');return false"><strong>${this.esc(DB.accountName(a.accountId))}</strong></a>` : `<strong>${this.esc(DB.accountName(a.accountId))}</strong>`}</td>
        <td>${this.esc(a.contactName || '-')}</td>
        <td>${App.interestBadge(a.interestLevel)}</td>
        <td>${App.outcomeBadge(a.outcome)}</td>
        <td>${a.kegsOrdered || 0}</td>
        <td>${a.followUpDate ? App.formatDate(a.followUpDate) : '-'}<br><small style="color:var(--text-muted)">${this.esc(a.followUpAction || '')}</small></td>
        <td>
          <button class="btn-icon" onclick="Activity.openForm('${a.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon delete" onclick="Activity.remove('${a.id}')" title="Delete">&#10006;</button>
        </td>
      </tr>
    `).join('');
  },

  openForm(id, preselectedAccountId) {
    const act = id ? DB.getById('activities', id) : {};
    const isEdit = !!id;
    const acctId = act.accountId || preselectedAccountId || '';

    const html = `
      <div class="form-group">
        <label>Account *</label>
        <select class="input" id="f-act-account">
          <option value="">-- Select Account --</option>
          ${App.accountOptions(acctId)}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Visit Date *</label>
          <input class="input" id="f-act-date" type="date" value="${act.visitDate || new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-group">
          <label>Contact Name</label>
          <input class="input" id="f-act-contact" value="${this.esc(act.contactName || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Interest Level</label>
          <select class="input" id="f-act-interest">
            ${['','Cold','Warm','Hot','Ordered','On Tap'].map(s => `<option ${s === (act.interestLevel||'') ? 'selected' : ''} value="${s}">${s || '-- Select --'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Outcome</label>
          <select class="input" id="f-act-outcome">
            ${['','Converted','Strong Interest','Moderate Interest','No Interest','Left Sample','No Contact'].map(s => `<option ${s === (act.outcome||'') ? 'selected' : ''} value="${s}">${s || '-- Select --'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kegs Ordered</label>
          <input class="input" id="f-act-kegs" type="number" min="0" value="${act.kegsOrdered || 0}">
        </div>
        <div class="form-group">
          <label>Products Discussed</label>
          <select class="input" id="f-act-products">
            ${['','Iron Island IPA','Lovejoy Lager','Both'].map(s => {
              const cur = (act.productsDiscussed || [])[0] || '';
              return `<option ${s === cur ? 'selected' : ''} value="${s}">${s || '-- Select --'}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Visit Notes</label>
        <textarea class="input" id="f-act-notes">${this.esc(act.visitNotes || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Follow-Up Action</label>
          <input class="input" id="f-act-followaction" value="${this.esc(act.followUpAction || '')}">
        </div>
        <div class="form-group">
          <label>Follow-Up Date</label>
          <input class="input" id="f-act-followdate" type="date" value="${act.followUpDate || ''}">
        </div>
      </div>
    `;

    App.openModal(isEdit ? 'Edit Visit' : 'Log Visit', html, () => {
      const accountId = document.getElementById('f-act-account').value;
      const visitDate = document.getElementById('f-act-date').value;
      if (!accountId) { App.toast('Select an account'); return; }
      if (!visitDate) { App.toast('Enter a visit date'); return; }

      const products = document.getElementById('f-act-products').value;
      const data = {
        accountId,
        visitDate,
        contactName: document.getElementById('f-act-contact').value.trim(),
        interestLevel: document.getElementById('f-act-interest').value,
        outcome: document.getElementById('f-act-outcome').value,
        kegsOrdered: parseInt(document.getElementById('f-act-kegs').value) || 0,
        productsDiscussed: products ? [products] : [],
        visitNotes: document.getElementById('f-act-notes').value.trim(),
        followUpAction: document.getElementById('f-act-followaction').value.trim(),
        followUpDate: document.getElementById('f-act-followdate').value,
      };

      // Also update account's last visit date
      const acct = DB.getById('accounts', accountId);
      if (acct && (!acct.lastVisitDate || visitDate >= acct.lastVisitDate)) {
        DB.updateAccount(accountId, { lastVisitDate: visitDate });
      }

      if (isEdit) {
        DB.updateActivity(id, data);
        App.toast('Visit updated');
      } else {
        DB.addActivity(data);
        App.toast('Visit logged');
      }
      App.closeModal();
      this.render();
    });
  },

  remove(id) {
    if (confirm('Delete this visit log?')) {
      DB.removeActivity(id);
      App.toast('Visit deleted');
      this.render();
    }
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
