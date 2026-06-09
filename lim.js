require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');

const ANIMAL = process.env.ANIMAL_TYPE || 'chicken';
const ALL_ANIMALS = ['chicken', 'duck', 'goat', 'cow'];

const api = axios.create({
  baseURL: process.env.BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': process.env.BASE_URL,
    'Referer': `${process.env.BASE_URL}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0'
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    for (const a of ALL_ANIMALS) {
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
async function harvest(animalType = ANIMAL) {
  try {
    const { data } = await api.post('/api/farm/claim', { animalType });
    divider();
    log(`✅ Harvest ${ANIMAL_EMOJI[animalType] || ''} ${animalType} berhasil!`);
    if (data.reward || data.amount) log(`🎁 Reward   : ${data.reward ?? data.amount}`);
    divider();
    return data;
  } catch (e) {
    log(`❌ Harvest ${animalType} gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Upgrade Farm (single animal) ─────────────────────
async function upgrade(animalType = ANIMAL) {
  try {
    const { data } = await api.post(
      '/api/farm/upgrade',
      { animalType },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': process.env.BASE_URL,
          'Referer': `${process.env.BASE_URL}/`,
        }
      }
    );
    divider();
    log(`⬆️  Upgrade ${ANIMAL_EMOJI[animalType] || ''} ${animalType} berhasil!`);
    if (data.level)   log(`📈 Level baru : ${data.level}`);
    if (data.message) log(`💬 Pesan      : ${data.message}`);
    divider();
    return data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    const status = e.response?.status;
    divider('·');
    if (status === 400) {
      log(`⚠️  Upgrade ${animalType} gagal: ${msg} (koin tidak cukup / sudah max level)`);
    } else {
      log(`❌ Upgrade ${animalType} gagal: ${msg}`);
    }
    divider('·');
  }
}

// ─── Upgrade All Animals ───────────────────────────────
async function upgradeAll() {
  divider();
  log('⬆️  UPGRADE SEMUA HEWAN');
  divider('·');

  for (const animal of ALL_ANIMALS) {
    log(`🔧 Mencoba upgrade ${ANIMAL_EMOJI[animal]} ${animal}...`);
    await upgrade(animal);
    await sleep(1000); // jeda 1 detik antar request
  }

  log('✅ Proses upgrade semua hewan selesai.');
  divider();
}

// ─── Watch Ad & Earn ──────────────────────────────────
async function watchAdAndEarn() {
  try {
    log('📺 Memulai Watch Ad & Earn...');

    // Simulasi durasi menonton iklan (5–15 detik acak)
    const watchDuration = Math.floor(Math.random() * 10000) + 5000;
    log(`⏱  Menonton iklan selama ${(watchDuration / 1000).toFixed(1)} detik...`);
    await sleep(watchDuration);

    // Klaim reward setelah nonton iklan
    const { data } = await api.post('/api/user/claim-ad-reward');
    divider();
    log('✅ Watch Ad & Earn berhasil diklaim!');
    if (data.reward || data.amount || data.coins) {
      log(`🎁 Reward   : ${data.reward ?? data.amount ?? data.coins}`);
    }
    if (data.coinBalance || data.balance) {
      log(`💰 Saldo    : ${data.coinBalance ?? data.balance}`);
    }
    divider();
    return data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    if (e.response?.status === 400 || e.response?.status === 429) {
      divider('·');
      log(`⏳ Ad reward belum tersedia: ${msg}`);
      divider('·');
    } else {
      log(`❌ Watch Ad gagal: ${msg}`);
    }
  }
}

// ─── Auto Watch Ad Loop ───────────────────────────────
async function autoWatchAd() {
  log('\n📺 Jadwal Watch Ad & Earn...');
  await watchAdAndEarn();
}

// ─── Auto Harvest (single animal) ─────────────────────
async function autoHarvest(animalType = ANIMAL) {
  log(`🔍 Mengecek status farm untuk ${animalType}...`);
  const status = await getFarmStatus();
  if (!status) return;

  const animal = status.timers?.find(t => t.animalType === animalType);
  if (!animal) {
    log(`⚠️  Data ${animalType} tidak ditemukan di timers.`);
    return;
  }

  if (animal.isReady) {
    log(`🌾 ${animalType} siap dipanen!`);
    await harvest(animalType);
  } else {
    const timeLeft = getTimeLeft(animal.nextClaimAt);
    const next     = formatNextClaim(animal.nextClaimAt);
    divider('·');
    log(`⏳ ${animalType} belum siap panen`);
    log(`⏱  Sisa waktu  : ${timeLeft}`);
    log(`📅 Next claim  : ${next}`);
    divider('·');
  }
}

// ─── Auto Harvest All Animals ─────────────────────────
async function autoHarvestAll() {
  log('🔍 Mengecek status semua hewan...');
  const status = await getFarmStatus();
  if (!status) return;

  let harvested = 0;
  for (const animal of ALL_ANIMALS) {
    const timer = status.timers?.find(t => t.animalType === animal);
    if (!timer) {
      log(`⚠️  Data ${animal} tidak ditemukan di timers.`);
      continue;
    }
    if (timer.isReady) {
      log(`🌾 ${ANIMAL_EMOJI[animal]} ${animal} siap dipanen!`);
      await harvest(animal);
      harvested++;
      await sleep(1000);
    }
  }

  if (harvested === 0) {
    log('ℹ️  Tidak ada hewan yang siap dipanen saat ini.');
  }
}

// ─── Auto Upgrade ─────────────────────────────────────
async function autoUpgrade() {
  log('⬆️  Mencoba upgrade semua hewan...');
  await getMe();
  await upgradeAll();
  await getMe();
  await getFarmStatus();
}

// ─── Run ──────────────────────────────────────────────
async function run() {
  console.log('\n' + '═'.repeat(45));
  console.log('🤖  BOT CATTLE FARM  —  Starting...');
  console.log('═'.repeat(45) + '\n');
  await getMe();
  await autoHarvestAll();

  // Langsung coba watch ad pertama kali saat bot start
  await watchAdAndEarn();
}

// ─── Cron ─────────────────────────────────────────────

// Auto harvest semua hewan setiap 2 jam
cron.schedule('0 */2 * * *', async () => {
  log('\n🔄 Jadwal harvest otomatis (semua hewan)...');
  await autoHarvestAll();
}, { timezone: 'Asia/Jakarta' });

// Auto upgrade semua hewan setiap pukul 08:00
cron.schedule('0 8 * * *', async () => {
  log('\n🔄 Jadwal upgrade otomatis (semua hewan)...');
  await autoUpgrade();
}, { timezone: 'Asia/Jakarta' });

// Watch Ad & Earn setiap 10 menit
cron.schedule('*/10 * * * *', async () => {
  await autoWatchAd();
}, { timezone: 'Asia/Jakarta' });

run();
