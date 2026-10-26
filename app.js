/* ==========================================================
   Smart Expense Tracker: app logic (app.html)
   - State is one object saved in localStorage
   - Views: dashboard, transactions, budgets, reports, settings
   - No charts: everything is stat cards, tables and status pills
   ========================================================== */
(function () {
  'use strict';

  const KEY = 'smart-expense-tracker-v2';
  const LOCALES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const DOT_COLORS = ['#3B6FE0', '#E07A3B', '#2FA37A', '#C9A227', '#8A5CD0', '#D9588F', '#4AA3C7', '#7C8B3A', '#8C96A3'];
  const TITLES = {
    dashboard: 'Dashboard', transactions: 'Transactions', budgets: 'Budgets',
    reports: 'Reports', settings: 'Settings'
  };

  /* ---------- small helpers ---------- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ym = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const parts = m => m.split('-').map(Number);
  const parseYmd = s => { const [y, m, d] = parts(s); return new Date(y, m - 1, d); };
  const monthLabel = m => { const [y, mo] = parts(m); return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
  const shortMonth = m => { const [y, mo] = parts(m); return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); };
  const shiftMonth = (m, delta) => { const [y, mo] = parts(m); return ym(new Date(y, mo - 1 + delta, 1)); };
  const daysIn = m => { const [y, mo] = parts(m); return new Date(y, mo, 0).getDate(); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const $ = sel => document.querySelector(sel);

  /* ---------- data ---------- */
  const defaultCats = () => ({
    expense: ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Education', 'Other'],
    income: ['Salary', 'Freelance', 'Gift', 'Other income']
  });
  const defaultBudgets = () => ({ Food: 7000, Rent: 15000, Transport: 2500, Shopping: 4000, Bills: 3000, Health: 1500, Entertainment: 1500, Education: 2000 });

  function sampleTxs() {
    const now = new Date(), txs = [];
    let s = 7;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const add = (type, amount, cat, date, note) => txs.push({ id: uid() + txs.length, type, amount, cat, date: ymd(date), note, sample: true });
    for (let back = 5; back >= 0; back--) {
      const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const last = back === 0 ? now.getDate() : daysIn(ym(first));
      const day = d => new Date(first.getFullYear(), first.getMonth(), Math.min(d, last));
      add('income', 62000, 'Salary', day(1), 'Monthly salary');
      if (rnd() > 0.45) add('income', 6000 + Math.round(rnd() * 4000), 'Freelance', day(12), 'Design project');
      if (last >= 3) add('expense', 15000, 'Rent', day(3), 'Flat rent');
      if (last >= 5) add('expense', 1500 + Math.round(rnd() * 600), 'Bills', day(5), 'Electricity bill');
      if (last >= 6) add('expense', 799, 'Bills', day(6), 'Broadband');
      ['Vegetables and fruit', 'Monthly groceries', 'Dinner out', 'Weekend brunch', 'Snacks', 'Lunch with team'].forEach(note => {
        const d = 2 + Math.round(rnd() * Math.max(last - 2, 0));
        if (d <= last) add('expense', 250 + Math.round(rnd() * 900), 'Food', day(d), note);
      });
      ['Metro card recharge', 'Cab to airport', 'Fuel', 'Auto fare'].forEach(note => {
        const d = 2 + Math.round(rnd() * Math.max(last - 2, 0));
        if (d <= last) add('expense', 120 + Math.round(rnd() * 600), 'Transport', day(d), note);
      });
      if (last >= 10) add('expense', 900 + Math.round(rnd() * 2400), 'Shopping', day(10 + Math.round(rnd() * 8)), 'Clothes');
      if (last >= 15) add('expense', 300 + Math.round(rnd() * 600), 'Entertainment', day(15), 'Movie night');
      if (rnd() > 0.5 && last >= 8) add('expense', 500 + Math.round(rnd() * 700), 'Health', day(8), 'Pharmacy');
      if (rnd() > 0.6 && last >= 9) add('expense', 1200, 'Education', day(9), 'Online course');
    }
    return txs;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.txs && d.cats && d.budgets) { d.currency = d.currency || 'INR'; return d; }
      }
    } catch (e) { /* storage unavailable: fall through to fresh state */ }
    return { txs: [], cats: defaultCats(), budgets: {}, sample: false, currency: 'INR' };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  let state = load();
  let view = 'dashboard';
  let month = ym(new Date());
  let editId = null, pendingDelete = null, confirmClear = false;
  const filters = { q: '', type: 'all', cat: 'all', all: false };

  const money = n => new Intl.NumberFormat(LOCALES[state.currency] || 'en-IN', {
    style: 'currency', currency: state.currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(n);

  /* ---------- calculations ---------- */
  const inMonth = m => state.txs.filter(t => t.date.slice(0, 7) === m);
  function totals(list) {
    let income = 0, expense = 0;
    list.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    return { income, expense, saved: income - expense };
  }
  function spentByCat(m) {
    const out = {};
    inMonth(m).forEach(t => { if (t.type === 'expense') out[t.cat] = (out[t.cat] || 0) + t.amount; });
    return out;
  }
  const savingsRate = t => (t.income > 0 ? Math.round(t.saved / t.income * 100) : null);
  function status(spent, limit) {
    const p = spent / limit;
    return p > 1 ? 'over' : p >= 0.8 ? 'warn' : 'ok';
  }
  const STATUS_TEXT = { ok: 'On track', warn: 'Near limit', over: 'Over budget' };
  const catColor = cat => { const i = state.cats.expense.indexOf(cat); return DOT_COLORS[(i < 0 ? 8 : i) % DOT_COLORS.length]; };
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  /* ---------- rendering ---------- */
  function render() {
    $('#view-title').textContent = TITLES[view];
    $('#month-label').textContent = monthLabel(month);
   
const monthSwitch = $('#month-switch');
if (monthSwitch) {
  monthSwitch.hidden = view === 'settings';
}

    $('#notice').hidden = !state.sample;
    
    
const viewSub = $('#view-sub');
if (viewSub) {
  viewSub.textContent = {
    dashboard: 'Your month at a glance',
    transactions: 'Everything you have recorded',
    budgets: 'Monthly limits for each category',
    reports: 'Summaries by month and category',
    settings: 'Currency, backup and data'
  }[view];
}

    document.querySelectorAll('.nav-item').forEach(b => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const html = { dashboard, transactions, budgets, reports, settings }[view]();
    $('#main').innerHTML = html;
  }

  /* --- dashboard --- */
  function dashboard() {
    const list = inMonth(month), t = totals(list), spent = spentByCat(month);
    
    const prev = totals(inMonth(shiftMonth(month, -1)));
    let cmp = 'No spending last month to compare';
    if (prev.expense) {
      const diff = Math.round((t.expense - prev.expense) / prev.expense * 100);
      cmp = diff > 0 ? `${diff}% more than last month` : diff < 0 ? `${Math.abs(diff)}% less than last month` : 'Same as last month';
    }
    const rate = savingsRate(t);

    const budgeted = Object.keys(state.budgets).filter(c => state.budgets[c] > 0)
      .map(c => ({ cat: c, limit: state.budgets[c], spent: spent[c] || 0 }))
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

    const bcards = budgeted.length ? `<div class="bcards">${budgeted.map(b => {
      const st = status(b.spent, b.limit);
      const sub = b.spent > b.limit ? `${money(b.spent - b.limit)} over` : `${money(b.limit - b.spent)} left`;
      return `<article class="bcard"><div class="bcard-top"><h3>${esc(b.cat)}</h3><span class="pill ${st}">${STATUS_TEXT[st]}</span></div>
        <p class="amt num">${money(b.spent)} <span>of ${money(b.limit)}</span></p><p class="sub">${sub}</p></article>`;
    }).join('')}</div>` : `<div class="empty">No budgets yet. <button class="link-btn" type="button" data-go="budgets">Set your first budget</button></div>`;

    const cats = Object.keys(spent).sort((a, b) => spent[b] - spent[a]);
    const catRows = cats.map(c => {
      const lim = state.budgets[c];
      return `<tr><td><span class="dot" style="background:${catColor(c)}"></span>${esc(c)}</td>
        <td class="r num">${money(spent[c])}</td><td class="r num">${Math.round(spent[c] / t.expense * 100)}%</td>
        <td class="r num">${lim ? money(lim) : '&ndash;'}</td></tr>`;
    }).join('');
    const catTable = cats.length ? `<div class="table-wrap"><table><thead><tr><th>Category</th><th class="r">Spent</th><th class="r">Share</th><th class="r">Budget</th></tr></thead><tbody>${catRows}</tbody>
      <tfoot><tr><td>Total</td><td class="r num">${money(t.expense)}</td><td class="r num">100%</td><td class="r"></td></tr></tfoot></table></div>`
      : `<div class="empty">No expenses recorded for ${esc(monthLabel(month))}.</div>`;

    const recent = list.slice().sort(byDateDesc).slice(0, 6);

    return `<div class="stack">
      <section class="stats" aria-label="Summary">
        <div class="stat primary"><span class="k">Balance</span><span class="v num">${money(t.saved)}</span><span class="d">Income minus expenses</span></div>
        <div class="stat"><span class="k">Income</span><span class="v num in">${money(t.income)}</span><span class="d">${list.filter(x => x.type === 'income').length} entries</span></div>
        <div class="stat"><span class="k">Expenses</span><span class="v num out">${money(t.expense)}</span><span class="d">${esc(cmp)}</span></div>
        <div class="stat"><span class="k">Savings rate</span><span class="v num">${rate === null ? '&ndash;' : rate + '%'}</span><span class="d">Share of income you kept</span></div>
      </section>
      <section class="panel"><div class="panel-head"><h2>Budget status</h2><button class="link-btn" type="button" data-go="budgets">Edit budgets</button></div>${bcards}</section>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Spending by category</h2><span class="sub">${esc(monthLabel(month))}</span></div>${catTable}</section>
        <section class="panel"><div class="panel-head"><h2>Latest transactions</h2><button class="link-btn" type="button" data-go="transactions">See all</button></div>
          ${recent.length ? `<ul class="rows">${recent.map(r => row(r, false)).join('')}</ul>` : '<div class="empty">Nothing recorded this month yet.</div>'}</section>
      </div></div>`;
  }

  function row(t, actions) {
    const d = parseYmd(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    let x = '';
    if (actions) {
      x = pendingDelete === t.id
        ? `<span class="x"><button class="btn btn-danger btn-sm" type="button" data-action="confirm-delete" data-id="${t.id}">Confirm delete</button><button class="btn btn-ghost btn-sm" type="button" data-action="cancel-delete">Keep</button></span>`
        : `<span class="x"><button class="btn btn-ghost btn-sm" type="button" data-action="edit" data-id="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-action="delete" data-id="${t.id}">Delete</button></span>`;
    }
    return `<li class="row"><span class="d num">${d}</span>
      <span class="t"><b>${esc(t.note || t.cat)}</b><span>${esc(t.cat)}${t.sample ? ' &middot; example' : ''}</span></span>
      <span class="a num ${t.type === 'income' ? 'in' : 'out'}">${t.type === 'income' ? '+' : '&minus;'}${money(t.amount)}</span>${x}</li>`;
  }

  /* --- transactions --- */
  function filteredTx() {
    const q = filters.q.trim().toLowerCase();
    return state.txs.filter(t => {
      if (!filters.all && t.date.slice(0, 7) !== month) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.cat !== 'all' && t.cat !== filters.cat) return false;
      if (q && `${t.note} ${t.cat}`.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(byDateDesc);
  }
  const options = (list, sel) => list.map(c => `<option${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');

  function transactions() {
    const list = filteredTx(), t = totals(list);
    const allCats = state.cats.expense.concat(state.cats.income.filter(c => state.cats.expense.indexOf(c) < 0));
    return `<section class="panel">
      <div class="panel-head"><h2>${list.length} transaction${list.length === 1 ? '' : 's'}</h2>
        <span class="sub num">${money(t.income)} in &middot; ${money(t.expense)} out</span></div>
      <div class="filters">
        <div class="field q"><label for="flt-q">Search</label><input id="flt-q" type="search" placeholder="Search notes or categories" value="${esc(filters.q)}"></div>
        <div class="field"><label for="flt-type">Type</label><select id="flt-type">
          <option value="all">All</option><option value="expense"${filters.type === 'expense' ? ' selected' : ''}>Expenses</option><option value="income"${filters.type === 'income' ? ' selected' : ''}>Income</option></select></div>
        <div class="field"><label for="flt-cat">Category</label><select id="flt-cat"><option value="all">All</option>${options(allCats, filters.cat)}</select></div>
        <label class="check"><input type="checkbox" id="flt-all"${filters.all ? ' checked' : ''}> All months</label>
      </div>
      ${list.length ? `<ul class="rows">${list.map(r => row(r, true)).join('')}</ul>` : '<div class="empty">No transactions match. Use Add transaction or change the filters.</div>'}
    </section>`;
  }

  /* --- budgets --- */
  function budgets() {
    const spent = spentByCat(month);
    const rows = state.cats.expense.map((cat, i) => {
      const limit = state.budgets[cat] || 0, sp = spent[cat] || 0, st = limit ? status(sp, limit) : 'none';
      const meta = limit
        ? (sp > limit ? `${money(sp - limit)} over budget` : `${money(limit - sp)} left`) + ` &middot; ${money(sp)} spent`
        : `No limit set &middot; ${money(sp)} spent`;
      return `<div class="bud-row"><div><div class="name"><span class="dot" style="background:${catColor(cat)}"></span>${esc(cat)}
        <span class="pill ${st}">${limit ? STATUS_TEXT[st] : 'No limit'}</span></div><div class="meta num">${meta}</div></div>
        <div class="field"><label class="sr-only" for="b-${i}">Monthly limit for ${esc(cat)}</label>
        <input id="b-${i}" type="number" min="0" step="100" inputmode="decimal" placeholder="Monthly limit" data-budget="${esc(cat)}" value="${limit || ''}"></div></div>`;
    }).join('');
    return `<div class="stack">
      <section class="panel"><div class="panel-head"><h2>Monthly limits</h2><span class="sub">Spending shown for ${esc(monthLabel(month))}. Limits repeat every month.</span></div>${rows}</section>
      <section class="panel"><div class="panel-head"><h2>Add a category</h2></div>
        <form id="cat-form" class="cat-form" novalidate>
          <div class="field"><label for="nc-type">Type</label><select id="nc-type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
          <div class="field"><label for="nc-name">Name</label><input id="nc-name" type="text" maxlength="24" placeholder="For example, Pets"></div>
          <button class="btn" type="submit">Add category</button>
        </form><p class="err" id="cat-err" role="alert" style="margin-top:10px"></p></section></div>`;
  }

  /* --- reports --- */
  function reports() {
    const months = [];
    for (let i = 11; i >= 0; i--) months.push(shiftMonth(month, -i));
    let sumI = 0, sumE = 0;
    const mrows = months.map(m => {
      const t = totals(inMonth(m)); sumI += t.income; sumE += t.expense;
      const r = savingsRate(t);
      return `<tr${m === month ? ' class="current"' : ''}><td>${esc(shortMonth(m))}</td><td class="r num in">${money(t.income)}</td><td class="r num out">${money(t.expense)}</td>
        <td class="r num ${t.saved < 0 ? 'out' : ''}">${money(t.saved)}</td><td class="r num">${r === null ? '&ndash;' : r + '%'}</td></tr>`;
    }).join('');
    const all = sumI - sumE, allRate = sumI > 0 ? Math.round(all / sumI * 100) + '%' : '&ndash;';

    const list = inMonth(month);
    const top = list.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topRows = top.map(t => `<tr><td>${esc(parseYmd(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}</td><td>${esc(t.note || t.cat)}</td><td>${esc(t.cat)}</td><td class="r num out">${money(t.amount)}</td></tr>`).join('');

    const inc = {};
    list.forEach(t => { if (t.type === 'income') inc[t.cat] = (inc[t.cat] || 0) + t.amount; });
    const incRows = Object.keys(inc).sort((a, b) => inc[b] - inc[a]).map(c => `<tr><td>${esc(c)}</td><td class="r num in">${money(inc[c])}</td></tr>`).join('');

    return `<div class="stack">
      <section class="panel"><div class="panel-head"><h2>Month by month</h2><span class="sub">The 12 months ending ${esc(shortMonth(month))}</span></div>
        <div class="table-wrap"><table><thead><tr><th>Month</th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Saved</th><th class="r">Savings rate</th></tr></thead>
        <tbody>${mrows}</tbody><tfoot><tr><td>Total</td><td class="r num">${money(sumI)}</td><td class="r num">${money(sumE)}</td><td class="r num">${money(all)}</td><td class="r num">${allRate}</td></tr></tfoot></table></div></section>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Biggest expenses</h2><span class="sub">${esc(monthLabel(month))}</span></div>
          ${top.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Note</th><th>Category</th><th class="r">Amount</th></tr></thead><tbody>${topRows}</tbody></table></div>` : '<div class="empty">No expenses this month.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>Income sources</h2><span class="sub">${esc(monthLabel(month))}</span></div>
          ${incRows ? `<div class="table-wrap"><table><thead><tr><th>Source</th><th class="r">Amount</th></tr></thead><tbody>${incRows}</tbody></table></div>` : '<div class="empty">No income this month.</div>'}</section>
      </div></div>`;
  }

  /* --- settings --- */
  function settings() {
    return `<section class="panel">
      <div class="set-row"><div><b>Currency</b><p>Changes how amounts are shown. Your numbers are not converted.</p></div>
        <div class="field"><label class="sr-only" for="set-cur">Currency</label><select id="set-cur">
          ${[['INR', 'Indian rupee (₹)'], ['USD', 'US dollar ($)'], ['EUR', 'Euro (€)'], ['GBP', 'British pound (£)']].map(c => `<option value="${c[0]}"${state.currency === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select></div></div>
      <div class="set-row"><div><b>Back up as CSV</b><p>Copy every transaction as CSV text. Paste it into a spreadsheet or a file to keep a copy.</p></div>
        <button class="btn btn-ghost" type="button" data-action="copy-csv">Copy CSV</button></div>
      <textarea id="csv-box" class="csv-box" readonly hidden aria-label="CSV text"></textarea>
      <p class="sub" id="csv-msg" style="color:var(--muted);font-size:14px"></p>
      <div class="set-row"><div><b>Add example data</b><p>Adds six months of sample transactions so you can explore. You can remove them later.</p></div>
        <button class="btn btn-ghost" type="button" data-action="add-sample">Add examples</button></div>
      <div class="set-row"><div><b>Delete all data</b><p>Removes every transaction, budget and custom category from this browser. This cannot be undone.</p></div>
        ${confirmClear
          ? '<span><button class="btn btn-danger" type="button" data-action="confirm-clear">Yes, delete everything</button> <button class="btn btn-ghost" type="button" data-action="cancel-clear">Cancel</button></span>'
          : '<button class="btn btn-ghost" type="button" data-action="clear-all">Delete all data</button>'}</div>
    </section>
    <p class="sub" style="color:var(--muted);font-size:14px;margin-top:16px">Your data is saved in this browser only. Clearing your browser data will erase it.</p>`;
  }

  /* ---------- dialog (add / edit) ---------- */
  const dlg = $('#tx-dialog'), form = $('#tx-form');
  function fillCategories(type, selected) { $('#f-cat').innerHTML = options(state.cats[type], selected); }
  function openDialog(id) {
    editId = id || null;
    const tx = editId ? state.txs.find(t => t.id === editId) : null;
    const type = tx ? tx.type : 'expense';
    $('#dlg-title').textContent = tx ? 'Edit transaction' : 'Add transaction';
    $('#dlg-submit').textContent = tx ? 'Save changes' : 'Add transaction';
    form.type.value = type;
    $('#type-expense').checked = type === 'expense';
    $('#type-income').checked = type === 'income';
    fillCategories(type, tx ? tx.cat : null);
    $('#f-amount').value = tx ? tx.amount : '';
    $('#f-date').value = tx ? tx.date : (month === ym(new Date()) ? ymd(new Date()) : month + '-01');
    $('#f-note').value = tx ? tx.note : '';
    $('#form-err').textContent = '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(() => $('#f-amount').focus(), 30);
  }
  function closeDialog() { if (dlg.open) dlg.close(); editId = null; }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  /* ---------- CSV ---------- */
  function toCSV(list) {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    return ['Date,Type,Category,Amount,Note'].concat(list.map(t => [t.date, t.type, q(t.cat), t.amount, q(t.note || '')].join(','))).join('\n');
  }
  function csvFallback(text) {
    const box = $('#csv-box'); if (!box) return;
    box.hidden = false; box.value = text; box.focus(); box.select();
    $('#csv-msg').textContent = 'Copy this text with your keyboard (Ctrl+C or Cmd+C).';
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-view]');
    if (nav) { view = nav.dataset.view; pendingDelete = null; render(); window.scrollTo(0, 0); return; }
    const go = e.target.closest('[data-go]');
    if (go) { view = go.dataset.go; render(); window.scrollTo(0, 0); return; }
    if (e.target === dlg) { closeDialog(); return; }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;

    if (a === 'prev-month') { month = shiftMonth(month, -1); render(); }
    else if (a === 'next-month') { month = shiftMonth(month, 1); render(); }
    else if (a === 'add') openDialog(null);
    else if (a === 'edit') openDialog(id);
    else if (a === 'close-dialog') closeDialog();
    else if (a === 'delete') { pendingDelete = id; render(); }
    else if (a === 'cancel-delete') { pendingDelete = null; render(); }
    else if (a === 'confirm-delete') {
      state.txs = state.txs.filter(t => t.id !== id);
      state.sample = state.txs.some(t => t.sample);
      pendingDelete = null; save(); render(); toast('Transaction deleted');
    }
    else if (a === 'clear-sample') {
      state.txs = state.txs.filter(t => !t.sample); state.sample = false; save(); render(); toast('Examples removed');
    }
    else if (a === 'add-sample') {
      state.txs = state.txs.concat(sampleTxs()); state.sample = true; save(); render(); toast('Example data added');
    }
    else if (a === 'clear-all') { confirmClear = true; render(); }
    else if (a === 'cancel-clear') { confirmClear = false; render(); }
    else if (a === 'confirm-clear') {
      state = { txs: [], cats: defaultCats(), budgets: {}, sample: false, currency: state.currency };
      confirmClear = false; save(); render(); toast('All data deleted');
    }
    else if (a === 'copy-csv') {
      const text = toCSV(state.txs.slice().sort(byDateDesc));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => { $('#csv-msg').textContent = `Copied ${state.txs.length} transactions.`; }, () => csvFallback(text));
      } else csvFallback(text);
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'type' && t.closest('#tx-form')) { fillCategories(t.value, null); return; }
    if (t.id === 'flt-type') { filters.type = t.value; render(); }
    else if (t.id === 'flt-cat') { filters.cat = t.value; render(); }
    else if (t.id === 'flt-all') { filters.all = t.checked; render(); }
    else if (t.id === 'set-cur') { state.currency = t.value; save(); render(); }
    else if (t.dataset && t.dataset.budget) {
      const v = parseFloat(t.value);
      if (v > 0) state.budgets[t.dataset.budget] = v; else delete state.budgets[t.dataset.budget];
      save(); render(); toast('Budget saved');
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'flt-q') return;
    filters.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const q = $('#flt-q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } }
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'tx-form') {
      const amount = parseFloat(form.amount.value), date = form.date.value, err = $('#form-err');
      if (!(amount > 0)) { err.textContent = 'Enter an amount greater than zero.'; return; }
      if (!date) { err.textContent = 'Pick a date.'; return; }
      const rec = { type: form.type.value, amount: Math.round(amount * 100) / 100, cat: form.cat.value, date, note: form.note.value.trim() };
      if (editId) state.txs = state.txs.map(t => (t.id === editId ? Object.assign({}, t, rec, { sample: false }) : t));
      else state.txs.push(Object.assign({ id: uid() }, rec));
      state.sample = state.txs.some(t => t.sample);
      const wasEdit = !!editId;
      month = date.slice(0, 7);
      save(); closeDialog(); render(); toast(wasEdit ? 'Changes saved' : 'Transaction added');
    } else if (e.target.id === 'cat-form') {
      const type = $('#nc-type').value, name = $('#nc-name').value.trim(), err = $('#cat-err');
      if (!name) { err.textContent = 'Enter a category name.'; return; }
      if (state.cats[type].some(c => c.toLowerCase() === name.toLowerCase())) { err.textContent = 'That category already exists.'; return; }
      state.cats[type].push(name); save(); render(); toast('Category added');
    }
  });

  render();
})();
