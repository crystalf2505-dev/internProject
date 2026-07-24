/* =========================================================================
   PeriphTrack — Peripheral Inventory Tracker
   Front-end only for now (in-memory state). All persistence goes through
   the `api` object below — swap its internals for real fetch() calls to
   your Node.js + Express + MongoDB backend when it's ready. Everything
   else in this file (rendering, filtering, charts) can stay as-is.
   ========================================================================= */

/* ---------------------------------------------------------------------
   1. DATA — seeded from Peripheral_Inventory_Tracker_Copy.xlsx
   --------------------------------------------------------------------- */
let inventory = [
  { id: 'PERIPH-0001', name: 'Lenovo TB4 Dock',    category: 'Dock',     location: 'IT Closet',     qty: 24,  minStock: 10 },
  { id: 'PERIPH-0002', name: 'Lenovo USB-C Dock',  category: 'Dock',     location: 'IT Closet',     qty: 10,  minStock: 10 },
  { id: 'PERIPH-0003', name: 'Mouse',              category: 'Mouse',    location: 'IT Closet',     qty: 190, minStock: 10 },
  { id: 'PERIPH-0004', name: 'Display Port',       category: 'Cable',    location: 'IT Closet',     qty: 20,  minStock: 10 },
  { id: 'PERIPH-0005', name: 'HDMI',               category: 'Cable',    location: 'IT Closet',     qty: 60,  minStock: 10 },
  { id: 'PERIPH-0006', name: 'Ethernet',           category: 'Cable',    location: 'IT Closet',     qty: 50,  minStock: 10 },
  { id: 'PERIPH-0007', name: 'Keyboard',           category: 'Keyboard', location: 'Computer Room', qty: 237, minStock: 10 },
  { id: 'PERIPH-0008', name: 'Headset',            category: 'Headset',  location: 'IT Closet',     qty: 0,   minStock: 10 },
  { id: 'PERIPH-0009', name: 'HP Monitors',        category: 'Monitor',  location: 'IT Cage',       qty: 70,  minStock: 10 },
  { id: 'PERIPH-0010', name: 'HP Dock',            category: 'Dock',     location: 'IT Cage',       qty: 80,  minStock: 10 },
];

let transactions = [
  { date: '2026-07-09', itemId: 'PERIPH-0001', itemName: 'Lenovo TB4 Dock',   action: 'Added',   qty: 24,  location: 'Computer Room', note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0002', itemName: 'Lenovo USB-C Dock', action: 'Added',   qty: 10,  location: 'Computer Room', note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0003', itemName: 'Mouse',             action: 'Added',   qty: 200, location: 'IT Closet',     note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0007', itemName: 'Keyboard',          action: 'Added',   qty: 238, location: 'Computer Room', note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0008', itemName: 'Headset',           action: 'Added',   qty: 0,   location: 'IT Closet',     note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0007', itemName: 'Keyboard',          action: 'Removed', qty: 1,   location: 'Computer Room', note: '' },
  { date: '2026-07-09', itemId: 'PERIPH-0003', itemName: 'Mouse',             action: 'Removed', qty: 10,  location: 'IT Cage',       note: '' },
].sort((a, b) => new Date(b.date) - new Date(a.date));

let nextIdNum = inventory.length + 1;

/* ---------------------------------------------------------------------
   2. API STUB LAYER — replace bodies with real fetch() calls later
   --------------------------------------------------------------------- */
const api = {
  async listItems() { return inventory; },
  async createItem(item) { inventory.push(item); return item; },
  async updateItem(id, patch) {
    const i = inventory.findIndex(x => x.id === id);
    if (i > -1) inventory[i] = { ...inventory[i], ...patch };
    return inventory[i];
  },
  async deleteItem(id) {
    inventory = inventory.filter(x => x.id !== id);
    return true;
  },
  async logTransaction(tx) { transactions.unshift(tx); return tx; },
};

/* ---------------------------------------------------------------------
   3. STATE
   --------------------------------------------------------------------- */
let sortKey = 'id';
let sortDir = 1;
let currentView = 'inventory';

/* ---------------------------------------------------------------------
   4. HELPERS
   --------------------------------------------------------------------- */
function statusOf(item) {
  if (item.qty <= 0) return 'Out of Stock';
  if (item.qty <= item.minStock) return 'Low Stock';
  return 'In Stock';
}
function statusBadgeClass(status) {
  if (status === 'Out of Stock') return 'badge-out';
  if (status === 'Low Stock') return 'badge-low';
  return 'badge-instock';
}
function barcodeHTML(id) {
  const bars = Array.from({ length: 14 })
    .map(() => `<span style="height:${8 + Math.random() * 10}px;"></span>`)
    .join('');
  return `<div class="barcode-id">
      <div class="barcode-bars">${bars}</div>
      <span class="id-text">${id}</span>
    </div>`;
}
function showToast(msg) {
  document.getElementById('appToastBody').textContent = msg;
  new bootstrap.Toast(document.getElementById('appToast'), { delay: 2200 }).show();
}
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/* ---------------------------------------------------------------------
   5. RENDER: STAT CARDS
   --------------------------------------------------------------------- */
function renderStats() {
  const totalItems = inventory.length;
  const totalUnits = inventory.reduce((s, i) => s + i.qty, 0);
  const low = inventory.filter(i => statusOf(i) === 'Low Stock').length;
  const out = inventory.filter(i => statusOf(i) === 'Out of Stock').length;

  document.getElementById('statTotalItems').textContent = totalItems;
  document.getElementById('statTotalUnits').textContent = totalUnits.toLocaleString();
  document.getElementById('statLow').textContent = low;
  document.getElementById('statOut').textContent = out;
}

/* ---------------------------------------------------------------------
   6. RENDER: CHARTS
   --------------------------------------------------------------------- */
let categoryChart, statusChart;
function renderCharts() {
  const catTotals = {};
  inventory.forEach(i => { catTotals[i.category] = (catTotals[i.category] || 0) + i.qty; });
  const catLabels = Object.keys(catTotals);
  const catValues = Object.values(catTotals);

  const statusCounts = { 'In Stock': 0, 'Low Stock': 0, 'Out of Stock': 0 };
  inventory.forEach(i => statusCounts[statusOf(i)]++);

  const gridColor = 'rgba(255,255,255,.06)';
  const textColor = '#8B96A5';

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById('categoryChart'), {
    type: 'bar',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: '#3FB8AF',
        borderRadius: 6,
        maxBarThickness: 42,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
      }
    }
  });

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#49B47D', '#F2A93B', '#E2574C'],
        borderColor: '#171D26',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 10, padding: 14 } }
      }
    }
  });
}

/* ---------------------------------------------------------------------
   7. RENDER: FILTER DROPDOWNS
   --------------------------------------------------------------------- */
function renderFilterOptions() {
  const catSel = document.getElementById('filterCategory');
  const locSel = document.getElementById('filterLocation');
  const catList = document.getElementById('categoryList');
  const locList = document.getElementById('locationList');

  const cats = uniqueSorted(inventory.map(i => i.category));
  const locs = uniqueSorted(inventory.map(i => i.location));

  const prevCat = catSel.value, prevLoc = locSel.value;
  catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  locSel.innerHTML = '<option value="">All Locations</option>' + locs.map(l => `<option value="${l}">${l}</option>`).join('');
  catSel.value = cats.includes(prevCat) ? prevCat : '';
  locSel.value = locs.includes(prevLoc) ? prevLoc : '';

  catList.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  locList.innerHTML = locs.map(l => `<option value="${l}">`).join('');
}

/* ---------------------------------------------------------------------
   8. RENDER: TABLE
   --------------------------------------------------------------------- */
function getFilteredSorted() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fCat = document.getElementById('filterCategory').value;
  const fLoc = document.getElementById('filterLocation').value;
  const fStatus = document.getElementById('filterStatus').value;

  let rows = inventory.filter(i => {
    const matchesQ = !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
    const matchesCat = !fCat || i.category === fCat;
    const matchesLoc = !fLoc || i.location === fLoc;
    const matchesStatus = !fStatus || statusOf(i) === fStatus;
    return matchesQ && matchesCat && matchesLoc && matchesStatus;
  });

  rows.sort((a, b) => {
    let av = sortKey === 'status' ? statusOf(a) : a[sortKey];
    let bv = sortKey === 'status' ? statusOf(b) : b[sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  return rows;
}

function renderTable() {
  const rows = getFilteredSorted();
  const tbody = document.getElementById('inventoryBody');
  const empty = document.getElementById('emptyState');

  document.getElementById('resultCount').textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  tbody.innerHTML = rows.map(item => {
    const status = statusOf(item);
    return `
      <tr>
        <td>${barcodeHTML(item.id)}</td>
        <td>
          <div class="item-name">${item.name}</div>
          <div class="item-cat">${item.category}</div>
        </td>
        <td>${item.location}</td>
        <td class="text-end qty-num">${item.qty}</td>
        <td class="text-end qty-num" style="color:var(--text-muted);">${item.minStock}</td>
        <td><span class="badge-status ${statusBadgeClass(status)}">${status}</span></td>
        <td class="text-end row-actions">
          <div class="btn-group">
            <button class="btn btn-outline-soft" title="Stock in" data-action="in" data-id="${item.id}"><i class="bi bi-box-arrow-in-down"></i></button>
            <button class="btn btn-outline-soft" title="Stock out" data-action="out" data-id="${item.id}"><i class="bi bi-box-arrow-up"></i></button>
            <button class="btn btn-outline-soft" title="Edit" data-action="edit" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-soft" title="Remove" data-action="delete" data-id="${item.id}"><i class="bi bi-trash3"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ---------------------------------------------------------------------
   9. RENDER: TRANSACTION LOG
   --------------------------------------------------------------------- */
function renderLog() {
  const list = document.getElementById('logList');
  const empty = document.getElementById('logEmpty');
  if (!transactions.length) {
    list.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');
  list.innerHTML = transactions.slice(0, 100).map(tx => `
    <div class="log-item ${tx.action === 'Removed' ? 'action-removed' : ''}">
      <div class="log-date">${formatDate(tx.date)}</div>
      <div><strong>${tx.action === 'Removed' ? '−' : '+'}${tx.qty}</strong> · ${tx.itemName}
        <span class="text-muted">(${tx.itemId})</span> at ${tx.location || '—'}
      </div>
      ${tx.note ? `<div class="text-muted small">${tx.note}</div>` : ''}
    </div>
  `).join('');
}

/* ---------------------------------------------------------------------
   10. MASTER RENDER
   --------------------------------------------------------------------- */
function renderAll() {
  renderStats();
  renderCharts();
  renderFilterOptions();
  renderTable();
  renderLog();
}

/* ---------------------------------------------------------------------
   11. EVENTS — filters / search / sort
   --------------------------------------------------------------------- */
['searchInput', 'filterCategory', 'filterLocation', 'filterStatus'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTable);
  document.getElementById(id).addEventListener('change', renderTable);
});

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortKey === key) { sortDir *= -1; } else { sortKey = key; sortDir = 1; }
    renderTable();
  });
});

/* ---------------------------------------------------------------------
   12. EVENTS — tabs
   --------------------------------------------------------------------- */
document.getElementById('viewTabs').addEventListener('click', e => {
  const btn = e.target.closest('.nav-link');
  if (!btn) return;
  document.querySelectorAll('#viewTabs .nav-link').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentView = btn.dataset.view;
  document.getElementById('view-inventory').classList.toggle('d-none', currentView !== 'inventory');
  document.getElementById('view-log').classList.toggle('d-none', currentView !== 'log');
});

/* ---------------------------------------------------------------------
   13. ADD / EDIT ITEM MODAL
   --------------------------------------------------------------------- */
const itemModalEl = document.getElementById('itemModal');
const itemModal = new bootstrap.Modal(itemModalEl);

document.getElementById('openAddBtn').addEventListener('click', () => {
  document.getElementById('itemForm').reset();
  document.getElementById('itemEditId').value = '';
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemSubmitBtn').textContent = 'Add Item';
  document.getElementById('itemQty').value = 0;
  document.getElementById('itemMinStock').value = 10;
});

document.getElementById('itemForm').addEventListener('submit', async e => {
  e.preventDefault();
  const editId = document.getElementById('itemEditId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value.trim();
  const location = document.getElementById('itemLocation').value.trim();
  const qty = parseInt(document.getElementById('itemQty').value, 10) || 0;
  const minStock = parseInt(document.getElementById('itemMinStock').value, 10) || 0;

  if (editId) {
    await api.updateItem(editId, { name, category, location, qty, minStock });
    showToast(`${name} updated.`);
  } else {
    const id = `PERIPH-${String(nextIdNum++).padStart(4, '0')}`;
    await api.createItem({ id, name, category, location, qty, minStock });
    if (qty > 0) {
      await api.logTransaction({ date: new Date().toISOString().slice(0, 10), itemId: id, itemName: name, action: 'Added', qty, location, note: 'Initial stock' });
    }
    showToast(`${name} added to inventory.`);
  }
  itemModal.hide();
  renderAll();
});

/* ---------------------------------------------------------------------
   14. STOCK IN / OUT MODAL
   --------------------------------------------------------------------- */
const stockModalEl = document.getElementById('stockModal');
const stockModal = new bootstrap.Modal(stockModalEl);

function openStockModal(id, action) {
  const item = inventory.find(i => i.id === id);
  if (!item) return;
  document.getElementById('stockItemId').value = id;
  document.getElementById('stockAction').value = action;
  document.getElementById('stockItemName').textContent = item.name;
  document.getElementById('stockItemQty').textContent = item.qty;
  document.getElementById('stockModalTitle').textContent = action === 'in' ? 'Stock In' : 'Stock Out';
  document.getElementById('stockSubmitBtn').textContent = action === 'in' ? 'Add Stock' : 'Remove Stock';
  document.getElementById('stockForm').reset();
  document.getElementById('stockQty').value = 1;
  stockModal.show();
}

document.getElementById('stockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('stockItemId').value;
  const action = document.getElementById('stockAction').value;
  const qty = parseInt(document.getElementById('stockQty').value, 10) || 0;
  const note = document.getElementById('stockNote').value.trim();
  const item = inventory.find(i => i.id === id);
  if (!item || qty <= 0) return;

  if (action === 'in') {
    item.qty += qty;
  } else {
    item.qty = Math.max(0, item.qty - qty);
  }
  await api.updateItem(id, { qty: item.qty });
  await api.logTransaction({
    date: new Date().toISOString().slice(0, 10),
    itemId: id, itemName: item.name,
    action: action === 'in' ? 'Added' : 'Removed',
    qty, location: item.location, note
  });

  showToast(`${action === 'in' ? 'Added' : 'Removed'} ${qty} × ${item.name}.`);
  stockModal.hide();
  renderAll();
});

/* ---------------------------------------------------------------------
   15. DELETE MODAL
   --------------------------------------------------------------------- */
const deleteModalEl = document.getElementById('deleteModal');
const deleteModal = new bootstrap.Modal(deleteModalEl);
let pendingDeleteId = null;

function openDeleteModal(id) {
  const item = inventory.find(i => i.id === id);
  if (!item) return;
  pendingDeleteId = id;
  document.getElementById('deleteItemName').textContent = item.name;
  deleteModal.show();
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const item = inventory.find(i => i.id === pendingDeleteId);
  await api.deleteItem(pendingDeleteId);
  showToast(`${item ? item.name : 'Item'} removed.`);
  pendingDeleteId = null;
  deleteModal.hide();
  renderAll();
});

/* ---------------------------------------------------------------------
   16. ROW ACTION CLICKS (edit / delete / stock in / stock out)
   --------------------------------------------------------------------- */
document.getElementById('inventoryBody').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'in' || action === 'out') return openStockModal(id, action);
  if (action === 'delete') return openDeleteModal(id);
  if (action === 'edit') {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    document.getElementById('itemEditId').value = item.id;
    document.getElementById('itemModalTitle').textContent = 'Edit Item';
    document.getElementById('itemSubmitBtn').textContent = 'Save Changes';
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemLocation').value = item.location;
    document.getElementById('itemQty').value = item.qty;
    document.getElementById('itemMinStock').value = item.minStock;
    itemModal.show();
  }
});

/* ---------------------------------------------------------------------
   17. CSV EXPORT
   --------------------------------------------------------------------- */
document.getElementById('exportCsvBtn').addEventListener('click', () => {
  const header = ['Item_ID', 'Item_Name', 'Category', 'Location', 'Current_Qty', 'Minimum_Stock', 'Status'];
  const rows = inventory.map(i => [i.id, i.name, i.category, i.location, i.qty, i.minStock, statusOf(i)]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peripheral-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------------------------------------------------------------------
   18. INIT
   --------------------------------------------------------------------- */
renderAll();
