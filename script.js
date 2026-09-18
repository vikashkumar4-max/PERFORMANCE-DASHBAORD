// Anti-Inspect Guard (Blocks CTRL+U, CTRL+S, F12, DevTools)
document.addEventListener('keydown', function(e) {
  if (e.keyCode === 123 || 
     (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || 
     (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83))) {
    e.preventDefault();
    return false;
  }
});

const API_URL = "https://script.google.com/macros/s/AKfycbztOp0wjzSLjIbdwCjmwncfMQkqVCtmm8-W12b2ozh5fvDZqqfmA9x-QgcFNQq8RsCv-g/exec";
let rawData = [];
let p1Table;
let selectedTimeMode = 'today';

// Safe Data Fetching & Caching
async function loadData(force = false) {
  $("#loader").css("display", "flex");

  const cached = localStorage.getItem("common_rto_data_cache_v3");
  if (cached && !force) {
    try {
      rawData = JSON.parse(cached);
      initPortal();
      $("#loader").fadeOut();
      return;
    } catch(e) {
      localStorage.removeItem("common_rto_data_cache_v3");
    }
  }

  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    if (json.status === "success" && Array.isArray(json.data)) {
      rawData = json.data;
      localStorage.setItem("common_rto_data_cache_v3", JSON.stringify(rawData));
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

/* ================= PAGE 1 LOGIC ================= */
function populateP1FilterDropdowns() {
  const devSet = new Set(rawData.map(d => d.device_name).filter(Boolean));
  const remSet = new Set(rawData.map(d => d['Certificate Team - Remarks'] || d.stage).filter(Boolean));

  const devSel = $('#p1DeviceFilter').empty().append('<option value="ALL">All Devices</option>');
  devSet.forEach(d => devSel.append(`<option value="${d}">${d}</option>`));

  const remSel = $('#p1RemarkFilter').empty().append('<option value="ALL">All Remarks / Stages</option>');
  remSet.forEach(r => remSel.append(`<option value="${r}">${r}</option>`));
}

function applyPage1Filters() {
  const selectedDate = $('#p1DateFilter').val();
  const selectedDevice = $('#p1DeviceFilter').val();
  const selectedRemark = $('#p1RemarkFilter').val();

  const filtered = rawData.filter(item => {
    let dateMatch = true;
    if (selectedDate) {
      const itemDate = item.DATE || item.TIMESTAMP || '';
      dateMatch = itemDate.includes(selectedDate);
    }

    const devMatch = selectedDevice === 'ALL' || item.device_name === selectedDevice;
    
    const remVal = item['Certificate Team - Remarks'] || item.stage || '';
    const remMatch = selectedRemark === 'ALL' || remVal === selectedRemark;

    return dateMatch && devMatch && remMatch;
  });

  renderP1Table(filtered);
}

function resetPage1Filters() {
  $('#p1DateFilter').val('');
  $('#p1DeviceFilter').val('ALL');
  $('#p1RemarkFilter').val('ALL');
  applyPage1Filters();
}

function renderP1Table(data) {
  if (p1Table) p1Table.destroy();
  const tbody = $('#p1DataTable tbody').empty();

  data.forEach(row => {
    const remark = row['Certificate Team - Remarks'] || row.stage || 'N/A';
    const isIssued = remark.toLowerCase().includes('issued');
    
    const tr = `<tr>
      <td><span class="badge bg-primary bg-opacity-10 text-primary fw-bold">${row.project_name || row.Project || 'N/A'}</span></td>
      <td>${row.operator_name || 'N/A'}</td>
      <td class="fw-bold text-dark">${row.vehicle_number || 'N/A'}</td>
      <td>${row.device_name || 'N/A'}</td>
      <td>${row.dept || 'N/A'}</td>
      <td>${row.month || 'N/A'}</td>
      <td><span class="badge bg-secondary">${row.stage || 'N/A'}</span></td>
      <td class="small text-muted">${row['Pipeline start Date'] || 'N/A'}</td>
      <td>${row.Project || 'N/A'}</td>
      <td><span class="badge ${isIssued ? 'bg-success' : 'bg-warning text-dark'}">${remark}</span></td>
      <td class="small text-muted">${row.TIMESTAMP || 'N/A'}</td>
      <td class="small">${row.DATE || 'N/A'}</td>
      <td class="small">${row['REMARK DATE'] || 'N/A'}</td>
      <td class="small">${row['REAMRK TIME'] || 'N/A'}</td>
    </tr>`;
    tbody.append(tr);
  });

  p1Table = $('#p1DataTable').DataTable({ pageLength: 10, deferRender: true });
}

/* ================= PAGE 2 LOGIC ================= */
function populateP2RemarkDropdown() {
  const remSet = new Set(rawData.map(d => d['Certificate Team - Remarks'] || d.stage).filter(Boolean));
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
  const grid = $('#p2CardsGrid').empty();

  const rtoGroup = {};
  rawData.forEach(item => {
    const rto = item.project_name || item.Project || 'Other RTO';
    
    // Custom Date Matching
    if (customDate) {
      const itemDate = item.DATE || item.TIMESTAMP || '';
      if (!itemDate.includes(customDate)) return;
    }

    if (!rtoGroup[rto]) rtoGroup[rto] = [];
    rtoGroup[rto].push(item);
  });

  Object.keys(rtoGroup).forEach(rto => {
    const items = rtoGroup[rto];
    let remarkMatchCount = 0;

    items.forEach(item => {
      const remVal = item['Certificate Team - Remarks'] || item.stage || '';
      if (targetRemark === 'ALL' || remVal.toLowerCase().includes(targetRemark.toLowerCase())) {
        remarkMatchCount++;
      }
    });

    const total = items.length;
    const pending = total - remarkMatchCount;
    const efficiency = total > 0 ? Math.round((remarkMatchCount / total) * 100) : 0;

    const cardHtml = `
      <div class="col-md-4 col-lg-3">
        <div class="rich-card p-3">
          <div class="card-rto-header d-flex justify-content-between align-items-center mb-2">
            <h5 class="fw-bold text-primary m-0">${rto}</h5>
            <span class="badge bg-primary fs-6">${total} Total</span>
          </div>

          <div class="row g-2 text-center my-3">
            <div class="col-6">
              <div class="stat-box">
                <span class="small text-muted d-block fw-bold">${targetRemark === 'ALL' ? 'MATCHED' : 'ISSUED'}</span>
                <span class="fs-4 fw-bold text-success">${remarkMatchCount}</span>
              </div>
            </div>
            <div class="col-6">
              <div class="stat-box">
                <span class="small text-muted d-block fw-bold">PENDING</span>
                <span class="fs-4 fw-bold text-warning">${pending}</span>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center small fw-bold text-muted border-top pt-2">
            <span>Efficiency Rate:</span>
            <span class="text-success fs-6">${efficiency}%</span>
          </div>
        </div>
      </div>
    `;
    grid.append(cardHtml);
  });
}

/* ================= PAGE 3: AUTO-FETCH & SIMILAR SEARCH ENGINE ================= */
function executeP3Search() {
  const rawQuery = $('#p3SearchInput').val().trim();
  const cleanQuery = rawQuery.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const resultsDiv = $('#p3SearchResults').empty();

  if (!cleanQuery) {
    resultsDiv.html('<div class="alert alert-info rich-card">Type a vehicle number above to auto-fetch details...</div>');
    return;
  }

  // Similar / Auto-Fetch Matching Engine
  const matches = rawData.filter(item => {
    const vNoClean = (item.vehicle_number || '').replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const opClean = (item.operator_name || '').toLowerCase();
    return vNoClean.includes(cleanQuery) || opClean.includes(rawQuery.toLowerCase());
  });

  if (matches.length === 0) {
    resultsDiv.html(`
      <div class="alert alert-warning rich-card text-center py-4">
        <i class="bi bi-exclamation-triangle fs-2 text-warning d-block mb-2"></i>
        <h5>No Direct Records Found</h5>
        <p class="text-muted small m-0">No vehicle matching "<strong>${rawQuery}</strong>" was found in COMMON RTO DATA.</p>
      </div>
    `);
    return;
  }

  matches.forEach(item => {
    const remark = item['Certificate Team - Remarks'] || item.stage || 'N/A';
    const cardHtml = `
      <div class="rich-card p-4 mb-3 border-start border-4 border-primary">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="fw-bold text-primary m-0"><i class="bi bi-truck me-2"></i>${item.vehicle_number || 'N/A'}</h4>
          <span class="badge bg-primary fs-6">${item.project_name || item.Project || 'RTO'}</span>
        </div>

        <div class="row g-3">
          <div class="col-md-3"><strong>Operator Name:</strong> <br><span class="text-secondary">${item.operator_name || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Device Name:</strong> <br><span class="text-secondary">${item.device_name || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Department:</strong> <br><span class="text-secondary">${item.dept || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Month:</strong> <br><span class="text-secondary">${item.month || 'N/A'}</span></div>
          
          <div class="col-md-3"><strong>Current Stage:</strong> <br><span class="badge bg-secondary">${item.stage || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Pipeline Start Date:</strong> <br><span class="text-secondary">${item['Pipeline start Date'] || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Date / Timestamp:</strong> <br><span class="text-secondary">${item.DATE || item.TIMESTAMP || 'N/A'}</span></div>
          <div class="col-md-3"><strong>Remark Date & Time:</strong> <br><span class="text-secondary">${item['REMARK DATE'] || ''} ${item['REAMRK TIME'] || ''}</span></div>
          
          <div class="col-12 mt-2">
            <strong>Certificate Remarks:</strong> <br>
            <span class="badge bg-success fs-6 mt-1">${remark}</span>
          </div>
        </div>
      </div>
    `;
    resultsDiv.append(cardHtml);
  });
}

$(document).ready(() => loadData());
