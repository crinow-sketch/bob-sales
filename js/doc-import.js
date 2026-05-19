// === Document Import Module ===
// Parses .docx and .pdf sales logs and creates activity records
const DocImport = {
  render(container) {
    container.innerHTML = `
      <div id="doc-drop-zone" class="doc-drop-zone">
        <div class="doc-drop-icon">&#128196;</div>
        <p class="doc-drop-text">Drop .docx or .pdf sales logs here</p>
        <p class="doc-drop-sub">or click to browse</p>
        <input type="file" id="doc-file-input" accept=".docx,.pdf" multiple style="display:none">
      </div>
      <div id="doc-import-status"></div>
      <div id="doc-import-preview" class="doc-preview-container" style="display:none"></div>
    `;
    this.setupListeners();
  },

  setupListeners() {
    const zone = document.getElementById('doc-drop-zone');
    const input = document.getElementById('doc-file-input');
    if (!zone || zone._bound) return;
    zone._bound = true;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => {
      if (input.files.length) this.handleFiles(input.files);
    });
  },

  async handleFiles(fileList) {
    const status = document.getElementById('doc-import-status');
    const files = Array.from(fileList).filter(f =>
      f.name.endsWith('.docx') || f.name.endsWith('.pdf')
    );
    if (!files.length) {
      status.innerHTML = '<p style="color:var(--red)">Please drop .docx or .pdf files only.</p>';
      return;
    }

    status.innerHTML = '<p style="color:var(--amber)">Processing files...</p>';
    let allText = '';

    for (const file of files) {
      try {
        if (file.name.endsWith('.docx')) {
          allText += await this.extractDocx(file) + '\n';
        } else if (file.name.endsWith('.pdf')) {
          allText += await this.extractPdf(file) + '\n';
        }
      } catch (err) {
        status.innerHTML = `<p style="color:var(--red)">Error reading ${file.name}: ${err.message || err}</p>`;
        return;
      }
    }

    const entries = this.parseText(allText);
    if (!entries.length) {
      status.innerHTML = '<p style="color:var(--red)">No visit entries found in the document. Make sure it follows the format:<br>"Date header" then "Account Name: notes..."</p>';
      return;
    }

    status.innerHTML = `<p style="color:var(--green)">Found <strong>${entries.length}</strong> visit entries. Review below and click Import.</p>`;
    this.showPreview(entries);
  },

  // === DOCX text extraction (unzip + parse XML) ===
  async extractDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file('word/document.xml').async('text');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, 'text/xml');
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const paragraphs = xmlDoc.getElementsByTagNameNS(ns, 'p');
    const lines = [];

    for (const p of paragraphs) {
      const texts = p.getElementsByTagNameNS(ns, 't');
      let line = '';
      for (const t of texts) {
        line += t.textContent || '';
      }
      line = line.trim();
      if (line) lines.push(line);
    }
    return lines.join('\n');
  },

  // === PDF text extraction using pdf.js ===
  async extractPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      if (pageText.trim()) lines.push(pageText.trim());
    }
    return lines.join('\n');
  },

  // === Parse extracted text into visit entries ===
  parseText(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const entries = [];
    let currentDate = '';
    let currentYear = new Date().getFullYear();

    const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

    for (const line of lines) {
      const dateParsed = this.parseDate(line, currentYear, MONTHS);
      if (dateParsed) {
        currentDate = dateParsed.date;
        if (dateParsed.year) currentYear = dateParsed.year;
        continue;
      }

      // Skip title lines / non-entry lines
      if (!line.includes(':') && !line.includes(',')) continue;

      // Try to split on first colon for "Account: notes" pattern
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        const accountName = line.substring(0, colonIdx).trim();
        const notes = line.substring(colonIdx + 1).trim();

        // Skip if accountName looks like a time or very short
        if (accountName.length < 3 || /^\d{1,2}$/.test(accountName)) continue;

        const entry = this.extractDetails(accountName, notes, currentDate);
        entries.push(entry);
      } else {
        // Try comma-separated: "Account Name, notes..."
        const commaIdx = line.indexOf(',');
        if (commaIdx > 3 && commaIdx < 80) {
          const possibleName = line.substring(0, commaIdx).trim();
          // Only treat as account if it doesn't look like a regular sentence
          if (possibleName.split(' ').length <= 6 && !/^(talked|met|left|dropped|checked|called|texted|with|very|they|he|she|it|we|the|a|an)$/i.test(possibleName.split(' ')[0])) {
            const notes = line.substring(commaIdx + 1).trim();
            const entry = this.extractDetails(possibleName, notes, currentDate);
            entries.push(entry);
          }
        }
      }
    }
    return entries;
  },

  parseDate(line, currentYear, MONTHS) {
    const lower = line.toLowerCase().trim();

    // "August 1" / "September 13" / "October 2"
    for (let i = 0; i < MONTHS.length; i++) {
      const re = new RegExp('^' + MONTHS[i] + '\\s+(\\d{1,2})(?:\\s*,?\\s*(\\d{4}))?$', 'i');
      const m = lower.match(re);
      if (m) {
        const year = m[2] ? parseInt(m[2]) : currentYear;
        const month = String(i + 1).padStart(2, '0');
        const day = String(parseInt(m[1])).padStart(2, '0');
        return { date: `${year}-${month}-${day}`, year };
      }
    }

    // "November 7 and 8" - use first date
    for (let i = 0; i < MONTHS.length; i++) {
      const re = new RegExp('^' + MONTHS[i] + '\\s+(\\d{1,2})\\s+and\\s+\\d{1,2}', 'i');
      const m = lower.match(re);
      if (m) {
        const month = String(i + 1).padStart(2, '0');
        const day = String(parseInt(m[1])).padStart(2, '0');
        return { date: `${currentYear}-${month}-${day}` };
      }
    }

    // "MM/DD/YYYY" or "MM-DD-YYYY"
    const mdy = lower.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdy) {
      return { date: `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`, year: parseInt(mdy[3]) };
    }

    return null;
  },

  extractDetails(accountName, notes, visitDate) {
    const entry = {
      accountName: accountName.replace(/[;.,]+$/, '').trim(),
      visitDate: visitDate,
      contactName: '',
      interestLevel: '',
      outcome: '',
      visitNotes: notes,
      kegsOrdered: 0,
      productsDiscussed: [],
      followUpAction: '',
      followUpDate: '',
    };

    const lower = notes.toLowerCase();

    // Extract contact name
    const contactMatch = notes.match(/talked to (?:the )?(?:owner |manager |bartender |bar manager |buyer |GM )?(\w+)/i)
      || notes.match(/met (?:the )?(?:owner |manager )?(\w+)/i)
      || notes.match(/(?:owner|manager|buyer|bartender|bar manager|GM) (\w+)/i);
    if (contactMatch) {
      entry.contactName = contactMatch[1];
    }

    // Extract interest level
    if (/ordered|put (?:us )?on tap|will put|she would put|he would put|going to order/i.test(lower)) {
      entry.interestLevel = 'Hot';
    } else if (/interested|loves? (?:the |our )?beer|loved|really liked|seemed open|very cool|fan/i.test(lower)) {
      entry.interestLevel = 'Warm';
    } else if (/not (?:likely|interested|much|a big)|few taps|dive|no locals|hate|pissed/i.test(lower)) {
      entry.interestLevel = 'Cold';
    } else if (/left samples|dropped (?:off )?samples|gave samples|pass.* samples|try the samples/i.test(lower)) {
      entry.interestLevel = 'Warm';
    }

    // Extract outcome
    if (/ordered a keg|ordered a 1\/2|ordered a half|ordered|put (?:us )?on tap|have had us on/i.test(lower)) {
      entry.outcome = 'Converted';
    } else if (/really liked|loves? (?:the |our )?beer|very interested|will (?:put|give|order)|seemed interested|she would|he would|interested/i.test(lower)) {
      entry.outcome = 'Strong Interest';
    } else if (/left samples|dropped (?:off )?samples|gave samples|pass.* samples|promised|said she|said he/i.test(lower)) {
      entry.outcome = 'Left Sample';
    } else if (/was not (?:in|there|available|around)|not available|not in yet|busy/i.test(lower)) {
      entry.outcome = 'No Contact';
    } else if (/not (?:likely|interested)|no locals|hate|pissed|will not reorder/i.test(lower)) {
      entry.outcome = 'No Interest';
    } else if (/nice|cool|open|polite/i.test(lower)) {
      entry.outcome = 'Moderate Interest';
    }

    // Extract kegs ordered
    const kegMatch = lower.match(/ordered (?:a )?(\d+)\s*(?:keg|1\/[26]|half)/i);
    if (kegMatch) {
      entry.kegsOrdered = parseInt(kegMatch[1]);
    } else if (/ordered a keg/i.test(lower)) {
      entry.kegsOrdered = 1;
    }

    // Extract products discussed
    if (/ipa|iron island/i.test(lower)) entry.productsDiscussed.push('Iron Island IPA');
    if (/lager|lovejoy/i.test(lower)) entry.productsDiscussed.push('Lovejoy Lager');
    if (entry.productsDiscussed.length === 2) entry.productsDiscussed = ['Both'];

    // Extract follow-up hints
    if (/check back|follow up|call (?:back|monday|tomorrow)|try back|remind|text/i.test(lower)) {
      entry.followUpAction = 'Follow up';
    }

    return entry;
  },

  // === Show preview table ===
  showPreview(entries) {
    const accounts = DB.getAccounts();
    const preview = document.getElementById('doc-import-preview');

    // Match accounts
    entries.forEach(e => {
      const match = this.findAccount(e.accountName, accounts);
      e.matchedAccount = match;
      e.accountId = match ? match.id : '';
      e.matchConfidence = match ? this.similarity(e.accountName.toLowerCase(), match.name.toLowerCase()) : 0;
    });

    let html = `
      <div class="doc-preview-header">
        <span>${entries.length} visits to import</span>
        <div>
          <button class="btn btn-secondary" id="doc-cancel-import">Cancel</button>
          <button class="btn btn-primary" id="doc-confirm-import">Import All</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table doc-preview-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account (from doc)</th>
              <th>Matched To</th>
              <th>Contact</th>
              <th>Interest</th>
              <th>Outcome</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
    `;

    entries.forEach((e, i) => {
      const matchClass = e.matchedAccount ? (e.matchConfidence > 0.8 ? 'match-good' : 'match-partial') : 'match-none';
      const matchName = e.matchedAccount ? e.matchedAccount.name : '<em>No match</em>';

      html += `<tr class="${matchClass}">
        <td>${e.visitDate || '-'}</td>
        <td>${this.esc(e.accountName)}</td>
        <td class="match-cell">${matchName}</td>
        <td>${this.esc(e.contactName)}</td>
        <td>${e.interestLevel ? App.interestBadge(e.interestLevel) : '-'}</td>
        <td>${e.outcome ? App.outcomeBadge(e.outcome) : '-'}</td>
        <td class="notes-cell" title="${this.esc(e.visitNotes)}">${this.esc(e.visitNotes).substring(0, 60)}${e.visitNotes.length > 60 ? '...' : ''}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    preview.innerHTML = html;
    preview.style.display = 'block';

    document.getElementById('doc-confirm-import').addEventListener('click', () => this.doImport(entries));
    document.getElementById('doc-cancel-import').addEventListener('click', () => {
      preview.style.display = 'none';
      document.getElementById('doc-import-status').innerHTML = '';
    });
  },

  // === Fuzzy account matching ===
  findAccount(name, accounts) {
    const lower = name.toLowerCase().replace(/['']/g, "'");
    // Exact match
    let match = accounts.find(a => a.name.toLowerCase() === lower);
    if (match) return match;

    // Starts-with match
    match = accounts.find(a => a.name.toLowerCase().startsWith(lower) || lower.startsWith(a.name.toLowerCase()));
    if (match) return match;

    // Contains match
    match = accounts.find(a => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
    if (match) return match;

    // Fuzzy similarity
    let best = null, bestScore = 0;
    for (const a of accounts) {
      const score = this.similarity(lower, a.name.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return bestScore > 0.5 ? best : null;
  },

  similarity(a, b) {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;

    const costs = [];
    for (let i = 0; i <= longer.length; i++) {
      let lastVal = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) { costs[j] = j; }
        else if (j > 0) {
          let newVal = costs[j - 1];
          if (longer[i - 1] !== shorter[j - 1]) {
            newVal = Math.min(newVal, lastVal, costs[j]) + 1;
          }
          costs[j - 1] = lastVal;
          lastVal = newVal;
        }
      }
      if (i > 0) costs[shorter.length] = lastVal;
    }
    return 1 - costs[shorter.length] / longer.length;
  },

  // === Perform the import ===
  doImport(entries) {
    let imported = 0;
    for (const e of entries) {
      const activity = {
        accountId: e.accountId || '',
        visitDate: e.visitDate,
        contactName: e.contactName,
        interestLevel: e.interestLevel,
        outcome: e.outcome,
        visitNotes: e.visitNotes,
        followUpAction: e.followUpAction,
        followUpDate: e.followUpDate,
        kegsOrdered: e.kegsOrdered,
        productsDiscussed: e.productsDiscussed.length === 1 ? e.productsDiscussed : [],
      };
      DB.addActivity(activity);
      imported++;

      // Update account last visit date
      if (e.accountId && e.visitDate) {
        const acct = DB.getById('accounts', e.accountId);
        if (acct && (!acct.lastVisitDate || e.visitDate >= acct.lastVisitDate)) {
          DB.updateAccount(e.accountId, { lastVisitDate: e.visitDate });
        }
      }
    }

    document.getElementById('doc-import-preview').style.display = 'none';
    document.getElementById('doc-import-status').innerHTML =
      `<p style="color:var(--green)">Successfully imported <strong>${imported}</strong> visit entries!</p>`;
    App.toast(`${imported} visits imported from document`);

    // Refresh activity table if on that page
    if (App.currentPage === 'activity') Activity.render();
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
