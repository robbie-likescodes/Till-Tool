/* ====================== CONFIG ====================== */
const ENDPOINT = resolveEndpoint();
const MATH_EPS = 0.02;

function resolveEndpoint(){
  const fromWindow = window.TILL_CONFIG && typeof window.TILL_CONFIG.endpoint === 'string'
    ? window.TILL_CONFIG.endpoint
    : '';
  const fromMeta = document.querySelector('meta[name="till-endpoint"]')?.content || '';
  const candidate = String(fromWindow || fromMeta).trim();
  if(!candidate) return '';

  try{
    const url = new URL(candidate);
    const allowedHosts = new Set([
      'script.google.com',
      'script.googleusercontent.com'
    ]);
    if(url.protocol !== 'https:' || !allowedHosts.has(url.hostname)){
      console.warn('Ignoring endpoint because it is not an approved HTTPS Google Apps Script URL.');
      return '';
    }
    return url.toString();
  }catch(_err){
    console.warn('Ignoring invalid till endpoint URL configuration.');
    return '';
  }
}

function ensureEndpointConfigured(){
  if(ENDPOINT) return true;
  setText('saveHint', 'Submission endpoint is not configured. Contact the administrator.', 'muted');
  toast('Submission endpoint is not configured.');
  return false;
}

/* ====================== DOM HELPERS ====================== */
const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];
const money = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g,'')); return Number.isFinite(n)?+n:null; };
const fix2 = n => Number(Number(n||0).toFixed(2));
const setNum = (id, v) => { const el=$(id); if(!el) return; el.value = v==null? '' : (+v).toFixed(2); };
const getNum = id => money($(id)?.value);
const setText = (id, txt, cls) => { const el=$(id); if(!el) return; if(cls!=null) el.className=cls; el.textContent=txt; };
const show = (id, on) => { const el=$(id); if(!el) return; el.hidden = !on; };

const PM_AM_NOT_AVAILABLE_MSG = 'AM shift not available for upload, please scan AM receipt.';
const PM_AM_LOAD_FAILED_MSG = 'Could not load AM from Google Doc. Please scan AM receipt.';

/* ---------- Toasts ---------- */
let toastTimer=null;
function toast(msg){
  let t = $('__toast__');
  if(!t){
    t = document.createElement('div');
    t.id='__toast__';
    t.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2000;font-weight:600;transition:opacity .2s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{t.style.opacity='0';}, 2500);
}

/* ====================== SCAN STATE (declare EARLY!) ====================== */
const scanned = {
  am: false,       // AM Sales scanned (AM shift or for PM differencing)
  pmFull: false,   // Full Day scanned (PM)
  pmAm: false      // AM sales scanned from PM screen
};


/* ====================== SALES WIZARD ====================== */
const SALES_WIZARD_STEPS = [
  'Shift Selection',
  'Sales Report',
  'Manual Extras',
  'Till Total',
  'Deposit Total',
  'Computed Totals',
  'Tip Claim',
  'Sign and Submit'
];
let salesStep = 0;
let salesNavSentinelVisible = false;

function updateSalesNavVisibility(){
  const nav = $('salesWizardNav');
  if(!nav) return;
  const shouldShow = !!($('formSales')?.checked && salesNavSentinelVisible);
  nav.classList.toggle('is-visible', shouldShow);
  nav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function initSalesNavObserver(){
  const sentinel = $('salesNavSentinel');
  if(!sentinel) return;

  if(!('IntersectionObserver' in window)){
    salesNavSentinelVisible = true;
    updateSalesNavVisibility();
    return;
  }

  const observer = new IntersectionObserver((entries)=>{
    const entry = entries[0];
    salesNavSentinelVisible = !!entry?.isIntersecting;
    updateSalesNavVisibility();
  }, { threshold: 0.05 });

  observer.observe(sentinel);
}

function renderSalesStepJumps(salesOn){
  const host = $('salesStepJumps');
  if(!host) return;
  if(!salesOn){
    host.innerHTML = '';
    return;
  }

  // Keep bottom navigation focused on Back/Next controls only.
  host.innerHTML = '';
}

function updateSalesWizard(){
  const salesOn = $('formSales')?.checked;
  const isPm = $('shiftPM')?.checked;
  qsa('[data-sales-step]').forEach(el=>{
    const step = Number(el.dataset.salesStep);
    if(!salesOn){
      el.hidden = true;
      return;
    }
    const inStep = step === salesStep;
    if(el.id === 'amMode') return;
    if(el.id === 'pmMode') return;
    if(el.closest('#amMode') && isPm){ el.hidden = true; return; }
    if(el.closest('#pmMode') && !isPm){ el.hidden = true; return; }
    el.hidden = !inStep;
  });

  const back = $('salesBackBtn');
  const next = $('salesNextBtn');
  if(back) back.disabled = !salesOn || salesStep === 0;
  if(next){
    next.disabled = !salesOn || salesStep === SALES_WIZARD_STEPS.length - 1;
    next.textContent = salesStep === SALES_WIZARD_STEPS.length - 1 ? 'Done' : 'Next';
  }
  setText('salesStepLabel', `Step ${salesStep + 1} of ${SALES_WIZARD_STEPS.length}: ${SALES_WIZARD_STEPS[salesStep]}`, 'hint');
  renderSalesStepJumps(!!salesOn);
  updateSalesNavVisibility();

  const sticky = document.querySelector('.sticky');
  if(sticky) sticky.hidden = salesOn && salesStep !== SALES_WIZARD_STEPS.length - 1;
}

function goSalesStep(delta){
  const nextStep = Math.max(0, Math.min(SALES_WIZARD_STEPS.length - 1, salesStep + delta));
  if(nextStep === salesStep) return;
  salesStep = nextStep;
  updateSalesWizard();
  gateSubmit();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openReviewPanel(detailsId){
  const panel = $(detailsId);
  if(!panel) return;
  panel.open = true;
}

/* ====================== FORM SWITCHER (Which form?) ====================== */
function applyFormChoice(){
  const salesOn = $('formSales')?.checked;
  show('salesForm', !!salesOn);
  show('tipForm', !salesOn);
  if(!salesOn) salesStep = 0;
  updateSalesWizard();
  gateSubmit();
}
['formSales','formTips'].forEach(id => $(id)?.addEventListener('change', applyFormChoice));
applyFormChoice();

/* ====================== SHIFT AUTO / TOGGLE ====================== */
function isPM(t){ const [h,m]=(t||'').split(':').map(Number); return h>15||(h===15&&(m||0)>=0); }
function applyShiftUI(){
  const pm = $('shiftPM')?.checked;
  show('amMode', !pm);
  show('pmMode', !!pm);
  updateSalesWizard();
  gateSubmit();
}

(function initHeader(){
  const now = new Date();
  const todayIso = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  if ($('date')) $('date').value = todayIso;
  if ($('sales_signature_date')) $('sales_signature_date').value = todayIso;
  if ($('time')) $('time').value = now.toTimeString().slice(0,5);

  ['firstName','lastName','store'].forEach(k=>{
    const el=$(k); if(!el) return;
    const saved=localStorage.getItem('dd_'+k);
    if(saved) el.value = saved;
    el.addEventListener('input',()=>localStorage.setItem('dd_'+k, el.value));
  });

  const pmGuess = isPM($('time')?.value);
  if ($('shiftPM')) $('shiftPM').checked = pmGuess;
  if ($('shiftAM')) $('shiftAM').checked = !pmGuess;

  $('time')?.addEventListener('input', ()=>{
    const pmNow = isPM($('time').value);
    if ($('shiftPM')) $('shiftPM').checked = pmNow;
    if ($('shiftAM')) $('shiftAM').checked = !pmNow;
    applyShiftUI();
  });
  $('shiftAM')?.addEventListener('change', applyShiftUI);
  $('shiftPM')?.addEventListener('change', applyShiftUI);
  applyShiftUI();
})();

/* ====================== RECEIPT FIELDS (mirror) ====================== */
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
  { label:'Net Total', key:'net_total' }
];

function renderMirror(hostId, spec, values){
  const host = $(hostId); if(!host) return;
  const status = values?.__status || {};
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

const AM_MIRROR_TO_FIELD = {
  total_collected: 'am_total_collected',
  tips: 'am_tips',
  card: 'am_card',
  cash: 'am_cash',
  gift_card: 'am_gift_card',
  gift_cards_sales: 'am_gift_card'
};

function syncAmMirrorField(key, value){
  const target = AM_MIRROR_TO_FIELD[key];
  if(!target) return;
  if(value == null){
    const el = $(target);
    if(el) el.value = '';
    return;
  }
  setNum(target, value);
}

function seedAmMirrorValues(){
  return {
    __status: {},
    total_collected: getNum('am_total_collected'),
    tips: getNum('am_tips'),
    card: getNum('am_card'),
    cash: getNum('am_cash'),
    gift_card: getNum('am_gift_card')
  };
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
  if(!line) return { val:null, confidence:'miss' };
  const L = stripCounts(line);
  const matches = [...(L.matchAll(moneyRegex) || [])].map(m=>{
    const raw = m[0], val = normMoney(raw);
    if(val==null) return null;
    return { val, hasDollar:/\$/.test(raw), hasParen:/^\s*\(.*\)\s*$/.test(raw) };
  }).filter(Boolean);
  if(!matches.length) return { val:null, confidence:'miss' };
  const strong = matches.filter(x=>x.hasDollar||x.hasParen);
  const pool = (strict && strong.length) ? strong : matches;
  pool.sort((a,b)=>Math.abs(b.val)-Math.abs(a.val));
  const uncertain = pool.length > 1 || (strict && !strong.length);
  return { val:pool[0].val, confidence: uncertain ? 'maybe' : 'ok' };
}
function amountNear(lines, idx){
  let r = bestAmountFromLine(lines[idx], {strict:true});
  if(r.val!=null) return r;
  if(idx+1<lines.length){
    r = bestAmountFromLine(lines[idx+1], {strict:true});
    if(r.val!=null) return { ...r, confidence:'maybe' };
  }
  r = bestAmountFromLine(lines[idx], {strict:false});
  if(r.val!=null) return { ...r, confidence:'maybe' };
  if(idx+1<lines.length){
    r = bestAmountFromLine(lines[idx+1], {strict:false});
    if(r.val!=null) return { ...r, confidence:'maybe' };
  }
  if(idx-1>=0){
    r = bestAmountFromLine(lines[idx-1], {strict:true});
    if(r.val==null) r = bestAmountFromLine(lines[idx-1], {strict:false});
    if(r.val!=null) return { ...r, confidence:'maybe' };
  }
  return { val:null, confidence:'miss' };
}

/* ---------- Section anchors (SALES / PAYMENTS only) ---------- */
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

  const salesSec = (sSales>=0) ? lines.slice(Math.max(0,salesStartClamp(sSales)), Math.max(0, sPays>=0 ? sPays : lines.length)) : [];
  const paySec   = (sPays>=0) ? lines.slice(sPays) : [];

  function salesStartClamp(i){ return Math.max(0,i); }

  const K = {
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
    totalCollected: ['total collected','grand total'],
    cash: ['cash '],
    card: ['card','credit card charges'],
    giftCard: ['gift card '],
    fees: ['fees'],
    netTotal: ['net total']
  };

  const out = { __status:{} };
  const setField = (key, val, status) => { out[key]=val??null; out.__status[key]= (val==null?'miss':status); };

  function findIn(section, keys, fallbackScope=null){
    const idx = section.findIndex(l => hasAny(l, keys));
    if(idx>=0){
      const amt = amountNear(section, idx);
      return { val: amt.val, status: amt.confidence };
    }
    if(fallbackScope){
      const j = fallbackScope.findIndex(l => hasAny(l, keys));
      if(j>=0){
        const amt = amountNear(fallbackScope, j);
        return { val: amt.val, status: amt.val==null ? 'miss' : 'maybe' };
      }
    }
    return { val:null, status:'miss' };
  }

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

  r = findIn(paySec, K.totalCollected, lines); setField('total_collected', r.val, r.status);
  r = findIn(paySec, K.cash, lines.slice(sPays>=0?sPays:0)); setField('cash', r.val, r.status);
  r = findIn(paySec, K.card, lines.slice(sPays>=0?sPays:0)); setField('card', r.val, r.status);
  r = findIn(paySec, K.giftCard, lines.slice(sPays>=0?sPays:0)); setField('gift_card', r.val, r.status);
  r = findIn(paySec, K.fees, lines);           setField('fees', r.val, r.status);
  r = findIn(paySec, K.netTotal, lines);       setField('net_total', r.val, r.status);

  if(out.card==null){
    const src = paySec.length ? paySec : lines.slice(sPays>=0?sPays:0);
    const i = src.findIndex(l => /card\s*[x×]/i.test(l));
    if(i>=0){
      const amt = amountNear(src, i);
      setField('card', amt.val, amt.val==null ? 'miss' : 'maybe');
    }
  }
  return out;
}

/* ====================== PM DIFF STATE ====================== */
let pmAmParsed=null, pmFullParsed=null; // raw parsed
let pmDerived=null;                     // differences (PM-only view)

function computePMDerived(){
  if(!pmAmParsed || !pmFullParsed) return;
  const diff = (a,b) => {
    const an = money(a), bn = money(b);
    if(an==null || bn==null) return null;
    return fix2(an - bn);
  };
  pmDerived = { __status:{} };
  const keys = [
    'gross_sales','items','service_charges','returns','discounts_comps','net_sales','tax',
    'tips','gift_cards_sales','refunds_by_amount','total_sales',
    'total_collected','cash','card','gift_card','fees','net_total'
  ];
  keys.forEach(k=>{
    const v = diff(pmFullParsed[k], pmAmParsed[k]);
    pmDerived[k] = v;
    const okBoth = (pmFullParsed.__status?.[k]==='ok' && pmAmParsed.__status?.[k]==='ok');
    pmDerived.__status[k] = (v==null ? 'miss' : (okBoth ? 'ok' : 'maybe'));
  });
  renderMirror('pmSalesMirror', RECEIPT_SALES, pmDerived);
  setNum('pm_total_collected', pmDerived.total_collected);
  setNum('pm_tips', pmDerived.tips);
  setNum('pm_card', pmDerived.card);
  setNum('pm_cash', pmDerived.cash);
  setNum('pm_gift_card', pmDerived.gift_card ?? pmDerived.gift_cards_sales);
  recalcAll();
}


function setPmAmDocError(msg=''){
  const el = $('pmAmDocError');
  if(!el) return;
  el.hidden = !msg;
  el.textContent = msg;
}

function normalizeDateYMD(value){
  if(!value) return '';
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const raw = String(value).trim();
  if(!raw) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const mdy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if(mdy){
    const mm = mdy[1].padStart(2,'0');
    const dd = mdy[2].padStart(2,'0');
    const yyyy = mdy[3].length===2 ? `20${mdy[3]}` : mdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const dt = new Date(raw);
  if(Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0,10);
}

function normStore(v){ return String(v||'').trim().toLowerCase(); }

function pickEntryValue(entry, keys){
  for(const key of keys){
    if(entry?.[key] !== undefined && entry?.[key] !== null && String(entry[key]).trim() !== '') return entry[key];
  }
  return null;
}

function parseAmDocEntry(entry){
  const mapped = { __status:{} };
  const fieldMap = {
    gross_sales:['gross_sales','am_gross_sales','grossSales','amGrossSales','AM Gross Sales'],
    items:['items','am_items','AM Items'],
    service_charges:['service_charges','am_service_charges','serviceCharges','AM Service Charges'],
    returns:['returns','am_returns','AM Returns'],
    discounts_comps:['discounts_comps','am_discounts_comps','discountsComps','AM Free Drink Discount','AM Discounts & Comps'],
    net_sales:['net_sales','am_net_sales','netSales','AM Net Sales'],
    tax:['tax','am_tax','AM Tax'],
    tips:['tips','am_tips','am_shift_tips','Total AM Shift Tips','AM Tips'],
    gift_cards_sales:['gift_cards_sales','am_gift_card_sales','am_gift_cards_sales','AM "Gift Card x ____"','AM Gift Card Sales'],
    refunds_by_amount:['refunds_by_amount','am_refunds_by_amount','AM Refunds by Amount'],
    total_sales:['total_sales','am_total_sales','AM Total Sales'],
    total_collected:['total_collected','am_total_collected','AM Total Collected'],
    cash:['cash','am_cash_sales','AM Cash Sales'],
    card:['card','am_card_collected','am_credit_card_charges','AM Credit Card Charges'],
    gift_card:['gift_card','am_gift_card_sales','AM "Gift Card x ____"'],
    fees:['fees','am_fees','AM Fees'],
    net_total:['net_total','am_net_total','AM Net Total']
  };

  Object.entries(fieldMap).forEach(([key, aliases])=>{
    const val = money(pickEntryValue(entry, aliases));
    mapped[key] = val;
    mapped.__status[key] = val==null ? 'miss' : 'ok';
  });

  return mapped;
}

function extractEntryList(payload){
  if(Array.isArray(payload)) return payload;
  if(payload && Array.isArray(payload.entries)) return payload.entries;
  if(payload && Array.isArray(payload.data)) return payload.data;
  if(payload && Array.isArray(payload.rows)) return payload.rows;
  if(payload && Array.isArray(payload.result)) return payload.result;
  if(payload && payload.entry && typeof payload.entry === 'object') return [payload.entry];
  if(payload && typeof payload === 'object') return [payload];
  return [];
}

function chooseMostRecentEntry(entries){
  if(entries.length <= 1) return entries[0] || null;
  console.warn(`Multiple AM entries matched (${entries.length}). Choosing most recent.`);
  const enriched = entries.map((entry, idx)=>{
    const stamp = pickEntryValue(entry, ['updated_at','submission_date','timestamp','created_at','Submission Date','Time']);
    const parsed = stamp ? new Date(stamp).getTime() : NaN;
    return { entry, idx, parsed: Number.isNaN(parsed) ? -Infinity : parsed };
  });
  enriched.sort((a,b)=> b.parsed - a.parsed || a.idx - b.idx);
  return enriched[0].entry;
}

async function loadPmAmFromGoogleDoc(){
  if(!ensureEndpointConfigured()) return;
  const store = $('store')?.value;
  const date = $('date')?.value;
  const normalizedDate = normalizeDateYMD(date);
  const normalizedStore = normStore(store);

  setPmAmDocError('');
  if(!normalizedStore || !normalizedDate){
    setPmAmDocError(PM_AM_NOT_AVAILABLE_MSG);
    return;
  }

  const hadExistingValues = scanned.pmAm || [
    getNum('am_total_collected'), getNum('am_tips'), getNum('am_card'), getNum('am_cash'), getNum('am_gift_card')
  ].some(v => v != null);

  try{
    setText('statusPmAm','Loading Doc…','pill');
    const qs = new URLSearchParams({ action:'lookup_am', store, date: normalizedDate, shift:'AM' });
    const resp = await fetch(`${ENDPOINT}?${qs.toString()}`, { method:'GET' });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const payload = await resp.json();
    const entries = extractEntryList(payload);
    const matches = entries.filter(entry=>{
      const entryShift = String(pickEntryValue(entry, ['shift','Conditional Time AM Vs PM']) || '').trim().toUpperCase();
      const entryDate = normalizeDateYMD(pickEntryValue(entry, ['todays_date','date_of_shift','Date of Shift','date']));
      const entryStore = normStore(pickEntryValue(entry, ['store_location','store','Store Location']));
      return entryShift === 'AM' && entryDate === normalizedDate && entryStore === normalizedStore;
    });

    const found = chooseMostRecentEntry(matches);
    if(!found){
      setPmAmDocError(PM_AM_NOT_AVAILABLE_MSG);
      setText('statusPmAm','Doc not found','pill warn');
      return;
    }

    pmAmParsed = parseAmDocEntry(found);
    renderMirror('pmAmSalesMirror', RECEIPT_SALES, pmAmParsed);
    openReviewPanel('pmAmMirrorDetails');
    setNum('am_total_collected', pmAmParsed.total_collected);
    setNum('am_tips', pmAmParsed.tips);
    setNum('am_card', pmAmParsed.card);
    setNum('am_cash', pmAmParsed.cash);
    setNum('am_gift_card', pmAmParsed.gift_card ?? pmAmParsed.gift_cards_sales);

    scanned.pmAm = true;
    scanned.am = true;
    setText('pmSalesChip', hadExistingValues ? 'AM loaded from Doc (overwrote values)' : 'AM loaded from Doc', 'badge');
    setText('statusPmAm','Doc loaded ✓','pill ok');
    setPmAmDocError('');
    computePMDerived();
  }catch(err){
    console.error('Could not load AM from Google Doc', err);
    setPmAmDocError(PM_AM_LOAD_FAILED_MSG);
    setText('statusPmAm','Doc load failed','pill warn');
  }
}

/* ====================== SCAN HANDLERS ====================== */
$('amSalesMirror')?.addEventListener('input', (event)=>{
  const input = event.target;
  if(!(input instanceof HTMLInputElement)) return;
  const key = input.dataset.key;
  if(!key) return;
  const value = money(input.value);
  syncAmMirrorField(key, value);
  recalcAll();
});

renderMirror('amSalesMirror', RECEIPT_SALES, seedAmMirrorValues());

// AM Sales
$('btnScanAmSales')?.addEventListener('click', async ()=>{
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
  scanned.am = true;
  openReviewPanel('amSalesDetails');
  recalcAll();
});

// PM: Scan AM
$('btnScanPmAmSales')?.addEventListener('click', async ()=>{
  setPmAmDocError('');
  const f=$('filePmAmSales').files?.[0]; if(!f) return alert('Pick AM Sales (earlier shift) photo');
  const text = await ocrText(f, $('statusPmAm'));
  pmAmParsed = parseSalesText(text);
  renderMirror('pmAmSalesMirror', RECEIPT_SALES, pmAmParsed);
  openReviewPanel('pmAmMirrorDetails');
  setText('pmSalesChip','AM scanned','badge');
  scanned.pmAm = true; scanned.am = true;
  computePMDerived();
});

$('btnLoadPmAmDoc')?.addEventListener('click', loadPmAmFromGoogleDoc);

// PM: Scan Full Day
$('btnScanPmSales')?.addEventListener('click', async ()=>{
  const f=$('filePmSales').files?.[0]; if(!f) return alert('Pick Full Day Sales photo');
  const text = await ocrText(f, $('statusPmSales'));
  pmFullParsed = parseSalesText(text);
  renderMirror('pmSalesMirror', RECEIPT_SALES, pmFullParsed);
  openReviewPanel('pmSalesDetails');
  setText('pmSalesChip','Full Day scanned','badge');
  scanned.pmFull = true;
  computePMDerived();
});

// PM: Review AM
$('btnReviewPmAm')?.addEventListener('click', ()=>{
  openReviewPanel('pmAmMirrorDetails');
});

// PM: Review Full Day
$('btnReviewPmSales')?.addEventListener('click', ()=>{
  if(!pmFullParsed){ alert('Scan the Full Day receipt first.'); return; }
  renderMirror('pmSalesMirror', RECEIPT_SALES, pmFullParsed);
  openReviewPanel('pmSalesDetails');
});

// PM: Review PM (derived = Full Day − AM)
$('btnReviewPmComputed')?.addEventListener('click', ()=>{
  if(!pmAmParsed || !pmFullParsed){ alert('Scan AM and Full Day receipts first.'); return; }
  computePMDerived();
  openReviewPanel('pmSalesDetails');
});

/* ====================== TILL / DEPOSIT HELPERS ====================== */
function sumDenoms(prefix, kind){
  const base = `${prefix}_${kind}_`;
  return fix2(
    (getNum(base+'coins')||0) +
    (getNum(base+'1s')||0) +
    (getNum(base+'5s')||0) +
    (getNum(base+'10s')||0) +
    (getNum(base+'20s')||0) +
    (getNum(base+'50s')||0) +
    (getNum(base+'100s')||0)
  );
}
function updateTill(prefix){
  const total = sumDenoms(prefix,'till');
  if ($(prefix+'_till_total')) setNum(prefix+'_till_total', total);
}
function updateDeposit(prefix){
  const cash = sumDenoms(prefix,'dep');
  if ($(prefix+'_cash_deposit_total')) setNum(prefix+'_cash_deposit_total', cash);
}

/* Toast when starting to type in TILL + live totals */
['am','pm'].forEach(p=>{
  ['till_coins','till_1s','till_5s','till_10s','till_20s','till_50s','till_100s'].forEach(suf=>{
    const id = `${p}_${suf}`;
    $(id)?.addEventListener('input', ()=>{
      toast('This is what’s left in the register for the next shift.');
      updateTill(p); recalcAll();
    });
  });
  ['dep_coins','dep_1s','dep_5s','dep_10s','dep_20s','dep_50s','dep_100s'].forEach(suf=>{
    const id = `${p}_${suf}`;
    $(id)?.addEventListener('input', ()=>{ updateDeposit(p); recalcAll(); });
  });
});

/* ====================== COMPUTATIONS ====================== */
function depCashTotal(prefix){ return sumDenoms(prefix,'dep'); }
function recalc(prefix){
  const card = getNum(`${prefix}_card`)||0;
  const depCash  = depCashTotal(prefix);
  const depositTotal = fix2(card + depCash);

  const tillEnd  = getNum(`${prefix}_till_total`) || 0;
  const starting = getNum(`${prefix}_starting_cash`) || 0;
  const tips     = getNum(`${prefix}_tips`) || 0;
  const totalCollected = getNum(`${prefix}_total_collected`) || 0;
  const giftCard = getNum(`${prefix}_gift_card`) || 0; // receipts show negative

  const dailySales = fix2(totalCollected - tips + (-giftCard) + starting - tillEnd);
  setNum(`${prefix}_sales_total`, dailySales);

  let mish = null;
  if(prefix==='am'){
    mish = fix2(depositTotal - dailySales);
  }else{
    const amDaily = getNum('am_sales_total') || 0;
    mish = fix2(depositTotal - dailySales - amDaily);
  }
  setNum(`${prefix}_mishandled_cash`, mish);

  const shift = fix2(card + depCash);
  setNum(`${prefix}_shift_total`, shift);

}
function recalcAll(){ recalc('am'); recalc('pm'); gateSubmit(); }

qsa('input').forEach(el=>{
  if(['number','date','time'].includes(el.type)){
    el.addEventListener('input', recalcAll);
  }
});
$('recalcBtn')?.addEventListener('click', recalcAll);
function bindSalesNavButtons(){
  const back = $('salesBackBtn');
  const next = $('salesNextBtn');
  if(!back || !next) return;

  const goBack = (ev)=>{ ev.preventDefault(); goSalesStep(-1); };
  const goNext = (ev)=>{ ev.preventDefault(); goSalesStep(1); };

  back.addEventListener('click', goBack);
  next.addEventListener('click', goNext);
  back.addEventListener('touchend', goBack, { passive:false });
  next.addEventListener('touchend', goNext, { passive:false });
}

bindSalesNavButtons();
initSalesNavObserver();

/* ====================== TIP CLAIM TOASTS ====================== */
$('sales_tc_cc_tips')?.addEventListener('input', ()=>toast('Remember to claim the ACTUAL amount you are taking home'));
$('sales_tc_cash_tips')?.addEventListener('input', ()=>toast('Remember to claim the ACTUAL amount you are taking home'));
$('tc_cc_tips')?.addEventListener('input', ()=>toast('Remember to claim the ACTUAL amount you are taking home'));
$('tc_cash_tips')?.addEventListener('input', ()=>toast('Remember to claim the ACTUAL amount you are taking home'));


qsa('input, select').forEach(el=>{
  el.addEventListener('input', gateSubmit);
  el.addEventListener('change', gateSubmit);
});

/* ====================== SUBMIT GATE ====================== */
function gateSubmit(){
  const salesFormOn = $('formSales')?.checked;
  const tipsFormOn  = $('formTips')?.checked;

  const okBasicsSales = $('firstName')?.value.trim() && $('lastName')?.value.trim() && $('store')?.value && $('date')?.value && $('time')?.value;
  const okBasicsTips  = $('tc_firstName')?.value?.trim() && $('tc_lastName')?.value?.trim() && $('tc_store')?.value && $('tc_date')?.value && $('tc_time')?.value;

  if (salesFormOn){
    const isPm = $('shiftPM')?.checked;
    const scansOk = isPm ? (scanned.pmAm && scanned.pmFull) : scanned.am;
    const tipReqOk = money($('sales_tc_cc_tips')?.value)!=null && money($('sales_tc_cash_tips')?.value)!=null;
    const signOk = $('sales_signature')?.value.trim() && $('sales_signature_date')?.value;

    const ready = !!(okBasicsSales && scansOk && tipReqOk && signOk && salesStep === SALES_WIZARD_STEPS.length - 1);
    $('submitBtn').disabled = !ready;
    setText('saveHint',
      okBasicsSales
        ? (tipReqOk
            ? (signOk
                ? (scansOk ? (salesStep === SALES_WIZARD_STEPS.length - 1 ? 'Ready to submit ✓' : 'Go to Sign and Submit step') : (isPm ? 'Scan AM & Full Day first' : 'Scan AM Sales first'))
                : 'Complete signature and signed date')
            : 'Enter tip claim (CC + Cash)')
        : 'Fill name/store/date/time',
      ready ? '' : 'muted'
    );
  } else if (tipsFormOn){
    const tipOk = money($('tc_cc_tips')?.value)!=null && money($('tc_cash_tips')?.value)!=null;
    const ready = !!(okBasicsTips && tipOk);
    $('submitBtn').disabled = !ready;
    setText('saveHint',
      okBasicsTips ? (tipOk ? 'Ready to submit ✓' : 'Enter tip claim (CC + Cash)') : 'Fill name/store/date/time',
      ready ? '' : 'muted'
    );
  }
}

/* ====================== SUBMIT ====================== */
$('submitBtn')?.addEventListener('click', async ()=>{
  if(!ensureEndpointConfigured()) return;
  const salesFormOn = $('formSales')?.checked;
  const tipsFormOn  = $('formTips')?.checked;

  // helper: send as x-www-form-urlencoded (avoids preflight)
  const sendForm = async (payload) => {
    const params = new URLSearchParams();
    for (const [k,v] of Object.entries(payload)) {
      if (v == null || v === '') continue;
      params.append(k, String(v));
    }
    const r = await fetch(ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return r.json();
  };

  if (tipsFormOn){
    const payload = {
      source: 'Tip Claim',
      submission_id: (crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()),
      first_name: $('tc_firstName')?.value.trim() || '',
      last_name: $('tc_lastName')?.value.trim() || '',
      store_location: $('tc_store')?.value.trim() || '',
      todays_date: $('tc_date')?.value || '',
      time_of_entry: $('tc_time')?.value || '',
      cc_tips_claimed: getNum('tc_cc_tips'),
      cash_tips_claimed: getNum('tc_cash_tips')
    };
    setText('saveHint','Saving…','muted');
    try{
      const js = await sendForm(payload);
      if(js.ok){ toast('Please initial chore charts and send photos in GroupMe'); }
      setText('saveHint', js.ok ? 'Saved ✓' : ('Error: '+(js.error||'unknown')));
    }catch(e){ setText('saveHint','Network error','muted'); }
    return;
  }

  const isPm = $('shiftPM')?.checked;
  if (isPm && !(scanned.pmAm && scanned.pmFull)) { alert('Please scan AM and Full Day receipts first.'); return; }
  if (!isPm && !scanned.am) { alert('Please scan the AM Sales receipt first.'); return; }
  if (money($('sales_tc_cc_tips')?.value)==null || money($('sales_tc_cash_tips')?.value)==null){
    alert('Enter Tip Claim (CC + Cash) before submitting.'); return;
  }
  if (!$('sales_signature')?.value.trim() || !$('sales_signature_date')?.value){
    alert('Complete signature and signed date before submitting.'); return;
  }

  const payload = {
    source:'Web App',
    submission_id:(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()),
    first_name: $('firstName').value.trim(),
    last_name: $('lastName').value.trim(),
    store_location: $('store').value.trim(),
    todays_date: $('date').value,
    time_of_entry: $('time').value,
    shift: isPm ? 'PM' : 'AM',

    // --- AM mapped to server ---
    am_total_collected:getNum('am_total_collected'),
    am_tips:getNum('am_tips'),
    am_card_collected:getNum('am_card'),
    am_cash_sales:getNum('am_cash'),
    am_gift_card_sales:getNum('am_gift_card'),

    am_starting_cash:getNum('am_starting_cash'),
    am_ending_cash:getNum('am_till_total'),
    am_paid_in_out:getNum('am_paid_in_out'),
    am_expenses:getNum('am_expenses'),

    am_till_coins:getNum('am_till_coins'),
    am_till_1s:getNum('am_till_1s'),
    am_till_5s:getNum('am_till_5s'),
    am_till_10s:getNum('am_till_10s'),
    am_till_20s:getNum('am_till_20s'),
    am_till_50s:getNum('am_till_50s'),
    am_till_100s:getNum('am_till_100s'),

    am_dep_coins:getNum('am_dep_coins'),
    am_dep_1s:getNum('am_dep_1s'),
    am_dep_5s:getNum('am_dep_5s'),
    am_dep_10s:getNum('am_dep_10s'),
    am_dep_20s:getNum('am_dep_20s'),
    am_dep_50s:getNum('am_dep_50s'),
    am_dep_100s:getNum('am_dep_100s'),
    // client-calculated (server overwrites anyway)
    am_cash_deposit_total:getNum('am_cash_deposit_total'),
    am_shift_total:getNum('am_shift_total'),
    am_sales_total:getNum('am_sales_total'),
    am_mishandled_cash:getNum('am_mishandled_cash'),

    // --- PM mapped to server ---
    pm_total_collected:getNum('pm_total_collected'),
    pm_tips:getNum('pm_tips'),
    pm_card_collected:getNum('pm_card'),
    pm_cash_sales:getNum('pm_cash'),
    pm_gift_card_sales:getNum('pm_gift_card'),

    pm_starting_cash:getNum('pm_starting_cash'),
    pm_ending_cash:getNum('pm_till_total'),
    pm_paid_in_out:getNum('pm_paid_in_out'),
    pm_expenses:getNum('pm_expenses'),

    pm_till_coins:getNum('pm_till_coins'),
    pm_till_1s:getNum('pm_till_1s'),
    pm_till_5s:getNum('pm_till_5s'),
    pm_till_10s:getNum('pm_till_10s'),
    pm_till_20s:getNum('pm_till_20s'),
    pm_till_50s:getNum('pm_till_50s'),
    pm_till_100s:getNum('pm_till_100s'),

    pm_dep_coins:getNum('pm_dep_coins'),
    pm_dep_1s:getNum('pm_dep_1s'),
    pm_dep_5s:getNum('pm_dep_5s'),
    pm_dep_10s:getNum('pm_dep_10s'),
    pm_dep_20s:getNum('pm_dep_20s'),
    pm_dep_50s:getNum('pm_dep_50s'),
    pm_dep_100s:getNum('pm_dep_100s'),
    // client-calculated (server overwrites anyway)
    pm_cash_deposit_total:getNum('pm_cash_deposit_total'),
    pm_shift_total:getNum('pm_shift_total'),
    pm_sales_total:getNum('pm_sales_total'),
    pm_mishandled_cash:getNum('pm_mishandled_cash'),

    // Tip-claim fields captured on the sales form
    sales_tc_cc_tips: getNum('sales_tc_cc_tips'),
    sales_tc_cash_tips: getNum('sales_tc_cash_tips'),
    sales_tc_notes: $('sales_tc_notes')?.value || '',
    sales_signature: $('sales_signature')?.value.trim() || '',
    sales_signature_date: $('sales_signature_date')?.value || ''
  };

  setText('saveHint','Saving…','muted');
  try{
    const js = await sendForm(payload);
    setText('saveHint', js.ok ? 'Saved ✓' : ('Error: '+(js.error||'unknown')));
  }catch(e){
    setText('saveHint','Network error','muted');
  }
});
