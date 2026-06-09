require('dotenv').config();
const axios  = require('axios');
const cron   = require('node-cron');
const readline = require('readline');

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

// ─── Helpers ──────────────────────────────────────────
const log    = (msg) => console.log(`[${new Date().toLocaleString('id-ID')}] ${msg}`);
const div    = (char = '─', len = 50) => console.log(char.repeat(len));
const divDot = () => div('·');
const divEq  = () => div('═');

function formatNextClaim(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('id-ID', {
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ANIMAL_EMOJI   = { chicken:'🐔', duck:'🦆', goat:'🐐', cow:'🐄' };
const PRODUCT_EMOJI  = { chicken:'🥚', duck:'🥚', goat:'🥛', cow:'🥛' };
const ANIMAL_LABEL   = { chicken:'Chicken', duck:'Duck', goat:'Goat', cow:'Cow' };

// ─── Upgrade cost table ────────────────────────────────
const UPGRADE_COST = {
  chicken: { 1:500,  2:1000, 3:2000, 4:4000, 5:8000,  6:15000, 7:30000, 8:60000,  9:100000 },
  duck:    { 1:600,  2:1200, 3:2500, 4:5000, 5:10000, 6:20000, 7:40000, 8:80000,  9:120000 },
  goat:    { 1:800,  2:1600, 3:3000, 4:6000, 5:12000, 6:25000, 7:50000, 8:90000,  9:150000 },
  cow:     { 1:1000, 2:2000, 3:4000, 4:8000, 5:15000, 6:30000, 7:60000, 8:100000, 9:200000 },
};
const MAX_LEVEL = 10;

function getUpgradeCost(animalType, currentLevel) {
  return UPGRADE_COST[animalType]?.[currentLevel] ?? null;
}

// ─── Readline helper ──────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── Info User ────────────────────────────────────────
async function getMe() {
  try {
    const { data } = await api.get('/api/user/me');
    const balance = data.coinBalance ?? data.balance ?? data.coins ?? 0;
    divEq();
    log(`👤 User     : ${data.username || data.first_name}`);
    log(`💰 Coin     : ${Number(balance).toLocaleString('id-ID')}`);
    log(`💵 Rupiah   : ${data.rupiahBalance ?? '-'}`);
    divEq();
    return data;
  } catch (e) {
    log(`❌ getMe gagal: ${e.response?.data?.message || e.message}`);
    return null;
  }
}

// ─── Status Farm ──────────────────────────────────────
async function getFarmStatus() {
  try {
    const { data } = await api.get('/api/farm/status');
    divEq();
    log('🏡 FARM STATUS');
    divDot();
    const balanceMap = {
      chicken: data.balances?.chickenEggBalance ?? 0,
      duck:    data.balances?.duckEggBalance    ?? 0,
      goat:    data.balances?.goatMilkBalance   ?? 0,
      cow:     data.balances?.cowMilkBalance    ?? 0,
    };
    const levelMap = {
      chicken: data.levels?.chickenLevel ?? 1,
      duck:    data.levels?.duckLevel    ?? 1,
      goat:    data.levels?.goatLevel    ?? 1,
      cow:     data.levels?.cowLevel     ?? 1,
    };
    log('  Hewan    Lv   Produk   Status           Next Claim');
    divDot();
    for (const a of ALL_ANIMALS) {
      const timer  = data.timers?.find(t => t.animalType === a);
      const emoji  = ANIMAL_EMOJI[a] || '🐾';
      const pemoji = PRODUCT_EMOJI[a] || '📦';
      const lv     = String(levelMap[a]).padEnd(3);
      const stok   = String(`${pemoji} ${balanceMap[a]}`).padEnd(8);
      const ready  = timer?.isReady;
      const status = ready ? '✅ SIAP PANEN  ' : '⏳ ' + (getTimeLeft(timer?.nextClaimAt) ?? 'N/A   ');
      const next   = ready ? '-' : formatNextClaim(timer?.nextClaimAt);
      log(`  ${emoji} ${a.padEnd(7)} Lv${lv} ${stok} ${status}  ${next}`);
    }
    divEq();
    return { raw: data, levelMap, balanceMap };
  } catch (e) {
    log(`❌ getFarmStatus gagal: ${e.response?.data?.message || e.message}`);
    return null;
  }
}

// ─── Harvest ──────────────────────────────────────────
async function harvest(animalType) {
  try {
    const { data } = await api.post('/api/farm/claim', { animalType });
    div();
    log(`✅ Harvest ${ANIMAL_EMOJI[animalType]} ${animalType} berhasil!`);
    if (data.reward || data.amount) log(`🎁 Reward   : ${data.reward ?? data.amount}`);
    div();
    return data;
  } catch (e) {
    log(`❌ Harvest ${animalType} gagal: ${e.response?.data?.message || e.message}`);
  }
}

// ─── Upgrade ──────────────────────────────────────────
async function upgrade(animalType) {
  try {
    const { data } = await api.post('/api/farm/upgrade', { animalType });
    div();
    log(`⬆️  Upgrade ${ANIMAL_EMOJI[animalType]} ${animalType} berhasil!`);
    if (data.level)   log(`📈 Level baru : ${data.level}`);
    if (data.message) log(`💬 Pesan      : ${data.message}`);
    div();
    return data;
  } catch (e) {
    const msg    = e.response?.data?.message || e.message;
    const status = e.response?.status;
    divDot();
    if (status === 400) {
      log(`⚠️  Upgrade ${animalType} gagal: ${msg} (koin tidak cukup / sudah max level)`);
    } else {
      log(`❌ Upgrade ${animalType} gagal: ${msg}`);
    }
    divDot();
    return null;
  }
}

// ─── Watch Ad ─────────────────────────────────────────
async function watchAdAndEarn() {
  try {
    log('📺 Memulai Watch Ad & Earn...');
    const watchDuration = Math.floor(Math.random() * 10000) + 5000;
    log(`⏱  Menonton iklan selama ${(watchDuration / 1000).toFixed(1)} detik...`);
    await sleep(watchDuration);
    const { data } = await api.post('/api/user/claim-ad-reward');
    div();
    log('✅ Watch Ad & Earn berhasil diklaim!');
    if (data.reward || data.amount || data.coins)
      log(`🎁 Reward : ${data.reward ?? data.amount ?? data.coins}`);
    if (data.coinBalance || data.balance)
      log(`💰 Saldo  : ${data.coinBalance ?? data.balance}`);
    div();
    return data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    if (e.response?.status === 400 || e.response?.status === 429) {
      divDot(); log(`⏳ Ad reward belum tersedia: ${msg}`); divDot();
    } else {
      log(`❌ Watch Ad gagal: ${msg}`);
    }
  }
}

// ─── Auto Harvest All ─────────────────────────────────
async function autoHarvestAll() {
  log('🔍 Mengecek status semua hewan...');
  const farm = await getFarmStatus();
  if (!farm) return;
  let harvested = 0;
  for (const animal of ALL_ANIMALS) {
    const timer = farm.raw.timers?.find(t => t.animalType === animal);
    if (!timer) { log(`⚠️  Data ${animal} tidak ditemukan.`); continue; }
    if (timer.isReady) {
      log(`🌾 ${ANIMAL_EMOJI[animal]} ${animal} siap dipanen!`);
      await harvest(animal);
      harvested++;
      await sleep(1000);
    }
  }
  if (harvested === 0) log('ℹ️  Tidak ada hewan yang siap dipanen saat ini.');
}

// ─── Auto Upgrade All ─────────────────────────────────
async function upgradeAll() {
  div();
  log('⬆️  UPGRADE SEMUA HEWAN');
  divDot();
  for (const animal of ALL_ANIMALS) {
    log(`🔧 Mencoba upgrade ${ANIMAL_EMOJI[animal]} ${animal}...`);
    await upgrade(animal);
    await sleep(1000);
  }
  log('✅ Proses upgrade semua hewan selesai.');
  div();
}

async function autoUpgrade() {
  log('⬆️  Mencoba upgrade semua hewan...');
  await getMe();
  await upgradeAll();
  await getMe();
  await getFarmStatus();
}

// ─── Get Join Tasks ───────────────────────────────────
async function getJoinTasks() {
  try {
    const { data } = await api.get('/api/quest/join-tasks');
    return data;
  } catch (e) {
    log(`❌ getJoinTasks gagal: ${e.response?.data?.message || e.message}`);
    return null;
  }
}

async function claimJoinTask(taskId, taskName) {
  try {
    const { data } = await api.post(`/api/quest/join-task/${taskId}/claim`);
    log(`✅ Claim task "${taskName}" berhasil!`);
    if (data.reward || data.amount || data.coins)
      log(`🎁 Reward : ${data.reward ?? data.amount ?? data.coins}`);
    if (data.message) log(`💬 Pesan  : ${data.message}`);
    return { success: true, data };
  } catch (e) {
    const msg    = e.response?.data?.message || e.message;
    const status = e.response?.status;
    divDot();
    if (status === 400) {
      log(`⚠️  Task "${taskName}" sudah diklaim sebelumnya atau belum tersedia.`);
    } else if (status === 403) {
      log(`🔒 Task "${taskName}" terkunci — akses ditolak.`);
    } else if (status === 404) {
      log(`❓ Task "${taskName}" tidak ditemukan di server.`);
    } else {
      log(`❌ Gagal claim task "${taskName}": ${msg}`);
    }
    log(`⚠️  PERHATIAN : Tugas join task "${taskName}" gagal diklaim otomatis.`);
    log(`📱  Silakan selesaikan tugas ini secara manual di aplikasi Telegram.`);
    divDot();
    return { success: false, reason: msg, status };
  }
}

async function autoJoinTasks() {
  divEq();
  log('📋 MEMPROSES JOIN TASKS...');
  divDot();
  const tasks = await getJoinTasks();
  if (!tasks) {
    log('⚠️  Gagal mengambil daftar task.');
    divEq();
    return;
  }
  const taskList = Array.isArray(tasks) ? tasks : (tasks.tasks ?? tasks.data ?? []);
  if (taskList.length === 0) {
    log('ℹ️  Tidak ada task yang tersedia.');
    divEq();
    return;
  }
  log(`📌 Ditemukan ${taskList.length} task.`);
  divDot();

  let claimed = 0, skipped = 0, failed = 0;
  const failedTasks = [];

  for (const task of taskList) {
    const taskId      = task.id ?? task.taskId;
    const taskName    = task.name ?? task.title ?? `Task #${taskId}`;
    const isCompleted = task.isCompleted ?? task.completed ?? false;
    const isClaimed   = task.isClaimed   ?? task.claimed   ?? false;

    if (isCompleted && isClaimed) {
      log(`⏭️  [SKIP] ${taskName}`);
      skipped++;
      continue;
    }

    log(`🔧 Memproses: ${taskName} (ID: ${taskId})`);
    const result = await claimJoinTask(taskId, taskName);

    if (result.success) {
      claimed++;
    } else {
      failed++;
      failedTasks.push(taskName);
    }
    await sleep(1000);
  }

  divDot();
  log(`✅ Diklaim  : ${claimed} task`);
  log(`⏭️  Dilewati : ${skipped} task`);
  log(`❌ Gagal    : ${failed} task`);

  if (failedTasks.length > 0) {
    divDot();
    log('📋 DAFTAR TASK YANG GAGAL DIKLAIM OTOMATIS:');
    failedTasks.forEach((name, i) => log(`   ${i + 1}. ${name}`));
    divDot();
    log('📱 Selesaikan task-task di atas secara MANUAL di aplikasi Telegram.');
  }

  divEq();
}

// ══════════════════════════════════════════════════════
//  MENU HARVEST
// ══════════════════════════════════════════════════════

function printAnimalMenu(title, showAll = true) {
  console.log(`\n  🐾 ${title}`);
  divDot();
  if (showAll) console.log('  [0] Semua Hewan');
  console.log('  [1] 🐔 Chicken');
  console.log('  [2] 🦆 Duck');
  console.log('  [3] 🐐 Goat');
  console.log('  [4] 🐄 Cow');
  console.log('  [9] ↩️  Kembali ke Menu Utama');
  divDot();
}

function animalFromChoice(choice) {
  const map = { '1':'chicken', '2':'duck', '3':'goat', '4':'cow' };
  return map[choice] ?? null;
}

async function menuHarvest() {
  printAnimalMenu('Pilih Hewan untuk Harvest', true);
  const choice = await prompt('  Masukkan pilihan: ');
  if (choice === '9') return;

  const farm = await getFarmStatus();
  if (!farm) return;

  if (choice === '0') {
    let harvested = 0;
    for (const animal of ALL_ANIMALS) {
      const timer = farm.raw.timers?.find(t => t.animalType === animal);
      if (timer?.isReady) {
        log(`🌾 ${ANIMAL_EMOJI[animal]} ${animal} siap dipanen! Memanen...`);
        await harvest(animal);
        harvested++;
        await sleep(800);
      } else {
        const timeLeft = getTimeLeft(timer?.nextClaimAt);
        log(`⏳ ${ANIMAL_EMOJI[animal]} ${animal} belum siap — sisa waktu: ${timeLeft}`);
      }
    }
    if (harvested === 0) log('ℹ️  Tidak ada hewan yang siap dipanen.');
    return;
  }

  const animalType = animalFromChoice(choice);
  if (!animalType) { log('❌ Pilihan tidak valid.'); return; }

  const timer = farm.raw.timers?.find(t => t.animalType === animalType);
  if (!timer) { log(`⚠️  Data ${animalType} tidak ditemukan.`); return; }

  divEq();
  log(`🔍 Status ${ANIMAL_EMOJI[animalType]} ${ANIMAL_LABEL[animalType].toUpperCase()}`);
  divDot();

  if (timer.isReady) {
    log(`  ✅ Status     : SIAP PANEN`);
    divEq();
    const konfirm = await prompt(`  Panen ${ANIMAL_LABEL[animalType]} sekarang? (y/n): `);
    if (konfirm.toLowerCase() === 'y') {
      await harvest(animalType);
    } else {
      log('  ↩️  Dibatalkan.');
    }
  } else {
    log(`  ⏳ Status     : Belum siap dipanen`);
    log(`  ⏱  Sisa Waktu : ${getTimeLeft(timer.nextClaimAt)}`);
    log(`  📅 Next Claim : ${formatNextClaim(timer.nextClaimAt)}`);
    divEq();
    log(`  ℹ️  ${ANIMAL_LABEL[animalType]} belum bisa dipanen saat ini.`);
  }
}

// ══════════════════════════════════════════════════════
//  MENU UPGRADE
// ══════════════════════════════════════════════════════

async function menuUpgrade() {
  printAnimalMenu('Pilih Hewan untuk Upgrade', true);
  const choice = await prompt('  Masukkan pilihan: ');
  if (choice === '9') return;

  const me   = await getMe();
  const farm = await getFarmStatus();
  if (!me || !farm) return;

  const coinBalance = Number(me.coinBalance ?? me.balance ?? me.coins ?? 0);

  if (choice === '0') {
    divEq();
    log('⬆️  PREVIEW UPGRADE SEMUA HEWAN');
    divDot();
    log(`  💰 Coin tersedia : ${coinBalance.toLocaleString('id-ID')}`);
    divDot();

    let totalBiaya = 0;
    const upgradeQueue = [];

    for (const animal of ALL_ANIMALS) {
      const currentLevel = farm.levelMap[animal] ?? 1;
      const cost         = getUpgradeCost(animal, currentLevel);
      const emoji        = ANIMAL_EMOJI[animal];

      if (currentLevel >= MAX_LEVEL) {
        log(`  ${emoji} ${animal.padEnd(7)} Lv${currentLevel}  → 🏆 MAX LEVEL`);
        continue;
      }
      if (cost === null) {
        log(`  ${emoji} ${animal.padEnd(7)} Lv${currentLevel}  → ⚠️  Data biaya tidak tersedia`);
        continue;
      }

      const cukup  = (coinBalance - totalBiaya) >= cost;
      const status = cukup ? '✅ Cukup' : '❌ Tidak cukup';
      log(`  ${emoji} ${animal.padEnd(7)} Lv${currentLevel} → Lv${currentLevel+1}  Biaya: ${cost.toLocaleString('id-ID')} koin  [${status}]`);
      if (cukup) {
        totalBiaya += cost;
        upgradeQueue.push(animal);
      }
    }

    divDot();
    log(`  💸 Total biaya   : ${totalBiaya.toLocaleString('id-ID')} koin`);
    log(`  💰 Sisa setelah  : ${(coinBalance - totalBiaya).toLocaleString('id-ID')} koin`);
    divDot();

    if (upgradeQueue.length === 0) {
      log('  ⚠️  Tidak ada hewan yang bisa diupgrade (coin tidak cukup / semua max level).');
      divEq();
      return;
    }

    log(`  📦 Hewan yang akan diupgrade: ${upgradeQueue.join(', ')}`);
    divEq();
    const konfirm = await prompt('  Lanjutkan upgrade semua? (y/n): ');
    if (konfirm.toLowerCase() !== 'y') { log('  ↩️  Dibatalkan.'); return; }

    for (const animal of upgradeQueue) {
      log(`🔧 Mengupgrade ${ANIMAL_EMOJI[animal]} ${animal}...`);
      await upgrade(animal);
      await sleep(1000);
    }
    log('✅ Selesai upgrade semua hewan.');
    return;
  }

  const animalType = animalFromChoice(choice);
  if (!animalType) { log('❌ Pilihan tidak valid.'); return; }

  const currentLevel = farm.levelMap[animalType] ?? 1;
  const cost         = getUpgradeCost(animalType, currentLevel);
  const emoji        = ANIMAL_EMOJI[animalType];
  const label        = ANIMAL_LABEL[animalType];

  divEq();
  log(`⬆️  DETAIL UPGRADE ${emoji} ${label.toUpperCase()}`);
  divDot();
  log(`  🐾 Hewan          : ${emoji} ${label}`);
  log(`  📊 Level saat ini : ${currentLevel}`);

  if (currentLevel >= MAX_LEVEL) {
    log(`  🏆 Status         : MAX LEVEL — tidak bisa upgrade lagi!`);
    divEq();
    return;
  }

  log(`  📈 Target level   : ${currentLevel + 1}`);
  log(`  💰 Coin kamu      : ${coinBalance.toLocaleString('id-ID')}`);

  if (cost === null) {
    log(`  ⚠️  Biaya upgrade  : Data tidak tersedia di tabel lokal`);
    divEq();
    const konfirm = await prompt('  Tetap coba upgrade? (y/n): ');
    if (konfirm.toLowerCase() === 'y') await upgrade(animalType);
    return;
  }

  const cukup    = coinBalance >= cost;
  const sisaCoin = coinBalance - cost;

  log(`  💸 Biaya upgrade  : ${cost.toLocaleString('id-ID')} koin`);

  if (cukup) {
    log(`  ✅ Status coin    : CUKUP`);
    log(`  💵 Sisa setelah 1x: ${sisaCoin.toLocaleString('id-ID')} koin`);
  } else {
    const kurang = cost - coinBalance;
    log(`  ❌ Status coin    : TIDAK CUKUP`);
    log(`  📉 Kekurangan     : ${kurang.toLocaleString('id-ID')} koin`);
    divEq();
    log(`  ℹ️  Kumpulkan lebih banyak koin untuk upgrade ${label}.`);
    return;
  }

  divDot();
  let simCoin  = coinBalance;
  let simLevel = currentLevel;
  let maxKali  = 0;
  const upgradeSimList = [];
  while (simLevel < MAX_LEVEL) {
    const simCost = getUpgradeCost(animalType, simLevel);
    if (simCost === null || simCoin < simCost) break;
    simCoin  -= simCost;
    simLevel += 1;
    maxKali  += 1;
    upgradeSimList.push({ from: simLevel - 1, to: simLevel, cost: simCost });
  }

  log(`  🔢 Maks upgrade    : ${maxKali}x  (Lv${currentLevel} → Lv${Math.min(currentLevel + maxKali, MAX_LEVEL)})`);
  log(`  💰 Sisa jika maks  : ${simCoin.toLocaleString('id-ID')} koin`);
  divDot();

  log(`  📋 Simulasi biaya per upgrade ${emoji} ${label}:`);
  upgradeSimList.forEach((sim, i) => {
    log(`     ${i + 1}. Lv${sim.from} → Lv${sim.to}  :  ${sim.cost.toLocaleString('id-ID')} koin`);
  });
  divDot();

  const inputKali = await prompt(`  Berapa kali upgrade ${label}? (1-${maxKali}, Enter = 1): `);
  const kali = Math.min(Math.max(parseInt(inputKali) || 1, 1), maxKali);

  let totalBiaya = 0;
  for (let i = 0; i < kali; i++) {
    const c = getUpgradeCost(animalType, currentLevel + i);
    if (c !== null) totalBiaya += c;
  }

  divEq();
  log(`  📦 KONFIRMASI UPGRADE ${emoji} ${label.toUpperCase()}`);
  divDot();
  log(`  🐾 Hewan          : ${emoji} ${label}`);
  log(`  🔁 Jumlah upgrade  : ${kali}x`);
  log(`  📊 Level saat ini  : ${currentLevel}`);
  log(`  📈 Level setelah   : ${currentLevel + kali}`);
  log(`  💸 Total biaya     : ${totalBiaya.toLocaleString('id-ID')} koin`);
  log(`  💰 Coin sekarang   : ${coinBalance.toLocaleString('id-ID')} koin`);
  log(`  💵 Sisa setelah    : ${(coinBalance - totalBiaya).toLocaleString('id-ID')} koin`);
  divDot();

  const konfirm = await prompt('  Lanjutkan upgrade? (y/n): ');
  if (konfirm.toLowerCase() !== 'y') { log('  ↩️  Dibatalkan.'); return; }

  let berhasil = 0;
  for (let i = 0; i < kali; i++) {
    log(`  🔧 Upgrade ke-${i + 1} dari ${kali}...`);
    const result = await upgrade(animalType);
    if (!result) {
      log(`  ⚠️  Proses berhenti pada upgrade ke-${i + 1}.`);
      break;
    }
    berhasil++;
    if (i < kali - 1) await sleep(800);
  }

  divEq();
  log(`✅ Selesai: ${berhasil} dari ${kali}x upgrade ${emoji} ${label} berhasil.`);
  log(`📊 Level sekarang: ${currentLevel + berhasil}`);
  divEq();
}

// ══════════════════════════════════════════════════════
//  MENU UTAMA
// ══════════════════════════════════════════════════════

function printMainMenu() {
  console.log('\n' + '═'.repeat(50));
  console.log('🤖  BOT CATTLE FARM  —  Menu Utama');
  console.log('═'.repeat(50));
  console.log('  [1] 🏡  Lihat Status Farm');
  console.log('  [2] 🌾  Harvest Hewan');
  console.log('  [3] ⬆️   Upgrade Hewan');
  console.log('  [4] 📋  Join & Claim Tasks');
  console.log('  [5] 📺  Watch Ad & Earn');
  console.log('  [6] 👤  Info Akun');
  console.log('  [0] 🚪  Keluar');
  console.log('─'.repeat(50));
}

async function mainMenu() {
  while (true) {
    printMainMenu();
    const choice = await prompt('  Masukkan pilihan: ');
    switch (choice) {
      case '1': await getFarmStatus();  break;
      case '2': await menuHarvest();    break;
      case '3': await menuUpgrade();    break;
      case '4': await autoJoinTasks();  break;
      case '5': await watchAdAndEarn(); break;
      case '6': await getMe();          break;
      case '0':
        console.log('\n👋 Bot dihentikan. Sampai jumpa!\n');
        process.exit(0);
      default:
        log('❌ Pilihan tidak dikenali. Coba lagi.');
    }
  }
}

// ─── ASCII Banner ─────────────────────────────────────
const ASCII_BANNER = `
@@@@@@@@@%#%###%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##%%%%%%%%%%%%%%%%@%%%**%%@@@@@%%%%%%@@@@@@@@@@@@@
@@@@@@@@@@@%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%####################%%%%%%%%%%%%%%@@@@@%%%%%%@@@@@@@@@@@@@
@@@@@@@@@@@@%%%%%%%%%%%%%%%%%#####%######**++++++++++++===++**####%%%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@%%%%%%%%%%%%%##########*+++*++*++++==+++++++*++++++++*###%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@%%%%%%%%%%%%##**+***+++++**++*++=**#***++*+++**+++++++*++*###%%%%%%@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@%%%%%%%%%%%%###*+++**+++*+++++++++==*#+=*+++*##*+++*#####*++*##%%%%%%@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@%%%%%%%%%%%##*++**++++*+++*++*++**+==+*+++++=+########**#**#+++*##%%%%%%%@@@@@@@@@@@@%@
@@@@@@@@@@@@@@@%%%%%%%##*+*##++*+**++***+*+***++**++==++++++###*#%%###%##+++++*##%%%%%%%%%%@@@@@@@@@
@@@@@@@@@@@@@@@%%%%%%##+*###+++++**++**++++=++*+++++=+++**+++%#%%%%%%#%#####*+++*###%%%%%%%%@@@@@@@@
@@@@@@@@@@@@@@@%%%%##+*####*++*++++***+*+++=++=*+==+##*######%%#%%%#%%#%#%%###**++*####%%%%%@@@@@@@@
@@@@@@@@@@@@@@%%%%#**###*##++=+++**+*=++++==+++++####%###%%##%%#%%#%###*%%#%#**#*+++*####%%%%@@@@@@@
@@@@@@@@@@@@%%%%%#+**##%%%#*+++=+*++++++++*+==+##%%%%%####%%%%%%###**###*#*######*+++**##%%%%%@@@@@@
@@@@@@@@@@%%%%%##+**##%%%%+*+++++=*#*=*#*+++##%%%%%%%%#%%%%%%%%%#%%%%%%####*#%%##*+++++##%%%%%@@@@@@
%%%%%@@@%%%#*##*++*##%%%%%*#*+++=########*++##%%%%%%%%#%%%%%%%%%#%%%%%%%%#%%%%%%##+*+*+*##%%%%@@@@@@
@@%%%%%%####***++*#*%#%%%##++*=+#####%###*=**##%%%%#*##%%%%%%%%%%#%%%%%%%%#%%%%%#*#+*+***##%%%@@@@@@
@%%%%%####%%#*+****#*#%%###+++*=###++**++=+*=##%%%%%%%#%%%%%%###%#%%%%%%%%%###%%%%##+*****#%%%%%@@@@
@%%##*##%%%##+*##***##*##%##*=+++*=+=#####*=+*####+#%##%%%%%%%%%%#%%%%%%%%%#%%%%###*#++++**#%%%%%%@%
%%%##*#%%%%#**####**#*##*#####+==+==***##*+**+=+*###########%%%%%##%%%%%%%%#%%%%%%%##*+**++#%%%%%%%%
%%%##%%%%%##+####%%***#*##**#####=++===*###**#*+=++##################################*++*++*#%%%%%%%
%%##%%%%%%#**####%%%#*#*#**##**###*++=+****#########**###############%%#%%%%#%%%%%%%*+**+*+*#%%%%%%%
%##%%%%%%%#+*#####%####+**+*#*+**+++=+=++***###*#####*################%#%##%#%%%%%%%***++**+#%%%%%%%
%#%%%%%%%#***###*#########*+***+++++====+++=====+**##*##############################+********#%%%%%@
%#%%%%%%%#***###################**+**+======+===+=-==+##############################*++*+**++#%%%%%%
##%%%%%%##***#*###*#################*****=+=+==+++====-+**#######*###################++*+*+++###%%%%
#########*+**#**+**##*#########**********-+=++=*+=+++=====+++++****##################*+*+++++*###%%%
#*#######*++***#**###*#****************+=+==++==++=++-===--=+++++++++++*############*+*++*+++***#%%%
#*######**++**************************==+==++=:-==-++++=+*%@@@%*++**++*++*+++****#**+=++++++######*#%
**+**#****+++***********************++-=++=+====-=+#%@@@@@@@@@@@@%**++**++*+++****#**++++++++######*
**+**##****=+******************+*****+-+=-+=+==*+++*@@@@@@@@@@@@@@@@%***++**+++++*****=++++++#######
**********++=+++*****+****++***+*****+=-+==+=++*+++=%@@@@@@@@@@@@@@@@@%#****==*++++++*++====**######
#*********++=++++++++++++++++++++++++++-++=======%%%#@@@@@@@@@@@@@@@@@@@%%*++**+++=+++***+=+***#####
#**********+==++++++=+++++++++++++++++++==+-+#%@@@@@@@@@@@@@@@@@@@@@@@@@@@%#+++++++++++++==****#####
###********++==++++++++++++++++++++++++++==++#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#+++++++++++++=+*****##*#
###****+***+++====+++++=+======+=======++++-#%@@@@@@@@@@@@@@@#@@@@@@@@@@@@@#++++++++++++=++++++++**#
*******+++++++===============================%%@@@@@@@@@@@@@@=+@@@@@@@@@@@@#++++++++++++=++++++++***
****+++++++++++=-==========================-=+*@@@@@@@@@@@@@*=*@@@@@@@@@@@@#=++++=++====++*******###
*#***++++++++=++=-=-=======================-=%@@@@@@@@@@@@@*=++#@@@@@@@@@@@#++++=++====++++*********
###*#*#*+***++++==---======================+@@@@@@@@@@@@@@++++++++@@@@@@@@@*+++==+==-=+++******#****
#***#******+++++++=----====================-%@@@@@@@@@@@@@*+++++=+#@@@@@@@@@%++======-+++++*******####
****#*******++++++++=----===================*@@@+*@@@@@@@@@@*+++=++@@@@@@@@@%======-=+++++***#*####*##
#**#******+*=+++===+===-:-================-#@@@%%@@@@@@@@@@@@@@@@@@@@@@@@@@@%+===---==+++++****+*#####
#**********++++==+=++===--:-===============%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*=--===+++*******########
***##*##***++++=++=+++=====---===========*%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#-=++++++++*****##*######
#**#####****+++=+++++========-:----=====#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+++++*+=+++*******#**###
#**###*#******+=+++++++++=======-----:--#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#+++++*+********#***#####
#*######+**+++*++++++===++==========----+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*++++++******++++****#****
#*###*#*++++++++*+++++++++++++===-======%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*+++********+*#**+*#*#****+
**#*************+*+++++++++++++======++=#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=+**************#*#**######
*****#***********+++++++++=+======-=+==*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*==+************+%%#****#####
**#*##*************+++++++++===========#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#=+++********+**#%%%%***######
***************+**++++++++++=====+++=+=%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#+***+*****+**+**##%%##**######
*********+++++++******+++*#######*++=+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*=+++++**+++**+++*#%%%%*+**+*#**
*+******+++*%%%%%%%**+++#%%%%%%%%#*+++@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@====+++++++++++*++*##%%#****++*##
*+**###****%%%%%%%%%%%++##%%##%%##*==*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@====+=========+++++*##%%#**#######
@*+*####%%%%%###%%%%#*++#%%%##%%##*++%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*+++--====+++++++*+*#####*****####
@@@#####***#***+#+*+##++*%%%%#%%##*=*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#***+=++++++***++++*#####*********
@@%@%###%%%%%%%%%%%%##*=*#%#%%%%####%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%++++++=+=++++*++++*#####*+++++*%%
@@%%%###%%%%%%%%%%%%##*-+#%#%#%####%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%+++=======++++++++##*####%%####@@
@%%#@#**%########%###**-+#%#%####%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*++===-=+=+++**#######*##%%%%%@@
%###@#**#%%%########*#*=+######%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#++*##+=-+===+++#######*#%%%%%%%@
@%@@@#**##############*=+###%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*+=*###%%%#++++*########%%%%%%@@
@@@@%%**#############*+==#%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#=+***%%%%%%%%####***##%%%%%@%@
@@@@@%#*#######******+++#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%+***#%@@@@@@@#*****###%%%%%@@
@@@@@@#****++++++*++++%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%%@#%%%#@#**+**#####%%%@@
@@@@@@%+***+++*****+*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@%**+++*#####%%@@
@@@@@@%++**++#%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@%%++++*#####%%@@
@@@@@@%++++*%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%*++**####%#@@
@@@@@@%++++%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*+***##*#%@@
@@@@@@@*++*%%%%%%@@@@@@%##%%#%%%%%%%%#%%##@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*+*****#@@%
@@@@@@@****%%%#%@@@%%%*++*##############**@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%*##*####%@@#
@@@@@@@****%%%#%%#%%%%#++*##*##*########**@@@@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#####*##@@@@
@@@@@@@#*+*%%%##%%%%%%#++*%%*#*****#####*+@@@@@@@@@%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#**####*#%@@%
@@@@@@@#**+%%%%%%%%%%%##%%%%%%#****#####*=*@@@@@@@@%%%%@@@@@@@@@@%###*++%#%@@@%@@@@@@@@@@#+*****%%%@%@
@@@@@@%%**#%%%%%%%%%%##%%%%%%##*****####*=*@@@@@@@@%%@%@@@@@@@@@@%#*****%#%%@@@@@@@@@@@@%*******#@@@%%
@@@@@@%%*#%%%%%%%%%%%###*****##++++*####*+%@@@@@@@@%%%%@@@@@@@@@@%#*****%#%@@%@@@@@@@@@@%********@@@@%
@@@@@%%%#%%%%%%%%%%%%##########+++++####++%@@@@@@@@%%%%@@@@@@@@@@%#****#%#@@@%@@@@%@@@@@%*******#@@@@@
@@@@@%@@%%%%%%%%%%%%%##%#######+########++#@@@@@@@@%%%%@@@@@@@@@@##*****%#%@@%@@@@@@@@@@%*******#%@@@@
@@@@@@@@%%%%%%%%%%%%############%%%##***++*@@@@@@@@%%%%@@@@@@@@@@#*******%%@@#%@@@@@@@@@%*******#@@@@@
@@@@@@@@%%%%%%%%%%%%###########%%%%%#***+=+@@@@@@@@%%%%@@@@@@@@@@#*+++*%*###%%%##%%%%%%*######%%@@@%
@@@@@@@@%%%%%%%%%%%##*########%%%%%%#++++++@@@@@@@@%%%%@@@@@@@@@%#*++**%%%*####**%%###%#***###%@@@%%
@@@@@@@%%%%####*#%###########%%%%%%%%#+=+++@@@@@@@@@@@@@@@@@@@@@%%#++**%%%%%%%%%%%%%%%%#***#%%%@%@%%
@@@@@@@%%%###########*#*****#%%%%%%%%#=++==@@@@@@@@@@@@@@@@@@@@@%%%%*++%%%%%%%%%%%%%%%%%####%%@@@%@@
@@@@@@@@@%%%#######*##%#****%%%%%%%%%#+*+++#@@@@@@@@@@@@@@@@@@@@%%%%%++%%%%%%%%%%%%%%%%%%###%%@@@%@%
@@@@@@@%@@@@@@@%%%***%%*****%%%%%%%%%#+*++++@@@@@@@@@@@@@@@@@@@@%%%%%*+%%%%%%%%%%%%%%%%%@###%%@@@@%%
@@@@@@@@@@@@@@@@@%*+##%*****########%#++++++#@@@@@@@@@@@@@@@@@@%%%%%%#*%%%%%%%%%%%%%%%%%%###%%@%@@@@
@@@@@@@@@@@@@@@@%%**###*****########%#*+++++*@@@@@@@@@@@@@@@@@@%%%%%%%*%%%%%%%%%%%%%%%%%%%%%%%@@@@@@
@@@@@@@@@@@@@@@@%%##********##########*+=+++#@@@@@@@@@@@@@@@@@@%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@@@@@%
@@@@@@@@@@@@@@@%%%%*+**%%%%#%%%%%%%%%%##****%%@@@@@@@@@@@@@@@@@@%%@@%@%%%%%%%%%%%%%%%%%%%%%%%@@@@@@@
@@@@@@@@@%@@@@@%%%%***#@@@@@@%@@%@@%%%%@@@%@@@@@@@@@@@@%@@%@%%%%%%@@%@@%@@%%@@%@@%@@%%%%%%%%%@@@@@@@
@@@@@@@@@@@@@@%%%%%***%@@@@@@@@@@@@%%%%@%@%@%%@%@@%@%%@%@@%@%%%@%%@@%@@@%@@%@@%@@@@@@%%%%%%%%@@@@@@@
@@@@@@@@@@@@@%%%%%%**#@@@@@@@@@@@@@%@@@%%@%%%%@%%%%@%@@%@%%@%%%%%%@@@%@@%@@@@@@%@@%@@@%%%%%%%@@@@@@@
@@@@@@@@@@@@@@%%%%%##@@@@@@@@@@@@@@@@@@@@@%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@%@@@@@@@%##%#%@@@@@@@
@@@@@@@@@@@@@%@%%%%#%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@####%%@@@@@@
@@@@@@@@@@@@@@%%%%%#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%@@@@@@@
@@@@@@@@@@@@@@@%%%%#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@@@
@@@@@@@@@@@@@@%%%%%#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@
@@@@@@@@@@@@@@%%%%%#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@`;

// ─── Run ──────────────────────────────────────────────
async function run() {
  console.log(ASCII_BANNER);
  console.log('\n' + '═'.repeat(50));
  console.log('🤖  BOT CATTLE FARM  —  Starting...');
  console.log('═'.repeat(50) + '\n');

  await getMe();
  await autoHarvestAll();
  await watchAdAndEarn();
  await autoJoinTasks();

  await mainMenu();
}

// ─── Cron Jobs ────────────────────────────────────────
cron.schedule('0 */2 * * *', async () => {
  log('\n🔄 [CRON] Harvest otomatis semua hewan...');
  await autoHarvestAll();
}, { timezone: 'Asia/Jakarta' });

cron.schedule('0 8 * * *', async () => {
  log('\n🔄 [CRON] Upgrade otomatis semua hewan...');
  await autoUpgrade();
}, { timezone: 'Asia/Jakarta' });

cron.schedule('*/10 * * * *', async () => {
  try {
    const dur = Math.floor(Math.random() * 10000) + 5000;
    await sleep(dur);
    await api.post('/api/user/claim-ad-reward');
    log('📺 [CRON] Watch Ad diklaim.');
  } catch (_) {}
}, { timezone: 'Asia/Jakarta' });

cron.schedule('5 0 * * *', async () => {
  log('\n🔄 [CRON] Auto join tasks harian...');
  await autoJoinTasks();
}, { timezone: 'Asia/Jakarta' });

run();
