/* ====================== CONFIG ====================== */
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

/* ====================== RECEIPT FIELD LISTS ====================== */
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
  { label:'Total Collected', key:'total_collected' },
  { label:'Cash', key:'cash' },
  { label:'Card', key:'card' },
  { label:'Gift Card', key:'gift_card' },
  { label:'Fees', key:'fees' },
  { label:'Net Total', key:'net_total' },
  { label:'Free Drink Discount', key:'free_drink_discount' },
  { label:'Paper Money Card Discount', key:'paper_money_card_discount' },
  { label:'Pay the Difference Discount', key:'pay_difference_discount' },
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

/* ====================== OCR PREPROCESS (OpenCV) ====================== */
// Upscale → deskew → median blur → contrast → adaptive threshold → sharpen
async function preprocessImage(file) {
  const blobURL = URL.createObjectURL(file);
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = blobURL; i.crossOrigin='anonymous'; });

  const targetH = 2000;
  const scale = Math.max(1, targetH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(blobURL);

  // Wait for OpenCV
  if (!window.cv || !cv.imread) {
    await new Promise(res => {
      const tick = () => (window.cv && cv.imread) ? res() : setTimeout(tick, 30);
      tick();
    });
  }

  let src = cv.imread(c);
  let gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // --- deskew (small rotations) ---
  let detect = new cv.Mat();
  cv.GaussianBlur(gray, detect, new cv.Size(5,5), 0, 0);
  let th = new cv.Mat();
  cv.threshold(detect, th, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
  let edges = new cv.Mat();
  cv.Canny(th, edges, 50, 150);
  let lines = new cv.Mat();
  cv.HoughLines(edges, lines, 1, Math.PI/180, 120);

  let angle = 0;
  if (lines.rows > 0) {
    let sum = 0, cnt = 0;
    for (let i=0;i<lines.rows;i++){
      const theta = lines.data32F[i*2+1]*180/Math.PI;
      if ( (theta>2 && theta<20) || (theta>160 && theta<178) ) { // near-vertical
        sum += (90 - theta);
        cnt++;
      }
    }
    if (cnt>0) angle = sum/cnt;
  }
  if (Math.abs(angle) > 0.5) {
    const center = new cv.Point(src.cols/2, src.rows/2);
    const M = cv.getRotationMatrix2D(center, angle, 1);
    const rotated = new cv.Mat();
    cv.warpAffine(src, rotated, M, new cv.Size(src.cols, src.rows),
                 cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255,255,255,255));
    src.delete(); src = rotated;
    gray.delete(); gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  }
  detect.delete(); th.delete(); edges.delete(); lines.delete();

  // --- denoise + contrast boost ---
  const blur = new cv.Mat(); cv.medianBlur(gray, blur, 3);
  cv.convertScaleAbs(blur, blur, 1.5, -20); // alpha=1.5, beta=-20

  // --- adaptive threshold ---
  const bin = new cv.Mat();
  cv.adaptiveThreshold(
    blur, bin, 255,
    cv.ADAPTIVE_THRESH_MEAN_C,
    cv.THRESH_BINARY,
    31, 5
  );

  // --- sharpen ---
  const sharp = new cv.Mat();
  const kernel = cv.Mat.ones(3,3,cv.CV_32F);
  kernel.data32F.set([0,-1,0,-1,5,-1,0,-1,0]);
  cv.filter2D(bin, sharp, cv.CV_8U, kernel);

  cv.imshow(c, sharp);

  // cleanup
  src.delete(); gray.delete(); blur.delete(); bin.delete(); kernel.delete(); sharp.delete();

  return c.toDataURL('image/png');
}

/* ====================== OCR WORD BOXES ====================== */
async function ocrWords(file, statusEl) {
  setText(statusEl.id,'OCR…','pill');
  const dataURL = await preprocessImage(file);
  const { data } = await Tesseract.recognize(dataURL, 'eng', {
    logger: m => setText(statusEl.id, m.status || 'OCR…','pill'),
    tessedit_pageseg_mode: 4,     // single column
    user_defined_dpi: '300',
    preserve_interword_spaces: '1'
  });
  setText(statusEl.id,'Scanned ✓','pill ok');
  return data.words || [];
}

/* ====================== LINES & LABEL/MONEY HELPERS ====================== */
function wordsToLines(words){
  const rows = [];
  words.forEach(w=>{
    const cy = (w.bbox.y0 + w.bbox.y1)/2;
    let row = rows.find(r => Math.abs(r.cy - cy) < 8);
    if(!row) rows.push(row = { cy, items: [] });
    row.items.push(w);
  });
  return rows
    .sort((a,b)=>a.cy-b.cy)
    .map(r => r.items.sort((x,y)=>x.bbox.x0 - y.bbox.x0).map(i=>i.text).join(' ').replace(/\s{2,}/g,' '));
}

function wordsToLineBands(words){
  const rows=[];
  words.forEach(w=>{
    const cy=(w.bbox.y0+w.bbox.y1)/2;
    let r=rows.find(R=>Math.abs(R.cy-cy)<8);
    if(!r) rows.push(r={cy, items:[]});
    r.items.push(w);
  });
  rows.sort((a,b)=>a.cy-b.cy);
  rows.forEach(r=>r.items.sort((a,b)=>a.bbox.x0-b.bbox.x0));
  return rows;
}

function levenshtein(a,b){
  const dp=Array.from({length:a.length+1},(_,i)=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) dp[i][0]=i;
  for(let j=0;j<=b.length;j++) dp[0][j]=j;
  for(let i=1;i<=a.length;i++)
    for(let j=1;j<=b.length;j++)
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]==b[j-1]?0:1));
  return dp[a.length][b.length];
}
const looksLike = (s, targets) => {
  const t = String(s||'').toLowerCase().replace(/[^a-z]/g,'');
  return targets.some(x => levenshtein(t, x) <= 1);
};

// Money with parentheses-negatives support
const moneyToken = s => {
  const raw = String(s || '').trim();
  const isParenNeg = raw.startsWith('(') && raw.endsWith(')');
  const m = raw.match(/-?\$?\s*\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?/);
  if (!m) return null;
  let t = m[0].replace(/[^\d.-]/g,'');
  let v = Number(t);
  if (!Number.isFinite(v)) return null;
  if (isParenNeg) v = -Math.abs(v);
  return v;
};

// Estimate right money column for a set of words
function estimateMoneyColumn(words){
  const xs = [];
  for (const w of words){
    if (/\d/.test(w.text) && moneyToken(w.text)!=null){
      xs.push(w.bbox.x1);
    }
  }
  if (!xs.length) return null;
  xs.sort((a,b)=>a-b);
  return xs[Math.floor(xs.length*0.9)]; // 90th percentile
}

// Restrict to a section (e.g., PAYMENTS)
function bandSliceByAnchor(words, startLabel, endLabel){
  const rows = wordsToLineBands(words);
  const start = rows.findIndex(r => r.items.some(w=>looksLike(w.text,[startLabel])));
  const end   = rows.findIndex(r => r.items.some(w=>looksLike(w.text,[endLabel])));
  const to = (end>start && end>=0) ? end : rows.length;
  const from = (start>=0) ? start : 0;
  const slice = rows.slice(from, to);
  return slice.flatMap(r => r.items);
}

// Pick the amount closest to the right column on the same (or next) line
function extractAmountNearColumn(words, labels, colX){
  const rows = wordsToLineBands(words);
  for (let rIdx=0; rIdx<rows.length; rIdx++){
    const r = rows[rIdx];
    if (!r.items.some(w => looksLike(w.text, labels))) continue;

    const same = r.items
      .map(w => ({v: moneyToken(w.text), x: w.bbox.x1}))
      .filter(o => o.v!=null)
      .sort((a,b) => Math.abs(a.x - colX) - Math.abs(b.x - colX));
    if (same.length) return Number(same[0].v.toFixed(2));

    if (rIdx+1 < rows.length){
      const next = rows[rIdx+1].items
        .map(w => ({v: moneyToken(w.text), x: w.bbox.x1}))
        .filter(o => o.v!=null)
        .sort((a,b) => Math.abs(a.x - colX) - Math.abs(b.x - colX));
      if (next.length) return Number(next[0].v.toFixed(2));
    }
  }
  return null;
}

/* ====================== PARSERS (regex fallback) ====================== */
function numFromLine(s){
  const m = s.match(/\(?-?\$?\s*\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?\)?/g);
  if(!m || !m.length) return null;
  // respect parentheses negatives
  const raw = m.at(-1);
  let val = Number(raw.replace(/[^\d.-]/g,''));
  if (raw.trim().startsWith('(') && raw.trim().endsWith(')')) val = -Math.abs(val);
  return Number.isFinite(val) ? val : null;
}
function findIdx(lines, words){ return lines.findIndex(L => words.some(w => L.toLowerCase().includes(w))); }
function extract(lines, wordList){
  const i = findIdx(lines, wordList); if(i<0) return null;
  return numFromLine(lines[i]) ?? (lines[i+1] ? numFromLine(lines[i+1]) : null);
}

function parseSales(lines){
  const get = arr => extract(lines, arr);
  const out = {
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
    cash: get(['cash ']), // avoid "cash sales"
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
  };
  if(out.card==null){
    const i = findIdx(lines, ['card ×','card x']);
    if(i>=0){ out.card = numFromLine(lines[i]); }
  }
  return out;
}

function parseDrawer(lines){
  return {
    starting_cash:      extract(lines, ['starting cash']),
    cash_sales:         extract(lines, ['cash sales']),
    cash_refunds:       extract(lines, ['cash refunds']),
    paid_in_out:        extract(lines, ['paid in/out','paid in','paid out']),
    expected_in_drawer: extract(lines, ['expected in drawer'])
  };
}

/* ====================== SCAN HANDLERS ====================== */
// AM Sales
$('btnScanAmSales').addEventListener('click', async ()=>{
  const f = $('fileAmSales').files?.[0]; if(!f) return alert('Pick AM Sales photo');
  const wordsAll = await ocrWords(f, $('statusAmSales'));
  const lines = wordsToLines(wordsAll);
  const s = parseSales(lines);

  // Focus on PAYMENTS section to anchor right column
  const payWords = bandSliceByAnchor(wordsAll, 'payments', 'discounts');
  const colX = estimateMoneyColumn(payWords) ?? estimateMoneyColumn(wordsAll);

  const tipsFix  = extractAmountNearColumn(payWords, ['tips','tip'], colX);
  const cardFix  = extractAmountNearColumn(payWords, ['card'], colX);
  const cashFix  = extractAmountNearColumn(payWords, ['cash'], colX);
  const giftFix  = extractAmountNearColumn(payWords, ['giftcard','gift card'], colX);
  const totalFix = extractAmountNearColumn(payWords, ['totalcollected','total'], colX);

  if(tipsFix  != null) s.tips = tipsFix;
  if(cardFix  != null) s.card = cardFix;
  if(cashFix  != null) s.cash = cashFix;
  if(giftFix  != null) s.gift_card = giftFix;
  if(totalFix != null) s.total_collected = totalFix;

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
  const words = await ocrWords(f, $('statusAmDrawer'));
  const lines = wordsToLines(words);
  const d = parseDrawer(lines);

  const rfix = keyLabels => extractAmountNearColumn(words, keyLabels, estimateMoneyColumn(words) ?? 9e9);
  d.starting_cash      ??= rfix(['startingcash','starting']);
  d.cash_sales         ??= rfix(['cashsales']);
  d.cash_refunds       ??= rfix(['cashrefunds','refunds']);
  d.paid_in_out        ??= rfix(['paidin/out','paidin','paidout','in/out']);
  d.expected_in_drawer ??= rfix(['expectedindrawer','expected']);

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

// PM Sales (AM + PM scans or manual)
let pmAmParsed=null, pmParsed=null;

$('btnScanPmAmSales').addEventListener('click', async ()=>{
  const f=$('filePmAmSales').files?.[0]; if(!f) return alert('Pick AM Sales (earlier shift) photo');
  const words = await ocrWords(f, $('statusPmAm'));
  const lines = wordsToLines(words);
  pmAmParsed = parseSales(lines);
  renderMirror('pmAmSalesMirror', RECEIPT_SALES, pmAmParsed);
  setText('pmSalesChip','AM scanned','badge');
});

$('btnScanPmSales').addEventListener('click', async ()=>{
  const f=$('filePmSales').files?.[0]; if(!f) return alert('Pick PM Sales (your shift) photo');
  const wordsAll = await ocrWords(f, $('statusPmSales'));
  const lines = wordsToLines(wordsAll);
  pmParsed = parseSales(lines);

  const payWords = bandSliceByAnchor(wordsAll, 'payments', 'discounts');
  const colX = estimateMoneyColumn(payWords) ?? estimateMoneyColumn(wordsAll);

  const tipsFix  = extractAmountNearColumn(payWords, ['tips','tip'], colX);
  const cardFix  = extractAmountNearColumn(payWords, ['card'], colX);
  const cashFix  = extractAmountNearColumn(payWords, ['cash'], colX);
  const giftFix  = extractAmountNearColumn(payWords, ['giftcard','gift card'], colX);
  const totalFix = extractAmountNearColumn(payWords, ['totalcollected','total'], colX);

  if(tipsFix  != null) pmParsed.tips = tipsFix;
  if(cardFix  != null) pmParsed.card = cardFix;
  if(cashFix  != null) pmParsed.cash = cashFix;
  if(giftFix  != null) pmParsed.gift_card = giftFix;
  if(totalFix != null) pmParsed.total_collected = totalFix;

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
  const words = await ocrWords(f, $('statusPmDrawer'));
  const lines = wordsToLines(words);
  const d = parseDrawer(lines);

  const rfix = keyLabels => extractAmountNearColumn(words, keyLabels, estimateMoneyColumn(words) ?? 9e9);
  d.starting_cash      ??= rfix(['startingcash','starting']);
  d.cash_sales         ??= rfix(['cashsales']);
  d.cash_refunds       ??= rfix(['cashrefunds','refunds']);
  d.paid_in_out        ??= rfix(['paidin/out','paidin','paidout','in/out']);
  d.expected_in_drawer ??= rfix(['expectedindrawer','expected']);

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

  const starting = getNum(`${prefix}_starting_cash`) || 0;
  const ending   = getNum(`${prefix}_expected_in_drawer`) || 0;
  const expenses = getNum(`${prefix}_expenses`) || 0;

  const sales = (getNum(`${prefix}_total_collected`)||0)
    - (getNum(`${prefix}_tips`)||0)
    - (getNum(`${prefix}_gift_card`)||0)
    + starting - ending - expenses;
  setNum(`${prefix}_sales_total`, fix2(sales));

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

    // AM
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

    // PM
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
