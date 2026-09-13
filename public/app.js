// ===== Global Variables =====
let pricesData = {};
let shortHistory = [];
let dailyHistory = [];
let priceChart = null;
let currentChartType = 'short'; // 'short' or 'daily'
let allPricesList = []; // برای جستجو
let visibleCount = 20; // تعداد نمایش اولیه
let currentSort = 'marketCap';


// ===== Theme Toggle =====
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  if (priceChart) updateChart();
});

// ===== Mobile Menu =====
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainNav = document.getElementById('mainNav');

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    mainNav.classList.toggle('active');
  });
}

// ===== Assistant (FAQ) =====
const assistantToggle = document.getElementById('assistantToggle');
const assistantPanel = document.getElementById('assistantPanel');

assistantToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  assistantPanel.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.assistant')) {
    assistantPanel.classList.remove('active');
  }
});

// ===== Format Helpers =====
function formatNumber(num) {
  return new Intl.NumberFormat('fa-IR').format(Math.round(num || 0));
}

function formatUSD(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num || 0);
}

// ===== Render Price Cards =====
function renderCards(prices, searchTerm = '') {
  const container = document.getElementById('priceCards');
  const showMoreBtn = document.getElementById('showMoreBtn');

updateFavoritesSection();

  if (!container) return;

  let list = Object.entries(prices)
    .map(([key, data]) => ({ key, ...data }))
    .filter(item => item.usd > 0)
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

  allPricesList = list;

  // فیلتر جستجو
if (searchTerm.trim()) {
  const term = searchTerm.toLowerCase().trim();
  list = list.filter(item =>
    (item.name && item.name.toLowerCase().includes(term)) ||
    (item.symbol && item.symbol.toLowerCase().includes(term)) ||
    (item.key && item.key.toLowerCase().includes(term))
  );
  if (showMoreBtn) showMoreBtn.style.display = 'none';
} else {
  // مرتب‌سازی
  list.sort((a, b) => {
    switch (currentSort) {
      case 'price': return (b.usd || 0) - (a.usd || 0);
      case 'changeUp': return (b.change24h || 0) - (a.change24h || 0);
      case 'changeDown': return (a.change24h || 0) - (b.change24h || 0);
      case 'name': return (a.name || '').localeCompare(b.name || '', 'fa');
      case 'marketCap':
      default: return (b.marketCap || 0) - (a.marketCap || 0);
    }
  });

  if (showMoreBtn) {
    if (list.length > visibleCount) {
      showMoreBtn.style.display = 'inline-block';
      showMoreBtn.textContent = `نمایش بیشتر (${list.length - visibleCount} مورد باقی‌مانده)`;
    } else {
      showMoreBtn.style.display = 'none';
    }
  }

  list = list.slice(0, visibleCount); // فقط در حالت غیرجستجو
}

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        هیچ نتیجه‌ای پیدا نشد
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const change = item.change24h || 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeSign = change >= 0 ? '+' : '';

    const icon = item.image
      ? `<img src="${item.image}" alt="${item.symbol}" style="width:22px;height:22px;border-radius:50%;margin-left:6px;">`
      : '🪙';

   return `
  <div class="card" data-key="${item.key}">
    <button class="fav-btn ${isFavorite(item.key) ? 'active' : ''}" 
            onclick="event.stopPropagation(); toggleFavorite('${item.key}')"
            title="افزودن به علاقه‌مندی‌ها">
      ${isFavorite(item.key) ? '❤️' : '🤍'}
    </button>
    <div class="card-header" onclick="openDetailModal('${item.key}')" style="cursor:pointer">
      <div class="card-title">
        ${icon}
        ${item.name || item.key}
        <small style="opacity:0.55;font-size:0.78rem;margin-right:6px">(${item.symbol || ''})</small>
      </div>
      <div class="change ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
    </div>
    <div class="price-usd" onclick="openDetailModal('${item.key}')" style="cursor:pointer">
      ${formatUSD(item.usd)}
    </div>
  </div>
`;
  }).join('');
}

// ===== Live Ticker =====
function renderTicker(prices) {
  const ticker = document.getElementById('ticker');
  if (!ticker) return;

  const list = Object.entries(prices)
    .map(([key, data]) => ({ key, ...data }))
    .filter(item => item.usd > 0)
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
    .slice(0, 12); // فقط ۱۲ تای اول برای تیکر

  const content = list.concat(list).map(item => {
    const change = item.change24h || 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeSign = change >= 0 ? '▲' : '▼';

    return `<span>${item.symbol}: ${formatUSD(item.usd)} <span class="${changeClass}">${changeSign} ${Math.abs(change).toFixed(2)}%</span></span>`;
  }).join('');

  ticker.innerHTML = content;
  fillConverterOptions();
}

// ===== Converter =====
function setupConverter() {
  const amountInput = document.getElementById('amount');
  const fromSelect = document.getElementById('fromAsset');
  const toSelect = document.getElementById('toCurrency');
  const convertBtn = document.getElementById('convertBtn');
  const resultDiv = document.getElementById('convertResult');

  // Search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    renderCards(pricesData, e.target.value);
  });
}


  function doConvert() {
    const amount = parseFloat(amountInput.value) || 0;
    const from = fromSelect.value;
    const to = toSelect.value;
    

    if (!pricesData[from]) {
      resultDiv.textContent = 'داده در دسترس نیست';
      return;
    }

    let result = 0;
    let unit = '';

    if (to === 'usd') {
      result = from === 'usd' ? amount : amount * (pricesData[from].usd || 0);
      unit = 'دلار';
    } else {
      result = from === 'usd'
        ? amount * (pricesData.usd?.toman || 0)
        : amount * (pricesData[from].toman || 0);
      unit = 'تومان';
    }

    resultDiv.innerHTML = `
      <span>${formatNumber(result)}</span>
      <small style="font-size:0.85rem;opacity:0.8">${unit}</small>
    `;
  }

  
  

  convertBtn.addEventListener('click', doConvert);
  amountInput.addEventListener('input', doConvert);
  fromSelect.addEventListener('change', doConvert);
  toSelect.addEventListener('change', doConvert);
  doConvert();
}

 // پر کردن داینامیک select
function fillConverterOptions() {
  const fromSelect = document.getElementById('fromAsset');
  if (!fromSelect || !pricesData) return;

  const list = Object.entries(pricesData)
    .map(([key, data]) => ({ key, ...data }))
    .filter(item => item.usd > 0)
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
    .slice(0, 30);

  fromSelect.innerHTML = list.map(item => 
    `<option value="${item.key}">${item.name} (${item.symbol})</option>`
  ).join('');
}

// ===== Chart =====
function updateChart() {
  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  const isDark = html.getAttribute('data-theme') === 'dark';
  const history = currentChartType === 'short' ? shortHistory : dailyHistory;

  if (!history || history.length < 2) {
  console.log('تاریخچه کافی نیست. تعداد نقاط:', history ? history.length : 0);
  console.log('نوع نمودار فعلی:', currentChartType);
  return;
}
  const labels = history.map(h => {
    if (currentChartType === 'short') {
      const d = new Date(h.time);
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return h.date;
    }
  });

  if (priceChart) {
    priceChart.destroy();
  }

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'بیت‌کوین (USD)',
          data: history.map(h => h.bitcoin),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: currentChartType === 'short' ? 2 : 3,
          borderWidth: 2
        },
        {
          label: 'اتریوم (USD)',
          data: history.map(h => h.ethereum),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          tension: 0.35,
          fill: false,
          pointRadius: currentChartType === 'short' ? 2 : 3,
          borderWidth: 2
        },
        {
          label: 'طلا (USD)',
          data: history.map(h => h.gold),
          borderColor: '#eab308',
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          tension: 0.35,
          fill: false,
          pointRadius: currentChartType === 'short' ? 2 : 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: isDark ? '#f1f5f9' : '#0f172a',
            font: { family: 'Vazirmatn', size: 13 }
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          titleColor: isDark ? '#f1f5f9' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: isDark ? '#94a3b8' : '#64748b', maxTicksLimit: 10 },
          grid: { color: isDark ? '#1e293b' : '#f1f5f9' }
        },
        y: {
          ticks: { color: isDark ? '#94a3b8' : '#64748b' },
          grid: { color: isDark ? '#1e293b' : '#f1f5f9' }
        }
      }
    }
  });
}

// ===== History Table =====
function renderHistoryTable() {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  // Show last 15 short history points (newest first)
  const recent = [...shortHistory].reverse().slice(0, 15);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">هنوز داده‌ای ثبت نشده</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(h => {
    const time = new Date(h.time).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return `
      <tr>
        <td>${time}</td>
        <td>${formatUSD(h.bitcoin)}</td>
        <td>${formatUSD(h.ethereum)}</td>
        <td>${formatUSD(h.gold)}</td>
        <td>${formatNumber(h.usdToman)}</td>
      </tr>
    `;
  }).join('');
}

// ===== Fetch Data =====
async function fetchPrices() {
  try {
    const res = await fetch('/api/prices');
    if (!res.ok) throw new Error('Network error');

    const data = await res.json();

    pricesData = data.prices || {};
    shortHistory = data.shortHistory || [];
    dailyHistory = data.dailyHistory || [];

    // Last update time
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (data.lastUpdate) {
      const d = new Date(data.lastUpdate);
      lastUpdateEl.textContent = `آخرین به‌روزرسانی: ${d.toLocaleTimeString('fa-IR')}`;
    }

    renderCards(pricesData);
    renderTicker(pricesData);
    renderHistoryTable();
    updateChart();
    fillConverterOptions();
    updateFavoritesSection();

  } catch (err) {
    console.error('Error fetching prices:', err);
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = 'خطا در دریافت اطلاعات';
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // ===== Splash Screen =====
  const splash = document.getElementById('splash');
  setTimeout(() => {
    if (splash) splash.classList.add('hide');
  }, 1800); // بعد از ۱.۸ ثانیه محو می‌شود

  setupConverter();
  fetchPrices();
  setupChartSwitcher();

  // جستجو
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      visibleCount = 20; // موقع جستجو ریست شود
      renderCards(pricesData, e.target.value);
    });
  }

  // دکمه نمایش بیشتر
  const showMoreBtn = document.getElementById('showMoreBtn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      visibleCount += 20;
      renderCards(pricesData);
    });
  }

  setInterval(fetchPrices, 2 * 60 * 1000);

  // حالت فشرده
const compactBtn = document.getElementById('compactBtn');
const cardsContainer = document.getElementById('priceCards');

if (compactBtn && cardsContainer) {
  // بارگذاری وضعیت قبلی
  const isCompact = localStorage.getItem('compactView') === 'true';
  if (isCompact) {
    cardsContainer.classList.add('compact');
    compactBtn.classList.add('active');
    compactBtn.textContent = 'حالت عادی';
  }

  compactBtn.addEventListener('click', () => {
    const nowCompact = cardsContainer.classList.toggle('compact');
    compactBtn.classList.toggle('active', nowCompact);
    compactBtn.textContent = nowCompact ? 'حالت عادی' : 'حالت فشرده';
    localStorage.setItem('compactView', nowCompact);
  });
}

});

// Chart type buttons
const btnShort = document.getElementById('btnShort');
const btnDaily = document.getElementById('btnDaily');

// ===== Chart Type Switcher =====
function setupChartSwitcher() {
  if (!btnShort || !btnDaily) return;

  btnShort.addEventListener('click', () => {
    currentChartType = 'short';
    btnShort.classList.add('active');
    btnDaily.classList.remove('active');
    updateChart();
  });

  btnDaily.addEventListener('click', () => {
    currentChartType = 'daily';
    btnDaily.classList.add('active');
    btnShort.classList.remove('active');
    updateChart();
  });

  const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    visibleCount = 20;
    renderCards(pricesData);
  });
}
}

// ===== Modal =====
const detailModal = document.getElementById('detailModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

let modalChart = null;

function openDetailModal(key) {
  const data = pricesData[key];
  if (!data) return;

  modalTitle.textContent = `${data.name || key} (${data.symbol || ''})`;

  const change = data.change24h || 0;
  const changeClass = change >= 0 ? 'up' : 'down';
  const changeSign = change >= 0 ? '+' : '';

  modalBody.innerHTML = `
    <div class="modal-row">
      <span class="modal-label">قیمت دلاری</span>
      <span class="modal-value">${formatUSD(data.usd)}</span>
    </div>
    <div class="modal-row">
      <span class="modal-label">تغییر ۲۴ ساعته</span>
      <span class="modal-value change ${changeClass}">${changeSign}${change.toFixed(2)}%</span>
    </div>
    ${data.marketCap ? `
    <div class="modal-row">
      <span class="modal-label">ارزش بازار</span>
      <span class="modal-value">${formatUSD(data.marketCap)}</span>
    </div>` : ''}
    <div class="modal-row">
      <span class="modal-label">آخرین به‌روزرسانی</span>
      <span class="modal-value" style="font-size:0.9rem">${new Date().toLocaleTimeString('fa-IR')}</span>
    </div>
  `;

  detailModal.classList.add('active');

  // بارگذاری نمودار مخصوص این رمزارز
  loadModalChart(key);
}

// بستن با دکمه ×
if (modalClose) {
  modalClose.addEventListener('click', () => {
    detailModal.classList.remove('active');
  });
}

// بستن با کلیک روی پس‌زمینه
if (detailModal) {
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.classList.remove('active');
    }
  });
}



async function loadModalChart(coinId) {
  const canvas = document.getElementById('modalChart');
  if (!canvas) return;

  // پاک کردن نمودار قبلی
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`);
    const data = await res.json();

    if (!data.prices || data.prices.length < 2) {
      canvas.parentElement.style.display = 'none';
      return;
    }

    canvas.parentElement.style.display = 'block';

    const labels = data.prices.map(p => {
      const d = new Date(p[0]);
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    });

    const prices = data.prices.map(p => p[1]);

    const isDark = html.getAttribute('data-theme') === 'dark';

    modalChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'قیمت (USD)',
          data: prices,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: isDark ? '#94a3b8' : '#64748b', maxTicksLimit: 6 },
            grid: { display: false }
          },
          y: {
            ticks: { color: isDark ? '#94a3b8' : '#64748b' },
            grid: { color: isDark ? '#1e293b' : '#f1f5f9' }
          }
        }
      }
    });
  } catch (err) {
    console.log('خطا در دریافت نمودار مودال:', err);
    canvas.parentElement.style.display = 'none';
  }
}

// ===== Favorites =====
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  } catch {
    return [];
  }
}

function isFavorite(key) {
  return getFavorites().includes(key);
}

function toggleFavorite(key) {
  let favs = getFavorites();
  if (favs.includes(key)) {
    favs = favs.filter(k => k !== key);
  } else {
    favs.push(key);
  }
  localStorage.setItem('favorites', JSON.stringify(favs));
  renderCards(pricesData); // رفرش کارت‌ها برای آپدیت قلب‌ها
  updateFavoritesSection();
}

function updateFavoritesSection() {
  const container = document.getElementById('favoritesCards');
  const section = document.getElementById('favorites');
  if (!container || !section) return;

  const favs = getFavorites();
  
  if (favs.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const list = favs
    .map(key => {
      const data = pricesData[key];
      if (!data) return null;
      return { key, ...data };
    })
    .filter(Boolean);

  container.innerHTML = list.map(item => {
    const change = item.change24h || 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeSign = change >= 0 ? '+' : '';
    const icon = item.image 
      ? `<img src="${item.image}" style="width:22px;height:22px;border-radius:50%;margin-left:6px;">`
      : '🪙';

    return `
      <div class="card" onclick="openDetailModal('${item.key}')" style="cursor:pointer">
        <button class="fav-btn active" onclick="event.stopPropagation(); toggleFavorite('${item.key}')">❤️</button>
        <div class="card-header">
          <div class="card-title">
            ${icon} ${item.name || item.key}
            <small style="opacity:0.55;font-size:0.78rem">(${item.symbol || ''})</small>
          </div>
          <div class="change ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
        </div>
        <div class="price-usd">${formatUSD(item.usd)}</div>
      </div>
    `;
  }).join('');
}