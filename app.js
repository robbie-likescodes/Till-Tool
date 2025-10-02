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

/* ====================== RECEIPT FIELD LISTS ====================== */
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
  { label:'Net Total', key:'net_total' },

  // DISCOUNTS APPLIED
  { label:'Employee Discount', key:'employee_discount' },
  { label:'Free Drink Discount', key:'free_drink_discount' },
  { label:'Paper Money Card Discount', key:'paper_money_card_discount' },
  { label:'Pay the Difference Discount', key:'pay_difference_discount' },

  // CATEGORY SALES
  { label:'Uncategorized', key:'cat_uncategorized' },
  { label:'Cold', key:'cat_cold' },
  { label:'Food', key:'cat_food' },
  { label:'Hot Drinks', key:'cat_hot_drinks' }
];

const RECEIPT_DRAWER = [
  { label:'Starting Cash', key:'starting_cash' },
  { label:'Cash Sales', key:'cash_sales' },
  { label:'Cash Refunds', key:'cash_refunds' },
  { label:'Paid In/Out', key:'paid_in_out' },
  { label:'Expected in Drawer', key:'expected_in_drawer' },
  { label:'Actual in Drawer', key:'actual_in_drawer' },  
  { label:'Difference', key:'difference' }               
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

/* ====================== SIMPLE IMAGE RESIZE ====================== */
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
const onlyLetters = s => String(s||'').toLowerCase().replace(/[^a-z]/g,'');

function textToLines(text){
  return text.split(/\r?\n/).map(s=>s.replace(/\s{2,}/g,' ').trim()).filter(Boolean);
}

// STRONGER amount picker
function stripCounts(line){
  return String(line || '').replace(/(?:^|\s)[x×]\s*\d+\b/gi, ' ');
}
function bestAmountFromLine(line, {strict=false} = {}){
  if(!line) return null;
  const L = stripCounts(line);
  const matches = [...(L.matchAll(moneyRegex) || [])].map(m=>{
    const raw = m[0];
    const val = normMoney(raw);
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

/* ---------- Fuzzy header helpers ---------- */
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

/* ---------- Smart section anchors ---------- */
function findSalesStart(lines){
  let i = lines.findIndex(l => looksLikeHeader(l,'SALES'));
  if(i>=0 && onlyLetters(lines[i])!=='sales') i = -1;
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
function findDiscountsStart(lines){
  let i = lines.findIndex(l => looksLikeHeader(l,'DISCOUNTS APPLIED'));
  if(i<0) i = lines.findIndex(l => /discount/i.test(l));
  return i;
}
function findCategoryStart(lines){
  let i = lines.findIndex(l => looksLikeHeader(l,'CATEGORY SALES'));
  if(i<0) i = lines.findIndex(l => /\b(cold|hot\s*drinks?|food|uncategorized)\b/i.test(l));
  return i;
}
function sliceSmart(lines){
  const sSales = findSalesStart(lines);
  const sPays  = findPaymentsStart(lines);
  const sDisc  = findDiscountsStart(lines);
  const sCat   = findCategoryStart(lines);

  const endSales = (sPays>=0 ? sPays : (sDisc>=0 ? sDisc : (sCat>=0 ? sCat : lines.length)));
  const endPays  = (sDisc>=0 ? sDisc : (sCat>=0 ? sCat : lines.length));
  const endDisc  = (sCat>=0 ? sCat : lines.length);

  return {
    salesSec: lines.slice(Math.max(0,sSales), Math.max(0,endSales)),
    paySec:   lines.slice((sPays>=0? sPays : Math.max(0,endSales)), Math.max((sPays>=0? sPays : endSales), endPays)),
    discSec:  lines.slice((sDisc>=0? sDisc : endPays), endDisc),
    catSec:   lines.slice((sCat>=0? sCat : endDisc))
  };
}

/* ---------- FUZZY TOKEN HELPERS ---------- */
const squash = s => s.toLowerCase().replace(/\s+/g,' ').trim();
function tokens(s){ return squash(s).replace(/[^a-z ]/g,'').split(' ').filter(Boolean); }
function wordLike(a,b){
  const d = levenshtein(a,b);
  if (a.length >= 6) return d <= 2;
  if (a.length >= 4) return d <= 1;
  return d === 0;
}
function containsAllTokens(hay, req){
  const H = tokens(hay);
  return req.every(t => H.some(w => wordLike(t, w)));
}

/* ---------- Wrapped-label parsing (discounts) ---------- */
function parseDiscountsAnywhere(lines){
  const out = {};
  const defs = [
    { key:'employee_discount',         req:['employee','discount'] },
    { key:'free_drink_discount',       req:['free','drink','discount'] },
    { key:'paper_money_card_discount', req:['paper','money','card','discount'] },
    { key:'pay_difference_discount',   req:['pay','difference','discount'] }
  ];
  for (let i=0;i<lines.length;i++){
    const cur=lines[i];
    const windows=[{text:cur},{text:(i+1<lines.length?`${cur} ${lines[i+1]}`:cur)},{text:(i>0?`${lines[i-1]} ${cur}`:cur)}];
    for(const {key,req} of defs){
      if(out[key]!=null) continue;
      if(windows.some(w=>containsAllTokens(w.text,req))){
        out[key]=amountNear(lines,i)??null;
      }
    }
  }
  return out;
}

/* ---------- Categories ---------- */
function parseCategoriesAnywhere(lines){
  const out = {};
  const map = {
    cat_cold:/\bcold\b/i,
    cat_food:/\bfood\b/i,
    cat_hot_drinks:/\bhot\s*drinks?\b/i,
    cat_uncategorized:/\buncategorized\b/i
  };
  lines.forEach((L,idx)=>{
    for(const [key,rx] of Object.entries(map)){
      if(rx.test(L)){
        const v=amountNear(lines,idx);
        if(v!=null) out[key]=v;
      }
    }
  });
  return out;
}

/* ---------- Main SALES/PAYMENTS parser ---------- */
function parseSalesText(text){
  const lines=textToLines(text);
  const {salesSec,paySec,discSec,catSec}=sliceSmart(lines);
  const K={
    gross:['gross sales'],
    items:['items'],
    svc:['service charges'],
    returns:['returns'],
    disc:['discounts & comps','discounts and comps','discounts'],
    net:['net sales'],
    tax:['tax'],
    tips:['tips','gratuity'],
    giftSales:['gift cards sales','gift card sales','gift cards'],
    refunds:['refunds by amount'],
    totalSales:['total'],
    totalCollected:['total collected','grand total'],
    cash:['cash '],
    card:['card','credit card charges'],
    giftCard:['gift card '],
    fees:['fees'],
    netTotal:['net total']
  };
  function findIn(section,keys,fallbackScope=null){
    const idx=section.findIndex(l=>hasAny(l,keys));
    if(idx>=0) return amountNear(section,idx);
    if(fallbackScope){
      const j=fallbackScope.findIndex(l=>hasAny(l,keys));
      if(j>=0) return amountNear(fallbackScope,j);
    }
    return null;
  }
  const out={
    gross_sales:findIn(salesSec,K.gross,lines),
    items:findIn(salesSec,K.items,lines),
    service_charges:findIn(salesSec,K.svc,lines),
    returns:findIn(salesSec,K.returns,lines),
    discounts_comps:findIn(salesSec,K.disc,lines),
    net_sales:findIn(salesSec,K.net,lines),
    tax:findIn(salesSec,K.tax,lines),
    tips:findIn([...salesSec,...paySec],K.tips,lines),
    gift_cards_sales:findIn(salesSec,K.giftSales,lines),
    refunds_by_amount:findIn(salesSec,K.refunds,lines),
    total_sales:findIn(salesSec,K.totalSales,lines),
    total_collected:findIn(paySec,K.totalCollected,lines),
    cash:findIn(paySec,K.cash,lines),
    card:findIn(paySec,K.card,lines),
    gift_card:findIn(paySec,K.giftCard,lines),
    fees:findIn(paySec,K.fees,lines),
    net_total:findIn(paySec,K.netTotal,lines)
  };
  if(out.card==null){
    const src=paySec.length?paySec:lines;
    const i=src.findIndex(l=>/
