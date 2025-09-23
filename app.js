/* ====================== CONFIG & HELPERS ====================== */
const ENDPOINT = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const MATH_EPS = 0.02;

const $ = id => document.getElementById(id);
const qsa = s => [...document.querySelectorAll(s)];
const money = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g,'')); return Number.isFinite(n)?+n:null; };
const fix2 = n => Number(Number(n||0).toFixed(2));
const setNum = (id, v) => { const el=$(id); if(!el) return; el.value = v==null? '' : (+v).toFixed(2); };
const getNum = id => money($(id)?.value);
const setText = (id, txt, cls) => { const el=$(id); if(!el) return; if(cls) el.className=cls; el.textContent=txt; };

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
  const pm = isPM($('time').value);
  $('shiftPM').checked = pm; $('shiftAM').checked = !pm;
  $('time').addEventListener('input', ()=>{
    const pmNow = isPM($('time').value);
    if(pmNow){ $('shiftPM').checked = true; } else { $('shiftAM').checked = true; }
    applyShiftUI();
  });
  $('shiftAM').addEventListener('change', applyShiftUI);
  $('shiftPM').addEventListener('change', applyShiftUI);
  ['store'].forEach(k=>{
    $(k).value = localStorage.getItem('dd_'+k) || '';
    $(k).addEventListener('input',()=>localStorage.setItem('dd_'+k,$(k).value.trim()));
  });
  applyShiftUI();
})();

/* ====================== RECEIPT FIELD LISTS ====================== */
// EXACT Sales receipt fields (labels -> keys; order matters)
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
  // Discounts (examples)
  { label:'Free Drink Discount', key:'free_drink_discount' },
  { label:'Paper Money Card Discount', key:'paper_money_card_discount' },
  { label:'Pay the Difference Discount', key:'pay_difference_discount' },
  // Categories (examples)
  { label:'Uncategorized', key:'cat_uncategorized' },
  { label:'Cold', key:'cat_cold' },
  { label:'Employee Prices', key:'cat_employee_prices' },
  { label:'Food', key:'cat_food' },
  { label:'Hot Drinks', key:'cat_hot_drinks' }
];

// EXACT Drawer receipt fields (labels -> keys; order matters)
const RECEIPT_DRAWER = [
  { label:'Starting Cash', key:'starting_cash' },
  { label:'Cash Sales', key:'cash_sales' },
  { label:'Cash Refunds', key:'cash_refunds' },
  { label:'Paid In/Out', key:'paid_in_out' },
  { label:'Expected in Drawer', key:'expected_in_drawer' },
  { label:'Actual in Drawer', key:'actual_in_drawer' },
  { label:'Difference', key:'difference' }
];

/* ========= Render mirrors (read-only UI except they can edit to fix OCR) ========= */
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

/* ====================== OCR & PARSERS ====================== */
async function ocr(file, statusEl){
  setText(statusEl.id,'OCR…','pill'); 
  const url=URL.createObjectURL(file);
  const {data}=await Tesseract.recognize(url,'eng',{logger:m=>setText(statusEl.id,m.status||'OCR…','pill')});
  URL.revokeObjectURL(url);
  const lines=(data.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  setText(statusEl.id,'Scanned ✓','pill ok'); 
  return lines;
}
function numFromLine(s){
  const m = s.match(/-?\$?\s*\d{1,3}(?:[, \d]{0,3})*(?:\.\d{2})?/g);
  if(!m || !m.length) return null;
  return money(m.at(-1));
}
function find(lines, words){ return lines.findIndex(L=>words.some(w=>L.toLowerCase().includes(w))); }
function extract(lines, wordList){
  const i = find(lines, wordList); if(i<0) return null;
  return numFromLine(lines[i]) ?? (lines[i+1]? numFromLine(lines[i+1]) : null);
}

/* Sales parser (robust for "Card × N" & Tips) */
function parseSales(lines){
  const out = {};
  const get = arr => extract(lines, arr);
  Object.assign(out, {
    gross_sales: get(['gross sales']),
    items: get(['items']),
    service_charges: get(['service charges']),
    returns: get(['returns']),
    discounts_comps: get(['discounts & comps','discounts and comps','discounts']),
    net_sales: get(['net sales']),
    tax: get(['tax']),
    tips: get(['tips','gratuity']),
    gift_cards_sales: get(['gift cards sales','gift card sales','gift card']),
    refunds_by_amount: get(['refunds by amount']),
    total_sales: get(['total']),
    total_collected: get(['total collected']),
    cash: get(['cash ']), // space avoids "cash sales"
    card: get(['card','credit card charges']),
    gift_card: get(['gift card ']),
    fees: get(['fees']),
    net_total: get(['net total']),
    free_drink_discount: get(['free drink discount']),
    paper_money_card_discount: get(['paper money card discount']),
    pay_difference_discount: get(['pay the difference discount']),
    cat_uncategorized: get(['uncategorized']),
    cat_cold: get(['cold']),
    cat_employee_prices: get(['employee prices']),
    cat_food: get(['food']),
    cat_hot_drinks: get(['hot drinks'])
  });
  // Fallback for "Card × 159   $1,890.44"
  if(out.card==null){
    const i = find(lines, ['card ×','card x']);
    if(i>=0){ out.card = numFromLine(lines[i]); }
  }
  return out;
}

/* Drawer parser */
function parseDrawer(lines){
  return {
    starting_cash: extract(lines, ['starting cash']),
    cash_sales: extract(lines, ['cash sales']),
    cash_refunds: extract(lines, ['cash refunds']),
    paid_in_out: extract(lines, ['paid in/out','paid in','paid out']),
    expected_in_drawer: extract(lines, ['expected in drawer']),
    actual_in_drawer: extract(lines, ['actual in drawer','ending cash','till total']),
    difference: extract(lines, ['difference'])
  };
}

/* ====================== SCAN HANDLERS ====================== */
// AM Sales
$('btnScanAmSales').addEventListener('click', async ()=>{
  const f=$('fileAmSales').files?.[0]; if(!f) return alert('Pick AM Sales photo');
  const lines=await ocr(f,$('statusAmSales'));
  const s=parseSales(lines); renderMirror('amSalesMirror', RECEIPT_SALES, s);
  // Fill summary 5
  setNum('am_total_collected', s.total_collected);
  setNum('am_tips', s.tips);
  setNum('am_card', s.card);
  setNum('am_cash', s.cash);
  setNum('am_gift_card', s.gift_card ?? s.gift_cards_sales);
  setText('amSalesChip','scanned','badge'); recalcAll();
});
// AM Drawer
$('btnScanAmDrawer').addEventListener('click', async ()=>{
  const f=$('fileAmDrawer').files?.[0]; if(!f) return alert('Pick AM Drawer photo');
  const lines=await ocr(f,$('statusAmDrawer'));
  const d=parseDrawer(lines); renderMirror('amDrawerMirror', RECEIPT_DRAWER, d);
  setNum('am_starting_cash', d.starting_cash);
  setNum('am_ending_cash', d.actual_in_drawer);
  setNum('am_paid_in_out', d.paid_in_out);
  setText('amDrawerChip','scanned','badge'); recalcAll();
});

// PM Sales (AM + PM required)
let pmAmParsed=null, pmParsed=null;
$('btnScanPmAmSales').addEventListener('click', async ()=>{
  const f=$('filePmAmSales').files?.[0]; if(!f) return alert('Pick AM Sales (earlier shift) photo');
  const lines=await ocr(f,$('statusPmAm'));
  pmAmParsed=parseSales(lines); renderMirror('pmAmSalesMirror', RECEIPT_SALES, pmAmParsed);
  setText('pmSalesChip','AM scanned','badge');
});
$('btnScanPmSales').addEventListener('click', async ()=>{
  const f=$('filePmSales').files?.[0]; if(!f) return alert('Pick PM Sales (your shift) photo');
  const lines=await ocr(f,$('statusPmSales'));
  pmParsed=parseSales(lines); renderMirror('pmSalesMirror', RECEIPT_SALES, pmParsed);
  // Fill PM summary 5 directly from PM receipt
  setNum('pm_total_collected', pmParsed.total_collected);
  setNum('pm_tips', pmParsed.tips);
  setNum('pm_card', pmParsed.card);
  setNum('pm_cash', pmParsed.cash);
  setNum('pm_gift_card', pmParsed.gift_card ?? pmParsed.gift_cards_sales);
  setText('pmSalesChip','PM scanned','badge'); recalcAll();
});

// PM Drawer
$('btnScanPmDrawer').addEventListener('click', async ()=>{
  const f=$('filePmDrawer').files?.[0]; if(!f) return alert('Pick PM Drawer photo');
  const lines=await ocr(f,$('statusPmDrawer'));
  const d=parseDrawer(lines); renderMirror('pmDrawerMirror', RECEIPT_DRAWER, d);
  setNum('pm_starting_cash', d.starting_cash);
  setNum('pm_ending_cash', d.actual_in_drawer);
  setNum('pm_paid_in_out', d.paid_in_out);
  setText('pmDrawerChip','scanned','badge'); recalcAll();
});

/* ====================== COMPUTATIONS ====================== */
function depTotal(prefix){
  return fix2(
    (getNum(`${prefix}_dep_coins`)||0)+(getNum(`${prefix}_dep_1s`)||0)+(getNum(`${prefix}_dep_5s`)||0)+
    (getNum(`${prefix}_dep_10s`)||0)+(getNum(`${prefix}_dep_20s`)||0)+(getNum(`${prefix}_dep_50s`)||0)+
    (getNum(`${prefix}_dep_100s`)||0)
  );
}
function recalc(prefix){
  const card = getNum(`${prefix}_card`)||0;
  const dep = depTotal(prefix);
  setNum(`${prefix}_cash_deposit_total`, dep);
  const shift = fix2(card + dep);
  setNum(`${prefix}_shift_total`, shift);

  // Sales Total = Total Collected − Tips − Gift Card + Starting − Ending − Expenses
  const total = (getNum(`${prefix}_total_collected`)||0)
    - (getNum(`${prefix}_tips`)||0)
    - (getNum(`${prefix}_gift_card`)||0)
    + (getNum(`${prefix}_starting_cash`)||0)
    - (getNum(`${prefix}_ending_cash`)||0)
    - (getNum(`${prefix}_expenses`)||0);
  setNum(`${prefix}_sales_total`, fix2(total));

  // Mishandled = Starting − Shift + Expenses
  const mish = (getNum(`${prefix}_starting_cash`)||0) - shift + (getNum(`${prefix}_expenses`)||0);
  setNum(`${prefix}_mishandled_cash`, fix2(mish));
}
function recalcAll(){ recalc('am'); recalc('pm'); gateSubmit(); }
qsa('input').forEach(el=>{ if(['number','date','time'].includes(el.type)){ el.addEventListener('input', recalcAll); }});
$('recalcBtn').addEventListener('click', recalcAll);

/* ====================== SUBMIT GATE ====================== */
// Submit is allowed once store/date/time exist (mishandled can be non-zero).
function gateSubmit(){
  const okBasics = $('store').value.trim() && $('date').value && $('time').value;
  $('submitBtn').disabled = !okBasics;
  setText('saveHint', $('submitBtn').disabled ? 'Fill store/date/time' : 'Ready to submit ✓', $('submitBtn').disabled ? 'muted' : '');
}

/* ====================== SUBMIT ====================== */
$('submitBtn').addEventListener('click', async ()=>{
  if(!$('store').value.trim() || !$('date').value || !$('time').value){
    alert('Please fill Store, Date and Time'); return;
  }

  const payload = {
    source:'Web App',
    submission_id:(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()),
    store_location:$('store').value.trim(),
    todays_date:$('date').value,
    time_of_entry:$('time').value,

    // AM summary + drawer + deposit + computed
    am_total_collected:getNum('am_total_collected'),
    am_tips:getNum('am_tips'),
    am_card:getNum('am_card'),
    am_cash:getNum('am_cash'),
    am_gift_card:getNum('am_gift_card'),
    am_starting_cash:getNum('am_starting_cash'),
    am_ending_cash:getNum('am_ending_cash'),
    am_paid_in_out:getNum('am_paid_in_out'),
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
    const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const js=await r.json();
    setText('saveHint', js.ok ? 'Saved ✓' : ('Error: '+(js.error||'unknown')));
  }catch(e){
    setText('saveHint','Network error','muted');
  }
});
