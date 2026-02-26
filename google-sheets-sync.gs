/**
 * Google Apps Script endpoint for Till-Tool.
 *
 * Usage:
 * 1) Create/open your target Google Sheet.
 * 2) Set SHEET_ID (recommended) or SHEET_URL.
 * 3) Run initializeSheet() once.
 * 4) Deploy as Web App (Anyone with link).
 * 5) Set the endpoint in index.html via meta tag or window.TILL_CONFIG (no local machine setup).
 */

const SCRIPT_ID = '1GQlBBTuoOKVxS4pxm5mQQVE5hz64CmzAe0T01dYgIDxycfsSPAIdjDtn';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxT-L_bfvFeoC2ps8945uZcWeGt8k3p3sSP0K2ahVaRwUWnyf5nPPFWTXmpRqZVTGJn/exec';
const SHEET_ID = ''; // Recommended: paste spreadsheet ID here.
const SHEET_URL = ''; // Optional: paste spreadsheet URL instead of ID.
const SHEET_NAME = 'Entries from Form';
const MAX_STRING_LENGTH = 120;
const REQUIRED_FIELDS = ['first_name', 'last_name', 'store_location', 'todays_date', 'time_of_entry'];
const NUMERIC_FIELDS = [
  'am_tips','pm_tips','sales_tc_cc_tips','sales_tc_cash_tips','cc_tips_claimed','cash_tips_claimed',
  'am_total_collected','pm_total_collected','am_card_collected','pm_card_collected','am_cash_sales','pm_cash_sales',
  'am_till_total','pm_till_total','am_cash_deposit_total','pm_cash_deposit_total','am_shift_total','pm_shift_total',
  'am_sales_total','pm_sales_total','am_mishandled_cash','pm_mishandled_cash'
];

const HEADERS = [
  'Submission Date',
  'First Name',
  'Last Name',
  'Time',
  'Date of Shift',
  'Store Location',
  'Total AM Shift Tips',
  'Total PM Shift Tips',
  'Claimed CC Tips AM',
  'Claimed CC Tips PM',
  'Expenses (Usually 0)',
  'Money Left in Till - Value of Coins',
  "Money Left in Till - Value of 1's",
  "Money Left in Till - Value of 5's",
  "Money Left in Till - Value of 10's",
  "Money Left in Till - Value of 20's",
  "Money Left in Till - Value of 50's",
  "Money Left in Till - Value of 100's",
  'AM Till Total',
  'AM Till Total (Counted at start of PM Shift)',
  'Cash Deposit - Value of Coins for Deposit',
  "Cash Deposit - Value of 1's",
  "Cash Deposit - Value of 5's",
  "Cash Deposit - Value of 10's",
  "Cash Deposit - Value of 20's",
  "Cash Deposit - Value of 50's",
  "Cash Deposit - Value of 100's (Please do not take 100's)",
  'AM Credit Card Charges',
  'PM Credit Card Charges',
  'AM Shift Total',
  'PM Shift Total',
  'AM Total Collected',
  'PM Total Collected',
  'AM Gift Card x ____',
  'PM Gift Card x ____',
  'AM Free Drink Discount',
  'PM Free Drink Discount',
  'Starting Cash',
  'AM Daily Sales',
  'PM Daily Sales',
  'AM Mishandled Cash',
  'AM Mishandled Cash (AM Shift Previously Posted on Group Me)',
  'PM Mishandled Cash (Post to Group Me)',
  'AM Cash Sales',
  'PM Cash Sales',
  'Conditional Time AM Vs PM',
  'PM Till Total',
  'Deposit Total',
  'AM Notes',
  'PM Notes',
  'Cash Tips',
  'Submission ID',
  'My Signature',
];

function doPost(e) {
  try {
    const payload = getPayload_(e);
    validatePayload_(payload);

    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const row = buildRow_(payload);
    sheet.appendRow(row);

    return jsonResponse_({ ok: true, message: 'Saved', rowLength: row.length });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || '').toLowerCase();

  if (action === 'lookup_am') {
    try {
      const result = lookupAmEntry_(params);
      return jsonResponse_({ ok: true, entry: result });
    } catch (error) {
      return jsonResponse_({ ok: false, error: error && error.message ? error.message : String(error) });
    }
  }

  return jsonResponse_({ ok: true, service: 'Till-Tool Google Sheets endpoint' });
}

function initializeSheet() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return sheet;
}

function getSpreadsheet_() {
  const config = getSheetConfig_();

  if (config.sheetId) {
    return SpreadsheetApp.openById(config.sheetId);
  }

  if (config.sheetUrl) {
    const parsedId = parseSpreadsheetId_(config.sheetUrl);
    if (!parsedId) {
      throw new Error('SHEET_URL is set but does not contain a valid spreadsheet ID.');
    }
    return SpreadsheetApp.openById(parsedId);
  }

  throw new Error(
    'Missing sheet configuration. Set SHEET_ID (preferred) or SHEET_URL in this script, or set Script Properties SHEET_ID/SHEET_URL, then redeploy the web app.'
  );
}

function getSheetConfig_() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = cleanValue_(props.getProperty('SHEET_ID'));
  const configuredUrl = cleanValue_(props.getProperty('SHEET_URL'));

  return {
    sheetId: configuredId || cleanValue_(SHEET_ID),
    sheetUrl: configuredUrl || cleanValue_(SHEET_URL),
  };
}

function parseSpreadsheetId_(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
  return '';
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = firstRow.every((v) => !v);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const mismatch = HEADERS.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    throw new Error('Header row does not match expected template. Update row 1 manually or use a fresh sheet.');
  }
}

function getPayload_(e) {
  const params = (e && e.parameter) || {};

  if (Object.keys(params).length) {
    return normalizePayload_(params);
  }

  const raw = e && e.postData && e.postData.contents;
  if (!raw) return {};

  try {
    return normalizePayload_(JSON.parse(raw));
  } catch (err) {
    return normalizePayload_({});
  }
}

function normalizePayload_(payload) {
  const out = {};
  Object.keys(payload || {}).forEach((key) => {
    out[key] = cleanValue_(payload[key]);
  });
  return out;
}

function cleanValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return value;
}

function num_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function pick_(payload, keys, fallback) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key];
  }
  return fallback === undefined ? '' : fallback;
}

function sum_(...values) {
  return values
    .map((v) => num_(v))
    .filter((v) => v !== '')
    .reduce((acc, cur) => acc + cur, 0);
}


function validatePayload_(payload) {
  const source = String(payload.source || '').trim();
  if (!source) throw new Error('Missing source.');

  const isTipClaim = source === 'Tip Claim';
  const required = isTipClaim
    ? ['first_name', 'last_name', 'store_location', 'todays_date', 'time_of_entry', 'cc_tips_claimed', 'cash_tips_claimed']
    : REQUIRED_FIELDS.concat(['sales_tc_cc_tips', 'sales_tc_cash_tips']);

  required.forEach((field) => {
    const value = payload[field];
    if (value === undefined || value === null || value === '') {
      throw new Error('Missing required field: ' + field);
    }
  });

  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      throw new Error('Field exceeds max length: ' + key);
    }
  });

  NUMERIC_FIELDS.forEach((field) => {
    const value = payload[field];
    if (value === '' || value === undefined || value === null) return;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error('Invalid number for field: ' + field);
  });
}

function lookupAmEntry_(params) {
  const normalizedStore = normalizeStore_(params.store);
  const normalizedDate = normalizeDate_(params.date);
  if (!normalizedStore || !normalizedDate) {
    throw new Error('store and date query parameters are required.');
  }

  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const rowCount = lastRow - 1;
  const rows = sheet.getRange(2, 1, rowCount, HEADERS.length).getValues();

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const record = rowToRecord_(row);
    if (
      normalizeStore_(record.store_location) === normalizedStore
      && normalizeDate_(record.todays_date) === normalizedDate
      && String(record.shift || '').toUpperCase() === 'AM'
    ) {
      return record;
    }
  }

  return null;
}

function rowToRecord_(row) {
  return {
    store_location: row[5],
    todays_date: row[4],
    shift: row[45],
    total_collected: row[31],
    tips: row[6],
    card: row[27],
    cash: row[43],
    gift_card: row[33],
    updated_at: row[0],
  };
}

function normalizeStore_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return '';
}

function buildRow_(p) {
  const now = new Date();
  const shift = String(p.shift || '').toUpperCase();
  const conditionalShift = shift || inferShiftFromTime_(p.time_of_entry);
  const activeShift = conditionalShift === 'PM' ? 'PM' : 'AM';

  const claimedCcTips = num_(pick_(p, ['sales_tc_cc_tips', 'cc_tips_claimed']));
  const claimedCcAm = activeShift === 'AM' ? claimedCcTips : '';
  const claimedCcPm = activeShift === 'PM' ? claimedCcTips : '';
  const enteredNotes = pick_(p, ['sales_tc_notes', 'notes']);
  const amNotes = pick_(p, ['am_notes'], activeShift === 'AM' ? enteredNotes : '');
  const pmNotes = pick_(p, ['pm_notes'], activeShift === 'PM' ? enteredNotes : '');

  const shiftKeys = (amKey, pmKey) => (activeShift === 'PM' ? [pmKey, amKey] : [amKey, pmKey]);

  const tillCoins = num_(pick_(p, shiftKeys('am_till_coins', 'pm_till_coins')));
  const till1s = num_(pick_(p, shiftKeys('am_till_1s', 'pm_till_1s')));
  const till5s = num_(pick_(p, shiftKeys('am_till_5s', 'pm_till_5s')));
  const till10s = num_(pick_(p, shiftKeys('am_till_10s', 'pm_till_10s')));
  const till20s = num_(pick_(p, shiftKeys('am_till_20s', 'pm_till_20s')));
  const till50s = num_(pick_(p, shiftKeys('am_till_50s', 'pm_till_50s')));
  const till100s = num_(pick_(p, shiftKeys('am_till_100s', 'pm_till_100s')));

  const depCoins = num_(pick_(p, shiftKeys('am_dep_coins', 'pm_dep_coins')));
  const dep1s = num_(pick_(p, shiftKeys('am_dep_1s', 'pm_dep_1s')));
  const dep5s = num_(pick_(p, shiftKeys('am_dep_5s', 'pm_dep_5s')));
  const dep10s = num_(pick_(p, shiftKeys('am_dep_10s', 'pm_dep_10s')));
  const dep20s = num_(pick_(p, shiftKeys('am_dep_20s', 'pm_dep_20s')));
  const dep50s = num_(pick_(p, shiftKeys('am_dep_50s', 'pm_dep_50s')));
  const dep100s = num_(pick_(p, shiftKeys('am_dep_100s', 'pm_dep_100s')));

  const depositTotal = num_(pick_(p, shiftKeys('am_cash_deposit_total', 'pm_cash_deposit_total')));
  const computedDepositTotal = sum_(depCoins, dep1s, dep5s, dep10s, dep20s, dep50s, dep100s);
  const safeDepositTotal = depositTotal !== '' ? depositTotal : computedDepositTotal;

  return [
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    p.first_name || p.tc_firstName || p.tc_first_name || '',
    p.last_name || p.tc_lastName || p.tc_last_name || '',
    p.time_of_entry || p.tc_time || '',
    p.todays_date || p.tc_date || '',
    p.store_location || p.tc_store || '',
    num_(p.am_tips),
    num_(p.pm_tips),
    claimedCcAm,
    claimedCcPm,
    num_(pick_(p, shiftKeys('am_expenses', 'pm_expenses'))),
    tillCoins,
    till1s,
    till5s,
    till10s,
    till20s,
    till50s,
    till100s,
    num_(pick_(p, shiftKeys('am_till_total', 'pm_till_total').concat(shiftKeys('am_ending_cash', 'pm_ending_cash')))),
    num_(pick_(p, ['pm_starting_cash'])),
    depCoins,
    dep1s,
    dep5s,
    dep10s,
    dep20s,
    dep50s,
    dep100s,
    num_(p.am_card_collected),
    num_(p.pm_card_collected),
    num_(p.am_shift_total),
    num_(p.pm_shift_total),
    num_(p.am_total_collected),
    num_(p.pm_total_collected),
    num_(p.am_gift_card_sales),
    num_(p.pm_gift_card_sales),
    num_(p.am_paid_in_out),
    num_(p.pm_paid_in_out),
    num_(pick_(p, shiftKeys('am_starting_cash', 'pm_starting_cash'))),
    num_(p.am_sales_total),
    num_(p.pm_sales_total),
    num_(p.am_mishandled_cash),
    num_(p.am_mishandled_cash),
    num_(p.pm_mishandled_cash),
    num_(p.am_cash_sales),
    num_(p.pm_cash_sales),
    conditionalShift,
    num_(pick_(p, ['pm_till_total', 'pm_ending_cash'])),
    safeDepositTotal,
    amNotes,
    pmNotes,
    num_(pick_(p, ['sales_tc_cash_tips', 'cash_tips_claimed'])),
    p.submission_id || '',
    pick_(p, ['my_signature', 'signature']),
  ];
}

function inferShiftFromTime_(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return '';
  const parts = timeValue.split(':');
  if (!parts.length) return '';
  const hour = Number(parts[0]);
  if (!Number.isFinite(hour)) return '';
  return hour >= 15 ? 'PM' : 'AM';
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
