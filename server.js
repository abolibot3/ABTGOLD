const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.coingecko.com https://api.goldprice.dev https://api.metals.live https://metalmetric.com;");
  next();
});

// Database
const defaultData = {
  prices: {},
  shortHistory: [],
  dailyHistory: [],
  lastUpdate: null,
  lastDailySave: null
};

const adapter = new JSONFile('db.json');
const db = new Low(adapter, defaultData);

async function initDB() {
  await db.read();
  db.data.prices ||= {};
  db.data.shortHistory ||= [];
  db.data.dailyHistory ||= [];
  await db.write();
  console.log('✅ Database ready | shortHistory:', db.data.shortHistory.length);
}

// ===== دریافت قیمت‌ها =====
async function fetchPrices() {
  console.log('🔄 Fetching prices...');

  try {
    // ===== 1. گرفتن ۵۰ رمزارز برتر =====
    const cryptoRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false'
    );
    const cryptoList = await cryptoRes.json();

    const prices = {};

    cryptoList.forEach(coin => {
      prices[coin.id] = {
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        usd: coin.current_price || 0,
        change24h: coin.price_change_percentage_24h || 0,
        marketCap: coin.market_cap || 0,
        image: coin.image || null
      };
    });

    // ===== 2. طلا (چند منبع) =====
    let goldUsd = 2650;
    let goldSource = 'fallback';

    try {
      const res1 = await fetch('https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT');
      const data1 = await res1.json();
      if (data1?.symbols?.[0]?.price) {
        goldUsd = parseFloat(data1.symbols[0].price);
        goldSource = 'goldprice.dev';
      }
    } catch (e) {
      try {
        const res2 = await fetch('https://api.metals.live/v1/spot/gold');
        const data2 = await res2.json();
        if (Array.isArray(data2) && data2[0]?.price) {
          goldUsd = data2[0].price;
          goldSource = 'metals.live';
        }
      } catch (e2) {
        try {
          const res3 = await fetch('https://metalmetric.com/api/gpt?action=spot_prices&metal=gold');
          const data3 = await res3.json();
          if (data3?.gold || data3?.price) {
            goldUsd = data3.gold || data3.price;
            goldSource = 'metalmetric';
          }
        } catch (e3) {
          console.log('⚠️ همه منابع طلا شکست خوردند');
        }
      }
    }

    console.log(`🥇 Gold: $${goldUsd} (منبع: ${goldSource})`);

    // اضافه کردن طلا به لیست قیمت‌ها
    prices['gold'] = {
      name: 'طلا (اونس)',
      symbol: 'XAU',
      usd: goldUsd,
      change24h: 0,
      marketCap: 0,
      image: null
    };

    // ===== زمان =====
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // ذخیره قیمت‌ها
    db.data.prices = prices;
    db.data.lastUpdate = now.toISOString();

    // Short History
    db.data.shortHistory.push({
      time: now.toISOString(),
      bitcoin: prices.bitcoin?.usd || 0,
      ethereum: prices.ethereum?.usd || 0,
      solana: prices.solana?.usd || 0,
      gold: goldUsd
    });

    if (db.data.shortHistory.length > 200) {
      db.data.shortHistory = db.data.shortHistory.slice(-200);
    }

    // Daily History
    if (db.data.lastDailySave !== today) {
      db.data.dailyHistory.push({
        date: today,
        bitcoin: prices.bitcoin?.usd || 0,
        ethereum: prices.ethereum?.usd || 0,
        solana: prices.solana?.usd || 0,
        gold: goldUsd
      });

      if (db.data.dailyHistory.length > 365) {
        db.data.dailyHistory = db.data.dailyHistory.slice(-365);
      }

      db.data.lastDailySave = today;
      console.log('📅 Daily history saved for', today);
    }

    await db.write();
    console.log('✅ Saved | Total coins:', Object.keys(prices).length, '| Gold:', goldSource);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// API
app.get('/api/prices', async (req, res) => {
  await db.read();
  res.json({
    prices: db.data.prices,
    lastUpdate: db.data.lastUpdate,
    shortHistory: db.data.shortHistory,
    dailyHistory: db.data.dailyHistory
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start
async function start() {
  await initDB();
  await fetchPrices();
  setInterval(fetchPrices, 2 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`🚀 ABTGOLD running on http://localhost:${PORT}`);
  });
}

start();