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

/* ========================== RECEIPT MIRROR ========================== */
/* label: what baristas see (exact like the receipt)
 * key:   internal key we fill by OCR + allow manual correction
 * Order matches your Sales Report.
 */
const RECEIPT_FIELDS = [
  // SALES
  { label: 'Gross Sales',               key: 'gross_sales' },
  { label: 'Items',                     key: 'items' },
  { label: 'Service Charges',           key: 'service_charges' },
  { label: 'Returns',                   key: 'returns' },
  { label: 'Discounts & Comps',         key: 'discounts_comps' },
  { label: 'Net Sales',                 key: 'net_sales' },
  { label: 'Tax',                       key: 'tax' },
  { label: 'Tips',                      key: 'tips' },
  { label: 'Gift Cards Sales',          key: 'gift_cards_sales' },
  { label: 'Refunds by Amount',         key: 'refunds_by_amount' },
  { label: 'Total',                     key: 'total_sales' },

  // PAYMENTS
  { label: 'Total Collected',           key: 'total_collected' },
  { label: 'Cash',                      key: 'cash' },
  { label: 'Card',                      key: 'card' },            // <- as requested
  { label: 'Gift Card',                 key: 'gift_card' },
  { label: 'Fees',                      key: 'fees' },
  { label: 'Net Total',                 key: 'net_total' },

  // DISCOUNTS APPLIED (examples present on your sample)
  { label: 'Free Drink Discount',       key: 'free_drink_discount' },
  { label: 'Paper Money Card Discount', key: 'paper_money_card_discount' },
  { label: 'Pay the Difference Discount', key: 'pay_difference_discount' },

  // CATEGORY SALES (examples present on your sample)
  { label: 'Uncategorized',             key: 'cat_uncategorized' },
  { label: 'Cold',                      key: 'cat_cold' },
  { label: 'Employee Prices',           key: 'cat_employee_prices' },
  { label: 'Food',                      key: 'cat_food' },
  { label: 'Hot Drinks',                key: 'cat_hot_drinks' }
];

function renderReceiptMirror(values = {}) {
  const card = $('receiptMirrorCard');
  const host = $('receiptMirror');
  if (!card || !host) return; // safe if block not added to HTML yet

  host.innerHTML = '';
  RECEIPT_FIELDS.forEach(({ label, key }) => {
    const id = 'rm_' + key;
    const val = values[key];
    const html = `
      <div>
        <label>${label}</label>
        <div class="field">
          <input id="${id}" data-rm-key="${key}" type="number" step="0.01" inputmode="decimal" placeholder="0.00" value="${val != null ? (+val).toFixed(2) : ''}">
        </div>
      </div>`;
    host.insertAdjacentHTML('beforeend', html);
  });

  // keep AM calc fields in sync when they edit receipt lines
  host.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', () => {
      const k = el.dataset.rmKey;
      const v = money(el.value);
      mirrorToAM(k, v);
      recalcAll();
    });
  });

  card.style.display = '';
}

function mirrorToAM(k, v) {
  // map a few key receipt values into your AM fields for the rest of the math/UI
  const map = {
    total_collected: 'am_total_collected',
    tips:            'am_tips',
    gift_cards_sales:'am_gift_card_sales',
    card:            'am_card_collected',
    cash:            'am_cash_sales',
    tax:             null, // add if you decide to track separately
    total_sales:     null
  };
  const id = map[k];
  if (id) setNum(id, v);
}

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

/* ========================== SALES REPORT PARSER (fills all lines) ========================== */
function parseSales(lines) {
  const get = k => parseMoneyFromLines(lines, k);
  const allNums = lines.flatMap(L =>
    [...L.matchAll(/(?<!\d)(\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g)]
      .map(m => money(m[0]) || 0)
  );
  const largest = allNums.length ? Math.max(...allNums) : null;

  return {
    // SALES
    gross_sales:        get(['gross sales']),
    items:              get(['items']),
    service_charges:    get(['service charges']),
    returns:            get(['returns']),
    discounts_comps:    get(['discounts & comps','discounts and comps','discounts']),
    net_sales:          get(['net sales']),
    tax:                get(['tax','sales tax']),
    tips:               get(['tips','gratuity','gratuities']),
    gift_cards_sales:   get(['gift cards sales','gift card sales','gift card']),
    refunds_by_amount:  get(['refunds by amount']),
    total_sales:        get(['total']) ?? largest,

    // PAYMENTS
    total_collected:    get(['total collected']),
    cash:               get(['cash ']), // trailing space to avoid "cash sales" mismatch
    card:               get(['card','credit card charges']),
    gift_card:          get(['gift card ']),
    fees:               get(['fees']),
    net_total:          get(['net total']),

    // DISCOUNTS APPLIED
    free_drink_discount:        get(['free drink discount']),
    paper_money_card_discount:  get(['paper money card discount']),
    pay_difference_discount:    get(['pay the difference discount']),

    // CATEGORY SALES
    cat_uncategorized:  get(['uncategorized']),
    cat_cold:           get(['cold']),
    cat_employee_prices:get(['employee prices']),
    cat_food:           get(['food']),
    cat_hot_drinks:     get(['hot drinks'])
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

  // sync key AM fields so your existing math works
  setNum('am_total_collected',   p.total_collected);
  setNum('am_tips',              p.tips);
  setNum('am_gift_card_sales',   p.gift_cards_sales);
  setNum('am_card_collected',    p.card);
  setNum('am_cash_sales',        p.cash);

  // render the Receipt Mirror in exact order/labels
  const mirrorVals = {};
  RECEIPT_FIELDS.forEach(({ key }) => { mirrorVals[key] = p[key] ?? null; });
  renderReceiptMirror(mirrorVals);

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
  setNum('am_ending_cash',   p.ending_cash);
  setNum('am_paid_in_out',   p.paid_in_out);
  setNum('am_expenses',      p.expenses);
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

/* ========================== QUANTITY STEPPERS (+/−) ========================== */
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

/* ========================== MERGE RECEIPT MIRROR → PAYLOAD ========================== */
function collectReceiptMirrorIntoPayload(payload){
  const host = $('receiptMirror');
  if (!host) return;

  // read all mirror inputs
  const vals = {};
  host.querySelectorAll('[data-rm-key]').forEach(input=>{
    vals[input.dataset.rmKey] = money(input.value);
  });

  // Map the important ones into the AM keys your sheet expects.
  payload.am_total_collected  = vals.total_collected ?? payload.am_total_collected;
  payload.am_tips             = vals.tips ?? payload.am_tips;
  payload.am_gift_card_sales  = vals.gift_cards_sales ?? payload.am_gift_card_sales;
  payload.am_card_collected   = vals.card ?? payload.am_card_collected;
  payload.am_cash_sales       = vals.cash ?? payload.am_cash_sales;

  // Optional: include extras if you later add corresponding headers/server map
  payload.am_fees            = vals.fees ?? null;            // if you add an "AM Fees" column
  payload.am_net_total       = vals.net_total ?? null;       // if you add an "AM Net Total" column
  payload.am_discounts_total = vals.discounts_comps ?? null; // if you add an "AM Discounts Total" column
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

  // Merge Receipt Mirror values (so visible “Card”, “Total Collected”, etc. drive the actual payload)
  collectReceiptMirrorIntoPayload(payload);

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
      // Optional: reset the numeric fields but keep identity/date/time
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
