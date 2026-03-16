// === Nearby & Open Module ===
const Nearby = {
  userLat: null,
  userLng: null,

  render() {
    this.renderInitialUI();
    this.setupListeners();
    this.requestLocation();
  },

  setupListeners() {
    const bind = (id, evt, fn) => {
      const el = document.getElementById(id);
      if (el && !el._bound) {
        el.addEventListener(evt, fn);
        el._bound = true;
      }
    };
    bind('btn-refresh-location', 'click', () => this.requestLocation());
    bind('nearby-show-closed', 'change', () => this.renderList());
    bind('nearby-max-distance', 'change', () => this.renderList());
  },

  renderInitialUI() {
    const container = document.getElementById('nearby-content');
    container.innerHTML = `
      <div class="nearby-controls">
        <button class="btn btn-primary" id="btn-refresh-location">Update Location</button>
        <select class="input" id="nearby-max-distance" style="width:auto">
          <option value="5">Within 5 mi</option>
          <option value="10" selected>Within 10 mi</option>
          <option value="25">Within 25 mi</option>
          <option value="50">Within 50 mi</option>
          <option value="999">Any distance</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
          <input type="checkbox" id="nearby-show-closed"> Show closed
        </label>
      </div>
      <div id="nearby-status" class="nearby-status">Getting your location...</div>
      <div id="nearby-list"></div>
    `;
  },

  requestLocation() {
    const status = document.getElementById('nearby-status');
    if (!navigator.geolocation) {
      status.innerHTML = '<span style="color:var(--red)">Geolocation not supported by your browser</span>';
      return;
    }
    status.innerHTML = 'Getting your location...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        status.innerHTML = 'Location updated. Accuracy: ~' + Math.round(pos.coords.accuracy) + 'm';
        this.renderList();
      },
      (err) => {
        status.innerHTML = '<span style="color:var(--red)">Location error: ' + err.message + '</span>';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  },

  // Haversine distance in miles
  distanceMiles(lat1, lng1, lat2, lng2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // Parse "HH:MM-HH:MM" → { openMinutes, closeMinutes, wrapsMidnight }
  parseTimeRange(str) {
    const m = str.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const open = parseInt(m[1]) * 60 + parseInt(m[2]);
    const close = parseInt(m[3]) * 60 + parseInt(m[4]);
    return { openMinutes: open, closeMinutes: close, wrapsMidnight: close <= open };
  },

  // Format minutes → "3:00 PM"
  formatMinutes(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  },

  // Check if account is currently open
  // Returns { isOpen, statusText }
  checkOpenStatus(hours) {
    if (!hours) return { isOpen: false, statusText: 'Hours unknown' };

    const now = new Date();
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = days[now.getDay()];
    const yesterday = days[(now.getDay() + 6) % 7];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Check if still open from yesterday's late-night hours
    const yHours = hours[yesterday];
    if (yHours && yHours !== 'closed' && yHours !== '') {
      const yRange = this.parseTimeRange(yHours);
      if (yRange && yRange.wrapsMidnight && currentMin < yRange.closeMinutes) {
        return { isOpen: true, statusText: 'Open (closes ' + this.formatMinutes(yRange.closeMinutes) + ')' };
      }
    }

    // Check today's hours
    const tHours = hours[today];
    if (!tHours || tHours === 'closed') {
      return { isOpen: false, statusText: tHours === 'closed' ? 'Closed today' : 'Hours unknown' };
    }

    const tRange = this.parseTimeRange(tHours);
    if (!tRange) return { isOpen: false, statusText: 'Hours unknown' };

    // Not yet open
    if (currentMin < tRange.openMinutes) {
      return { isOpen: false, statusText: 'Opens at ' + this.formatMinutes(tRange.openMinutes) };
    }

    // Currently open (handles both normal and midnight-wrapping cases)
    if (tRange.wrapsMidnight || currentMin < tRange.closeMinutes) {
      const closeText = tRange.wrapsMidnight
        ? this.formatMinutes(tRange.closeMinutes) + ' (late night)'
        : this.formatMinutes(tRange.closeMinutes);
      return { isOpen: true, statusText: 'Open until ' + closeText };
    }

    // Past closing time
    return { isOpen: false, statusText: 'Closed' };
  },

  renderList() {
    if (!this.userLat || !this.userLng) return;

    const listEl = document.getElementById('nearby-list');
    const maxDist = parseFloat(document.getElementById('nearby-max-distance').value);
    const showClosed = document.getElementById('nearby-show-closed').checked;

    let accounts = DB.getAccounts()
      .filter(a => a.lat && a.lng)
      .map(a => {
        const dist = this.distanceMiles(this.userLat, this.userLng, a.lat, a.lng);
        const status = this.checkOpenStatus(a.hours);
        return { ...a, distance: dist, isOpen: status.isOpen, statusText: status.statusText };
      })
      .filter(a => a.distance <= maxDist);

    if (!showClosed) {
      accounts = accounts.filter(a => a.isOpen);
    }

    accounts.sort((a, b) => a.distance - b.distance);

    if (!accounts.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:24px"><p>' +
        (showClosed ? 'No accounts with coordinates within range.' : 'No open accounts nearby. Try increasing the distance or showing closed places.') +
        '</p></div>';
      return;
    }

    listEl.innerHTML = accounts.map(a => `
      <div class="nearby-card ${a.isOpen ? 'nearby-open' : 'nearby-closed'}">
        <div class="nearby-card-header">
          <div>
            <a href="#" class="acct-link" onclick="Accounts.showDetail('${a.id}');return false">
              <strong>${this.esc(a.name)}</strong>
            </a>
            <div class="nearby-card-address">${this.esc(a.address || '')}${a.city ? ', ' + this.esc(a.city) : ''}</div>
          </div>
          <div class="nearby-card-distance">
            ${a.distance < 0.1 ? 'Here' : a.distance.toFixed(1) + ' mi'}
          </div>
        </div>
        <div class="nearby-card-status">
          <span class="nearby-dot ${a.isOpen ? 'dot-open' : 'dot-closed'}"></span>
          ${a.statusText}
        </div>
        <div class="nearby-card-meta">
          ${a.status ? App.badge(a.status, a.status === 'Active' ? 'yes' : a.status === 'Prospect' ? 'pending' : 'no') : ''}
          ${App.onTapBadge(a.onTap)}
          ${a.priorityScore ? '<span style="color:var(--amber);font-weight:700">' + a.priorityScore + '</span>' : ''}
          ${a.lastVisitDate ? '<span style="color:var(--text-muted);font-size:11px">Last: ' + App.formatDate(a.lastVisitDate) + '</span>' : ''}
        </div>
        <div class="nearby-card-actions">
          <button class="btn btn-sm btn-primary" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}','_blank')">Navigate</button>
          <button class="btn btn-sm btn-secondary" onclick="Accounts.showDetail('${a.id}')">Details</button>
        </div>
      </div>
    `).join('');
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
