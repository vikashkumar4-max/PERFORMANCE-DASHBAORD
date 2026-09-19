// =========================================================================
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP DEPLOYMENT URL HERE
// =========================================================================
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzehndLK4KpbwDEZ-t7w0XXF9vFTQ-0fRXA7k5KAMLT7lrK-bpNtpR24rDgbrs_HgowDw/exec";

let globalMasterData = [];
let globalEmpMapping = {};

$(document).ready(function () {
  // Initial Data Load
  loadPortalData();

  // 10-Second Silent Background Sync Loop
  setInterval(loadPortalData, 10000);
});

function loadPortalData() {
  if (!APPS_SCRIPT_WEB_APP_URL || APPS_SCRIPT_WEB_APP_URL.includes("YOUR_EXEC_ID_HERE")) {
    console.error("Please insert your valid Google Apps Script Web App Deployment URL in script.js");
    $('#monthSummaryTbody').html('<tr><td colspan="5" class="py-4 text-danger">Error: Web App URL missing in script.js</td></tr>');
    return;
  }

  // Fetching data from Apps Script via HTTP GET API Call
  fetch(APPS_SCRIPT_WEB_APP_URL)
    .then(response => response.json())
    .then(response => {
      if (!response || response.status === "error") {
        console.error("Portal Execution Error: ", response ? response.message : "No response");
        return;
      }

      globalMasterData = response.masterData || [];
      globalEmpMapping = response.employeeMapping || {};
      
      $('#lastSyncTime').text(response.lastRefreshed || new Date().toLocaleTimeString());
      
      renderDashboard();
      renderThisMonthReport();
    })
    .catch(err => {
      console.error("Background Sync Failure: ", err);
    });
}

// 1. EXECUTIVE TEAM PERFORMANCE CARDS & GRAND TOTAL RENDER
function renderDashboard() {
  const empCounts = {};
  let totalIssuedCount = 0;

  globalMasterData.forEach(item => {
    const remark = String(item['certificate team - remarks'] || item['stage'] || '').toLowerCase().trim();
    const empTag = String(item['employee name'] || '').trim();

    if (remark.includes('issued')) {
      totalIssuedCount++;

      if (empTag) {
        if (empTag.toUpperCase() === 'HR_RTO') {
          const mappedEmps = [];
          Object.keys(globalEmpMapping).forEach(emp => {
            const assignedRtos = globalEmpMapping[emp] || [];
            if (assignedRtos.some(r => String(r).toUpperCase() === 'HR_RTO')) {
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

  $('#grandTotalIssued').text(totalIssuedCount);

  const container = $('#employeeCardsContainer').empty();
  const teamKeys = Object.keys(empCounts).sort();
  $('#totalTeamCount').text(teamKeys.length + ' TEAMS');

  if (teamKeys.length === 0) {
    container.append('<div class="col-12 text-center text-muted py-3">No certificate issued records found.</div>');
    return;
  }

  teamKeys.forEach(empName => {
    const count = empCounts[empName];
    const cardHtml = `
      <div class="col-12 col-md-6">
        <div class="emp-card d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold text-dark text-uppercase font-monospace">${empName}</div>
            <span class="text-muted small">Total Certificate Issued</span>
          </div>
          <div class="badge bg-success badge-count fw-bold shadow-sm">${count}</div>
        </div>
      </div>
    `;
    container.append(cardHtml);
  });
}

// 2. THIS MONTH SUMMARY TABLE RENDER
function renderThisMonthReport() {
  const rtoStats = {};
  const currentMonthNum = (new Date().getMonth() + 1).toString();

  globalMasterData.forEach(item => {
    const rowMonth = String(item['month'] || item['MONTH'] || '').trim();
    
    if (rowMonth === currentMonthNum || rowMonth.endsWith('-2026') || rowMonth === '9' || rowMonth === '09-2026') {
      const rto = String(item['project_name'] || item['project'] || 'OTHER_RTO').trim();
      const remark = String(item['certificate team - remarks'] || item['stage'] || '').toLowerCase().trim();

      if (!rtoStats[rto]) {
        rtoStats[rto] = { received: 0, issued: 0, pending: 0 };
      }

      rtoStats[rto].received++;

      if (remark.includes('issued')) {
        rtoStats[rto].issued++;
      } else {
        rtoStats[rto].pending++;
      }
    }
  });

  const tbody = $('#monthSummaryTbody').empty();
  let totReceived = 0, totIssued = 0, totPending = 0;

  const rtoKeys = Object.keys(rtoStats).sort();
  if (rtoKeys.length === 0) {
    tbody.append('<tr><td colspan="5" class="py-3 text-muted">No records found for current month.</td></tr>');
    return;
  }

  rtoKeys.forEach(rto => {
    const rec = rtoStats[rto].received;
    const iss = rtoStats[rto].issued;
    const pen = rtoStats[rto].pending;
    const pct = rec > 0 ? ((iss / rec) * 100).toFixed(2) + '%' : '0.00%';

    totReceived += rec;
    totIssued += iss;
    totPending += pen;

    tbody.append(`
      <tr>
        <td class="fw-bold text-start ps-4">${rto}</td>
        <td>${rec}</td>
        <td class="text-success fw-bold">${iss}</td>
        <td class="text-primary fw-bold">${pct}</td>
        <td class="text-danger fw-bold">${pen}</td>
      </tr>
    `);
  });

  const grandPct = totReceived > 0 ? ((totIssued / totReceived) * 100).toFixed(2) + '%' : '0.00%';

  $('#mTotReceived').text(totReceived);
  $('#mTotIssued').text(totIssued);
  $('#mTotPct').text(grandPct);
  $('#mTotPending').text(totPending);
}
