/* Monthly staff performance ranking and sales incentive distribution. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = value => '₹' + (Number(value) || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
  const hoursText = value => (Number(value) || 0).toFixed(2) + ' h';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const style = document.createElement('style');
  style.textContent = `
    #performancePanel .performance-table{min-width:760px}
    #performancePanel .performance-table td{vertical-align:middle}
    #performancePanel .performance-bar{height:7px;border-radius:99px;background:#e7eaf2;overflow:hidden;margin-top:5px;min-width:72px}
    #performancePanel .performance-bar span{display:block;height:100%;border-radius:99px;background:#d88a13}
    #performancePanel .performance-rank{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 7px;border-radius:9px;background:#172554;color:#fff;font-weight:750}
    #performancePanel .performance-payout{font-weight:750;color:#145c3b}
    #performancePanel .performance-total-row{font-weight:750;background:#fff1d3!important}
    @media(max-width:760px){#performancePanel .controls{width:100%}#performancePanel .controls label{flex:1 1 150px}}
  `;
  document.head.appendChild(style);

  function getEmployeeStats(name, month) {
    const profile = staffStore[name] || {};
    const defaults = typeof defaultStaffData === 'function' ? defaultStaffData(name).settings : {};
    const settings = {...defaults, ...(profile.settings || {})};
    const rows = Array.isArray(profile.records) ? profile.records.filter(r => r && r.date && String(r.date).startsWith(month + '-')) : [];
    let workedHours = 0, leaveDays = 0, presentDays = 0;
    for (const record of rows) {
      if (record.status === 'Leave') leaveDays++;
      if (record.status !== 'Present' || !record.in || !record.out) continue;
      const clocked = hoursBetween(parseInputTime(record.in), parseInputTime(record.out));
      const extraLunch = Math.max(0, (Number(record.lunch) || 0) - (Number(settings.lunch) || 0));
      const permission = Math.max(0, Number(record.permission) || 0);
      const net = Math.max(0, clocked - extraLunch - permission);
      if (Number.isFinite(net)) { workedHours += net; presentDays++; }
    }
    return {name, workedHours, leaveDays, presentDays};
  }

  function renderPerformance() {
    const month = $('month')?.value;
    const tbody = $('performanceRows');
    if (!month || !tbody) return;
    const pool = Math.max(0, Number(incentivePool) || 0);
    const stats = Object.keys(staffStore || {}).map(name => getEmployeeStats(name, month));
    stats.sort((a,b) => b.workedHours - a.workedHours || a.name.localeCompare(b.name));
    const teamHours = stats.reduce((sum, item) => sum + item.workedHours, 0);
    let totalDeduction = 0, totalPayable = 0, previousHours = null, previousRank = 0;
    const highest = stats.length ? stats[0].workedHours : 0;
    const rows = stats.map((item, index) => {
      const rank = previousHours !== null && Math.abs(item.workedHours - previousHours) < 0.000001 ? previousRank : index + 1;
      previousHours = item.workedHours; previousRank = rank;
      const share = teamHours > 0 ? item.workedHours / teamHours : 0;
      const gross = pool * share;
      const deductionPercent = Math.min(100, Math.max(0, item.leaveDays - 2) * 5);
      const deduction = gross * deductionPercent / 100;
      const payable = gross - deduction;
      totalDeduction += deduction; totalPayable += payable;
      const barWidth = highest > 0 ? item.workedHours / highest * 100 : 0;
      return `<tr>
        <td data-label="Rank"><span class="performance-rank">#${rank}</span></td>
        <td data-label="Employee"><strong>${esc(item.name)}</strong><div class="performance-bar"><span style="width:${barWidth.toFixed(2)}%"></span></div></td>
        <td data-label="Net working hours"><strong>${hoursText(item.workedHours)}</strong></td>
        <td data-label="Share">${(share * 100).toFixed(2)}%</td>
        <td data-label="Leave days">${item.leaveDays}</td>
        <td data-label="Deduction">${deductionPercent.toFixed(0)}% <span class="muted">(${money(deduction)})</span></td>
        <td data-label="Final incentive" class="performance-payout">${money(payable)}</td>
      </tr>`;
    });
    if (!rows.length) tbody.innerHTML = '<tr><td colspan="7" class="empty">Add employee profiles to see the monthly ranking.</td></tr>';
    else tbody.innerHTML = rows.join('') + `<tr class="performance-total-row">
      <td data-label="Rank">—</td><td data-label="Employee">Team total</td>
      <td data-label="Net working hours">${hoursText(teamHours)}</td>
      <td data-label="Share">${teamHours > 0 ? '100.00%' : '0.00%'}</td>
      <td data-label="Leave days">${stats.reduce((sum,x)=>sum+x.leaveDays,0)}</td>
      <td data-label="Deduction">${money(totalDeduction)}</td>
      <td data-label="Final incentive">${money(totalPayable)}</td>
    </tr>`;
    $('teamHours').textContent = teamHours.toFixed(2);
    $('teamPool').textContent = money(pool);
    $('teamPayable').textContent = money(totalPayable);
    $('teamLeaveDeduction').textContent = money(totalDeduction);
    const poolInput = $('incentivePoolInput');
    if (poolInput && document.activeElement !== poolInput) poolInput.value = pool.toFixed(2);
  }

  $('saveIncentivePool')?.addEventListener('click', () => {
    const value = Number($('incentivePoolInput').value);
    if (!Number.isFinite(value) || value < 0) { notify('Enter a valid incentive pool amount of ₹0 or more.', 'error'); return; }
    incentivePool = value;
    save();
    renderPerformance();
    notify('Monthly sales incentive pool saved.');
  });
  $('incentivePoolInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') $('saveIncentivePool').click(); });

  const originalRender = render;
  render = function() { originalRender(); renderPerformance(); };
  renderPerformance();
})();
