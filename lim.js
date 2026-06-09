require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');

const ANIMAL = process.env.ANIMAL_TYPE || 'chicken';

const api = axios.create({
  baseURL: process.env.BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': process.env.BASE_URL,
    'Referer': `${process.env.BASE_URL}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

const log = (msg) => console.log(`[${new Date().toLocaleString('id-ID')}] ${msg}`);

const divider = (char = '─', len = 45) => console.log(char.repeat(len));

function formatNextClaim(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
}

function getTimeLeft(isoString) {
  if (!isoString) return null;
  const diff = new Date(isoString) - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const ANIMAL_EMOJI = {
  chicken: '🐔',
  duck:    '🦆',
  goat:    '🐐',
  cow:     '🐄',
};

const PRODUCT_EMOJI = {
  chicken: '🥚',
  duck:    '🥚',
  goat:    '🥛',
  cow:     '🥛',
};

// ─── Info User ────────────────────────────────────────
async function getMe() {
  try {
    const { data } = await api.get('/api/user/me');
    const balance = data.coinBalance ?? data.balance ?? data.coins ?? '-';
    divider();
    log(`👤 User     : ${data.username || data.first_name}`);
    log(`💰 Coin     : ${balance}`);
    log(`💵 Rupiah   : ${data.rupiahBalance ?? '-'}`);
    divider();
    return data;
  } catch (e) {
    log(`❌ getMe gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Status Farm ──────────────────────────────────────
async function getFarmStatus() {
  try {
    const { data } = await api.get('/api/farm/status');

    divider();
    log('🏡 FARM STATUS');
    divider('·');

    // Balances
    const animals = ['chicken', 'duck', 'goat', 'cow'];
    const balanceMap = {
      chicken : data.balances?.chickenEggBalance ?? 0,
      duck    : data.balances?.duckEggBalance    ?? 0,
      goat    : data.balances?.goatMilkBalance   ?? 0,
      cow     : data.balances?.cowMilkBalance    ?? 0,
    };
    const levelMap = {
      chicken : data.levels?.chickenLevel ?? 0,
      duck    : data.levels?.duckLevel    ?? 0,
      goat    : data.levels?.goatLevel    ?? 0,
      cow     : data.levels?.cowLevel     ?? 0,
    };

    log('  Hewan    Lv   Produk   Status         Next Claim');
    divider('·');
    for (const a of animals) {
      const timer   = data.timers?.find(t => t.animalType === a);
      const emoji   = ANIMAL_EMOJI[a]  || '🐾';
      const pemoji  = PRODUCT_EMOJI[a] || '📦';
      const lv      = String(levelMap[a]).padEnd(3);
      const stok    = String(`${pemoji} ${balanceMap[a]}`).padEnd(8);
      const ready   = timer?.isReady;
      const status  = ready ? '✅ SIAP PANEN ' : '⏳ ' + (getTimeLeft(timer?.nextClaimAt) ?? 'N/A   ');
      const next    = ready ? '-' : formatNextClaim(timer?.nextClaimAt);
      log(`  ${emoji} ${a.padEnd(7)} Lv${lv} ${stok} ${status}  ${next}`);
    }

    divider();
    return data;
  } catch (e) {
    log(`❌ getFarmStatus gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Harvest / Claim ──────────────────────────────────
async function harvest() {
  try {
    const { data } = await api.post('/api/farm/claim', { animalType: ANIMAL });
    divider();
    log(`✅ Harvest ${ANIMAL_EMOJI[ANIMAL] || ''} ${ANIMAL} berhasil!`);
    if (data.reward || data.amount) log(`🎁 Reward   : ${data.reward ?? data.amount}`);
    divider();
    return data;
  } catch (e) {
    log(`❌ Harvest gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Upgrade Farm ─────────────────────────────────────
async function upgrade() {
  try {
    const { data } = await api.post('/api/farm/upgrade', { animalType: ANIMAL });
    divider();
    log(`⬆️  Upgrade ${ANIMAL} berhasil!`);
    if (data.level) log(`📈 Level baru : ${data.level}`);
    divider();
    return data;
  } catch (e) {
    log(`❌ Upgrade gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Auto Harvest ─────────────────────────────────────
async function autoHarvest() {
  log('🔍 Mengecek status farm...');
  const status = await getFarmStatus();
  if (!status) return;

  const animal = status.timers?.find(t => t.animalType === ANIMAL);
  if (!animal) {
    log(`⚠️  Data ${ANIMAL} tidak ditemukan di timers.`);
    return;
  }

  if (animal.isReady) {
    log(`🌾 ${ANIMAL} siap dipanen!`);
    await harvest();
  } else {
    const timeLeft = getTimeLeft(animal.nextClaimAt);
    const next     = formatNextClaim(animal.nextClaimAt);
    divider('·');
    log(`⏳ Belum siap panen`);
    log(`⏱  Sisa waktu  : ${timeLeft}`);
    log(`📅 Next claim  : ${next}`);
    divider('·');
  }
}

// ─── Auto Upgrade ─────────────────────────────────────
async function autoUpgrade() {
  log('⬆️  Mencoba upgrade farm...');
  await getMe();
  await upgrade();
  await getMe();
  await getFarmStatus();
}

// ─── Run ──────────────────────────────────────────────
async function run() {
  console.log('\n' + '═'.repeat(45));
  console.log('🤖  BOT CATTLE FARM  —  Starting...');
  console.log('═'.repeat(45) + '\n');
  await getMe();
  await autoHarvest();
}

// ─── Cron ─────────────────────────────────────────────
cron.schedule('0 */2 * * *', async () => {
  log('\n🔄 Jadwal harvest otomatis...');
  await autoHarvest();
}, { timezone: 'Asia/Jakarta' });

cron.schedule('0 8 * * *', async () => {
  log('\n🔄 Jadwal upgrade otomatis...');
  await autoUpgrade();
}, { timezone: 'Asia/Jakarta' });

run();
