// === Accounts Module ===
const Accounts = {
  render() {
    this.populateCityFilter();
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
    bind('btn-add-account', 'click', () => this.openForm());
    bind('account-search', 'input', () => this.renderTable());
    bind('filter-city', 'change', () => this.renderTable());
    bind('filter-status', 'change', () => this.renderTable());
    bind('filter-ontap', 'change', () => this.renderTable());
    bind('sort-accounts', 'change', () => this.renderTable());
  },

  populateCityFilter() {
    const sel = document.getElementById('filter-city');
    const current = sel.value;
    const cities = App.getCities();
    sel.innerHTML = '<option value="">All Cities</option>' +
      cities.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
  },

  getFiltered() {
    let accounts = DB.getAccounts();
    const search = document.getElementById('account-search').value.toLowerCase();
    const city = document.getElementById('filter-city').value;
    const status = document.getElementById('filter-status').value;
    const ontap = document.getElementById('filter-ontap').value;
    const sort = document.getElementById('sort-accounts').value;

    if (search) {
      accounts = accounts.filter(a =>
        a.name.toLowerCase().includes(search) ||
        (a.contactPerson || '').toLowerCase().includes(search) ||
        (a.city || '').toLowerCase().includes(search) ||
        (a.address || '').toLowerCase().includes(search)
      );
    }
    if (city) accounts = accounts.filter(a => a.city === city);
    if (status) accounts = accounts.filter(a => a.status === status);
    if (ontap) accounts = accounts.filter(a => a.onTap === ontap);

    // Sort
    const [field, dir] = sort.split('-');
    accounts.sort((a, b) => {
      let va = a[field], vb = b[field];
      if (field === 'name') {
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (field.includes('Date')) {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    });
    return accounts;
  },

  renderTable() {
    const tbody = document.getElementById('accounts-tbody');
    const accounts = this.getFiltered();
    if (!accounts.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No accounts found. Add your first account!</p></td></tr>';
      return;
    }
    tbody.innerHTML = accounts.map(a => `
      <tr>
        <td><a href="#" class="acct-link" onclick="Accounts.showDetail('${a.id}');return false"><strong>${this.esc(a.name)}</strong></a><br><small style="color:var(--text-muted)">${this.esc(a.address || '')}</small></td>
        <td>${this.esc(a.city || '')}</td>
        <td>
          <span style="font-weight:700;color:var(--amber)">${a.priorityScore || 0}</span>
          <br>${App.ratingDots(a.volumeRating)} / ${App.ratingDots(a.likelihoodRating)}
        </td>
        <td>${this.esc(a.contactPerson || '-')}</td>
        <td>${a.status || '-'}</td>
        <td>${App.onTapBadge(a.onTap)}</td>
        <td>${App.formatDate(a.lastVisitDate)}</td>
        <td>
          <button class="btn-icon" onclick="Accounts.openForm('${a.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon delete" onclick="Accounts.remove('${a.id}')" title="Delete">&#10006;</button>
        </td>
      </tr>
    `).join('');
  },

  openForm(id) {
    const acct = id ? DB.getById('accounts', id) : {};
    const isEdit = !!id;
    const products = ['IPA 1/6', 'IPA 1/2', 'Lager 1/6', 'Lager 1/2', 'Cases'];
    const currentProducts = acct.productFormat || [];

    const html = `
      <div class="form-group">
        <label>Account Name *</label>
        <input class="input" id="f-name" value="${this.esc(acct.name || '')}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Address</label>
          <input class="input" id="f-address" value="${this.esc(acct.address || '')}">
        </div>
        <div class="form-group">
          <label>City</label>
          <input class="input" id="f-city" value="${this.esc(acct.city || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Volume Rating (1-5)</label>
          <select class="input" id="f-volume">
            ${[0,1,2,3,4,5].map(n => `<option value="${n}" ${n == (acct.volumeRating||0) ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Likelihood Rating (1-5)</label>
          <select class="input" id="f-likelihood">
            ${[0,1,2,3,4,5].map(n => `<option value="${n}" ${n == (acct.likelihoodRating||0) ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contact Person</label>
          <input class="input" id="f-contact" value="${this.esc(acct.contactPerson || '')}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input class="input" id="f-phone" value="${this.esc(acct.contactPhone || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input class="input" id="f-email" type="email" value="${this.esc(acct.contactEmail || '')}">
      </div>
      <div class="form-group">
        <label>Product Formats</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${products.map(p => `
            <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
              <input type="checkbox" value="${p}" ${currentProducts.includes(p) ? 'checked' : ''}
                     class="f-product-check"> ${p}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select class="input" id="f-status">
            ${['Active','Prospect','Inactive','Declined'].map(s => `<option ${s === acct.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>On Tap?</label>
          <select class="input" id="f-ontap">
            ${['','Yes','No','Pending'].map(s => `<option value="${s}" ${s === (acct.onTap||'') ? 'selected' : ''}>${s || '-- Select --'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Last Visit Date</label>
          <input class="input" id="f-lastvisit" type="date" value="${acct.lastVisitDate || ''}">
        </div>
        <div class="form-group">
          <label>Last Order Date</label>
          <input class="input" id="f-lastorder" type="date" value="${acct.lastOrderDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="input" id="f-notes">${this.esc(acct.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label style="margin-bottom:8px">Business Hours</label>
        <div class="hours-grid">
          ${['mon','tue','wed','thu','fri','sat','sun'].map(day => {
            const label = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'}[day];
            const val = (acct.hours && acct.hours[day]) || '';
            return '<div class="hours-row"><span class="hours-day-label">' + label + '</span><input class="input hours-input" id="f-hours-' + day + '" value="' + this.esc(val) + '" placeholder="11:00-02:00"></div>';
          }).join('')}
        </div>
        <small style="color:var(--text-muted)">Format: HH:MM-HH:MM (24h, e.g. 16:00-02:00 = 4 PM–2 AM). Use "closed" if closed.</small>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Latitude</label>
          <input class="input" id="f-lat" type="number" step="any" value="${acct.lat || ''}">
        </div>
        <div class="form-group">
          <label>Longitude</label>
          <input class="input" id="f-lng" type="number" step="any" value="${acct.lng || ''}">
        </div>
      </div>
    `;

    App.openModal(isEdit ? 'Edit Account' : 'Add Account', html, () => {
      const name = document.getElementById('f-name').value.trim();
      if (!name) { App.toast('Account name is required'); return; }
      const vol = parseInt(document.getElementById('f-volume').value) || 0;
      const like = parseInt(document.getElementById('f-likelihood').value) || 0;
      const selectedProducts = [...document.querySelectorAll('.f-product-check:checked')].map(cb => cb.value);

      const hours = {};
      ['mon','tue','wed','thu','fri','sat','sun'].forEach(day => {
        hours[day] = document.getElementById('f-hours-' + day).value.trim();
      });
      const latVal = parseFloat(document.getElementById('f-lat').value);
      const lngVal = parseFloat(document.getElementById('f-lng').value);

      const data = {
        name,
        address: document.getElementById('f-address').value.trim(),
        city: document.getElementById('f-city').value.trim(),
        volumeRating: vol,
        likelihoodRating: like,
        priorityScore: vol + like,
        contactPerson: document.getElementById('f-contact').value.trim(),
        contactPhone: document.getElementById('f-phone').value.trim(),
        contactEmail: document.getElementById('f-email').value.trim(),
        productFormat: selectedProducts,
        status: document.getElementById('f-status').value,
        onTap: document.getElementById('f-ontap').value,
        lastVisitDate: document.getElementById('f-lastvisit').value,
        lastOrderDate: document.getElementById('f-lastorder').value,
        notes: document.getElementById('f-notes').value.trim(),
        hours,
        lat: isNaN(latVal) ? null : latVal,
        lng: isNaN(lngVal) ? null : lngVal,
      };

      if (isEdit) {
        DB.updateAccount(id, data);
        App.toast('Account updated');
      } else {
        DB.addAccount(data);
        App.toast('Account added');
      }
      App.closeModal();
      this.render();
    });
  },

  showDetail(id) {
    const acct = DB.getById('accounts', id);
    if (!acct) return;

    // Gather all related data
    const visits = DB.getActivities()
      .filter(a => a.accountId === id)
      .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
    const pipelineItems = DB.getPipeline().filter(p => p.accountId === id);
    const routeStops = DB.getRoutes().filter(r => r.accountId === id);

    // Build the detail HTML
    const html = `
      <div class="detail-view">
        <!-- Account Header -->
        <div class="detail-header">
          <div>
            <div class="detail-name">${this.esc(acct.name)}</div>
            <div class="detail-address">${this.esc(acct.address || '')}${acct.city ? ', ' + this.esc(acct.city) : ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:28px;font-weight:800;color:var(--amber)">${acct.priorityScore || 0}</div>
            <div style="font-size:11px;color:var(--text-muted)">PRIORITY</div>
          </div>
        </div>

        <!-- Quick Stats Row -->
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-val">${App.ratingDots(acct.volumeRating)}</div>
            <div class="detail-stat-lbl">Volume</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-val">${App.ratingDots(acct.likelihoodRating)}</div>
            <div class="detail-stat-lbl">Likelihood</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-val">${App.onTapBadge(acct.onTap) || '-'}</div>
            <div class="detail-stat-lbl">On Tap</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-val">${acct.status || '-'}</div>
            <div class="detail-stat-lbl">Status</div>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="detail-section">
          <div class="detail-section-title">Contact Info</div>
          <div class="detail-info-grid">
            ${acct.contactPerson ? `<div><span class="detail-label">Person:</span> ${this.esc(acct.contactPerson)}</div>` : ''}
            ${acct.contactPhone ? `<div><span class="detail-label">Phone:</span> ${this.esc(acct.contactPhone)}</div>` : ''}
            ${acct.contactEmail ? `<div><span class="detail-label">Email:</span> ${this.esc(acct.contactEmail)}</div>` : ''}
            ${acct.productFormat && acct.productFormat.length ? `<div><span class="detail-label">Products:</span> ${acct.productFormat.join(', ')}</div>` : ''}
            ${acct.lastVisitDate ? `<div><span class="detail-label">Last Visit:</span> ${App.formatDate(acct.lastVisitDate)}</div>` : ''}
            ${acct.lastOrderDate ? `<div><span class="detail-label">Last Order:</span> ${App.formatDate(acct.lastOrderDate)}</div>` : ''}
          </div>
        </div>

        <!-- Business Hours -->
        ${acct.hours ? `
        <div class="detail-section">
          <div class="detail-section-title">Business Hours</div>
          <div class="hours-display">
            ${['mon','tue','wed','thu','fri','sat','sun'].map(day => {
              const label = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'}[day];
              const val = acct.hours[day] || 'Unknown';
              return '<div class="hours-display-row"><span class="hours-day-label">' + label + '</span><span>' + (val === 'closed' ? '<span style="color:var(--red)">Closed</span>' : this.formatHoursDisplay(val)) + '</span></div>';
            }).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Account Notes -->
        ${acct.notes ? `
        <div class="detail-section">
          <div class="detail-section-title">Account Notes</div>
          <div class="detail-notes">${this.esc(acct.notes)}</div>
        </div>
        ` : ''}

        <!-- Pipeline Status -->
        ${pipelineItems.length ? `
        <div class="detail-section">
          <div class="detail-section-title">Pipeline Status</div>
          ${pipelineItems.map(p => `
            <div class="detail-pipeline-card">
              <span class="badge badge-${(p.priority || 'medium').toLowerCase()}">${p.priority || 'Medium'}</span>
              <strong>${this.esc(p.stage)}</strong>
              &middot; ${this.esc(p.targetProducts || 'Both')}
              ${p.nextAction ? `<br><span style="color:var(--text-secondary);font-size:12px">Next: ${this.esc(p.nextAction)}</span>` : ''}
              ${p.notes ? `<br><span style="color:var(--text-muted);font-size:12px">${this.esc(p.notes)}</span>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Route Assignments -->
        ${routeStops.length ? `
        <div class="detail-section">
          <div class="detail-section-title">Route Assignments</div>
          ${routeStops.map(r => `
            <div class="detail-route-card">
              <strong>Week ${r.week} - ${r.day} (Stop #${r.stopNumber})</strong>
              ${r.hours ? ` &middot; ${this.esc(r.hours)}` : ''}
              ${r.outcome ? `<br>${App.outcomeBadge(r.outcome)}${r.kegsOrdered ? ' &middot; ' + r.kegsOrdered + ' kegs ordered' : ''}` : ''}
              ${r.notes ? `<br><span style="color:var(--text-muted);font-size:12px">${this.esc(r.notes)}</span>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Visit History -->
        <div class="detail-section">
          <div class="detail-section-title">Visit History (${visits.length} visits)</div>
          ${visits.length ? visits.map(v => `
            <div class="detail-visit-card">
              <div class="detail-visit-header">
                <span class="detail-visit-date">${App.formatDate(v.visitDate)}</span>
                ${v.outcome ? App.outcomeBadge(v.outcome) : ''}
                ${v.interestLevel ? App.interestBadge(v.interestLevel) : ''}
                ${v.kegsOrdered ? `<span style="color:var(--green);font-weight:600">${v.kegsOrdered} kegs</span>` : ''}
              </div>
              ${v.contactName ? `<div style="font-size:12px;color:var(--text-secondary)">Contact: ${this.esc(v.contactName)}</div>` : ''}
              ${v.visitNotes ? `<div class="detail-visit-notes">${this.esc(v.visitNotes)}</div>` : ''}
              ${v.productsDiscussed && v.productsDiscussed.length ? `<div style="font-size:12px;color:var(--text-muted)">Products: ${v.productsDiscussed.join(', ')}</div>` : ''}
              ${v.followUpAction || v.followUpDate ? `
                <div class="detail-visit-followup">
                  Follow-up: ${this.esc(v.followUpAction || '')} ${v.followUpDate ? '(due ' + App.formatDate(v.followUpDate) + ')' : ''}
                </div>
              ` : ''}
            </div>
          `).join('') : '<div class="empty-state" style="padding:12px"><p>No visits logged yet.</p></div>'}
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="App.closeModal();Activity.openForm(null,\'${id}\')">Log Visit</button>
          <button class="btn btn-secondary" onclick="App.closeModal();Accounts.openForm(\'${id}\')">Edit Account</button>
          ${acct.lat && acct.lng ? `<button class="btn btn-secondary" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${acct.lat},${acct.lng}','_blank')">Navigate</button>` : ''}
          ${!pipelineItems.length ? `<button class="btn btn-secondary" onclick="App.closeModal();Pipeline.openForm(null)">Add to Pipeline</button>` : ''}
        </div>
      </div>
    `;

    // Use the modal with no save button for detail view
    App.openModal(acct.name, html, null);
    // Hide the save button for detail view
    document.getElementById('modal-save').style.display = 'none';
    document.getElementById('modal-cancel').textContent = 'Close';
  },

  remove(id) {
    if (confirm('Delete this account? This cannot be undone.')) {
      DB.removeAccount(id);
      App.toast('Account deleted');
      this.render();
    }
  },

  // Convert "HH:MM" to "H:MM AM/PM"
  formatTime12(timeStr) {
    const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return timeStr;
    let h = parseInt(m[1]);
    const min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return h12 + ':' + min + ' ' + ampm;
  },

  // Convert "HH:MM-HH:MM" to "H:MM AM - H:MM AM" for display
  formatHoursDisplay(val) {
    if (!val || val === 'unknown') return val || 'Unknown';
    const parts = val.split('-');
    if (parts.length !== 2) return this.esc(val);
    return this.formatTime12(parts[0].trim()) + ' – ' + this.formatTime12(parts[1].trim());
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
