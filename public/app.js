/*
  Finance Memorandum Generator V2
  - Apple-style tab UI
  - Repeaters for dynamic sections
  - Only filled fields render into PDF
  - Prefills Legal + Recommendation wording extracted from reference PDF (editable)
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const statusEl = $('#status');
function setStatus(text, kind = 'info') {
  statusEl.hidden = !text;
  statusEl.textContent = text || '';
  statusEl.dataset.kind = kind;
}

// Tabs
const segButtons = $$('.seg');
const tabs = $$('.tab');
function openTab(name) {
  segButtons.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  tabs.forEach(t => (t.hidden = t.dataset.tab !== name));
}
segButtons.forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));

// Repeatable state
const state = {
  parties: [],
  execSummary: [],
  presales: [],
  lots: [],
  feasibility: [],
  funding: [],
  security: [],
  borrowers: [],
  companyAssets: [],
  companyLiabilities: []
};

function rowHasAnyValue(obj) {
  return Object.values(obj).some(v => String(v ?? '').trim().length > 0);
}

function getTpl(id) {
  const tpl = document.getElementById(id);
  if (!tpl) throw new Error(`Missing template: ${id}`);
  return tpl;
}

function renderRepeater(type) {
  const map = {
    parties: { list: '#partiesList', tpl: 'tplPartiesRow', blank: { name: '', role: '', entityType: '' } },
    // NOTE: Template id in index.html is tplExecSummaryRow (not tplExecRow)
    execSummary: { list: '#execSummaryList', tpl: 'tplExecSummaryRow', blank: { key: '', value: '' } },
    presales: { list: '#presalesList', tpl: 'tplPresalesRow', blank: { buyer: '', lot: '', price: '', deposit: '', status: '' } },
    lots: { list: '#lotsList', tpl: 'tplLotsRow', blank: { stage: '', lot: '', size: '', price: '', status: '' } },
    feasibility: { list: '#feasibilityList', tpl: 'tplFeasibilityRow', blank: { group: '', label: '', amount: '', notes: '' } },
    // NOTE: Template id in index.html is tplFundingRow (not tplSimpleRow)
    funding: { list: '#fundingList', tpl: 'tplFundingRow', blank: { label: '', amount: '' } },
    security: { list: '#securityList', tpl: 'tplSecurityRow', blank: { name: '', details: '' } },
    borrowers: { list: '#borrowersList', tpl: 'tplBorrowersRow', blank: { name: '', entityType: '', abn: '', role: '', address: '', notes: '' } },
    // NOTE: Template id in index.html is tplCompanyRow (not tplSimpleRow)
    companyAssets: { list: '#companyAssetsList', tpl: 'tplCompanyRow', blank: { label: '', amount: '' } },
    companyLiabilities: { list: '#companyLiabilitiesList', tpl: 'tplCompanyRow', blank: { label: '', amount: '' } },
  };
  const cfg = map[type];
  if (!cfg) return;

  const container = $(cfg.list);
  container.innerHTML = '';

  const tpl = getTpl(cfg.tpl);

  state[type].forEach((row, idx) => {
    const node = tpl.content.firstElementChild.cloneNode(true);

    // Bind inputs
    $$('[data-k]', node).forEach(input => {
      const k = input.getAttribute('data-k');
      input.value = row[k] ?? '';
      input.addEventListener('input', () => {
        state[type][idx][k] = input.value;
      });
    });

    // Remove
    const removeBtn = $('[data-remove]', node);
    removeBtn.addEventListener('click', () => {
      state[type].splice(idx, 1);
      renderRepeater(type);
    });

    container.appendChild(node);
  });
}

function addRow(type) {
  if (type === 'guarantors') return; // guarantors handled separately
  const blankMap = {
    parties: { name: '', role: '', entityType: '' },
    execSummary: { key: '', value: '' },
    presales: { buyer: '', lot: '', price: '', deposit: '', status: '' },
    lots: { stage: '', lot: '', size: '', price: '', status: '' },
    feasibility: { group: '', label: '', amount: '', notes: '' },
    funding: { label: '', amount: '' },
    security: { name: '', details: '' },
    borrowers: { name: '', entityType: '', abn: '', role: '', address: '', notes: '' },
    companyAssets: { label: '', amount: '' },
    companyLiabilities: { label: '', amount: '' },
  };
  const blank = blankMap[type];
  if (!blank) return;
  state[type].push({ ...blank });
  renderRepeater(type);
}

// Guarantors are special: min 1, max 10, includes bio
state.guarantors = [{ fullName: '', relationship: '', netWorth: '', bio: '' }];
function renderGuarantors() {
  const container = $('#guarantorsList');
  container.innerHTML = '';
  const tpl = getTpl('tplGuarantorsRow');

  state.guarantors.forEach((row, idx) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    $$('[data-k]', node).forEach(input => {
      const k = input.getAttribute('data-k');
      input.value = row[k] ?? '';
      input.addEventListener('input', () => {
        state.guarantors[idx][k] = input.value;
      });
    });

    $('[data-remove]', node).addEventListener('click', () => {
      if (state.guarantors.length <= 1) {
        state.guarantors[0] = { fullName: '', relationship: '', netWorth: '', bio: '' };
      } else {
        state.guarantors.splice(idx, 1);
      }
      renderGuarantors();
    });

    container.appendChild(node);
  });
}
function addGuarantor() {
  if (state.guarantors.length >= 10) {
    setStatus('Guarantors max is 10.', 'warn');
    return;
  }
  state.guarantors.push({ fullName: '', relationship: '', netWorth: '', bio: '' });
  renderGuarantors();
}

// Wire add buttons
$$('[data-add]').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.add;
    if (t === 'guarantors') return addGuarantor();
    addRow(t);
  });
});

// Initial render
renderRepeater('parties');
renderRepeater('execSummary');
renderRepeater('presales');
renderRepeater('lots');
renderRepeater('feasibility');
renderRepeater('funding');
renderRepeater('security');
renderRepeater('borrowers');
renderRepeater('companyAssets');
renderRepeater('companyLiabilities');
renderGuarantors();

// Prefill reference wording extracted from PDF (editable)
(function prefillDefaults() {
  const f = $('#form');
  const setIfEmpty = (name, value) => {
    const el = f.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!el) return;
    if ((el.value ?? '').trim() === '') el.value = value;
  };

  // From reference PDF page 3 + page 24 (editable defaults)
  setIfEmpty('legal.confidentialityHeading', 'CONFIDENTIALITY & DISCLAIMER');
  setIfEmpty('legal.contactName', 'Andrew West');
  setIfEmpty('legal.contactEmail', 'awest@globalcapital.com.au');
  setIfEmpty('legal.contactPhone', '0450 051 415');

  setIfEmpty('legal.confidentialityBody', `This Finance Memorandum (“FM”) has been prepared by Global Capital Corporation in its capacity as mandated finance facilitator for Warra Project Pty Ltd and related entities as outlined within this document “Borrower” to prospective financiers (“Recipient”) on the express understanding that the contents will be regarded and treated as strictly confidential.

All communication and enquiries should be directed to:

▸ Global Capital Commercial
▸ Level 43, Governor Philip Tower,
  1 Farrer Place, Sydney NSW 2000, Australia
▸ Telephone (+61 2) 9222 9100

The contents of this FM and all information relating to the “Borrower” and the subject property/s outlined in this Finance Memorandum or arrangements surrounding which is not public knowledge (“Information”), is confidential and must not be disclosed by the Recipient of the Information to any person except on a need to know basis to:

▸ Its employees;
▸ Its consultants and,
▸ Persons who have or may have an immediate association with the Recipient in relation to the Project.

The Recipient must ensure that the persons referred to above are aware and comply with these confidentiality requirements. If requested by Global Capital Corporation, the Recipient must return all Information in the possession of the Recipient and the persons referred to above. The Recipient may be required to sign a confidentiality deed.

The information contained in the FM is only intended as a summary to the Recipient and should not be regarded as a complete assessment.

This FM has been prepared without any actual, or implied, knowledge or consideration as to the investment objectives, financial situation, taxation position or other particular needs, or requirements of the Recipient. Should the Recipient intend to participate in the proposed arrangements, it may not rely on this FM, Global Capital Corporation or any person associated with Global Capital Corporation and should make its own independent assessment and investigation of the proposed arrangements and of the Project as it considers necessary, including, without limitation, seeking professional advice.`);

  setIfEmpty('legal.disclaimerBody', `The Recipient must base any decision it may make and any determination as to the relevance of any information contained in this FM upon that assessment, investigation and / or advice. This FM is not, nor should be construed as, a recommendation by Global Capital Corporation or any of its affiliates, or any of its affiliates' officers, agents or employees to participate in the proposed arrangements.

Global Capital Corporation has prepared this FM with reasonable care but does not represent or warrant that the information in this FM is correct or complete. Neither Global Capital Corporation nor any Global Capital Corporation Associate is liable (whether at law, in equity, under statute or otherwise) for any statement made or anything contained in or arising out of the information contained within this FM, including without limitation, any errors, misrepresentations or omissions.

No person has been authorised to give any information (other than as contained in this FM), or make any representation, or warranty in connection with the proposed arrangements on behalf of the “Borrower” or any “Borrower” Associate and any such information, representation or warranty should not be relied on as having been authorised by Global Capital Corporation or any Global Capital Corporation Associate.

The Recipient should take its own legal and other advice regarding its obligations under this Disclaimer.

Should the Recipient decide against participating in the proposed arrangement, the recipient is required to return this FM to Global Capital Corporation immediately and to destroy all material prepared from and/or containing any information from this FM.

No party assumes any responsibility to update this FM in any respect.

All amounts referred to in this FM are in Australian dollars.`);

  setIfEmpty('recommendation.heading', 'RECOMMENDATION');
  setIfEmpty('recommendation.body', `Recommended for approval

Yours truly,

Andrew West
Global Capital Commercial`);
  setIfEmpty('recommendation.annexuresHeading', 'ANNEXURES');
  setIfEmpty('recommendation.annexuresIntro', 'In support of this application please find attached the following documents:');
  setIfEmpty('recommendation.annexuresList', `(1) Valuation Report
(2) QS report
(3) Construction contract`);

  // Footer line from reference
  setIfEmpty('footers.confidentiality', 'This document is strictly private & confidential and the property of Global Capital Commercial');
})();

function getScalarPayload() {
  const form = $('#form');
  const payload = {
    meta: {},
    cover: {},
    loan: {},
    proposal: {},
    salesMarketing: {},
    property: {},
    funding: {},
    security: {},
    professionalContacts: { solicitor: {}, accountant: {} },
    legal: {},
    recommendation: {},
    footers: {},

    partiesToLoan: [],
    execSummary: [],
    presales: [],
    lots: [],
    feasibilityRows: [],
    borrowers: [],
    guarantors: [],
    financials: { companyAssets: [], companyLiabilities: [], individuals: [] },
  };

  // Scalars
  const named = $$('[name]', form).filter(el => el.type !== 'file');
  for (const el of named) {
    const name = el.getAttribute('name');
    const value = (el.value || '').trim();
    if (!value) continue;

    const [root, key, subkey] = name.split('.');
    if (!root || !key) continue;

    if (subkey) {
      payload[root] = payload[root] || {};
      payload[root][key] = payload[root][key] || {};
      payload[root][key][subkey] = value;
    } else {
      payload[root] = payload[root] || {};
      payload[root][key] = value;
    }
  }

  // Arrays
  payload.partiesToLoan = state.parties.filter(rowHasAnyValue);
  payload.execSummary = state.execSummary.filter(r => (r.key || '').trim() && (r.value || '').trim());
  payload.presales = state.presales.filter(rowHasAnyValue);
  payload.lots = state.lots.filter(rowHasAnyValue);
  payload.feasibilityRows = state.feasibility.filter(rowHasAnyValue);
  payload.funding.rows = state.funding.filter(rowHasAnyValue);
  payload.security.rows = state.security.filter(rowHasAnyValue);
  payload.borrowers = state.borrowers.filter(rowHasAnyValue);
  payload.guarantors = state.guarantors.filter(rowHasAnyValue);

  payload.financials.companyAssets = state.companyAssets.filter(rowHasAnyValue);
  payload.financials.companyLiabilities = state.companyLiabilities.filter(rowHasAnyValue);

  // Individuals A&L textarea parser
  const rawEl = $('#individualFinancialsRaw');
  const raw = (rawEl ? rawEl.value : '').trim();
  if (raw) {
    const blocks = raw.split(/\n\s*\n+/);
    for (const block of blocks) {
      const lines = block.split(/\n/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const nameLine = lines.shift();
      const name = nameLine.replace(/^Name\s*:\s*/i, '').trim();
      const rows = [];
      for (const line of lines) {
        // label|amount|type
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 2) continue;
        rows.push({ label: parts[0], amount: parts[1], type: parts[2] || '' });
      }
      if (name || rows.length) payload.financials.individuals.push({ name, rows, notes: '' });
    }
  }

  return payload;
}

async function generatePdf() {
  try {
    setStatus('Generating PDF…', 'info');

    const form = $('#form');
    const fd = new FormData();

    const payload = getScalarPayload();
    fd.append('payload', JSON.stringify(payload));

    const coverFile = form.querySelector('input[name="coverImage"]').files?.[0];
    const logoFile = form.querySelector('input[name="logo"]').files?.[0];
    const footerLogoFile = form.querySelector('input[name="footerLogo"]').files?.[0];
    const propFiles = Array.from(form.querySelector('input[name="propertyImages"]').files || []).slice(0, 6);

    if (coverFile) fd.append('coverImage', coverFile);
    if (logoFile) fd.append('logo', logoFile);
    if (footerLogoFile) fd.append('footerLogo', footerLogoFile);
    for (const f of propFiles) fd.append('propertyImages', f);

    const res = await fetch('/api/generate', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setStatus('PDF generated.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus(e.message || 'Failed to generate PDF', 'err');
  }
}

$('#btnGenerate').addEventListener('click', generatePdf);

$('#btnReset').addEventListener('click', () => {
  $('#form').reset();

  for (const k of Object.keys(state)) state[k] = [];
  state.guarantors = [{ fullName: '', relationship: '', netWorth: '', bio: '' }];

  renderRepeater('parties');
  renderRepeater('execSummary');
  renderRepeater('presales');
  renderRepeater('lots');
  renderRepeater('feasibility');
  renderRepeater('funding');
  renderRepeater('security');
  renderRepeater('borrowers');
  renderRepeater('companyAssets');
  renderRepeater('companyLiabilities');
  renderGuarantors();

  setStatus('', 'info');
  openTab('cover');
});

$('#btnLoadSample').addEventListener('click', () => {
  const f = $('#form');
  const set = (name, value) => {
    const el = f.querySelector(`[name="${CSS.escape(name)}"]`);
    if (el) el.value = value;
  };

  set('meta.referenceNumber', 'PRP.17213');
  set('meta.memoTitle', 'Finance Memorandum');
  set('meta.preparedFor', 'Prospective Financier');
  set('meta.preparedBy', 'Global Capital Commercial');
  set('meta.date', '12 January 2026');

  set('cover.headline', 'Construction Finance');
  set('cover.subheadline', 'Industrial Land Subdivision');

  set('loan.loanAmount', '$50,000,000');
  set('loan.purpose', 'To refinance current facilities, and to allow for the construction of a 28 lot industrial sub division');
  set('loan.loanType', 'Interest Only - Capitalised for the term');
  set('loan.lvr', '73% based on GRV (Ex GST) and also limited to 88% of TDC');
  set('loan.term', '12 months comprising 9 months construction period plus 3 months');
  set('loan.securityType', 'Industrial Land subdivision');
  set('loan.securityLocation', '19 Production Ave & 47-49 Farnsworth Ave Warragamba NSW 2752');
  set('loan.creditReports', 'Clear with nothing adverse');
  set('loan.anticipatedSettlement', 'Mid March 2025');
  set('loan.exitStrategy', 'Sale of completed project');

  set('property.address', '19 Production Ave & 47-49 Farnsworth Ave Warragamba NSW 2752');

  state.execSummary = [
    { key: 'BORROWER', value: 'Warra Project Pty Ltd' },
    { key: 'GCC REFERENCE NO', value: 'PRP.17213' },
    { key: 'TYPE OF BORROWER', value: 'Private Company' },
    { key: 'LOAN AMOUNT', value: '$50,000,000' },
    { key: 'LOAN PURPOSE', value: 'To refinance current facilities, and to allow for the construction of a 28 lot industrial sub division' },
    { key: 'LOAN TYPE', value: 'Interest Only - Capitalised for the term' },
    { key: 'LVR', value: '73% based on GRV (Ex GST) and also limited to 88% of TDC' },
    { key: 'LOAN TERM', value: '12 months comprising 9 months construction period plus 3 months' },
    { key: 'SECURITY TYPE', value: 'Industrial Land subdivision' },
    { key: 'SECURITY LOCATION', value: '19 Production Ave & 47-49 Farnsworth Ave Warragamba NSW 2752' },
    { key: 'CREDIT REPORTS', value: 'Clear with nothing adverse' },
    { key: 'ANTICIPATED SETTLEMENT', value: 'Mid March 2025' },
    { key: 'EXIT STRATEGY', value: 'Sale of completed project' },
  ];

  state.parties = [
    { name: 'Warra Project Pty Ltd', role: 'Borrower', entityType: 'Company' },
  ];

  state.guarantors = [
    { fullName: 'Andrew West', relationship: 'Director', netWorth: '', bio: '' }
  ];

  renderRepeater('execSummary');
  renderRepeater('parties');
  renderGuarantors();

  setStatus('Sample loaded. Upload images if you want them on the PDF.', 'ok');
});
