const API_URL = "https://script.google.com/macros/s/AKfycbyY8u1MvDYUNDDeprNBFCMWGRi4tiSJHdNcGSzVfBITZlBk0EcBlU3r4erLTkbn3ijLKQ/exec"; // Apana Web App URL yahan daalein
let rawData = [];
let p1Table;
let selectedTimeMode = 'today';
let autoSyncTimer = null;

// CREDENTIALS CONFIGURATION
const VALID_USER = "admin";
const VALID_PASS = "rto123";

$(document).ready(function() {
  // Silent background fetch starts immediately when login page appears
  loadDataSilent();
  
  // Check active session
  if (sessionStorage.getItem("rto_logged_in") === "true") {
    $("#loginOverlay").hide();
    $("#userHeaderControls").attr("style", "display: flex !important");
    $("#portalMainContent").show();
    startAutoSync();
  }
});

function handleLogin(e) {
  e.preventDefault();
  const u = $("#loginUser").val().trim();
  const p = $("#loginPass").val().trim();

  if (u === VALID_USER && p === VALID_PASS) {
    sessionStorage.setItem("rto_logged_in", "true");
    $("#loginOverlay").fadeOut();
    $("#userHeaderControls").attr("style", "display: flex !important");
    $("#portalMainContent").fadeIn();
    initPortal();
    startAutoSync();
  } else {
    $("#loginError").show();
  }
}

function handleLogout() {
  sessionStorage.removeItem("rto_logged_in");
  clearInterval(autoSyncTimer);
  location.reload();
}

async function loadDataSilent() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    
    if (Array.isArray(json)) {
      rawData = json;
    } else if (json && Array.isArray(json.data)) {
      rawData = json.data;
    }

    if (sessionStorage.getItem("rto_logged_in") === "true") {
      initPortal();
    }
    $("#syncBadge").html('<i class="bi bi-check-circle-fill text-success"></i> Live Sync Active');
  } catch(e) {
    console.error("Silent Fetch Error", e);
  }
}

function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  // Silent auto-fetch every 10 seconds without disturbing user UI
  autoSyncTimer = setInterval(() => {
    loadDataSilent();
  }, 10000);
}

function showMainDashboard() {
  $("#page1, #page2, #page3").hide();
  $("#moduleNavBar").hide();
  $("#mainDashboardPage").fadeIn();
}

function switchPage(pageId) {
  $("#mainDashboardPage").hide();
  $("#moduleNavBar").show();
  $(".page-nav-btn").removeClass("btn-primary").addClass("btn-outline-primary");
  
  $("#page1, #page2, #page3").hide();
  $("#" + pageId).fadeIn();

  if (pageId === 'page1') $("#btnNavPage1").removeClass("btn-outline-primary").addClass("btn-primary");
  if (pageId === 'page2') $("#btnNavPage2").removeClass("btn-outline-primary").addClass("btn-primary");
  if (pageId === 'page3') $("#btnNavPage3").removeClass("btn-outline-primary").addClass("btn-primary");
}

function initPortal() {
  populateP1Dropdowns();
  populateP2Dropdowns();
  applyPage1Filters();
  applyPage2Filters();
  calculateOverviewCards();
}

/* Pipeline Start Date Normalizer */
function parsePipelineDate(str) {
  if (!str) return '';
  let clean = str.toString().trim().split(' ')[0];
  if (clean.includes('-') || clean.includes('/')) {
    let parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

/* PAGE 1 FILTERS */
function populateP1Dropdowns() {
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
  const selectedPipelineDate = $('#p1PipelineDateFilter').val();
  const selectedDevice = $('#p1DeviceFilter').val();
  const selectedRemark = $('#p1RemarkFilter').val();

  const filtered = rawData.filter(item => {
    const rtoVal = item.project_name || item.project || '';
    const rtoMatch = selectedRto === 'ALL' || rtoVal === selectedRto;

    let dateMatch = true;
    if (selectedPipelineDate) {
      const itemParsed = parsePipelineDate(item.pipeline_start);
      dateMatch = itemParsed === selectedPipelineDate;
    }

    const devMatch = selectedDevice === 'ALL' || item.device_name === selectedDevice;
    const remVal = item.certificate_remarks || item.stage || '';
    const remMatch = selectedRemark === 'ALL' || remVal.toLowerCase().trim() === selectedRemark.toLowerCase().trim();

    return rtoMatch && dateMatch && devMatch && remMatch;
  });

  renderP1Table(filtered);
}

function resetPage1Filters() {
  $('#p1RtoFilter').val('ALL');
  $('#p1PipelineDateFilter').val('');
  $('#p1DeviceFilter').val('ALL');
  $('#p1RemarkFilter').val('ALL');
  applyPage1Filters();
}

function renderP1Table(data) {
  if (p1Table) p1Table.destroy();
  const tbody = $('#p1DataTable tbody').empty();

  data.forEach(row => {
    const remark = row.certificate_remarks || row.stage || 'N/A';
    const tr = `<tr>
      <td>${row.project_name || row.project || 'N/A'}</td>
      <td>${row.operator_name || 'N/A'}</td>
      <td class="fw-bold">${row.vehicle_number || 'N/A'}</td>
      <td>${row.device_name || 'N/A'}</td>
      <td>${row.dept || 'N/A'}</td>
      <td>${row.month || 'N/A'}</td>
      <td>${row.stage || 'N/A'}</td>
      <td class="fw-bold text-primary">${row.pipeline_start || 'N/A'}</td>
      <td>${row.project || 'N/A'}</td>
      <td>${remark}</td>
      <td>${row.timestamp || 'N/A'}</td>
      <td>${row.date || 'N/A'}</td>
      <td>${row.remark_date || 'N/A'}</td>
      <td>${row.remark_time || 'N/A'}</td>
    </tr>`;
    tbody.append(tr);
  });

  p1Table = $('#p1DataTable').DataTable({ pageLength: 10, deferRender: true, bDestroy: true });
}

/* PAGE 2 FILTERS & REPORT ENGINE */
function populateP2Dropdowns() {
  const devSet = new Set(rawData.map(d => d.device_name).filter(Boolean));
  const devSel = $('#p2DeviceFilter').empty().append('<option value="ALL">All Devices</option>');
  devSet.forEach(d => devSel.append(`<option value="${d}">${d}</option>`));
}

function setTimeMode(mode, btn) {
  selectedTimeMode = mode;
  $(btn).siblings().removeClass('active');$(btn).addClass('active');
  applyPage2Filters();
}

function applyPage2Filters() {
  const customDateText = $('#p2CustomDate').val().trim().toLowerCase();
  const targetDevice = $('#p2DeviceFilter').val();
  const targetRemark = $('#p2RemarkFilter').val();

  $('#p2TableColHeader').text(targetRemark === 'ALL' ? 'Total Records' : targetRemark);

  const rtoCounts = {};
  let team1Count = 0, team2Count = 0, team3Count = 0, grandTotal = 0;

  const now = new Date();

  rawData.forEach(item => {
    const rto = item.project_name || item.project || 'OTHER_RTO';
    const dept = (item.dept || '').toLowerCase().trim();
    const remVal = (item.certificate_remarks || item.stage || '').toLowerCase().trim();
    const devVal = item.device_name || '';

    // Device Filter
    if (targetDevice !== 'ALL' && devVal !== targetDevice) return;

    // Remark Filter
    if (targetRemark !== 'ALL' && !remVal.includes(targetRemark.toLowerCase())) return;

    // Custom Any-Format Date Filter
    if (customDateText) {
      const fullItemDateStr = `${item.date} ${item.remark_date} ${item.pipeline_start} ${item.timestamp}`.toLowerCase();
      if (!fullItemDateStr.includes(customDateText)) return;
    } else {
      // Time Interval Mode Filter
      const rawDateStr = item.date || item.pipeline_start || item.timestamp;
      const d = new Date(rawDateStr);
      if (!isNaN(d.getTime())) {
        if (selectedTimeMode === 'today' && d.toDateString() !== now.toDateString()) return;
        if (selectedTimeMode === 'week') {
          const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return;
        }
        if (selectedTimeMode === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return;
        if (selectedTimeMode === 'year' && d.getFullYear() !== now.getFullYear()) return;
      }
    }

    if (!rtoCounts[rto]) rtoCounts[rto] = 0;
    rtoCounts[rto]++;
    grandTotal++;

    if (dept.includes('rajshekhar') || dept.includes('raghav') || dept.includes('lakshya')) team1Count++;
    else if (dept.includes('vikash')) team2Count++;
    else if (dept.includes('sonu')) team3Count++;
  });

  const tbody = $('#p2RtoTableBody').empty();
  Object.keys(rtoCounts).sort().forEach(rto => {
    tbody.append(`<tr><td>${rto}</td><td>${rtoCounts[rto]}</td></tr>`);
  });

  $('#p2TableTotalVal').text(grandTotal);
  $('#p2GrandTotalBox').text(grandTotal);
  $('#p2Team1Val').text(team1Count);
  $('#p2Team2Val').text(team2Count);
  $('#p2Team3Val').text(team3Count);
}

function calculateOverviewCards() {
  const now = new Date();
  let mTotal = 0, wTotal = 0, yTotal = 0;

  rawData.forEach(item => {
    const d = new Date(item.date || item.pipeline_start || item.timestamp);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === now.getFullYear()) {
        yTotal++;
        if (d.getMonth() === now.getMonth()) mTotal++;
        const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) wTotal++;
      }
    }
  });

  $('#cardMonthTotal').text(mTotal);
  $('#cardWeekTotal').text(wTotal);
  $('#cardYearTotal').text(yTotal);
}

/* PAGE 3 VEHICLE SEARCH */
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
      <div class="gov-card p-3 mb-3 border-start border-4 border-navy">
        <h5 class="fw-bold text-navy mb-2">${item.vehicle_number || 'N/A'} <span class="badge bg-secondary ms-2">${item.project_name || 'RTO'}</span></h5>
        <div class="row g-2 small">
          <div class="col-md-3"><strong>Operator:</strong> ${item.operator_name || 'N/A'}</div>
          <div class="col-md-3"><strong>Device:</strong> ${item.device_name || 'N/A'}</div>
          <div class="col-md-3"><strong>Dept:</strong> ${item.dept || 'N/A'}</div>
          <div class="col-md-3"><strong>Pipeline Start:</strong> ${item.pipeline_start || 'N/A'}</div>
          <div class="col-md-3"><strong>Remark:</strong> ${item.certificate_remarks || item.stage || 'N/A'}</div>
        </div>
      </div>
    `);
  });
}
