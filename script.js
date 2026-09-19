// =========================================================================
// GITHUB FRONTEND LOGIC & DATA ENGINE
// =========================================================================

// PASTE YOUR APPS SCRIPT WEB APP DEPLOYMENT URL HERE
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyhyg46WRcGuz13rXZwlMwaLLRdne4GS8mH1E6SB8W4T9TXr_brvY0zmEX_Ekcl6TWfKw/exec";

let globalMasterData = [];
let globalEmpMapping = {};

$(document).ready(function () {
  // Check Login Session
  if (sessionStorage.getItem("isLoggedIn") === "true") {
    showPortal();
  }

  // Login Form Submission
  $('#loginForm').submit(function (e) {
    e.preventDefault();
    const u = $('#loginUser').val();
    const p = $('#loginPass').val();

    fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`)
      .then(res => res.json())
      .then(res => {
        if (res.status === "success") {
          sessionStorage.setItem("isLoggedIn", "true");
          showPortal();
        } else {
          $('#loginAlert').removeClass('d-none').text(res.message);
        }
      })
      .catch(() => {
        $('#loginAlert').removeClass('d-none').text("Connection Error. Please check Web App URL.");
      });
  });

  // Real-time Master Table Filter Event Listeners
  $('#filterKeyword, #filterRto, #filterRemark, #filterEmp').on('input change', function () {
    renderMasterTable();
  });
});

function showPortal() {
  $('#loginScreen').addClass('d-none');
  $('#portalApp').removeClass('d-none');
  loadPortalData();
  setInterval(loadPortalData, 10000); // 10-Second Background Refresh
}

function logout() {
  sessionStorage.clear();
  window.location.reload();
}

function switchPage(pageId) {
  $('.page-view').addClass('d-none');$('#' + pageId).removeClass('d-none');
  $('.btn-nav').removeClass('active');$(event.currentTarget).addClass('active');
}

function loadPortalData() {
  if (!APPS_SCRIPT_WEB_APP_URL || APPS_SCRIPT_WEB_APP_URL.includes("YOUR_EXEC_ID_HERE")) {
    console.error("Please specify APPS_SCRIPT_WEB_APP_URL in script.js");
    return;
  }

  fetch(APPS_SCRIPT_WEB_APP_URL)
    .then(res => res.json())
    .then(res => {
      if (res.status !== "success") return;
      globalMasterData = res.masterData || [];
      globalEmpMapping = res.employeeMapping || {};

      populateFilterDropdowns();
      renderMasterTable();
      renderDashboard();
      renderThisMonthReport();
    });
}

// 1. PAGE 1: MASTER DATA TABLE & FILTERS
function populateFilterDropdowns() {
  const rtos = new Set(), emps = new Set();
  globalMasterData.forEach(item => {
    if (item['project_name']) rtos.add(item['project_name']);
    if (item['employee name']) emps.add(item['employee name']);
  });

  if ($('#filterRto children').length <= 1) {
    rtos.forEach(r => $('#filterRto').append(`<option value="${r}">${r}</option>`));
    emps.forEach(e => $('#filterEmp').append(`<option value="${e}">${e}</option>`));
  }
}

function renderMasterTable() {
  const kw = $('#filterKeyword').val().toLowerCase();
  const rto = $('#filterRto').val();
  const rem = $('#filterRemark').val();
  const emp = $('#filterEmp').val();

  if (globalMasterData.length === 0) return;

  // Build Table Headers
  const headers = Object.keys(globalMasterData[0]).filter(k => !k.startsWith('_'));
  let theadHtml = '<tr>' + headers.map(h => `<th class="text-uppercase">${h}</th>`).join('') + '</tr>';
  $('#masterTableHead').html(theadHtml);

  // Filter Data
  const filtered = globalMasterData.filter(item => {
    const matchKw = !kw || JSON.stringify(item).toLowerCase().includes(kw);
    const matchRto = !rto || item['project_name'] === rto;
    const matchEmp = !emp || item['employee name'] === emp;
    const remark = String(item['certificate team - remarks'] || '').toLowerCase();
    const matchRem = !rem || (rem === 'issued' ? remark.includes('issued') : !remark.includes('issued'));

    return matchKw && matchRto && matchEmp && matchRem;
  });

  // Build Body Rows
  const tbody = $('#masterTableBody').empty();
  if (filtered.length === 0) {
    tbody.append('<tr><td colspan="100%" class="py-4 text-muted">No matching records found.</td></tr>');
    return;
  }

  filtered.slice(0, 100).forEach(row => { // Limit to 100 rows for high performance
    let tr = '<tr>' + headers.map(h => `<td>${row[h] !== undefined ? row[h] : ''}</td>`).join('') + '</tr>';
    tbody.append(tr);
  });
}

function resetFilters() {
  $('#filterKeyword, #filterRto, #filterRemark, #filterEmp').val('');
  renderMasterTable();
}

// 2. PAGE 2: EXECUTIVE REPORT DASHBOARD
function renderDashboard() {
  const empCounts = {};
  let totalIssued = 0;

  globalMasterData.forEach(item => {
    const remark = String(item['certificate team - remarks'] || item['stage'] || '').toLowerCase();
    const empTag = String(item['employee name'] || '').trim();

    if (remark.includes('issued')) {
      totalIssued++;
      if (empTag) {
        if (empTag.toUpperCase() === 'HR_RTO') {
          const mappedEmps = [];
          Object.keys(globalEmpMapping).forEach(emp => {
            if ((globalEmpMapping[emp] || []).some(r => String(r).toUpperCase() === 'HR_RTO')) {
              mappedEmps.push(emp);
            }
          });
          const groupKey = mappedEmps.length > 0 ? mappedEmps.join(' / ') : 'HR_RTO';
          empCounts[groupKey] = (empCounts[groupKey] || 0) + 1;
        } else {
          empCounts[empTag] = (empCounts[empTag] || 0) + 1;
        }
      }
    }
  });

  $('#grandTotalIssued').text(totalIssued);
  const container = $('#employeeCardsContainer').empty();
  const teamKeys = Object.keys(empCounts).sort();
  $('#totalTeamCount').text(teamKeys.length + ' TEAMS');

  teamKeys.forEach(empName => {
    container.append(`
      <div class="col-12 col-md-6">
        <div class="emp-card d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold text-dark text-uppercase font-monospace">${empName}</div>
            <span class="text-muted small">Certificates Issued</span>
          </div>
          <div class="badge bg-success font-monospace px-3 py-2 fs-6">${empCounts[empName]}</div>
        </div>
      </div>
    `);
  });
}

function renderThisMonthReport() {
  const rtoStats = {};
  const currentMonthNum = (new Date().getMonth() + 1).toString();

  globalMasterData.forEach(item => {
    const rowMonth = String(item['month'] || '').trim();
    if (rowMonth === currentMonthNum || rowMonth.endsWith('-2026') || rowMonth === '9') {
      const rto = String(item['project_name'] || item['project'] || 'OTHER').trim();
      const remark = String(item['certificate team - remarks'] || '').toLowerCase();

      if (!rtoStats[rto]) rtoStats[rto] = { received: 0, issued: 0, pending: 0 };
      rtoStats[rto].received++;
      if (remark.includes('issued')) rtoStats[rto].issued++;
      else rtoStats[rto].pending++;
    }
  });

  const tbody = $('#monthSummaryTbody').empty();
  let totRec = 0, totIss = 0, totPen = 0;

  Object.keys(rtoStats).sort().forEach(rto => {
    const s = rtoStats[rto];
    const pct = s.received > 0 ? ((s.issued / s.received) * 100).toFixed(2) + '%' : '0.00%';
    totRec += s.received; totIss += s.issued; totPen += s.pending;

    tbody.append(`
      <tr>
        <td class="text-start ps-4">${rto}</td>
        <td>${s.received}</td>
        <td class="text-success">${s.issued}</td>
        <td class="text-primary">${pct}</td>
        <td class="text-danger">${s.pending}</td>
      </tr>
    `);
  });

  const grandPct = totRec > 0 ? ((totIss / totRec) * 100).toFixed(2) + '%' : '0.00%';
  $('#mTotReceived').text(totRec); $('#mTotIssued').text(totIss);
  $('#mTotPct').text(grandPct); $('#mTotPending').text(totPen);
}

// 3. PAGE 3: VEHICLE SEARCH ENGINE
function searchVehicle() {
  const query = $('#vehicleSearchInput').val().trim().toLowerCase();
  if (!query) return;

  const matches = globalMasterData.filter(item => JSON.stringify(item).toLowerCase().includes(query));
  const container = $('#vehicleResultContainer').removeClass('d-none');
  const body = $('#vehicleResultBody').empty();

  if (matches.length === 0) {
    body.append('<div class="text-center text-muted py-3">No record found for this vehicle number.</div>');
    return;
  }

  matches.forEach((item, idx) => {
    let html = `<div class="p-3 mb-3 bg-light rounded border"><h6 class="fw-bold text-warning">Record #${idx + 1}</h6><div class="row g-2 font-monospace small">`;
    Object.keys(item).forEach(k => {
      if (!k.startsWith('_')) {
        html += `<div class="col-6 col-md-4"><strong>${k}:</strong> ${item[k]}</div>`;
      }
    });
    html += '</div></div>';
    body.append(html);
  });
}
