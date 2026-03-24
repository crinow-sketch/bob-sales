// === Dashboard Module ===
const Dashboard = {
  charts: {},

  render() {
    this.renderKPIs();
    this.renderCharts();
  },

  renderKPIs() {
    const accounts = DB.getAccounts();
    const activities = DB.getActivities();
    const pipeline = DB.getPipeline();
    const sales = DB.getSales();
    const today = App.todayLocal();

    // Current month sales
    const now = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentSales = sales.find(s => s.month === monthNames[now.getMonth()] && s.year === now.getFullYear());
    const kegsThisMonth = currentSales
      ? (currentSales.kegsIPA_sixth || 0) + (currentSales.kegsIPA_half || 0) +
        (currentSales.kegsLager_sixth || 0) + (currentSales.kegsLager_half || 0)
      : 0;
    const goal = currentSales ? currentSales.goal : 0;
    const pctGoal = goal ? Math.round((kegsThisMonth / goal) * 100) : 0;

    const onTapCount = accounts.filter(a => a.onTap === 'Yes').length;
    const allTimeOnTap = accounts.filter(a => a.lastOrderDate).length;
    const hotLeads = pipeline.filter(p => p.stage === 'Hot Lead').length;
    const overdue = activities.filter(a => a.followUpDate && a.followUpDate <= today && a.outcome !== 'Converted').length;

    // Visits this month
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const visitsThisMonth = activities.filter(a => a.visitDate >= monthStart).length;

    const kpis = [
      { value: accounts.length, label: 'Total Accounts' },
      { value: onTapCount, label: 'On Tap Now' },
      { value: allTimeOnTap, label: 'All-Time Placements' },
      { value: kegsThisMonth, label: 'Kegs This Month' },
      { value: `${pctGoal}%`, label: 'Of Monthly Goal' },
      { value: hotLeads, label: 'Hot Leads' },
      { value: overdue, label: 'Follow-Ups Due' },
      { value: visitsThisMonth, label: 'Visits This Month' },
    ];

    document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    `).join('');
  },

  renderCharts() {
    this.renderMonthlyKegsChart();
    this.renderPipelineChart();
    this.renderProductMixChart();
    this.renderInterestChart();
  },

  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
  },

  renderMonthlyKegsChart() {
    this.destroyChart('monthly');
    const ctx = document.getElementById('chart-monthly-kegs');
    if (!ctx) return;
    const sales = DB.getSales().sort((a, b) => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      if (a.year !== b.year) return a.year - b.year;
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
    const labels = sales.map(s => `${s.month.slice(0,3)} ${s.year}`);
    const ipaData = sales.map(s => (s.kegsIPA_sixth || 0) + (s.kegsIPA_half || 0));
    const lagerData = sales.map(s => (s.kegsLager_sixth || 0) + (s.kegsLager_half || 0));

    this.charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Iron Island IPA', data: ipaData, backgroundColor: '#f0a500' },
          { label: 'Lovejoy Lager', data: lagerData, backgroundColor: '#3498db' },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#8899aa' } } },
        scales: {
          x: { stacked: true, ticks: { color: '#8899aa' }, grid: { color: '#2a3a4a' } },
          y: { stacked: true, ticks: { color: '#8899aa' }, grid: { color: '#2a3a4a' } },
        }
      }
    });
  },

  renderPipelineChart() {
    this.destroyChart('pipeline');
    const ctx = document.getElementById('chart-pipeline');
    if (!ctx) return;
    const pipeline = DB.getPipeline();
    const stages = ['Cold', 'Warm Prospect', 'Hot Lead', 'Needs Follow-Up', 'Ordered', 'On Tap'];
    const counts = stages.map(s => pipeline.filter(p => p.stage === s).length);
    const colors = ['#3498db', '#f1c40f', '#e74c3c', '#e67e22', '#2ecc71', '#d4a017'];

    this.charts.pipeline = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: stages,
        datasets: [{ data: counts, backgroundColor: colors }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#8899aa', padding: 12 } } }
      }
    });
  },

  renderProductMixChart() {
    this.destroyChart('productMix');
    const ctx = document.getElementById('chart-product-mix');
    if (!ctx) return;
    const sales = DB.getSales();
    const totals = {
      'IPA 1/6': sales.reduce((s, r) => s + (r.kegsIPA_sixth || 0), 0),
      'IPA 1/2': sales.reduce((s, r) => s + (r.kegsIPA_half || 0), 0),
      'Lager 1/6': sales.reduce((s, r) => s + (r.kegsLager_sixth || 0), 0),
      'Lager 1/2': sales.reduce((s, r) => s + (r.kegsLager_half || 0), 0),
      'Cases': sales.reduce((s, r) => s + (r.casesCans || 0), 0),
    };

    this.charts.productMix = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(totals),
        datasets: [{ data: Object.values(totals), backgroundColor: ['#f0a500', '#cf7500', '#3498db', '#2980b9', '#9b59b6'] }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#8899aa', padding: 12 } } }
      }
    });
  },

  renderInterestChart() {
    this.destroyChart('interest');
    const ctx = document.getElementById('chart-interest');
    if (!ctx) return;
    const activities = DB.getActivities();
    const levels = ['Cold', 'Warm', 'Hot', 'Ordered', 'On Tap'];
    const counts = levels.map(l => activities.filter(a => a.interestLevel === l).length);
    const colors = ['#3498db', '#f1c40f', '#e74c3c', '#2ecc71', '#d4a017'];

    this.charts.interest = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: levels,
        datasets: [{ data: counts, backgroundColor: colors }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#8899aa', padding: 12 } } }
      }
    });
  },
};
