/* ========================== CONFIG ========================== */
const ENDPOINT = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'; // <-- paste your Web App URL
const MATH_EPS = 0.02; // tolerance for sanity checks (~2 cents)

/* ========================== HELPERS ========================== */
const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const money = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? +n : null; };
const fix2 = n => Number(Number(n || 0).toFixed(2));
const setNum = (id, v) => { const el = $(id); if (!el) return; el.readOnly = READONLY.has(id); el.value = (v == null ? '' : (+v).toFixed(2)); };
const getNum = id => money($(id)?.value);
const setText = (id, text, cls) => { const el=$(id); if(!el) return; if(cls) el.className=cls; el.textContent=text; };

/* ========================== READ-ONLY FIELDS ========================== */
const READONLY = new Set([
  'am_cash_deposit_total','am_shift_total','am_sales_total','am_mishandled_cash',
  'pm_cash_deposit_total','pm_shift_total','pm_sales_total','pm_mishandled_cash'
]);

/* ========================== RECEIPT MIRROR (Sales) ========================== */
const RECEIPT_FIELDS = [
  // SALES
  { label: 'Gross Sales', key: 'gross_sales' },
  { label: 'Items', key: 'items' },
  { label: 'Service Charges', key: 'service_charges' },
  { label: 'Returns', key: 'returns' },
  { label: 'Discounts & Comps', key: 'discounts_comps' },
  { label: 'Net Sales', key: 'net_sales' },
  { label: 'Tax', key: 'tax' },
  { label: 'Tips', key: 'tips' },
  { label: 'Gift Cards Sales', key: 'gift_cards_sales' },
  { label: 'Refunds by Amount', key: 'refunds_by_amount' },
  { label: 'Total', key: 'total_sales' },
  // PAYMENTS
  { label: 'Total Collected', key: 'total_collected' },
  { label: 'Cash', key: 'cash' },
  { label: 'Card', key: 'card' },
  { label: 'Gift Card', key: 'gift_card' },
  { label: 'Fees', key: 'fees' },
  { label: 'Net Total', key: 'net_total' },
  // DISCOUNTS (examples)
  { label: 'Free Drink Discount', key: 'free_drink_discount' },
  { label: 'Paper Money Card Discount', key: 'paper_money_card_discount' },
  { label: 'Pay the Difference Discount', key: 'pay_difference_discount' },
  // CATEGORIES (examples)
  { label: 'Uncategorized', key: 'cat_uncategorized' },
  { label: 'Cold', key: 'cat_cold' },
  { label: 'Employee Prices', key: 'cat_employee_prices' },
  { label: 'Food', key: 'cat_food' },
  { label: 'Hot Drinks', key: 'cat_hot_drinks' }
];

function renderReceiptMirror(values = {}) {
  const host = $('receiptMirror'); if (!host) return;
  host.innerHTML = '';
  RECEIPT_FIELDS.forEach(({ label, key }) => {
    const id = 'rm_' + key;
    const val = values[key];
    host.insertAdjacentHTML('beforeend', `
      <div>
        <label>${label}</label>
        <div class="field"><input id="${id}" data-rm-key="${key}" type="number" step="0.01" inputmode="decimal" value="${val!=null?(+val).toFixed(2):''}" placeholder="0.00"></div>
      </div>
    `);
  });
  host.querySelectorAll('[data-rm-key]').forEach(input=>{
    input.addEventListener('input',()=>{
      const k = input.dataset.rmKey;
      const v = money(input.value);
      if(k==='total_collected') setNum('am_total_collected', v);
      if(k==='tips') setNum('am_tips', v);
      if(k==='gift_cards_sales') setNum('am_gift_card_sales', v);
      if(k==='card') setNum('am_card_collected', v);
      if(k==='cash') setNum('am_cash_sales', v);
      recalcAll();
    });
  });
}

/* ========================== DRAWER MIRROR ========================== */
const DRAWER_FIELDS = [
  { label: 'Starting Cash', key: 'starting_cash' },
  { label: 'Cash Sales', key: 'cash_sales' },
  { label: 'Cash Refunds', key: 'cash_refunds' },
  { label: 'Paid In/Out', key: 'paid_in_out' },
  { label: 'Expected in Drawer', key: 'expected_in_drawer' },
  { label: 'Actual in Drawer', key: 'actual_in_drawer' },
  { label: 'Difference', key: 'difference' },
  { label: 'Fees', key: 'fees' }
];

function renderDrawerMirror(values = {}) {
  const host = $('drawerMirror'); if (!host) return;
  host.innerHTML = '';
  DRAWER_FIELDS.forEach(({ label, key }) => {
    const id = 'dm_' + key;
    const val = values[key];
    host.insertAdjacentHTML('beforeend', `
      <div>
        <label>${label}</label>
        <div class="field"><input id="${id}" data-dm-key="${key}" type="number" step="0.01" inputmode="decimal" value="${val!=null?(+val).toFixed(2):''}" placeholder="0.00"></div>
      </div>
    `);
  });
  host.querySelectorAll('[data-dm-key]').forEach(input=>{
    input.addEventListener('input',()=>{
      const k = input.dataset.dmKey; const v = money(input.value);
      if(k==='starting_cash') setNum('am_starting_cash', v);
      if(k==='actual_in_drawer') setNum('am_ending_cash', v);
      if(k==='paid_in_out') setNum('am_paid_in_out', v);
      recalcAll();
    });
  });
}

/* ========================== MEMORY & DEFAULTS ========================== */
(function(){
  ['firstName','lastName','store'].forEach(k=>{
    $(k).value = localStorage.getItem('dd_'+k) || '';
    $(k).addEventListener('input',()=>localStorage.setItem('dd_'+k,$(k).value.trim()));
  });
  const now = new Date();
  $('date').value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('time').value = now.toTimeString().slice(0,5);
})();

/* ========================== AM/PM TOGGLE ========================== */
function isPM(t){ const [h,m]=(t||'').split(':').map(Number); return h>15 || (h===15 && (m||0)>=0); }
function toggleAMPM(){ const pm=isPM($('time').value); $('amSection').style.display=pm?'none':''; $('pmSection').style.display=pm?'':'none'; }
$('time').addEventListener('input', toggleAMPM); toggleAMPM();

/* ========================== OCR CORE ========================== */
async function ocr(file, statusEl){
  setText(statusEl.id,'OCR…','pill');
  const url = URL.createObjectURL(file);
  const { data } = await Tesseract.recognize(url, 'eng', { logger:m=>setText(statusEl.id, m.status||'OCR…','pill') });
  URL.revokeObjectURL(url);
  const lines=(data.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  setText(statusEl.id,'Scanned ✓','pill ok');
  return lines;
}
function parseMoneyFromLines(lines, keys){
  const re = /(?<!\d)(-?\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g;
  const toN = s => { const n = Number(String(s||'').replace(/[^\d.-]/g,'')); return Number.isFinite(n)?+n:null; };
  const has = (s,arr)=>arr.some(w=>s.toLowerCase().includes(w));
  for(let i=0;i<lines.length;i++){
    if(has(lines[i], keys)){
      const same = [...lines[i].matchAll(re)].map(m=>toN(m[0])).filter(v=>v!=null);
      if(same.length) return same.at(-1);
      const next = lines[i+1] ? [...lines[i+1].matchAll(re)].map(m=>toN(m[0])).filter(v=>v!=null) : [];
      if(next.length) return next.at(-1);
    }
  }
  return null;
}

/* ========================== SALES PARSER (robust Tips/Card ×) ========================== */
function parseSales(lines){
  const get = arr => parseMoneyFromLines(lines, arr);
  const allNums = lines.flatMap(L=>[...L.matchAll(/(?<!\d)(\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g)].map(m=>money(m[0])||0));
  const largest = allNums.length? Math.max(...allNums) : null;

  let tips = get(['tips','gratuity','gratuities']);
  let card = get(['card','credit card charges']);
  if(card==null){
    const cardLine = lines.find(s=>/card\s*[×x]/i.test(s));
    if(cardLine){
      const m = cardLine.match(/(?<!\d)(\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?)(?!\d)/g);
      if(m && m.length) card = money(m.at(-1));
    }
  }

  return {
    // SALES
    gross_sales:        get(['gross sales']),
    items:              get(['items']),
    service_charges:    get(['service charges']),
    returns:            get(['returns']),
    discounts_comps:    get(['discounts & comps','discounts and comps','discounts']),
    net_sales:          get(['net sales']),
    tax:                get(['tax','sales tax']),
    tips:               tips,
    gift_cards_sales:   get(['gift cards sales','gift card sales','gift card']),
    refunds_by_amount:  get(['refunds by amount']),
    total_sales:        get(['total']) ?? largest,

    // PAYMENTS
    total_collected:    get(['total collected']),
    cash:               get(['cash ']), // avoid "cash sales"
    card:               card,
    gift_card:          get(['gift card ']),
    fees:               get(['fees']),
    net_total:          get(['net total']),

    // DISCOUNTS
    free_drink_discount:        get(['free drink discount']),
    paper_money_card_discount:  get(['paper money card discount']),
    pay_difference_discount:    get(['pay the difference discount']),

    // CATEGORIES
    cat_uncategorized:  get(['uncategorized']),
    cat_cold:           get(['cold']),
    cat_employee_prices:get(['employee prices']),
    cat_food:           get(['food']),
    cat_hot_drinks:     get(['hot drinks'])
  };
}

/* ========================== DRAWER PARSER ========================== */
function parseDrawer(lines){
  return {
    starting_cash:       parseMoneyFromLines(lines, ['starting cash']),
    cash_sales:          parseMoneyFromLines(lines, ['cash sales']),
    cash_refunds:        parseMoneyFromLines(lines, ['cash refunds']),
    paid_in_out:         parseMoneyFromLines(lines, ['paid in/out','paid in','paid out']),
    expected_in_drawer:  parseMoneyFromLines(lines, ['expected in drawer']),
    actual_in_drawer:    parseMoneyFromLines(lines, ['actual in drawer','ending cash','till total']),
    difference:          parseMoneyFromLines(lines, ['difference']),
    fees:                parseMoneyFromLines(lines, ['fees'])
  };
}

/* ========================== SALES OCR BUTTON (AM / main) ========================== */
$('scanSales').addEventListener('click', async ()=>{
  const f = $('fileSales').files?.[0]; if(!f) return alert('Pick a Sales Report photo');
  const lines = await ocr(f, $('statusSales'));
  const p = parseSales(lines);

  // Quick visible fields that drive math
  setNum('am_total_collected', p.total_collected);
  setNum('am_tips', p.tips);
  setNum('am_gift_card_sales', p.gift_cards_sales);
  setNum('am_card_collected', p.card);
  setNum('am_cash_sales', p.cash);

  // Mirror (hidden by default in <details>)
  const mirrorVals = {}; RECEIPT_FIELDS.forEach(({key})=> mirrorVals[key] = p[key] ?? null);
  renderReceiptMirror(mirrorVals);

  $('salesDetails')?.open &&= false;
  setText('salesChip','scanned','badge');
  recalcAll();
});

/* ========================== PM DIFF OCR BUTTONS ========================== */
let pmScanAM = null;
let pmScanAllDay = null;

$('scanPmAM')?.addEventListener('click', async ()=>{
  const f = $('filePmAM').files?.[0]; if(!f) return alert('Pick the AM Sales Report photo');
  const lines = await ocr(f, $('statusPmAM'));
  pmScanAM = parseSales(lines);
  maybeComputePMFromDiff();
});

$('scanPmAllDay')?.addEventListener('click', async ()=>{
  const f = $('filePmAllDay').files?.[0]; if(!f) return alert('Pick the All-Day Sales Report photo');
  const lines = await ocr(f, $('statusPmAllDay'));
  pmScanAllDay = parseSales(lines);
  maybeComputePMFromDiff();
});

function diffPos(a, b){ // safe positive difference, 0 if missing
  if(a==null || b==null) return null;
  return fix2(a - b);
}
function maybeComputePMFromDiff(){
  if(!pmScanAM || !pmScanAllDay) return;
  // Compute PM = All-Day − AM for the key five
  const d = {
    total_collected: diffPos(pmScanAllDay.total_collected, pmScanAM.total_collected),
    tips:            diffPos(pmScanAllDay.tips,            pmScanAM.tips),
    gift_cards_sales:diffPos(pmScanAllDay.gift_cards_sales,pmScanAM.gift_cards_sales),
    card:            diffPos(pmScanAllDay.card,            pmScanAM.card),
    cash:            diffPos(pmScanAllDay.cash,            pmScanAM.cash)
  };
  if(d.total_collected!=null) setNum('pm_total_collected', d.total_collected);
  if(d.tips!=null)            setNum('pm_tips', d.tips);
  if(d.gift_cards_sales!=null)setNum('pm_gift_card_sales', d.gift_cards_sales);
  if(d.card!=null)            setNum('pm_card_collected', d.card);
  if(d.cash!=null)            setNum('pm_cash_sales', d.cash);
  recalcAll();
}

/* ========================== DRAWER OCR BUTTON ========================== */
$('scanDrawer').addEventListener('click', async ()=>{
  const f = $('fileDrawer').files?.[0]; if(!f) return alert('Pick a Drawer Report photo');
  const lines = await ocr(f, $('statusDrawer'));
  const d = parseDrawer(lines);
  // Fill manual-facing fields
  setNum('am_starting_cash', d.starting_cash);
  if(d.actual_in_drawer!=null) setNum('am_ending_cash', d.actual_in_drawer);
  if(d.paid_in_out!=null) setNum('am_paid_in_out', d.paid_in_out);
  // Mirror (hidden unless opened)
  renderDrawerMirror(d);
  $('drawerDetails')?.open &&= false;
  setText('drawerChip','scanned','badge');
  recalcAll();
});

/* ========================== LIVE COMPUTATIONS ========================== */
function recalcAM(){
  const dep = fix2((getNum('am_dep_coins')||0)+(getNum('am_dep_1s')||0)+(getNum('am_dep_5s')||0)+(getNum('am_dep_10s')||0)+(getNum('am_dep_20s')||0)+(getNum('am_dep_50s')||0)+(getNum('am_dep_100s')||0));
  setNum('am_cash_deposit_total', dep);
  const shift = fix2((getNum('am_card_collected')||0) + dep);
  setNum('am_shift_total', shift);
  const sales = fix2((getNum('am_total_collected')||0) - (getNum('am_tips')||0) - (getNum('am_gift_card_sales')||0) + (getNum('am_starting_cash')||0) - (getNum('am_ending_cash')||0) - (getNum('am_expenses')||0));
  setNum('am_sales_total', sales);
  const mish = fix2((getNum('am_starting_cash')||0) - shift + (getNum('am_expenses')||0));
  setNum('am_mishandled_cash', mish);
  setText('amCheck', 'AM calculated', 'pill ok');
}
function recalcPM(){
  const dep = fix2((getNum('pm_dep_coins')||0)+(getNum('pm_dep_1s')||0)+(getNum('pm_dep_5s')||0)+(getNum('pm_dep_10s')||0)+(getNum('pm_dep_20s')||0)+(getNum('pm_dep_50s')||0)+(getNum('pm_dep_100s')||0));
  setNum('pm_cash_deposit_total', dep);
  const shift = fix2((getNum('pm_card_collected')||0) + dep);
  setNum('pm_shift_total', shift);
  const sales = fix2((getNum('pm_total_collected')||0) - (getNum('pm_tips')||0) - (getNum('pm_gift_card_sales')||0) + (getNum('pm_starting_cash')||0) - (getNum('pm_ending_cash')||0) - (getNum('pm_expenses')||0));
  setNum('pm_sales_total', sales);
  const mish = fix2((getNum('pm_starting_cash')||0) - shift + (getNum('pm_expenses')||0));
  setNum('pm_mishandled_cash', mish);
  setText('pmCheck', 'PM calculated', 'pill ok');
}
function recalcAll(){ recalcAM(); recalcPM(); gateSubmit(); }
qsa('input').forEach(el=>{ if(['number','date','time'].includes(el.type)){ el.addEventListener('input', recalcAll); }});
$('recalcBtn').addEventListener('click', recalcAll);

/* ========================== SUBMIT GATE (relaxed) ========================== */
// Enable submit as long as required fields exist; mishandled cash may be non-zero.
function gateSubmit(){
  const hasBasics = $('store').value.trim() && $('date').value && $('time').value;
  $('submitBtn').disabled = !hasBasics;
  setText('saveHint', $('submitBtn').disabled ? 'Fill store/date/time' : 'Ready to submit ✓', $('submitBtn').disabled ? 'muted' : '');
}

/* ========================== VALIDATION (light) ========================== */
function validateBeforeSubmit(){
  const missing = [];
  if(!$('store').value.trim()) missing.push('Store');
  if(!$('date').value) missing.push('Date');
  if(!$('time').value) missing.push('Time');
  if(missing.length){ alert('Please fill: '+missing.join(', ')); return false; }
  return true;
}

/* ========================== SUBMIT ========================== */
$('submitBtn').addEventListener('click', async ()=>{
  if(!validateBeforeSubmit()) return;

  const payload = {
    source:'Web App',
    submission_id:(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()),
    store_location:$('store').value.trim(),
    todays_date:$('date').value,
    time_of_entry:$('time').value,

    // AM visible inputs
    am_total_collected:getNum('am_total_collected'),
    am_tips:getNum('am_tips'),
    am_gift_card_sales:getNum('am_gift_card_sales'),
    am_card_collected:getNum('am_card_collected'),
    am_cash_sales:getNum('am_cash_sales'),
    am_starting_cash:getNum('am_starting_cash'),
    am_ending_cash:getNum('am_ending_cash'),
    am_paid_in_out:getNum('am_paid_in_out'),
    am_expenses:getNum('am_expenses'),
    // deposit
    am_dep_coins:getNum('am_dep_coins'),
    am_dep_1s:getNum('am_dep_1s'),
    am_dep_5s:getNum('am_dep_5s'),
    am_dep_10s:getNum('am_dep_10s'),
    am_dep_20s:getNum('am_dep_20s'),
    am_dep_50s:getNum('am_dep_50s'),
    am_dep_100s:getNum('am_dep_100s'),
    // computed
    am_cash_deposit_total:getNum('am_cash_deposit_total'),
    am_shift_total:getNum('am_shift_total'),
    am_sales_total:getNum('am_sales_total'),
    am_mishandled_cash:getNum('am_mishandled_cash'),

    // PM (after diff or manual)
    pm_total_collected:getNum('pm_total_collected'),
    pm_gift_card_sales:getNum('pm_gift_card_sales'),
    pm_card_collected:getNum('pm_card_collected'),
    pm_cash_sales:getNum('pm_cash_sales'),
    pm_tips:getNum('pm_tips'),
    pm_starting_cash:getNum('pm_starting_cash'),
    pm_ending_cash:getNum('pm_ending_cash'),
    pm_paid_in_out:getNum('pm_paid_in_out'),
    pm_expenses:getNum('pm_expenses'),
    pm_dep_coins:getNum('pm_dep_coins'),
    pm_dep_1s:getNum('pm_dep_1s'),
    pm_dep_5s:getNum('pm_dep_5s'),
    pm_dep_10s:getNum('pm_dep_10s'),
    pm_dep_20s:getNum('pm_dep_20s'),
    pm_dep_50s:getNum('pm_dep_50s'),
    pm_dep_100s:getNum('pm_dep_100s'),
    pm_cash_deposit_total:getNum('pm_cash_deposit_total'),
    pm_shift_total:getNum('pm_shift_total'),
    pm_sales_total:getNum('pm_sales_total'),
    pm_mishandled_cash:getNum('pm_mishandled_cash')
  };

  setText('saveHint','Saving…','muted');
  try{
    const r = await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const js = await r.json();
    setText('saveHint', js.ok ? 'Saved ✓' : ('Error: '+(js.error||'unknown')));
  }catch(err){
    setText('saveHint','Network error','muted');
  }
});
