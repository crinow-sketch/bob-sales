// === Pipeline Module ===
const Pipeline = {
  STAGES: ['Cold', 'Warm Prospect', 'Hot Lead', 'Needs Follow-Up', 'Ordered', 'On Tap'],

  render() {
    this.renderBoard();
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
    bind('btn-add-pipeline', 'click', () => this.openForm());
    bind('pipeline-priority-filter', 'change', () => this.renderBoard());
    bind('pipeline-product-filter', 'change', () => this.renderBoard());
  },

  getFiltered() {
    let items = DB.getPipeline();
    const priority = document.getElementById('pipeline-priority-filter').value;
    const product = document.getElementById('pipeline-product-filter').value;
    if (priority) items = items.filter(p => p.priority === priority);
    if (product) items = items.filter(p => p.targetProducts === product);
    return items;
  },

  renderBoard() {
    const items = this.getFiltered();
    this.STAGES.forEach(stage => {
      const container = document.querySelector(`.kanban-cards[data-stage="${stage}"]`);
      const stageItems = items.filter(p => p.stage === stage);
      if (!stageItems.length) {
        container.innerHTML = '<div class="empty-state" style="padding:16px 0"><p style="font-size:12px">No items</p></div>';
        return;
      }
      container.innerHTML = stageItems.map(p => {
        const acctName = DB.accountName(p.accountId);
        const priorityClass = (p.priority || 'low').toLowerCase();
        return `
          <div class="kanban-card" onclick="Pipeline.openForm('${p.id}')">
            <div class="kanban-card-name"><a href="#" class="acct-link" onclick="event.stopPropagation();Accounts.showDetail('${p.accountId}');return false">${this.esc(acctName)}</a></div>
            <div class="kanban-card-meta">
              <span class="badge badge-${priorityClass}">${p.priority || 'Low'}</span>
              ${p.targetProducts ? ` &middot; ${this.esc(p.targetProducts)}` : ''}
            </div>
            ${p.nextAction ? `<div class="kanban-card-meta" style="margin-top:4px">${this.esc(p.nextAction)}</div>` : ''}
          </div>
        `;
      }).join('');
    });
  },

  openForm(id) {
    const item = id ? DB.getById('pipeline', id) : {};
    const isEdit = !!id;

    const html = `
      <div class="form-group">
        <label>Account *</label>
        <select class="input" id="f-pipe-account">
          <option value="">-- Select Account --</option>
          ${App.accountOptions(item.accountId || '')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stage</label>
          <select class="input" id="f-pipe-stage">
            ${this.STAGES.map(s => `<option ${s === (item.stage || 'Cold') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select class="input" id="f-pipe-priority">
            ${['High','Medium','Low'].map(s => `<option ${s === (item.priority || 'Medium') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Products</label>
          <select class="input" id="f-pipe-products">
            ${['Both','Iron Island IPA','Lovejoy Lager'].map(s => `<option ${s === (item.targetProducts || 'Both') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Last Contact Date</label>
          <input class="input" id="f-pipe-lastcontact" type="date" value="${item.lastContactDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Next Action</label>
        <input class="input" id="f-pipe-nextaction" value="${this.esc(item.nextAction || '')}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="input" id="f-pipe-notes">${this.esc(item.notes || '')}</textarea>
      </div>
      ${isEdit ? `<div style="margin-top:12px"><button class="btn btn-danger btn-sm" onclick="Pipeline.remove('${id}')">Remove from Pipeline</button></div>` : ''}
    `;

    App.openModal(isEdit ? 'Edit Pipeline Item' : 'Add to Pipeline', html, () => {
      const accountId = document.getElementById('f-pipe-account').value;
      if (!accountId) { App.toast('Select an account'); return; }

      const data = {
        accountId,
        stage: document.getElementById('f-pipe-stage').value,
        priority: document.getElementById('f-pipe-priority').value,
        targetProducts: document.getElementById('f-pipe-products').value,
        lastContactDate: document.getElementById('f-pipe-lastcontact').value,
        nextAction: document.getElementById('f-pipe-nextaction').value.trim(),
        notes: document.getElementById('f-pipe-notes').value.trim(),
      };

      if (isEdit) {
        DB.updatePipeline(id, data);
        App.toast('Pipeline updated');
      } else {
        DB.addPipeline(data);
        App.toast('Added to pipeline');
      }
      App.closeModal();
      this.render();
    });
  },

  remove(id) {
    if (confirm('Remove from pipeline?')) {
      DB.removePipeline(id);
      App.toast('Removed from pipeline');
      App.closeModal();
      this.render();
    }
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
