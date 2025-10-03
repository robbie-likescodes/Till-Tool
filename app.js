/* ====================== CONFIG ====================== */
const ENDPOINT = 'https://script.google.com/macros/s/AKfycby1cmY6Ck8ci0RDozBgb_eAsZqq3RAGJW61irUXfvD8JRnLcZIc1Fv-05-wVaLIs-3y/exec';
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

  ['firstName','lastName','store'].forEach(k=>{
    const el=$(k); const saved=localStorage.getItem('dd_'+k);
    if(saved) el.value = saved;
    el.addEventListener('input',()=>localStorage.setItem('dd_'+k, el.value));
  });

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

/* ====================== RECEIPT FIELD LISTS (mirrors) ====================== */
/* Kept only SALES + PAYMENTS fields */
const RECEIPT_SALES = [
  // SALES
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

  // PAYMENTS
  { label:'Total Collected', key:'total_collected' },
  { label:'Cash', key:'cash' },
  { label:'Card', key:'card' },
  { label:'Gift Card', key:'gift_card' },
  { label:'Fees', key:'fees' },
  { label:'Net Total', key:'net_total' }
];

/* ====================== MIRRORS (with confidence coloring) ====================== */
function renderMirror(hostId, spec, values){
  const host = $(hostId); if(!host) return;
  const status = values?.__status || {}; // {key: 'ok'|'maybe'|'miss'}
  host.innerHTML = '';
  spec.forEach(({label, key})=>{
    const id = `${hostId}_${key}`;
    const v = values?.[key];
    const cls = status[key] || 'miss';
    host.insertAdjacentHTML('beforeend', `
      <div>
        <label>${label}</label>
        <div class="field ${cls}">
          <input id="${id}" data-key="${key}" type="number" step="0.01" inputmode="decimal"
                 value="${v!=null?(+v).toFixed(2):''}" placeholder="0.00">
        </div>
      </div>
    `);
  });
}

/* ====================== SIMPLE IMAGE RESIZE (OCR-friendly) ====================== */
async function fileToResizedDataURL(file, maxSide = 2000) {
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

  // lift faint thermal text
  ctx.filter = 'contrast(135%) brightness(112%)';
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  URL.revokeObjectURL(url);
  return dataUrl;
}

/* ====================== OCR (TEXT ONLY) ====================== */
async function ocrText(file, statusEl){
  setText(statusEl.id,'OCR…','pill');
  const dataUrl = await fileToResizedDataURL(file);
  const { data } = await Tesseract.recognize(dataUrl, 'eng', {
    logger: m => setText(statusEl.id, (m.status || 'OCR…') + (m.progress?` ${Math.round(m.progress*100)}%`:''), 'pill'),
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  });
  setText(statusEl.id,'Scanned ✓','pill ok');
  return data.text || '';
}

/* ====================== TEXT → LINES + HELPERS ====================== */
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
const onlyLetters = s => String(s||'').toLowerCase().replace(/[^a-z]/g,'');

function textToLines(text){
  return text.split(/\r?\n/).map(s=>s.replace(/\s{2,}/g,' ').trim()).filter(Boolean);
}
function stripCounts(line){ return String(line || '').replace(/(?:^|\s)[x×]\s*\d+\b/gi, ' '); }
function bestAmountFromLine(line, {strict=false} = {}){
  if(!line) return null;
  const L = stripCounts(line);
  const matches = [...(L.matchAll(moneyRegex) || [])].map(m=>{
    const raw = m[0], val = normMoney(raw);
    if(val==null) return null;
    return { val, hasDollar:/\$/.test(raw), hasParen:/^\s*\(.*\)\s*$/.test(raw) };
  }).filter(Boolean);
  if(!matches.length) return null;
  const strong = matches.filter(x=>x.hasDollar||x.hasParen);
  const pool = (strict && strong.length) ? strong : matches;
  pool.sort((a,b)=>Math.abs(b.val)-Math.abs(a.val));
  return pool[0].val;
}
function amountNear(lines, idx){
  let v = bestAmountFromLine(lines[idx], {strict:true});
  if(v!=null) return v;
  if(idx+1<lines.length){
    v = bestAmountFromLine(lines[idx+1], {strict:true});
    if(v!=null) return v;
  }
  v = bestAmountFromLine(lines[idx], {strict:false});
  if(v!=null) return v;
  if(idx+1<lines.length){
    v = bestAmountFromLine(lines[idx+1], {strict:false});
    if(v!=null) return v;
  }
  if(idx-1>=0){
    v = bestAmountFromLine(lines[idx-1], {strict:true}) ?? bestAmountFromLine(lines[idx-1], {strict:false});
  }
  return v ?? null;
}

/* ---------- Section anchors ---------- */
function levenshtein(a,b){
  const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[m][n];
}
function looksLikeHeader(line, target){
  const h = onlyLetters(line);
  const t = onlyLetters(target);
  if(!h || !t) return false;
  if(h.includes(t)) return true;
  return levenshtein(h, t) <= 2;
}
function findSalesStart(lines){
  let i = lines.findIndex(l => looksLikeHeader(l,'SALES'));
  if(i>=0 && onlyLetters(lines[i])!=='sales') i = -1; // avoid "Sales Report"
  if(i<0){
    const keys = ['gross sales','net sales','discounts & comps','discounts and comps'];
    i = lines.findIndex(l => hasAny(l, keys));
  }
  return i>=0? i : 0;
}
function findPaymentsStart(lines){
  let i = lines.findIndex(l => looksLikeHeader(l,'PAYMENTS'));
  if(i<0) i = lines.findIndex(l => hasAny(l, ['total collected','card ×','card x','gift card','net total']));
  return i;
}

/* ---------- SALES/PAYMENTS parser with confidence ---------- */
function parseSalesText(text){
  const lines = textToLines(text);

  const sSales = findSalesStart(lines);
  const sPays  = findPaymentsStart(lines);

  const salesSec = (sSales>=0) ? lines.slice(sSales, Math.max(0, sPays>=0 ? sPays : lines.length)) : [];
  const paySec   = (sPays>=0) ? lines.slice(sPays) : [];

  const K = {
    // Sales
    gross: ['gross sales'],
    items: ['items'],
    svc: ['service charges'],
    returns: ['returns'],
    disc: ['discounts & comps','discounts and comps','discounts'],
    net: ['net sales'],
    tax: ['tax'],
    tips: ['tips','gratuity'],
    giftSales: ['gift cards sales','gift card sales','gift cards'],
    refunds: ['refunds by amount'],
    totalSales: ['total'],
    // Payments
    totalCollected: ['total collected','grand total'],
    cash: ['cash '], // avoid "cash sales"
    card: ['card','credit card charges'],
    giftCard: ['gift card '],
    fees: ['fees'],
    netTotal: ['net total']
  };

  const out = { __status:{} };

  function setField(key, val, status){
    out[key] = val ?? null;
    out.__status[key] = (val==null ? 'miss' : status);
  }

  function findIn(section, keys, fallbackScope=null){
    const idx = section.findIndex(l => hasAny(l, keys));
    if(idx>=0) return { val: amountNear(section, idx), status:'ok' };
    if(fallbackScope){
      const j = fallbackScope.findIndex(l => hasAny(l, keys));
      if(j>=0) return { val: amountNear(fallbackScope, j), status:'maybe' };
    }
    return { val:null, status:'miss' };
  }

  // SALES
  let r;
  r = findIn(salesSec, K.gross, lines);        setField('gross_sales', r.val, r.status);
  r = findIn(salesSec, K.items, lines);        setField('items', r.val, r.status);
  r = findIn(salesSec, K.svc, lines);          setField('service_charges', r.val, r.status);
  r = findIn(salesSec, K.returns, lines);      setField('returns', r.val, r.status);
  r = findIn(salesSec, K.disc, lines);         setField('discounts_comps', r.val, r.status);
  r = findIn(salesSec, K.net, lines);          setField('net_sales', r.val, r.status);
  r = findIn(salesSec, K.tax, lines);          setField('tax', r.val, r.status);
  r = findIn([...salesSec, ...paySec], K.tips, lines); setField('tips', r.val, r.status);
  r = findIn(salesSec, K.giftSales, lines);    setField('gift_cards_sales', r.val, r.status);
  r = findIn(salesSec, K.refunds, lines);      setField('refunds_by_amount', r.val, r.status);
  r = findIn(salesSec, K.totalSales, lines);   setField('total_sales', r.val, r.status);

  // PAYMENTS
  r = findIn(paySec, K.totalCollected, lines); setField('total_collected', r.val, r.status);
  r = findIn(paySec, K.cash, lines.slice(sPays>=0?sPays:0)); setField('cash', r.val, r.status);
  r = findIn(paySec, K.card, lines.slice(sPays>=0?sPays:0)); setField('card', r.val, r.status);
  r = findIn(paySec, K.giftCard, lines.slice(sPays>=0?sPays:0)); setField('gift_card', r.val, r.status);
  r = findIn(paySec, K.fees, lines);           setField('fees', r.val, r.status);
  r = findIn(paySec, K.netTotal, lines);       setField('net_total', r.val, r.status);

  // Heuristic for "Card × 107  $1,220.62"
  if(out.card==null){
    const src = paySec.length ? paySec : lines.slice(sPays>=0?sPays:0);
    const i = src.findIndex(l => /card\s*[x×]/i.test(l));
    if(i>=0){
      setField('card', amountNear(src, i), 'maybe');
    }
  }

  return out;
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

// PM Sales (AM + PM scans)
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

  const starting = getNum(`${prefix}_starting_cash`) || 0;
  const expenses = getNum(`${prefix}_expenses`) || 0;

  // With drawer removed, use simplified formula:
  // Sales Total = Total Collected − Tips − Gift Card + Starting Cash − Expenses
  const sales = (getNum(`${prefix}_total_collected`)||0)
    - (getNum(`${prefix}_tips`)||0)
    - (getNum(`${prefix}_gift_card`)||0)
    + starting - expenses;
  setNum(`${prefix}_sales_total`, fix2(sales));

  // Mishandled = Starting − Shift + Expenses  (unchanged, still useful signal)
  const mish = starting - shift + expenses;
  setNum(`${prefix}_mishandled_cash`, fix2(mish));
}
function recalcAll(){ recalc('am'); recalc('pm'); gateSubmit(); }

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

    // AM (no drawer fields anymore)
    am_total_collected:getNum('am_total_collected'),
    am_tips:getNum('am_tips'),
    am_card:getNum('am_card'),
    am_cash:getNum('am_cash'),
    am_gift_card:getNum('am_gift_card'),
    am_starting_cash:getNum('am_starting_cash'),
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

    // PM (no drawer fields anymore)
    pm_total_collected:getNum('pm_total_collected'),
    pm_tips:getNum('pm_tips'),
    pm_card:getNum('pm_card'),
    pm_cash:getNum('pm_cash'),
    pm_gift_card:getNum('pm_gift_card'),
    pm_starting_cash:getNum('pm_starting_cash'),
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
