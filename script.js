const API_URL = "https://script.google.com/macros/s/AKfycbwdAXJaJQBKdN6G2SYawhHrs2ETUTUaUnC2cmsfFBN_MIEYFGS1wsYGdmaRJ6w2_DSOBQ/exec"; // Put your Web App URL here
let rawData = [];
let p1Table;
let selectedTimeMode = 'today';

async function loadData(force = false) {
  $("#loader").css("display", "flex");

  const cached = localStorage.getItem("common_rto_cache_v7");
  if (cached && !force) {
    try {
      rawData = JSON.parse(cached);
      if (Array.isArray(rawData) && rawData.length > 0) {
        initPortal();
        $("#loader").fadeOut();
        return;
      }
    } catch(e) {
      localStorage.removeItem("common_rto_cache_v7");
    }
  }

  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    
    // Fail-safe handling for direct or wrapped array response
    if (Array.isArray(json)) {
      rawData = json;
    } else if (json && Array.isArray(json.data)) {
      rawData = json.data;
    } else {
      rawData = [];
    }

    if (rawData.length > 0) {
      localStorage.setItem("common_rto_cache_v7", JSON.stringify(rawData));
      initPortal();
    }
  } catch(e) {
    console.error("Fetch Error:", e);
  } finally {
    $("#loader").fadeOut();
  }
}

function switchPage(pageId, btn) {
  $('.nav-tab-btn').removeClass('active');
  $(btn).addClass('active');$('#page1, #page2, #page3').hide();
  $('#' + pageId).fadeIn();
}

function initPortal() {
  populateP1FilterDropdowns();
  populateP2RemarkDropdown();
  applyPage1Filters();
  applyPage2Filters();
}

function normalizeDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return str;
}

/* PAGE 1 LOGIC */
function populateP1FilterDropdowns() {
  const rtoSet = new Set(rawData.map(d => d.project_name || d.project).filter(Boolean));
  const devSet = new Set(rawData.map(d => d.device_name).filter(Boolean));
  const remSet = new Set(rawData.map(d => d.certificate_remarks || d.stage).filter(Boolean));

  const rtoSel = $('#p1RtoFilter').empty().append('<option value="ALL">All RTOs</option>');
  rtoSet.forEach(r => rtoSel.append(`<option value="${r}">${r}</option>`));

  const devSel = $('#p1DeviceFilter').empty().append('<option value="ALL">All Devices</option>');
  devSet.forEach(d => devSel.append(`<option value="${d}">${d}</option>`));

  const remSel = $('#p1RemarkFilter').empty().append('<option value="ALL">All Remarks / Stages</option>');
  remSet.forEach(r => remSel.append(`<option value="${r}">${r}</option>`));
}

function applyPage1Filters() {
  const selectedRto = $('#p1RtoFilter').val();
  const selectedDate = $('#p1DateFilter').val();
  const selectedDevice = $('#p1DeviceFilter').val();
  const selectedRemark = $('#p1RemarkFilter').val();

  const filtered = rawData.filter(item => {
    const rtoVal = item.project_name || item.project || '';
    const rtoMatch = selectedRto === 'ALL' || rtoVal === selectedRto;

    let dateMatch = true;
    if (selectedDate) {
      const itemDateParsed = normalizeDate(item.date || item.timestamp);
      dateMatch = itemDateParsed.includes(selectedDate);
    }

    const devMatch = selectedDevice === 'ALL' || item.device_name === selectedDevice;
    const remVal = item.certificate_remarks || item.stage || '';
    const remMatch = selectedRemark === 'ALL' || remVal === selectedRemark;

    return rtoMatch && dateMatch && devMatch && remMatch;
  });

  renderP1Table(filtered);
}

function resetPage1Filters() {
  $('#p1RtoFilter').val('ALL');
  $('#p1DateFilter').val('');
  $('#p1DeviceFilter').val('ALL');
  $('#p1RemarkFilter').val('ALL');
  applyPage1Filters();
}

function renderP1Table(data) {
  if (p1Table) p1Table.destroy();
  const tbody = $('#p1DataTable tbody').empty();

  data.forEach(row => {
    const remark = row.certificate_remarks || row.stage || 'N/A';
    const isIssued = remark.toLowerCase().includes('issued');
    
    const tr = `<tr>
      <td><span class="badge bg-primary bg-opacity-10 text-primary fw-bold">${row.project_name || row.project || 'N/A'}</span></td>
      <td>${row.operator_name || 'N/A'}</td>
      <td class="fw-bold text-dark">${row.vehicle_number || 'N/A'}</td>
      <td>${row.device_name || 'N/A'}</td>
      <td>${row.dept || 'N/A'}</td>
      <td>${row.month || 'N/A'}</td>
      <td><span class="badge bg-secondary">${row.stage || 'N/A'}</span></td>
      <td class="small text-muted">${row.pipeline_start || 'N/A'}</td>
      <td>${row.project || 'N/A'}</td>
      <td><span class="badge ${isIssued ? 'bg-success' : 'bg-warning text-dark'}">${remark}</span></td>
      <td class="small text-muted">${row.timestamp || 'N/A'}</td>
      <td class="small">${row.date || 'N/A'}</td>
      <td class="small">${row.remark_date || 'N/A'}</td>
      <td class="small">${row.remark_time || 'N/A'}</td>
    </tr>`;
    tbody.append(tr);
  });

  p1Table = $('#p1DataTable').DataTable({ pageLength: 10, deferRender: true });
}

/* PAGE 2 LOGIC */
function populateP2RemarkDropdown() {
  const remSet = new Set(rawData.map(d => d.certificate_remarks || d.stage).filter(Boolean));
  const remSel = $('#p2GlobalRemarkFilter').empty().append('<option value="Certificate Issued">Certificate Issued (Default)</option><option value="ALL">All Remarks Combined</option>');
  remSet.forEach(r => {
    if (r !== 'Certificate Issued') remSel.append(`<option value="${r}">${r}</option>`);
  });
}

function setTimeMode(mode, btn) {
  selectedTimeMode = mode;
  $(btn).siblings().removeClass('active');$(btn).addClass('active');
  applyPage2Filters();
}

function applyPage2Filters() {
  const customDate = $('#p2CustomDate').val();
  const targetRemark = $('#p2GlobalRemarkFilter').val();
  
  $('#p2TableColHeader').text(targetRemark === 'ALL' ? 'Total Records' : targetRemark);

  const rtoCounts = {};
  let team1Count = 0;
  let team2Count = 0;
  let team3Count = 0;
  let grandTotal = 0;

  rawData.forEach(item => {
    const rto = item.project_name || item.project || 'OTHER_RTO';
    if (!rtoCounts[rto]) rtoCounts[rto] = 0;

    if (customDate) {
      const itemDateParsed = normalizeDate(item.date || item.timestamp);
      if (!itemDateParsed.includes(customDate)) return;
    }

    const remVal = item.certificate_remarks || item.stage || '';
    const isMatched = targetRemark === 'ALL' || remVal.toLowerCase().includes(targetRemark.toLowerCase());

    if (isMatched) {
      rtoCounts[rto]++;
      grandTotal++;

      const dept = (item.dept || '').toLowerCase();
      if (dept.includes('rajshekhar') || dept.includes('raghav') || dept.includes('lakshya')) {
        team1Count++;
      } else if (dept.includes('vikash')) {
        team2Count++;
      } else if (dept.includes('sonu')) {
        team3Count++;
      }
    }
  });

  const tbody = $('#p2RtoTableBody').empty();
  Object.keys(rtoCounts).forEach(rto => {
    tbody.append(`
      <tr>
        <td class="bg-light">${rto}</td>
        <td>${rtoCounts[rto]}</td>
      </tr>
    `);
  });

  $('#p2TableTotalVal').text(grandTotal);
  $('#p2GrandTotalBox').text(grandTotal);
  $('#p2Team1Val').text(team1Count);
  $('#p2Team2Val').text(team2Count);
  $('#p2Team3Val').text(team3Count);
}

/* PAGE 3 SEARCH ENGINE */
function executeP3Search() {
  const rawQuery = $('#p3SearchInput').val().trim();
  const cleanQuery = rawQuery.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const resultsDiv = $('#p3SearchResults').empty();

  if (!cleanQuery) return;

  const matches = rawData.filter(item => {
    const vNoClean = (item.vehicle_number || '').replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return vNoClean.includes(cleanQuery);
  });

  matches.forEach(item => {
    resultsDiv.append(`
      <div class="rich-card p-4 mb-3 border-start border-4 border-primary">
        <h4 class="fw-bold text-primary mb-3">${item.vehicle_number || 'N/A'} (${item.project_name || 'RTO'})</h4>
        <div class="row g-3">
          <div class="col-md-3"><strong>Operator:</strong> ${item.operator_name || 'N/A'}</div>
          <div class="col-md-3"><strong>Device:</strong> ${item.device_name || 'N/A'}</div>
          <div class="col-md-3"><strong>Dept:</strong> ${item.dept || 'N/A'}</div>
          <div class="col-md-3"><strong>Remark:</strong> <span class="badge bg-success">${item.certificate_remarks || item.stage || 'N/A'}</span></div>
        </div>
      </div>
    `);
  });
}

$(document).ready(() => loadData());
