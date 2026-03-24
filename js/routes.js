// === Routes Module ===
const Routes = {
  currentWeek: 1,
  DAYS: ['Tuesday', 'Wednesday', 'Thursday'],

  render() {
    this.renderGrid();
    this.setupListeners();
  },

  setupListeners() {
    const el = document.getElementById('btn-add-route');
    if (el && !el._bound) {
      el.addEventListener('click', () => this.openForm());
      el._bound = true;
    }
    // Week tab buttons
    document.querySelectorAll('.tab-btn[data-week]').forEach(btn => {
      if (!btn._bound) {
        btn.addEventListener('click', () => {
          this.currentWeek = parseInt(btn.dataset.week);
          document.querySelectorAll('.tab-btn[data-week]').forEach(b => b.classList.toggle('active', b === btn));
          this.renderGrid();
        });
        btn._bound = true;
      }
    });
  },

  renderGrid() {
    const routes = DB.getRoutes().filter(r => r.week === this.currentWeek);
    this.DAYS.forEach(day => {
      const container = document.getElementById(`stops-${day}`);
      const stops = routes
        .filter(r => r.day === day)
        .sort((a, b) => (a.stopNumber || 0) - (b.stopNumber || 0));

      if (!stops.length) {
        container.innerHTML = '<div class="empty-state" style="padding:16px 0"><p style="font-size:12px">No stops</p></div>';
        return;
      }

      container.innerHTML = stops.map(s => {
        const acct = DB.getById('accounts', s.accountId);
        const name = acct ? acct.name : 'Unknown';
        const city = acct ? acct.city : '';
        const outcomeClass = this.outcomeClass(s.outcome);
        return `
          <div class="route-stop-card ${outcomeClass}">
            <div class="route-stop-num">Stop #${s.stopNumber || '?'}</div>
            <div class="route-stop-name">${s.accountId ? `<a href="#" class="acct-link" onclick="Accounts.showDetail('${s.accountId}');return false">${this.esc(name)}</a>` : this.esc(name)}</div>
            <div class="route-stop-meta">${this.esc(city)}${s.hours ? ' &middot; ' + this.esc(s.hours) : ''}</div>
            ${s.outcome ? `<div class="route-stop-meta">${App.outcomeBadge(s.outcome)}${s.kegsOrdered ? ' &middot; ' + s.kegsOrdered + ' kegs' : ''}</div>` : ''}
            <div class="route-stop-actions">
              ${!s.contactMade ? `<button class="btn btn-sm btn-primary" onclick="Routes.quickUpdate('${s.id}')">Log Visit</button>` : ''}
              <button class="btn btn-sm btn-secondary" onclick="Routes.openForm('${s.id}')">Edit</button>
              <button class="btn btn-sm btn-secondary" onclick="Routes.remove('${s.id}')" style="color:var(--red)">&#10006;</button>
            </div>
          </div>
        `;
      }).join('');
    });
  },

  outcomeClass(outcome) {
    if (!outcome) return '';
    const map = {
      'Converted': 'outcome-converted',
      'Strong Interest': 'outcome-strong',
      'Moderate Interest': 'outcome-moderate',
      'No Interest': 'outcome-nointerest',
      'Left Sample': 'outcome-leftsample',
      'No Contact': 'outcome-nocontact',
    };
    return map[outcome] || '';
  },

  openForm(id) {
    const item = id ? DB.getById('routes', id) : { week: this.currentWeek };
    const isEdit = !!id;

    const html = `
      <div class="form-group">
        <label>Account *</label>
        <select class="input" id="f-route-account">
          <option value="">-- Select Account --</option>
          ${App.accountOptions(item.accountId || '')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Week</label>
          <select class="input" id="f-route-week">
            ${[1,2,3].map(w => `<option value="${w}" ${w === (item.week || 1) ? 'selected' : ''}>Week ${w}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Day</label>
          <select class="input" id="f-route-day">
            ${this.DAYS.map(d => `<option ${d === (item.day || 'Tuesday') ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stop #</label>
          <input class="input" id="f-route-stop" type="number" min="1" value="${item.stopNumber || 1}">
        </div>
        <div class="form-group">
          <label>Hours</label>
          <input class="input" id="f-route-hours" value="${this.esc(item.hours || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contact Made?</label>
          <select class="input" id="f-route-contact">
            ${['','Yes','No'].map(s => `<option value="${s}" ${s === (item.contactMade || '') ? 'selected' : ''}>${s || '-- Select --'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Outcome</label>
          <select class="input" id="f-route-outcome">
            ${['','Converted','Strong Interest','Moderate Interest','No Interest','Left Sample','No Contact'].map(s => `<option value="${s}" ${s === (item.outcome || '') ? 'selected' : ''}>${s || '-- Select --'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kegs Ordered</label>
          <input class="input" id="f-route-kegs" type="number" min="0" value="${item.kegsOrdered || 0}">
        </div>
        <div class="form-group">
          <label>Follow-Up Date</label>
          <input class="input" id="f-route-followup" type="date" value="${item.followUpDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="input" id="f-route-notes">${this.esc(item.notes || '')}</textarea>
      </div>
    `;

    App.openModal(isEdit ? 'Edit Route Stop' : 'Add Route Stop', html, () => {
      const accountId = document.getElementById('f-route-account').value;
      if (!accountId) { App.toast('Select an account'); return; }

      const data = {
        accountId,
        week: parseInt(document.getElementById('f-route-week').value),
        day: document.getElementById('f-route-day').value,
        stopNumber: parseInt(document.getElementById('f-route-stop').value) || 1,
        hours: document.getElementById('f-route-hours').value.trim(),
        contactMade: document.getElementById('f-route-contact').value,
        outcome: document.getElementById('f-route-outcome').value,
        kegsOrdered: parseInt(document.getElementById('f-route-kegs').value) || 0,
        followUpDate: document.getElementById('f-route-followup').value,
        notes: document.getElementById('f-route-notes').value.trim(),
      };

      if (isEdit) {
        DB.updateRoute(id, data);
        App.toast('Route stop updated');
      } else {
        DB.addRoute(data);
        App.toast('Route stop added');
      }
      App.closeModal();
      this.render();
    });
  },

  quickUpdate(id) {
    const item = DB.getById('routes', id);
    if (!item) return;

    const html = `
      <div class="form-row">
        <div class="form-group">
          <label>Contact Made?</label>
          <select class="input" id="f-quick-contact">
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Outcome</label>
          <select class="input" id="f-quick-outcome">
            ${['Converted','Strong Interest','Moderate Interest','No Interest','Left Sample','No Contact'].map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kegs Ordered</label>
          <input class="input" id="f-quick-kegs" type="number" min="0" value="0">
        </div>
        <div class="form-group">
          <label>Follow-Up Date</label>
          <input class="input" id="f-quick-followup" type="date">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="input" id="f-quick-notes"></textarea>
      </div>
    `;

    App.openModal('Log Visit - ' + DB.accountName(item.accountId), html, () => {
      const data = {
        contactMade: document.getElementById('f-quick-contact').value,
        outcome: document.getElementById('f-quick-outcome').value,
        kegsOrdered: parseInt(document.getElementById('f-quick-kegs').value) || 0,
        followUpDate: document.getElementById('f-quick-followup').value,
        notes: document.getElementById('f-quick-notes').value.trim(),
      };
      DB.updateRoute(id, data);

      // Also log as an activity
      DB.addActivity({
        accountId: item.accountId,
        visitDate: App.todayLocal(),
        outcome: data.outcome,
        kegsOrdered: data.kegsOrdered,
        followUpDate: data.followUpDate,
        visitNotes: data.notes,
        followUpAction: data.followUpDate ? 'Follow up' : '',
        interestLevel: this.outcomeToInterest(data.outcome),
      });

      // Update account last visit
      DB.updateAccount(item.accountId, { lastVisitDate: App.todayLocal() });

      App.toast('Visit logged');
      App.closeModal();
      this.render();
    });
  },

  outcomeToInterest(outcome) {
    const map = {
      'Converted': 'On Tap',
      'Strong Interest': 'Hot',
      'Moderate Interest': 'Warm',
      'No Interest': 'Cold',
      'Left Sample': 'Warm',
      'No Contact': 'Cold',
    };
    return map[outcome] || 'Cold';
  },

  remove(id) {
    if (confirm('Remove this route stop?')) {
      DB.removeRoute(id);
      App.toast('Stop removed');
      this.render();
    }
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
