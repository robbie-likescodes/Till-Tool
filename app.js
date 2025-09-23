/* ========================== CONFIG ========================== */
const ENDPOINT = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'; // <-- paste your Web App URL
const MATH_EPS = 0.02; // tolerance for sanity checks (~2 cents)

/* ========================== HELPERS ========================== */
const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const money = v => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? +n : null;
};
const fix2 = n => Number(Number(n || 0).toFixed(2));
const setNum = (id, v) => {
  const el = $(id);
  if (!el) return;
  el.readOnly = READONLY.has(id);
  el.value = (v == null ? '' : (+v).toFixed(2));
};
const getNum = id => money($(id)?.value);
const setText = (id, text, cls) => {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = text;
};

/* ========================== READ-ONLY FIELDS ========================== */
const READONLY = new Set([
  'am_cash_deposit_total', 'am_shift_total', 'am_sales_total', 'am_mishandled_cash',
  'pm_cash_deposit_total', 'pm_shift_total', 'pm_sales_total', 'pm_mishandled_cash'
]);

/* ========================== MEMORY & DEFAULTS ========================== */
(function bootMemoryAndDefaults() {
  // Remember name + store on device
  ['firstName', 'lastName', 'store'].forEach(k => {
    $(k).value = localStorage.getItem('dd_' + k) || '';
    $(k).addEventListener('input', () => localStorage.setItem('dd_' + k, $(k).value.trim()));
  });
  // Date/time defaults
  const now = new Date();
  $('date').value = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  $('time').value = now.toTimeString().slice(0, 5);
})();

/* ========================== AM / PM TOGGLE ========================== */
function isPM(t) {
  const [h, m] = (t || '').split(':').map(Number);
  return h > 15 || (h === 15 && (m || 0) >= 0);
}
function toggleAMPM() {
  const pm = isPM($('time').value);
  $('amSection').style.display = pm ? 'none' : '';
  $('pmSection').style.display = pm ? '' : 'none';
}
$('time').addEventListener('input', toggleAMPM);
toggleAMPM();

/* ========================== OCR CORE ========================== */
// Requires <script src="https://unpkg.com/tesseract.js@5.0.5/dist/tesseract.min.js"></script> in index.html
async function ocr(file, statusEl) {
  setText(statusEl.id, 'OCR…', 'pill');
  const url = URL.createObjectURL(file);
  const { data } = await Tesseract.recognize(url, 'eng', {
    logger: m => setText(statusEl.id, m.status || 'OCR…', 'pill')
  });
  URL.revokeObjectURL(url);
  const lines = (data.text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  setText(statusEl.id, 'Scanned ✓', 'pill ok');
  return lines;
}

function parseMoneyFromLines(lines, keys) {
  const re = /(?<!\d)(-?\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g;
  const toN = s => {
    const n = Number(String(s || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? +n : null;
  };
  const has = (s, arr) => arr.some(w => s.toLowerCase().includes(w));
  for (let i = 0; i < lines.length; i++) {
    if (has(lines[i], keys)) {
      const same = [...lines[i].matchAll(re)].map(m => toN(m[0])).filter(v => v != null);
      if (same.length) return same.at(-1);
      const next = lines[i + 1] ? [...lines[i + 1].matchAll(re)].map(m => toN(m[0])).filter(v => v != null) : [];
      if (next.length) return next.at(-1);
    }
  }
  return null;
}

/* ========================== SALES REPORT PARSER ========================== */
function parseSales(lines) {
  const get = k => parseMoneyFromLines(lines, k);
  const allNums = lines.flatMap(L =>
    [...L.matchAll(/(?<!\d)(\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g)]
      .map(m => money(m[0]) || 0)
  );
  const largest = allNums.length ? Math.max(...allNums) : null;
  return {
    total_collected: get(['total collected', 'grand total', 'amount due', 'total']) ?? largest,
    tips: get(['tips', 'gratuity', 'gratuities']),
    gift: get(['gift card sales', 'gift cards sales', 'gift card']),
    card: get(['credit card charges', 'card']),
    cash_sales: get(['cash sales']),
    tax: get(['tax', 'sales tax']),
    subtotal: get(['subtotal', 'sub total', 'net sales', 'items total'])
  };
}

/* ========================== DRAWER REPORT PARSER ========================== */
function parseDrawer(lines) {
  return {
    starting_cash: parseMoneyFromLines(lines, ['starting cash']),
    ending_cash: parseMoneyFromLines(lines, ['actual in drawer', 'ending cash', 'till total']),
    paid_in_out: parseMoneyFromLines(lines, ['paid in/out', 'paid in', 'paid out']),
    expenses: parseMoneyFromLines(lines, ['expenses'])
  };
}

/* ========================== OCR BUTTON WIRING ========================== */
$('scanSales').addEventListener('click', async () => {
  const f = $('fileSales').files?.[0];
  if (!f) return alert('Pick a Sales Report photo');
  const lines = await ocr(f, $('statusSales'));
  const p = parseSales(lines);
  setNum('am_total_collected', p.total_collected);
  setNum('am_tips', p.tips);
  setNum('am_gift_card_sales', p.gift);
  setNum('am_card_collected', p.card);
  setNum('am_cash_sales', p.cash_sales);
  setText('salesChip', 'scanned', 'badge');
  recalcAll();
});
$('clearSales').addEventListener('click', () => {
  ['am_total_collected', 'am_tips', 'am_gift_card_sales', 'am_card_collected', 'am_cash_sales']
    .forEach(id => $(id).value = '');
  setText('mathSales', 'Cleared', 'pill');
});

$('scanDrawer').addEventListener('click', async () => {
  const f = $('fileDrawer').files?.[0];
  if (!f) return alert('Pick a Drawer Report photo');
  const lines = await ocr(f, $('statusDrawer'));
  const p = parseDrawer(lines);
  setNum('am_starting_cash', p.starting_cash);
  setNum('am_ending_cash', p.ending_cash);
  setNum('am_paid_in_out', p.paid_in_out);
  setNum('am_expenses', p.expenses);
  setText('drawerChip', 'scanned', 'badge');
  recalcAll();
});

/* ========================== LIVE COMPUTATIONS ========================== */
function recalcAM() {
  // Deposit Total
  const dep = fix2(
    (getNum('am_dep_coins') || 0) + (getNum('am_dep_1s') || 0) + (getNum('am_dep_5s') || 0) +
    (getNum('am_dep_10s') || 0) + (getNum('am_dep_20s') || 0) + (getNum('am_dep_50s') || 0) +
    (getNum('am_dep_100s') || 0)
  );
  setNum('am_cash_deposit_total', dep);

  // Shift Total = card + deposit
  const shift = fix2((getNum('am_card_collected') || 0) + dep);
  setNum('am_shift_total', shift);

  // AM Sales Total = Total Collected - Tips - Gift + Starting - Ending - Expenses
  const sales = fix2(
    (getNum('am_total_collected') || 0) - (getNum('am_tips') || 0) - (getNum('am_gift_card_sales') || 0) +
    (getNum('am_starting_cash') || 0) - (getNum('am_ending_cash') || 0) - (getNum('am_expenses') || 0)
  );
  setNum('am_sales_total', sales);

  // Mishandled = Starting - Shift + Expenses
  const mish = fix2((getNum('am_starting_cash') || 0) - shift + (getNum('am_expenses') || 0));
  setNum('am_mishandled_cash', mish);

  // Sanity chip for Sales report math
  const parts = fix2((getNum('am_cash_sales') || 0) + (getNum('am_card_collected') || 0) +
                     (getNum('am_gift_card_sales') || 0) + (getNum('am_tips') || 0));
  const tot = getNum('am_total_collected');
  const ok = (tot != null) && Math.abs(parts - tot) <= MATH_EPS;
  setText('mathSales', ok ? 'Math check ✓' : 'Review totals', 'pill ' + (ok ? 'ok' : 'warn'));

  // Overall AM check
  setText('amCheck', (mish >= 0 ? 'AM OK' : 'AM: mishandled negative? review'), 'pill ' + (mish >= 0 ? 'ok' : 'warn'));
}

function recalcPM() {
  const dep = fix2(
    (getNum('pm_dep_coins') || 0) + (getNum('pm_dep_1s') || 0) + (getNum('pm_dep_5s') || 0) +
    (getNum('pm_dep_10s') || 0) + (getNum('pm_dep_20s') || 0) + (getNum('pm_dep_50s') || 0) +
    (getNum('pm_dep_100s') || 0)
  );
  setNum('pm_cash_deposit_total', dep);

  const shift = fix2((getNum('pm_card_collected') || 0) + dep);
  setNum('pm_shift_total', shift);

  const sales = fix2(
    (getNum('pm_total_collected') || 0) - (getNum('pm_tips') || 0) - (getNum('pm_gift_card_sales') || 0) +
    (getNum('pm_starting_cash') || 0) - (getNum('pm_ending_cash') || 0) - (getNum('pm_expenses') || 0)
  );
  setNum('pm_sales_total', sales);

  const mish = fix2((getNum('pm_starting_cash') || 0) - shift + (getNum('pm_expenses') || 0));
  setNum('pm_mishandled_cash', mish);

  setText('pmCheck', (mish >= 0 ? 'PM OK' : 'PM: mishandled negative? review'), 'pill ' + (mish >= 0 ? 'ok' : 'warn'));
}

function recalcAll() {
  recalcAM();
  recalcPM();
}

// Recompute on any numeric/date/time input change
qsa('input').forEach(el => {
  if (['number', 'date', 'time'].includes(el.type)) {
    el.addEventListener('input', recalcAll);
  }
});
$('recalcBtn').addEventListener('click', recalcAll);

/* ========================== QUANTITY STEPPERS ========================== */
qsa('[data-q]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.for;
    const v = getNum(id) ?? 0;
    const d = Number(btn.dataset.q);
    setNum(id, v + d);
    recalcAll();
  });
});

/* ========================== VALIDATION ========================== */
function validateBeforeSubmit() {
  const missing = [];
  if (!$('store').value.trim()) missing.push('Store');
  if (!$('date').value) missing.push('Date');
  if (!$('time').value) missing.push('Time');

  if (missing.length) {
    alert('Please fill: ' + missing.join(', '));
    return false;
  }
  return true;
}

/* ========================== PAYLOAD & SUBMIT ========================== */
$('submitBtn').addEventListener('click', async () => {
  if (!validateBeforeSubmit()) return;

  const payload = {
    // Identity
    source: 'Web App',
    submission_id: (crypto.randomUUID ? crypto.randomUUID() : 'web-' + Date.now()),
    store_location: $('store').value.trim(),
    todays_date: $('date').value,
    time_of_entry: $('time').value,

    // --- AM incoming
    am_total_collected: getNum('am_total_collected'),
    am_tips: getNum('am_tips'),
    am_gift_card_sales: getNum('am_gift_card_sales'),
    am_card_collected: getNum('am_card_collected'),
    am_cash_sales: getNum('am_cash_sales'),
    am_starting_cash: getNum('am_starting_cash'),
    am_ending_cash: getNum('am_ending_cash'),
    am_paid_in_out: getNum('am_paid_in_out'),
    am_expenses: getNum('am_expenses'),

    am_dep_coins: getNum('am_dep_coins'),
    am_dep_1s: getNum('am_dep_1s'),
    am_dep_5s: getNum('am_dep_5s'),
    am_dep_10s: getNum('am_dep_10s'),
    am_dep_20s: getNum('am_dep_20s'),
    am_dep_50s: getNum('am_dep_50s'),
    am_dep_100s: getNum('am_dep_100s'),

    // AM computed (client copies — server recomputes anyway)
    am_cash_deposit_total: getNum('am_cash_deposit_total'),
    am_shift_total: getNum('am_shift_total'),
    am_sales_total: getNum('am_sales_total'),
    am_mishandled_cash: getNum('am_mishandled_cash'),

    // --- PM incoming
    pm_total_collected: getNum('pm_total_collected'),
    pm_gift_card_sales: getNum('pm_gift_card_sales'),
    pm_card_collected: getNum('pm_card_collected'),
    pm_cash_sales: getNum('pm_cash_sales'),
    pm_tips: getNum('pm_tips'),
    pm_starting_cash: getNum('pm_starting_cash'),
    pm_ending_cash: getNum('pm_ending_cash'),
    pm_paid_in_out: getNum('pm_paid_in_out'),
    pm_expenses: getNum('pm_expenses'),

    pm_dep_coins: getNum('pm_dep_coins'),
    pm_dep_1s: getNum('pm_dep_1s'),
    pm_dep_5s: getNum('pm_dep_5s'),
    pm_dep_10s: getNum('pm_dep_10s'),
    pm_dep_20s: getNum('pm_dep_20s'),
    pm_dep_50s: getNum('pm_dep_50s'),
    pm_dep_100s: getNum('pm_dep_100s'),

    // PM computed (client copies — server recomputes anyway)
    pm_cash_deposit_total: getNum('pm_cash_deposit_total'),
    pm_shift_total: getNum('pm_shift_total'),
    pm_sales_total: getNum('pm_sales_total'),
    pm_mishandled_cash: getNum('pm_mishandled_cash')
  };

  setText('saveHint', 'Saving…', 'muted');
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const js = await r.json();
    setText('saveHint', js.ok ? 'Saved ✓' : ('Error: ' + (js.error || 'unknown')));
    if (js.ok) {
      // Optional: mild reset keeping identity/date/time
      // resetFormButKeepIdentity();
    }
  } catch (err) {
    setText('saveHint', 'Network error', 'muted');
  }
});

/* Optional reset if you want it after successful save */
function resetFormButKeepIdentity() {
  const keep = new Set(['firstName','lastName','store','date','time']);
  qsa('input').forEach(el => {
    if (!keep.has(el.id)) {
      if (el.type === 'number') el.value = '';
    }
  });
  recalcAll();
}

