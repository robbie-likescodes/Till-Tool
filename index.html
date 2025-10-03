<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Daily Close — Barista Web App</title>
  <link rel="stylesheet" href="styles.css" />
  <meta name="theme-color" content="#7C3AED" />
</head>
<body>
  <div class="wrap">
    <h1>Daily Close</h1>
    <div class="sub">Pick a form → complete → submit.</div>

    <!-- WHICH FORM -->
    <div class="card">
      <label>Which form?</label>
      <div class="row" role="radiogroup" aria-label="Form Type">
        <label class="chip"><input id="formSales" type="radio" name="formType" checked /> Shift Sales Form</label>
        <label class="chip"><input id="formTips" type="radio" name="formType" /> Tip Claim</label>
      </div>
    </div>

    <!-- ===== SHIFT SALES FORM ===== -->
    <section id="salesForm" aria-label="Shift Sales Form">
      <div class="sub">Pick shift → scan receipts → (optional) review → count till → add deposit → submit.</div>

      <!-- HEADER / IDENTITY -->
      <div class="card grid grid-2-md">
        <div>
          <label for="firstName">First name</label>
          <div class="field"><input id="firstName" type="text" autocomplete="given-name" placeholder="e.g., Ava" /></div>
        </div>
        <div>
          <label for="lastName">Last name</label>
          <div class="field"><input id="lastName" type="text" autocomplete="family-name" placeholder="e.g., Lee" /></div>
        </div>

        <div>
          <label for="store">Store</label>
          <div class="field">
            <select id="store">
              <option value="">Choose location…</option>
              <option>Huffman</option>
              <option>Boniface</option>
              <option>Muldoon</option>
              <option>Lake Otis</option>
              <option>Camelot</option>
            </select>
          </div>
          <div class="hint">Remembered on this device.</div>
        </div>

        <div class="grid grid-2">
          <div>
            <label for="date">Date</label>
            <div class="field"><input id="date" type="date" /></div>
          </div>
          <div>
            <label for="time">Time</label>
            <div class="field"><input id="time" type="time" step="60" /></div>
          </div>
        </div>

        <div>
          <label>Shift</label>
          <div class="row" role="radiogroup" aria-label="Shift">
            <label class="chip"><input id="shiftAM" type="radio" name="shift" checked /> AM</label>
            <label class="chip"><input id="shiftPM" type="radio" name="shift" /> PM</label>
          </div>
          <div class="hint">Auto-picks by time; you can override.</div>
        </div>
      </div>

      <!-- CAMERA TIPS -->
      <div class="tip">
        📸 <strong>Best scan:</strong> flat receipt • no glare • fill the frame • use back camera.
      </div>

      <!-- AM MODE -->
      <section id="amMode" aria-label="AM Mode">
        <!-- AM SALES -->
        <div class="card">
          <div class="sect-title">
            <h2>AM Sales Report</h2>
            <span id="amSalesChip" class="badge">waiting</span>
          </div>

          <div class="row">
            <input id="fileAmSales" type="file" accept="image/*" capture="environment" />
            <button id="btnScanAmSales" class="btn btn-grad tiny" type="button">Scan AM Sales</button>
            <span id="statusAmSales" class="pill">Idle</span>
          </div>

          <!-- Preview ONLY: Total Collected + Tips -->
          <div class="grid grid-2-md mt-12">
            <div>
              <label for="am_total_collected">Total Collected</label>
              <div class="field"><input id="am_total_collected" type="number" step="0.01" inputmode="decimal" /></div>
            </div>
            <div>
              <label for="am_tips">Tips</label>
              <div class="field"><input id="am_tips" type="number" step="0.01" inputmode="decimal" /></div>
            </div>
          </div>

          <!-- Review -->
          <details id="amSalesDetails" class="mt-12">
            <summary class="pill">Review</summary>
            <div id="amSalesMirror" class="grid grid-2-md mt-12"></div>
          </details>
        </div>

        <!-- AM MANUAL EXTRAS -->
        <div class="card">
          <div class="sect-title"><h2>AM Manual Extras</h2><span class="badge">optional</span></div>
          <div class="grid grid-3-md">
            <div><label for="am_starting_cash">Starting Cash</label><div class="field"><input id="am_starting_cash" type="number" step="0.01" inputmode="decimal" /></div></div>
            <div><label for="am_expenses">Expenses</label><div class="field"><input id="am_expenses" type="number" step="0.01" inputmode="decimal" /></div></div>
          </div>
        </div>

        <!-- AM TILL (End of Shift) -->
        <div class="card">
          <div class="sect-title"><h2>AM End-of-Shift Till Total</h2></div>
          <div class="grid grid-3-md">
            <div><label for="am_till_coins">Coins</label><div class="field"><input id="am_till_coins" type="number" step="0.01" /></div></div>
            <div><label for="am_till_1s">$1s</label><div class="field"><input id="am_till_1s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_5s">$5s</label><div class="field"><input id="am_till_5s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_10s">$10s</label><div class="field"><input id="am_till_10s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_20s">$20s</label><div class="field"><input id="am_till_20s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_50s">$50s</label><div class="field"><input id="am_till_50s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_100s">$100s</label><div class="field"><input id="am_till_100s" type="number" step="0.01" /></div></div>
            <div><label for="am_till_total">Till Total (auto)</label><div class="field"><input id="am_till_total" type="number" readonly /></div></div>
          </div>
          <div class="hint mt-8">This is what’s left in the register for the next shift.</div>
        </div>

        <!-- AM DEPOSIT -->
        <div class="card">
          <div class="sect-title"><h2>AM Deposit (manual)</h2></div>
          <div class="grid grid-3-md">
            <div><label for="am_dep_coins">Coins</label><div class="field"><input id="am_dep_coins" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_1s">$1s</label><div class="field"><input id="am_dep_1s" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_5s">$5s</label><div class="field"><input id="am_dep_5s" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_10s">$10s</label><div class="field"><input id="am_dep_10s" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_20s">$20s</label><div class="field"><input id="am_dep_20s" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_50s">$50s</label><div class="field"><input id="am_dep_50s" type="number" step="0.01" /></div></div>
            <div><label for="am_dep_100s">$100s</label><div class="field"><input id="am_dep_100s" type="number" step="0.01" /></div></div>
            <div><label for="am_cash_deposit_total">Cash Deposit (auto)</label><div class="field"><input id="am_cash_deposit_total" type="number" readonly /></div></div>
          </div>
        </div>

        <!-- AM COMPUTED -->
        <div class="card">
          <div class="sect-title"><h2>AM Computed</h2><span id="amCalcChip" class="badge">…</span></div>
          <div class="grid grid-3-md">
            <div><label for="am_shift_total">AM Shift Total (Card + Cash Deposit)</label><div class="field"><input id="am_shift_total" type="number" readonly /></div></div>
            <div><label for="am_sales_total">AM Daily Sales (Actual)</label><div class="field"><input id="am_sales_total" type="number" readonly /></div></div>
            <div><label for="am_mishandled_cash">AM Mishandled Cash</label><div class="field"><input id="am_mishandled_cash" type="number" readonly /></div></div>
          </div>
        </div>
      </section>

      <!-- PM MODE -->
      <section id="pmMode" aria-label="PM Mode" style="display:none">
        <div class="card">
          <div class="sect-title">
            <h2>PM Sales Reports</h2>
            <span id="pmSalesChip" class="badge">waiting</span>
          </div>

          <!-- New PM button labels -->
          <div class="grid grid-2-md">
            <div>
              <label>Scan AM (earlier shift)</label>
              <div class="row">
                <input id="filePmAmSales" type="file" accept="image/*" capture="environment" />
                <button id="btnScanPmAmSales" class="btn btn-grad tiny" type="button">Scan AM</button>
                <button id="btnReviewPmAm" class="btn btn-ghost tiny" type="button">Review AM</button>
                <span id="statusPmAm" class="pill">Idle</span>
              </div>
            </div>
            <div>
              <label>Scan Full Day</label>
              <div class="row">
                <input id="filePmSales" type="file" accept="image/*" capture="environment" />
                <button id="btnScanPmSales" class="btn btn-grad tiny" type="button">Scan Full Day</button>
                <button id="btnReviewPmSales" class="btn btn-ghost tiny" type="button">Review Full Day</button>
                <span id="statusPmSales" class="pill">Idle</span>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="grid grid-2-md mt-12">
            <div><label for="pm_total_collected">PM Total Collected</label><div class="field"><input id="pm_total_collected" type="number" step="0.01" /></div></div>
            <div><label for="pm_tips">PM Tips</label><div class="field"><input id="pm_tips" type="number" step="0.01" /></div></div>
          </div>

          <div class="row mt-12">
            <button id="btnReviewPmComputed" class="btn btn-ghost tiny" type="button">Review PM</button>
          </div>

          <details id="pmAmMirrorDetails" class="mt-12">
            <summary class="pill">Review</summary>
            <div id="pmAmSalesMirror" class="grid grid-2-md mt-12"></div>
          </details>
          <details id="pmSalesDetails" class="mt-12">
            <summary class="pill">Review</summary>
            <div id="pmSalesMirror" class="grid grid-2-md mt-12"></div>
          </details>
        </div>

        <!-- PM MANUAL EXTRAS -->
        <div class="card">
          <div class="sect-title"><h2>PM Manual Extras</h2><span class="badge">optional</span></div>
          <div class="grid grid-3-md">
            <div><label for="pm_starting_cash">Starting Cash (PM)</label><div class="field"><input id="pm_starting_cash" type="number" step="0.01" inputmode="decimal" /></div></div>
            <div><label for="pm_expenses">Expenses</label><div class="field"><input id="pm_expenses" type="number" step="0.01" inputmode="decimal" /></div></div>
          </div>
        </div>

        <!-- PM TILL (End of Shift) -->
        <div class="card">
          <div class="sect-title"><h2>PM End-of-Shift Till Total</h2></div>
          <div class="grid grid-3-md">
            <div><label for="pm_till_coins">Coins</label><div class="field"><input id="pm_till_coins" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_1s">$1s</label><div class="field"><input id="pm_till_1s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_5s">$5s</label><div class="field"><input id="pm_till_5s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_10s">$10s</label><div class="field"><input id="pm_till_10s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_20s">$20s</label><div class="field"><input id="pm_till_20s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_50s">$50s</label><div class="field"><input id="pm_till_50s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_100s">$100s</label><div class="field"><input id="pm_till_100s" type="number" step="0.01" /></div></div>
            <div><label for="pm_till_total">Till Total (auto)</label><div class="field"><input id="pm_till_total" type="number" readonly /></div></div>
          </div>
          <div class="hint mt-8">This is what’s left in the register for the next shift.</div>
        </div>

        <!-- PM DEPOSIT -->
        <div class="card">
          <div class="sect-title"><h2>PM Deposit (manual)</h2></div>
          <div class="grid grid-3-md">
            <div><label for="pm_dep_coins">Coins</label><div class="field"><input id="pm_dep_coins" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_1s">$1s</label><div class="field"><input id="pm_dep_1s" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_5s">$5s</label><div class="field"><input id="pm_dep_5s" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_10s">$10s</label><div class="field"><input id="pm_dep_10s" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_20s">$20s</label><div class="field"><input id="pm_dep_20s" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_50s">$50s</label><div class="field"><input id="pm_dep_50s" type="number" step="0.01" /></div></div>
            <div><label for="pm_dep_100s">$100s</label><div class="field"><input id="pm_dep_100s" type="number" step="0.01" /></div></div>
            <div><label for="pm_cash_deposit_total">Cash Deposit (auto)</label><div class="field"><input id="pm_cash_deposit_total" type="number" readonly /></div></div>
          </div>
        </div>

        <!-- PM COMPUTED -->
        <div class="card">
          <div class="sect-title"><h2>PM Computed</h2><span id="pmCalcChip" class="badge">…</span></div>
          <div class="grid grid-3-md">
            <div><label for="pm_shift_total">PM Shift Total (Card + Cash Deposit)</label><div class="field"><input id="pm_shift_total" type="number" readonly /></div></div>
            <div><label for="pm_sales_total">PM Daily Sales (Actual)</label><div class="field"><input id="pm_sales_total" type="number" readonly /></div></div>
            <div><label for="pm_mishandled_cash">PM Mishandled Cash</label><div class="field"><input id="pm_mishandled_cash" type="number" readonly /></div></div>
          </div>
        </div>
      </section>

      <!-- TIP CLAIM (inside Shift Sales; required) -->
      <section id="salesTipClaim" aria-label="Tip Claim (Shift Sales)">
        <div class="card">
          <div class="sect-title"><h2>Tip Claim</h2><span class="badge">required</span></div>
          <div class="grid grid-3-md">
            <div>
              <label for="sales_tc_cc_tips">Claimed CC Tips</label>
              <div class="field"><input id="sales_tc_cc_tips" type="number" step="0.01" inputmode="decimal" placeholder="0.00" /></div>
            </div>
            <div>
              <label for="sales_tc_cash_tips">Claimed Cash Tips</label>
              <div class="field"><input id="sales_tc_cash_tips" type="number" step="0.01" inputmode="decimal" placeholder="0.00" /></div>
            </div>
            <div>
              <label for="sales_tc_notes">Notes to the office</label>
              <div class="field"><input id="sales_tc_notes" type="text" placeholder="Optional details" /></div>
            </div>
          </div>
          <div class="hint mt-8">Remember to claim the ACTUAL amount you are taking home.</div>
        </div>
      </section>
    </section>

    <!-- ===== TIP CLAIM FORM (standalone) ===== -->
    <section id="tipForm" aria-label="Tip Claim" style="display:none">
      <div class="card grid grid-2-md">
        <div>
          <label for="tc_firstName">First name</label>
          <div class="field"><input id="tc_firstName" type="text" autocomplete="given-name" placeholder="e.g., Ava" /></div>
        </div>
        <div>
          <label for="tc_lastName">Last name</label>
          <div class="field"><input id="tc_lastName" type="text" autocomplete="family-name" placeholder="e.g., Lee" /></div>
        </div>
        <div>
          <label for="tc_store">Store</label>
          <div class="field">
            <select id="tc_store">
              <option value="">Choose location…</option>
              <option>Huffman</option>
              <option>Boniface</option>
              <option>Muldoon</option>
              <option>Lake Otis</option>
              <option>Camelot</option>
            </select>
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label for="tc_date">Date</label>
            <div class="field"><input id="tc_date" type="date" /></div>
          </div>
          <div>
            <label for="tc_time">Time</label>
            <div class="field"><input id="tc_time" type="time" step="60" /></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="grid grid-2-md">
          <div>
            <label for="tc_cc_tips">Claimed CC Tips</label>
            <div class="field"><input id="tc_cc_tips" type="number" step="0.01" inputmode="decimal" placeholder="0.00" /></div>
          </div>
          <div>
            <label for="tc_cash_tips">Claimed Cash Tips</label>
            <div class="field"><input id="tc_cash_tips" type="number" step="0.01" inputmode="decimal" placeholder="0.00" /></div>
          </div>
        </div>
        <div class="hint mt-8">This records what you are actually taking home.</div>
      </div>
    </section>
  </div>

  <!-- Sticky submit -->
  <div class="sticky" role="region" aria-label="Submit Bar">
    <div class="bar">
      <span id="saveHint" class="muted">Ready</span>
      <div class="row">
        <button id="recalcBtn" class="btn btn-ghost" type="button">Recalculate</button>
        <button id="submitBtn" class="btn btn-grad" type="button" disabled>Submit</button>
      </div>
    </div>
  </div>

  <!-- OCR library -->
  <script src="https://unpkg.com/tesseract.js@5.0.5/dist/tesseract.min.js"></script>
  <!-- App logic -->
  <script src="app.js"></script>
</body>
</html>
