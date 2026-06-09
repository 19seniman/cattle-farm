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

// ─── Info User ────────────────────────────────────────
async function getMe() {
  try {
    const { data } = await api.get('/api/user/me');
    log(`👤 User: ${data.username || data.first_name} | Balance: ${data.balance ?? data.coins ?? '-'}`);
    return data;
  } catch (e) {
    log(`❌ getMe gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Status Farm ──────────────────────────────────────
async function getFarmStatus() {
  try {
    const { data } = await api.get('/api/farm/status');
    log(`🏡 Farm Status: ${JSON.stringify(data)}`);
    return data;
  } catch (e) {
    log(`❌ getFarmStatus gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Harvest / Claim ──────────────────────────────────
async function harvest() {
  try {
    const { data } = await api.post('/api/farm/claim', { animalType: ANIMAL });
    log(`✅ Harvest berhasil! ${JSON.stringify(data)}`);
    return data;
  } catch (e) {
    log(`❌ Harvest gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Upgrade Farm ─────────────────────────────────────
async function upgrade() {
  try {
    const { data } = await api.post('/api/farm/upgrade', { animalType: ANIMAL });
    log(`⬆️ Upgrade berhasil! ${JSON.stringify(data)}`);
    return data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    log(`❌ Upgrade gagal: ${msg}`);
  }
}

// ─── Auto Harvest (cek dulu sebelum claim) ────────────
async function autoHarvest() {
  log('🔍 Mengecek status farm...');
  const status = await getFarmStatus();
  if (!status) return;

  // Ambil data hewan — sesuaikan dengan struktur JSON aktual
  const animal = status[ANIMAL]
    || status.animals?.[ANIMAL]
    || status.farm?.[ANIMAL];

  if (!animal) {
    log(`⚠️ Data ${ANIMAL} tidak ditemukan di respons farm. Cek struktur JSON.`);
    return;
  }

  const isReady = animal.isReady ?? animal.canClaim ?? animal.ready ?? false;

  if (isReady) {
    log(`🌾 ${ANIMAL} siap dipanen!`);
    await harvest();
  } else {
    const sisa = animal.timeLeft ?? animal.nextHarvest ?? animal.remainingTime ?? '?';
    log(`⏳ Belum siap panen. Sisa waktu: ${sisa}`);
  }
}

// ─── Auto Upgrade (opsional, jalankan manual) ─────────
async function autoUpgrade() {
  log('⬆️ Mencoba upgrade farm...');
  await getMe();       // lihat balance dulu
  await upgrade();
  await getMe();       // lihat balance setelah upgrade
  await getFarmStatus();
}

// ─── Jalankan semua saat start ────────────────────────
async function run() {
  console.log('\n🤖 ====== Bot Cattle Farm Started ======\n');
  await getMe();
  await autoHarvest();
}

// ─── Jadwal Otomatis ──────────────────────────────────
// Cek harvest setiap 2 jam
cron.schedule('0 */2 * * *', async () => {
  log('\n🔄 Jadwal harvest otomatis...');
  await autoHarvest();
}, { timezone: 'Asia/Jakarta' });

// Upgrade otomatis setiap hari jam 08:00
cron.schedule('0 8 * * *', async () => {
  log('\n🔄 Jadwal upgrade otomatis...');
  await autoUpgrade();
}, { timezone: 'Asia/Jakarta' });

// Jalankan langsung
run();
