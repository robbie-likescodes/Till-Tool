/* ====================== CONFIG ====================== */
// Apps Script endpoint
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbz8fXRp4uuYvEV4qWCtW3XxN5wiEIjtacv7BVhFIMEgRLztTOUfpVlGO-3_F2as5RmXHg/exec';
const MATH_EPS = 0.02;

/* ====================== DOM HELPERS ====================== */
const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const money = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g,'')); return Number.isFinite(n)?+n:null; };
const fix2 = n => Number(Number(n||0).toFixed(2));
const setNum = (id, v) => { const el=$(id); if(!el) return; el.value = v==null? '' : (+v).toFixed(2); };
const getNum = id => money($(id)?.value);
const setText = (id, txt, cls) => { const el=$(id); if(!el) return; if(cls!=null) el.className=cls; el.textContent=txt; };

/* ====================== SHIFT AUTO / TOGGLE ====================== */
function isPM(t){ const [h,m]=(t||'').split(':').map(Number); return h>15||(h===15&&(m||0)>=0); }
function applyShiftUI(){
  const pm = $('shiftPM').checked;
  $('amMode').style.display = pm? 'none' : '';
  $('pmMode').style.display = pm? '' : 'none';
  gateSubmit();
}

(function initHeader(){
  const now = new Date();
  $('date').value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('time').value = now.toTimeString().slice(0,5);

  // Remember identity on device
  ['firstName','lastName','store'].forEach(k=>{
    const el=$(k); const saved=localStorage.getItem('dd_'+k);
    if(saved) el.value = saved;
    el.addEventListener('input',()=>localStorage.setItem('dd_'+k, el.value));
  });

  // Auto-pick shift by time, allow override
  const pm = isPM($('time').value);
  $('shiftPM').checked = pm; $('shiftAM').checked = !pm;

  $('time').addEventListener('input', ()=>{
    const pmNow = isPM($('time').value);
    if(pmNow){ $('shiftPM').checked = true; } else { $('shiftAM').checked = true; }
    applyShiftUI();
  });
  $('shiftAM').addEventListener('change', applyShiftUI);
  $('shiftPM').addEventListener('change', applyShiftUI);
  applyShiftUI();
})();

/* ====================== RECEIPT FIELD LISTS (for mirrors) ====================== */
const RECEIPT_SALES = [
  { label:'Gross Sales', key:'gross_sales' },
  { label:'Items', key:'items' },
  { label:'Service Charges', key:'service_charges' },
  { label:'Returns', key:'returns' },
  { label:'Discounts & Comps', key:'discounts_comps' },
  { label:'Net Sales', key:'net_sales' },
  { label:'Tax', key:'tax' },
  { label:'Tips', key:'tips' },
  { label:'Gift Cards Sales', key:'gift_cards_sales' },
  { label:'Refunds by Amount', key:'refunds_by_amount' },
  { label:'Total', key:'total_sales' },
  // Payments
  { label:'Total Collected', key:'total_collected' },
  { label:'Cash', key:'cash' },
  { label:'Card', key:'card' },
  { label:'Gift Card', key:'gift_card' },
  { label:'Fees', key:'fees' },
  { label:'Net Total', key:'net_total' },
  // Discounts (optional)
  { label:'Free Drink Discount', key:'free_drink_discount' },
  { label:'Paper Money Card Discount', key:'paper_money_card_discount' },
  { label:'Pay the Difference Discount', key:'pay_difference_discount' },
  // Categories (optional)
  { label:'Uncategorized', key:'cat_uncategorized' },
  { label:'Cold', key:'cat_cold' },
  { label:'Employee Prices', key:'cat_employee_prices' },
  { label:'Food', key:'cat_food' },
  { label:'Hot Drinks', key:'cat_hot_drinks' }
];

const RECEIPT_DRAWER = [
  { label:'Starting Cash', key:'starting_cash' },
  { label:'Cash Sales', key:'cash_sales' },
  { label:'Cash Refunds', key:'cash_refunds' },
  { label:'Paid In/Out', key:'paid_in_out' },
  { label:'Expected in Drawer', key:'expected_in_drawer' }
];

/* ====================== MIRRORS ====================== */
function renderMirror(hostId, spec, values){
  const host = $(hostId); if(!host) return;
  host.innerHTML = '';
  spec.forEach(({label, key})=>{
    const id = `${hostId}_${key}`;
    const v = values?.[key];
    host.insertAdjacentHTML('beforeend', `
      <div>
        <label>${label}</label>
        <div class="field"><input id="${id}" data-key="${key}" type="number" step="0.01" inputmode="decimal" value="${v!=null?(+v).toFixed(2):''}" placeholder="0.00"></div>
      </div>
    `);
  });
}

/* ====================== SIMPLE IMAGE RESIZE (fast & stable) ====================== */
async function fileToResizedDataURL(file, maxSide = 1600) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const url = URL.createObjectURL(file);
  await new Promise(r => { img.onload = r; img.src = url; });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });

  // Light contrast lift for faint thermal text
  ctx.filter = 'contrast(115%) brightness(105%)';
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  URL.revokeObjectURL(url);
  return dataUrl;
}

/* ====================== OCR (TEXT ONLY) ====================== */
async function ocrText(file, statusEl){
  setText(statusEl.id,'OCR…','pill');
  const dataUrl = await fileToResizedDataURL(file);
  const { data } = await Tesseract.recognize(dataUrl, 'eng', {
    logger: m => setText(statusEl.id, (m.status || 'OCR…') + (m.progress?` ${Math.round(m.progress*100)}%`:''), 'pill'),
    tessedit_pageseg_mode: 4,   // single column works well on these receipts
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  });
  setText(statusEl.id,'Scanned ✓','pill ok');
  return data.text || '';
}

/* ====================== TEXT → LINES + PARSERS ====================== */
const moneyRegex = /\(?-?\$?\s*\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?\)?/g;
const normMoney = s => {
  if(!s) return null;
  const raw = s.trim();
  const parenNeg = raw.startsWith('(') && raw.endsWith(')');
  const n = Number(raw.replace(/[^\d.-]/g,''));
  if (!Number.isFinite(n)) return null;
  return parenNeg ? -Math.abs(n) : n;
};
const hasAny = (s, arr) => arr.some(w => s.toLowerCase().includes(w));

function textToLines(text){
  return text.split(/\r?\n/).map(s=>s.replace(/\s{2,}/g,' ').trim()).filter(Boolean);
}

// get the last money on the same line or next line
function amountNear(lines, idx){
  const same = [...(lines[idx].matchAll(moneyRegex)||[])].map(m=>normMoney(m[0])).filter(v=>v!=null);
  if(same.length) return same.at(-1);
  if(idx+1 < lines.length){
    const next = [...(lines[idx+1].matchAll(moneyRegex)||[])].map(m=>normMoney(m[0])).filter(v=>v!=null);
    if(next.length) return next.at(-1);
  }
  return null;
}

function sliceBetween(lines, startKey, endKey){
  const s = lines.findIndex(l => l.toLowerCase().includes(startKey));
  const e = lines.findIndex(l => l.toLowerCase().includes(endKey));
  const from = s>=0 ? s : 0;
  const to = (e>from) ? e : lines.length;
  return lines.slice(from, to);
}

function parseSalesText(text){
  const lines = textToLines(text);

  // Anchors/keywords
  const K = {
    gross: ['gross sales'],
    items: ['items'],
    svc: ['service charges'],
    returns: ['returns'],
    disc: ['discounts & comps','discounts and comps','discounts'],
    net: ['net sales'],
    tax: ['tax'],
    tips: ['tips','gratuity'],
    giftSales: ['gift cards sales','gift card sales'],
    refunds: ['refunds by amount'],
    totalSales: ['total'], // in SALES section; we’ll avoid Payments by sectioning
    totalCollected: ['total collected','grand total'],
    cash: ['cash '], // trailing space so it doesn’t match "cash sales"
    card: ['card','credit card charges'],
    giftCard: ['gift card '],
    fees: ['fees'],
    netTotal: ['net total']
  };

  // Sections
  const salesSec = sliceBetween(lines, 'sales', 'payments');
  const paySec   = sliceBetween(lines, 'payments', 'discounts applied');

  function findIn(section, keys){
    const idx = section.findIndex(l => hasAny(l, keys));
    if(idx<0) return null;
    return amountNear(section, idx);
  }

  const out = {
    gross_sales:        findIn(salesSec, K.gross),
    items:              findIn(salesSec, K.items),
    service_charges:    findIn(salesSec, K.svc),
    returns:            findIn(salesSec, K.returns),
    discounts_comps:    findIn(salesSec, K.disc),
    net_sales:          findIn(salesSec, K.net),
    tax:                findIn(salesSec, K.tax),
    tips:               findIn(salesSec.concat(paySec), K.tips), // Tips sometimes show under SALES or PAYMENTS
    gift_cards_sales:   findIn(salesSec, K.giftSales),
    refunds_by_amount:  findIn(salesSec, K.refunds),
    total_sales:        findIn(salesSec, K.totalSales),

    total_collected:    findIn(paySec, K.totalCollected) ?? findIn(lines, K.totalCollected),
    cash:               findIn(paySec, K.cash),
    card:               findIn(paySec, K.card),
    gift_card:          findIn(paySec, K.giftCard),
    fees:               findIn(paySec, K.fees),
    net_total:          findIn(paySec, K.netTotal)
  };

  // Special: "Card × 107   $1,220.62"
  if(out.card==null){
    const i = paySec.findIndex(l => /card\s*[x×]/i.test(l));
    if(i>=0) out.card = amountNear(paySec, i);
  }

  return out;
}

function parseDrawerText(text){
  const lines = textToLines(text);
  const K = {
    start: ['starting cash'],
    csales: ['cash sales'],
    cref: ['cash refunds'],
    inout: ['paid in/out','paid in','paid out'],
    expected: ['expected in drawer']
  };
  function find(keys){
    const i = lines.findIndex(l => hasAny(l, keys));
    return (i>=0) ? amountNear(lines, i) : null;
  }
  return {
    starting_cash:      find(K.start),
    cash_sales:         find(K.csales),
    cash_refunds:       find(K.cref),
    paid_in_out:        find(K.inout),
    expected_in_drawer: find(K.expected)
  };
}

/* ====================== SCAN HANDLERS ====================== */
// AM Sales
$('btnScanAmSales').addEventListener('click', async ()=>{
  const f = $('fileAmSales').files?.[0]; if(!f) return alert('Pick AM Sales photo');
  const text = await ocrText(f, $('statusAmSales'));
  const s = parseSalesText(text);

  renderMirror('amSalesMirror', RECEIPT_SALES, s);
  setNum('am_total_collected', s.total_collected);
  setNum('am_tips', s.tips);
  setNum('am_card', s.card);
  setNum('am_cash', s.cash);
  setNum('am_gift_card', s.gift_card ?? s.gift_cards_sales);

  setText('amSalesChip','scanned','badge');
  if ([s.total_collected,s.tips,s.card].some(v=>v==null)) { const d=$('amSalesDetails'); if(d) d.open=true; }
  recalcAll();
});

// AM Drawer
$('btnScanAmDrawer').addEventListener('click', async ()=>{
  const f=$('fileAmDrawer').files?.[0]; if(!f) return alert('Pick AM Drawer photo');
  const text = await ocrText(f, $('statusAmDrawer'));
  const d = parseDrawerText(text);

  renderMirror('amDrawerMirror', RECEIPT_DRAWER, d);
  setNum('am_starting_cash', d.starting_cash);
  setNum('am_cash_sales_drawer', d.cash_sales);
  setNum('am_cash_refunds', d.cash_refunds);
  setNum('am_paid_in_out', d.paid_in_out);
  setNum('am_expected_in_drawer', d.expected_in_drawer);

  setText('amDrawerChip','scanned','badge');
  if ([d.starting_cash,d.expected_in_drawer].some(v=>v==null)) { const de=$('amDrawerDetails'); if(de) de.open=true; }
  recalcAll();
});

// PM Sales (requires AM & PM scans or manual entry)
let pmAmParsed=null, pmParsed=null;

$('btnScanPmAmSales').addEventListener('click', async ()=>{
  const f=$('filePmAmSales').files?.[0]; if(!f) return alert('Pick AM Sales (earlier shift) photo');
  const text = await ocrText(f, $('statusPmAm'));
  pmAmParsed = parseSalesText(text);
  renderMirror('pmAmSalesMirror', RECEIPT_SALES, pmAmParsed);
  setText('pmSalesChip','AM scanned','badge');
});

$('btnScanPmSales').addEventListener('click', async ()=>{
  const f=$('filePmSales').files?.[0]; if(!f) return alert('Pick PM Sales (your shift) photo');
  const text = await ocrText(f, $('statusPmSales'));
  pmParsed = parseSalesText(text);

  renderMirror('pmSalesMirror', RECEIPT_SALES, pmParsed);
  setNum('pm_total_collected', pmParsed.total_collected);
  setNum('pm_tips', pmParsed.tips);
  setNum('pm_card', pmParsed.card);
  setNum('pm_cash', pmParsed.cash);
  setNum('pm_gift_card', pmParsed.gift_card ?? pmParsed.gift_cards_sales);

  setText('pmSalesChip','PM scanned','badge');
  if ([pmParsed.total_collected, pmParsed.tips, pmParsed.card].some(v=>v==null)) { const d=$('pmSalesDetails'); if(d) d.open=true; }
  recalcAll();
});

// PM Drawer
$('btnScanPmDrawer').addEventListener('click', async ()=>{
  const f=$('filePmDrawer').files?.[0]; if(!f) return alert('Pick PM Drawer photo');
  const text = await ocrText(f, $('statusPmDrawer'));
  const d = parseDrawerText(text);

  renderMirror('pmDrawerMirror', RECEIPT_DRAWER, d);
  setNum('pm_starting_cash', d.starting_cash);
  setNum('pm_cash_sales_drawer', d.cash_sales);
  setNum('pm_cash_refunds', d.cash_refunds);
  setNum('pm_paid_in_out', d.paid_in_out);
  setNum('pm_expected_in_drawer', d.expected_in_drawer);

  setText('pmDrawerChip','scanned','badge');
  if ([d.starting_cash,d.expected_in_drawer].some(v=>v==null)) { const de=$('pmDrawerDetails'); if(de) de.open=true; }
  recalcAll();
});

/* ====================== COMPUTATIONS ====================== */
function depTotal(prefix){
  return fix2(
    (getNum(`${prefix}_dep_coins`)||0) +
    (getNum(`${prefix}_dep_1s`)||0) +
    (getNum(`${prefix}_dep_5s`)||0) +
    (getNum(`${prefix}_dep_10s`)||0) +
    (getNum(`${prefix}_dep_20s`)||0) +
    (getNum(`${prefix}_dep_50s`)||0) +
    (getNum(`${prefix}_dep_100s`)||0)
  );
}

function recalc(prefix){
  const card = getNum(`${prefix}_card`)||0;
  const dep  = depTotal(prefix);
  setNum(`${prefix}_cash_deposit_total`, dep);

  const shift = fix2(card + dep);
  setNum(`${prefix}_shift_total`, shift);

  // Use "Expected in Drawer" as ending cash for equations
  const starting = getNum(`${prefix}_starting_cash`) || 0;
  const ending   = getNum(`${prefix}_expected_in_drawer`) || 0;
  const expenses = getNum(`${prefix}_expenses`) || 0;

  // Sales Total = Total Collected − Tips − Gift Card + Starting − Expected − Expenses
  const sales = (getNum(`${prefix}_total_collected`)||0)
    - (getNum(`${prefix}_tips`)||0)
    - (getNum(`${prefix}_gift_card`)||0)
    + starting - ending - expenses;
  setNum(`${prefix}_sales_total`, fix2(sales));

  // Mishandled = Starting − Shift + Expenses
  const mish = starting - shift + expenses;
  setNum(`${prefix}_mishandled_cash`, fix2(mish));
}

function recalcAll(){ recalc('am'); recalc('pm'); gateSubmit(); }

// Recalc on any numeric/date/time inputs
qsa('input').forEach(el=>{
  if(['number','date','time'].includes(el.type)){
    el.addEventListener('input', recalcAll);
  }
});
$('recalcBtn').addEventListener('click', recalcAll);

/* ====================== SUBMIT GATE ====================== */
function gateSubmit(){
  const okBasics = $('store').value.trim() && $('date').value && $('time').value;
  $('submitBtn').disabled = !okBasics;
  setText('saveHint', okBasics ? 'Ready to submit ✓' : 'Fill store/date/time', okBasics ? '' : 'muted');
}

/* ====================== SUBMIT ====================== */
$('submitBtn').addEventListener('click', async ()=>{
  if(!$('store').value.trim() || !$('date').value || !$('time').value){
    alert('Please fill Store, Date and Time'); return;
  }

  const payload = {
    source:'Web App',
    submission_id:(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()),
    first_name: $('firstName').value.trim(),
    last_name: $('lastName').value.trim(),
    store_location: $('store').value.trim(),
    todays_date: $('date').value,
    time_of_entry: $('time').value,
    shift: $('shiftPM').checked ? 'PM' : 'AM',

    // AM summary + drawer + deposit + computed
    am_total_collected:getNum('am_total_collected'),
    am_tips:getNum('am_tips'),
    am_card:getNum('am_card'),
    am_cash:getNum('am_cash'),
    am_gift_card:getNum('am_gift_card'),
    am_starting_cash:getNum('am_starting_cash'),
    am_cash_sales_drawer:getNum('am_cash_sales_drawer'),
    am_cash_refunds:getNum('am_cash_refunds'),
    am_paid_in_out:getNum('am_paid_in_out'),
    am_expected_in_drawer:getNum('am_expected_in_drawer'),
    am_expenses:getNum('am_expenses'),
    am_dep_coins:getNum('am_dep_coins'),
    am_dep_1s:getNum('am_dep_1s'),
    am_dep_5s:getNum('am_dep_5s'),
    am_dep_10s:getNum('am_dep_10s'),
    am_dep_20s:getNum('am_dep_20s'),
    am_dep_50s:getNum('am_dep_50s'),
    am_dep_100s:getNum('am_dep_100s'),
    am_cash_deposit_total:getNum('am_cash_deposit_total'),
    am_shift_total:getNum('am_shift_total'),
    am_sales_total:getNum('am_sales_total'),
    am_mishandled_cash:getNum('am_mishandled_cash'),

    // PM summary + drawer + deposit + computed
    pm_total_collected:getNum('pm_total_collected'),
    pm_tips:getNum('pm_tips'),
    pm_card:getNum('pm_card'),
    pm_cash:getNum('pm_cash'),
    pm_gift_card:getNum('pm_gift_card'),
    pm_starting_cash:getNum('pm_starting_cash'),
    pm_cash_sales_drawer:getNum('pm_cash_sales_drawer'),
    pm_cash_refunds:getNum('pm_cash_refunds'),
    pm_paid_in_out:getNum('pm_paid_in_out'),
    pm_expected_in_drawer:getNum('pm_expected_in_drawer'),
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
    const r = await fetch(ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const js = await r.json();
    setText('saveHint', js.ok ? 'Saved ✓' : ('Error: '+(js.error||'unknown')));
  }catch(e){
    setText('saveHint','Network error','muted');
  }
});
