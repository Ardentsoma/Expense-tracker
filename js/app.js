/* ============================================
   Spendify — Expense Tracker Application
   ============================================ */

const DEFAULT_CATEGORIES = [
  'Food', 'Transport', 'Bills', 'Shopping',
  'Healthcare', 'Education', 'Entertainment',
  'Airtime & Data', 'Miscellaneous'
];

const CATEGORY_ICONS = {
  'Food': '🍔',
  'Transport': '🚗',
  'Bills': '📄',
  'Shopping': '🛍️',
  'Healthcare': '🏥',
  'Education': '📚',
  'Entertainment': '🎬',
  'Airtime & Data': '📱',
  'Miscellaneous': '📦'
};

const CATEGORY_COLORS = {
  'Food': 'cat-food',
  'Transport': 'cat-transport',
  'Bills': 'cat-bills',
  'Shopping': 'cat-shopping',
  'Healthcare': 'cat-healthcare',
  'Education': 'cat-education',
  'Entertainment': 'cat-entertainment',
  'Airtime & Data': 'cat-airtime',
  'Miscellaneous': 'cat-misc'
};

// ============================================
// State
// ============================================
let state = {
  expenses: [],
  filter: 'all',
  searchQuery: ''
};

let pieChart = null;
let trendChart = null;
let pendingDeleteId = null;

// ============================================
// Utilities
// ============================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(amount) {
  return '₦' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today, ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday, ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (days < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getDayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

// ============================================
// Local Storage
// ============================================
function saveToStorage() {
  try {
    const data = {
      expenses: state.expenses
    };
    localStorage.setItem('spendify_data', JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('spendify_data');
    if (raw) {
      const data = JSON.parse(raw);
      state.expenses = data.expenses || [];
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    state.expenses = [];
  }
}

// ============================================
// Data Operations
// ============================================
function addExpense(name, amount, category) {
  const expense = {
    id: generateId(),
    name: name.trim(),
    amount: parseFloat(amount),
    category: category || 'Miscellaneous',
    date: new Date().toISOString(),
    createdAt: Date.now()
  };
  state.expenses.push(expense);
  saveToStorage();
  return expense;
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveToStorage();
}

function getFilteredExpenses(filterType) {
  let filtered = [...state.expenses];

  // Apply time filter
  if (filterType === 'daily' || state.filter === 'daily') {
    const { start, end } = getDayRange();
    filtered = filtered.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  } else if (filterType === 'weekly' || state.filter === 'weekly') {
    const { start, end } = getWeekRange();
    filtered = filtered.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  } else if (filterType === 'monthly' || state.filter === 'monthly') {
    const { start, end } = getMonthRange();
    filtered = filtered.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }

  // Apply search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  }

  return filtered;
}

function getStats(filterType) {
  const filtered = getFilteredExpenses(filterType);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const count = filtered.length;
  const avg = count > 0 ? total / count : 0;
  return { total, count, avg };
}

function getDashboardStats() {
  const { total: todayTotal } = getStats('daily');
  const { total: weekTotal } = getStats('weekly');
  const { total: monthTotal } = getStats('monthly');
  const allTotal = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  return { todayTotal, weekTotal, monthTotal, allTotal };
}

function getCategoryBreakdown() {
  const filtered = getFilteredExpenses(state.filter);
  const breakdown = {};
  filtered.forEach(e => {
    breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
  });
  return breakdown;
}

function getMonthlyTrend() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = m.toLocaleDateString('en-US', { month: 'short' });
    const total = state.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    }).reduce((sum, e) => sum + e.amount, 0);
    months.push({ label, total });
  }
  return months;
}

// ============================================
// Render Functions
// ============================================
function renderDashboard() {
  const stats = getDashboardStats();
  document.getElementById('todayAmount').textContent = formatCurrency(stats.todayTotal);
  document.getElementById('weekAmount').textContent = formatCurrency(stats.weekTotal);
  document.getElementById('monthAmount').textContent = formatCurrency(stats.monthTotal);
  document.getElementById('totalAmount').textContent = formatCurrency(stats.allTotal);
}

function renderSummaryStats() {
  const stats = getStats(state.filter);
  document.getElementById('statTotal').textContent = formatCurrency(stats.total);
  document.getElementById('statCount').textContent = stats.count;
  document.getElementById('statAverage').textContent = formatCurrency(stats.avg);
}

function getCategoryIconClass(category) {
  const colorMap = {
    'Food': 'cat-food',
    'Transport': 'cat-transport',
    'Bills': 'cat-bills',
    'Shopping': 'cat-shopping',
    'Healthcare': 'cat-healthcare',
    'Education': 'cat-education',
    'Entertainment': 'cat-entertainment',
    'Airtime & Data': 'cat-airtime',
    'Miscellaneous': 'cat-misc'
  };
  return colorMap[category] || 'cat-misc';
}

function renderExpenseList() {
  const container = document.getElementById('expenseList');
  const filtered = getFilteredExpenses(state.filter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-receipt"></i>
        </div>
        <p class="empty-state-title">${state.searchQuery ? 'No expenses match your search' : 'No expenses recorded yet'}</p>
        <p class="empty-state-sub">${state.searchQuery ? 'Try a different search term' : 'Tap the button above to add your first expense'}</p>
      </div>
    `;
    return;
  }

  // Sort by date descending
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = '<div class="stagger-enter">' +
    sorted.map(expense => renderExpenseItem(expense)).join('') +
    '</div>';
}

function renderExpenseItem(expense) {
  const icon = CATEGORY_ICONS[expense.category] || '📦';
  const colorClass = getCategoryIconClass(expense.category);

  return `
    <div class="expense-item" data-id="${expense.id}">
      <div class="expense-category-icon ${colorClass}">${icon}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(expense.name)}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">${escapeHtml(expense.category)}</span>
          <span class="text-[10px] text-gray-500">${formatDate(expense.date)}</span>
        </div>
      </div>
      <div class="text-right flex-shrink-0 flex items-center gap-2">
        <p class="text-sm font-bold text-gray-900">${formatCurrency(expense.amount)}</p>
        <button class="btn-danger delete-btn" data-id="${expense.id}" title="Delete">
          <i class="fas fa-trash-alt text-[11px]"></i>
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Charts
// ============================================
function renderCharts() {
  renderPieChart();
  renderTrendChart();
}

function renderPieChart() {
  const ctx = document.getElementById('pieChart');
  if (!ctx) return;

  const breakdown = getCategoryBreakdown();
  const labels = Object.keys(breakdown);
  const data = Object.values(breakdown);

  const textColor = '#6b7280';

  if (pieChart) {
    pieChart.destroy();
  }

  if (data.length === 0) {
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['No data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e5e7eb'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
    return;
  }

  const colors = [
    '#14b8a6', '#f97316', '#eab308', '#22c55e',
    '#a855f7', '#3b82f6', '#ef4444', '#06b6d4', '#64748b'
  ];

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 10, family: 'Bricolage Grotesque' },
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderTrendChart() {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const trend = getMonthlyTrend();
  const textColor = '#6b7280';
  const gridColor = '#f1f5f9';

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(t => t.label),
      datasets: [{
        label: 'Spending',
        data: trend.map(t => t.total),
        backgroundColor: '#14b8a6',
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 10, family: 'Bricolage Grotesque' } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 9, family: 'Bricolage Grotesque' },
            callback: (val) => '₦' + (val / 1000).toFixed(0) + 'k'
          },
          beginAtZero: true
        }
      }
    }
  });
}

// ============================================
// CSV Export
// ============================================
function exportCSV() {
  if (state.expenses.length === 0) {
    showToast('No Data', 'No expenses to export');
    return;
  }

  const headers = ['Name', 'Amount (₦)', 'Category', 'Date'];
  const rows = state.expenses.map(e => [
    `"${e.name.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${e.category}"`,
    `"${new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `spendify_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Exported', 'CSV file downloaded successfully');
}

// ============================================
// Toast
// ============================================
function showToast(title, message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMessage').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// Full Refresh
// ============================================
function refreshUI() {
  renderDashboard();
  renderSummaryStats();
  renderExpenseList();
  renderCharts();
}

// ============================================
// Event Handlers
// ============================================
function setupEventHandlers() {
  // Form submission (desktop)
  document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit('expenseForm');
  });

  // Form submission (mobile)
  document.getElementById('mobileExpenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit('mobileExpenseForm');
    closeMobileModal();
  });

  // Delete buttons (delegated)
  document.getElementById('expenseList').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      showDeleteConfirm(deleteBtn.dataset.id);
    }
  });

  // Confirm modal
  document.getElementById('confirmDelete').addEventListener('click', executeDelete);
  document.getElementById('confirmCancel').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmOverlay').addEventListener('click', closeConfirmModal);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.dataset.filter;
      state.searchQuery = document.getElementById('searchInput').value.trim();
      updateURL();
      refreshUI();
    });
  });

  // Search
  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      updateURL();
      refreshUI();
    }, 300);
  });

  // Category custom
  document.getElementById('expenseCategory').addEventListener('change', handleCategoryChange);
  document.getElementById('mobileExpenseCategory').addEventListener('change', handleCategoryChange);

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // Mobile modal
  document.getElementById('mobileAddBtn').addEventListener('click', openMobileModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeMobileModal);
  document.getElementById('modalOverlay').addEventListener('click', closeMobileModal);

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileModal();
      closeConfirmModal();
    }
  });
}

function handleFormSubmit(formId) {
  const isMobile = formId === 'mobileExpenseForm';
  const nameInput = document.getElementById(isMobile ? 'mobileExpenseName' : 'expenseName');
  const amountInput = document.getElementById(isMobile ? 'mobileExpenseAmount' : 'expenseAmount');
  const categorySelect = document.getElementById(isMobile ? 'mobileExpenseCategory' : 'expenseCategory');
  const customInput = document.getElementById(isMobile ? 'mobileCustomCategory' : 'customCategory');
  const customWrapper = document.getElementById(isMobile ? 'mobileCustomCategoryWrapper' : 'customCategoryWrapper');

  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  let category = categorySelect.value;

  // Validation
  if (!name) {
    nameInput.focus();
    nameInput.classList.add('border-gray-400', 'dark:border-gray-500');
    setTimeout(() => nameInput.classList.remove('border-gray-400', 'dark:border-gray-500'), 2000);
    showToast('Error', 'Please enter an expense name');
    return;
  }

  if (!amount || amount <= 0) {
    amountInput.focus();
    amountInput.classList.add('border-gray-400', 'dark:border-gray-500');
    setTimeout(() => amountInput.classList.remove('border-gray-400', 'dark:border-gray-500'), 2000);
    showToast('Error', 'Amount must be greater than zero');
    return;
  }

  if (category === 'custom') {
    category = customInput.value.trim() || 'Custom';
  }

  addExpense(name, amount, category);
  nameInput.value = '';
  amountInput.value = '';
  categorySelect.value = 'Food';
  if (customInput) {
    customInput.value = '';
    customWrapper.classList.add('hidden');
  }

  refreshUI();
  showToast('Expense Added', `${name} — ${formatCurrency(amount)}`);
}

function handleCategoryChange(e) {
  const isMobile = e.target.id === 'mobileExpenseCategory';
  const wrapper = document.getElementById(isMobile ? 'mobileCustomCategoryWrapper' : 'customCategoryWrapper');
  const input = document.getElementById(isMobile ? 'mobileCustomCategory' : 'customCategory');
  if (e.target.value === 'custom') {
    wrapper.classList.remove('hidden');
    input.focus();
  } else {
    wrapper.classList.add('hidden');
  }
}

function showDeleteConfirm(id) {
  const expense = state.expenses.find(e => e.id === id);
  if (!expense) return;
  pendingDeleteId = id;
  document.getElementById('confirmExpenseName').textContent = `"${expense.name}"`;
  document.getElementById('confirmExpenseAmount').textContent = formatCurrency(expense.amount);
  document.getElementById('confirmModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  document.body.style.overflow = '';
  pendingDeleteId = null;
}

function executeDelete() {
  const id = pendingDeleteId;
  if (!id) return;
  const item = document.querySelector(`.expense-item[data-id="${id}"]`);
  closeConfirmModal();
  if (item) {
    item.classList.add('deleting');
    setTimeout(() => {
      deleteExpense(id);
      refreshUI();
      showToast('Expense Deleted', 'The expense has been removed');
    }, 300);
  } else {
    deleteExpense(id);
    refreshUI();
  }
}

// Mobile modal
function openMobileModal() {
  document.getElementById('mobileModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMobileModal() {
  document.getElementById('mobileModal').classList.add('hidden');
  document.body.style.overflow = '';
}

// URL state
function updateURL() {
  const params = new URLSearchParams();
  if (state.filter !== 'all') params.set('filter', state.filter);
  if (state.searchQuery) params.set('q', state.searchQuery);
  const str = params.toString();
  const url = str ? '?' + str : window.location.pathname;
  window.history.replaceState({}, '', url);
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  const q = params.get('q');
  if (filter && ['all', 'daily', 'weekly', 'monthly'].includes(filter)) {
    state.filter = filter;
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });
  }
  if (q) {
    state.searchQuery = q;
    document.getElementById('searchInput').value = q;
  }
}

// ============================================
// Seed Demo Data
// ============================================
function seedDemoData() {
  if (state.expenses.length > 0) return;

  const now = new Date();
  const demoExpenses = [
    { name: 'Jollof Rice & Chicken', amount: 5000, category: 'Food', date: new Date(now) },
    { name: 'Bolt Ride to Ikeja', amount: 2500, category: 'Transport', date: new Date(now) },
    { name: 'MTN Airtime', amount: 1000, category: 'Airtime & Data', date: new Date(now) },
    { name: 'Electricity Bills', amount: 12000, category: 'Bills', date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    { name: 'Netflix Subscription', amount: 2900, category: 'Entertainment', date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    { name: 'New Sneakers', amount: 35000, category: 'Shopping', date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { name: 'Pharmacy - Malaria Meds', amount: 4500, category: 'Healthcare', date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
    { name: 'Online Course Subscription', amount: 15000, category: 'Education', date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { name: 'Groceries at Shoprite', amount: 18500, category: 'Food', date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
    { name: 'Data Bundle 10GB', amount: 3000, category: 'Airtime & Data', date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
    { name: 'Movie Tickets', amount: 4000, category: 'Entertainment', date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
    { name: 'Diesel for Generator', amount: 25000, category: 'Bills', date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) }
  ];

  demoExpenses.forEach(e => {
    state.expenses.push({
      id: generateId(),
      name: e.name,
      amount: e.amount,
      category: e.category,
      date: e.date.toISOString(),
      createdAt: e.date.getTime()
    });
  });

  saveToStorage();
}

// ============================================
// Init
// ============================================
function init() {
  loadFromStorage();
  loadFromURL();

  // If no data, seed demo
  if (state.expenses.length === 0) {
    seedDemoData();
  }

  setupEventHandlers();
  refreshUI();
  showToast('Welcome', 'Your expenses are ready');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
