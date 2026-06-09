link Project : https://t.me/blockchainproject_19/4048

```

<div align="center">

# 🐄 BOT CATTLE FARM 🐔

### Bot otomatis untuk game **Cattle Farm** di Telegram
> Harvest • Upgrade • Convert • Watch Ads • Claim Tasks — semua autopilot!

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Telegram](https://img.shields.io/badge/Platform-Telegram-2CA5E0?style=for-the-badge&logo=telegram)](https://t.me)

</div>

---

## 📖 Daftar Isi

- [✨ Fitur Unggulan](#-fitur-unggulan)
- [⚙️ Persyaratan Sistem](#️-persyaratan-sistem)
- [🚀 Instalasi & Setup](#-instalasi--setup)
- [🔑 Konfigurasi .env](#-konfigurasi-env)
- [▶️ Cara Menjalankan](#️-cara-menjalankan)
- [🗺️ Panduan Menu](#️-panduan-menu)
- [⏰ Cron Job Otomatis](#-cron-job-otomatis)
- [❓ FAQ & Troubleshooting](#-faq--troubleshooting)

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
| 🌾 **Auto Harvest** | Panen otomatis semua hewan saat sudah siap |
| ⬆️ **Smart Upgrade** | Upgrade dengan simulasi biaya & preview koin tersisa |
| 💱 **Convert Produk** | Konversi telur/susu ke koin dengan info rate realtime |
| 📺 **Watch Ads** | Mode manual (1x + cooldown) atau berurutan hingga 50x |
| 📋 **Auto Tasks** | Klaim semua join task secara otomatis |
| 👤 **Info Akun** | Cek saldo koin & rupiah kapan saja |
| ⏰ **Cron Jobs** | Harvest & watch ads berjalan otomatis di background |
| 🖼️ **ASCII Banner** | Tampilan keren saat bot dijalankan |

---

## ⚙️ Persyaratan Sistem

Pastikan perangkatmu sudah terinstal:

- **Node.js** versi `18.x` atau lebih baru → [Download di sini](https://nodejs.org)
- **npm** (biasanya sudah terinstal bersama Node.js)
- **Git** → [Download di sini](https://git-scm.com)
- Akun **Telegram** yang sudah bermain Cattle Farm
- **Bearer Token** dari game (lihat cara mendapatkannya di bawah)

Cek versi Node.js kamu:
```bash
node -v   # harus v18 ke atas
npm -v
```

---

## 🚀 Instalasi & Setup

### Langkah 1 — Clone Repository

```bash
git clone https://github.com/19seniman/cattle-farm.git
```

```bash
cd cattle-farm
```

### Langkah 2 — Install Dependencies

Install semua package yang dibutuhkan:

```bash
npm install axios
```
> 📡 Untuk HTTP request ke API game

```bash
npm install dotenv
```
> 🔐 Untuk membaca konfigurasi dari file `.env`

```bash
npm install node-cron
```
> ⏰ Untuk menjalankan tugas otomatis terjadwal

Atau install semuanya sekaligus dengan satu perintah:

```bash
npm install axios dotenv node-cron
```

---

## 🔑 Konfigurasi .env

### Langkah 3 — Buat File .env

Buat file konfigurasi dengan perintah berikut:

```bash
nano .env
```

Isi file `.env` dengan format seperti ini:

```env
# ───────────────────────────────────────────
#   KONFIGURASI BOT CATTLE FARM
# ───────────────────────────────────────────

# URL base API game
BASE_URL=https://www.cattlefarmonly.my.id

# Bearer token dari akun kamu (lihat cara mendapatkan di bawah)
BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (Opsional) Tipe hewan default
ANIMAL_TYPE=chicken
```

Simpan file dengan menekan `CTRL + X` → `Y` → `Enter`

---

### 🔍 Cara Mendapatkan Bearer Token

1. Buka game **Cattle Farm** di Telegram
2. Tekan `F12` untuk membuka **DevTools** browser
3. Pilih tab **Network**
4. Lakukan aksi apa saja di game (klik harvest, dll)
5. Cari request ke `cattlefarmonly.my.id`
6. Klik salah satu request → lihat tab **Headers**
7. Temukan bagian `Authorization: Bearer eyJ...`
8. Salin nilai token tersebut (bagian setelah kata `Bearer `)
9. Tempel ke file `.env` di bagian `BEARER_TOKEN=`

> ⚠️ **Penting:** Token biasanya expired dalam 30 hari. Perbarui token secara berkala agar bot tetap berjalan.

---

## ▶️ Cara Menjalankan

### Langkah 4 — Jalankan Bot

```bash
node lim.js
```

Saat berhasil, akan muncul ASCII art keren diikuti tampilan seperti ini:

```
══════════════════════════════════════════
🤖  BOT CATTLE FARM  —  Starting...
══════════════════════════════════════════

[10/6/2026] 👤 User     : ElRaga7
[10/6/2026] 💰 Coin     : 125.000
[10/6/2026] 🔍 Mengecek status semua hewan...
```

Bot akan otomatis:
1. ✅ Cek info akun
2. ✅ Harvest semua hewan yang siap
3. ✅ Klaim Watch Ad
4. ✅ Proses semua Join Tasks
5. 🗺️ Tampilkan **Menu Utama**

---

## 🗺️ Panduan Menu

```
══════════════════════════════════════════════════
🤖  BOT CATTLE FARM  —  Menu Utama
══════════════════════════════════════════════════
  [1] 🏡  Lihat Status Farm
  [2] 🌾  Harvest Hewan
  [3] ⬆️   Upgrade Hewan
  [4] 📋  Join & Claim Tasks
  [5] 📺  Watch Ad & Earn
  [6] 💱  Convert Produk
  [7] 👤  Info Akun
  [0] 🚪  Keluar
──────────────────────────────────────────────────
```

### 🏡 [1] Status Farm
Menampilkan status lengkap semua hewan beserta:
- Level hewan saat ini
- Stok produk (telur/susu)
- Status panen (`✅ SIAP PANEN` atau `⏳ HH:MM:SS`)
- Waktu panen berikutnya

### 🌾 [2] Harvest Hewan
Pilih hewan mana yang ingin dipanen:
- `[0]` Harvest semua hewan sekaligus
- `[1-4]` Harvest hewan tertentu saja
- Bot otomatis cek apakah sudah siap sebelum memanen

### ⬆️ [3] Upgrade Hewan
Upgrade dengan informasi lengkap:
- Preview biaya koin per upgrade
- Simulasi berapa kali bisa upgrade dengan saldo saat ini
- Input jumlah upgrade sekaligus (misal: 3x upgrade sekaligus)
- Konfirmasi sebelum eksekusi

### 📺 [5] Watch Ad & Earn
Dua mode tersedia:

| Mode | Cara Kerja |
|------|-----------|
| 🖐 **Manual** | Tonton 1x ads → cooldown 10 menit → selesai otomatis |
| 🔁 **Berurutan** | Tonton berulang 1–50x, atur jeda antar ads (min 5 detik) |

### 💱 [6] Convert Produk
Konversi hasil produksi menjadi koin:

| Pilihan | Item |
|---------|------|
| `[1]` | 🥚 Chicken Egg |
| `[2]` | 🥚 Duck Egg |
| `[3]` | 🥛 Goat Milk |
| `[4]` | 🥛 Cow Milk |
| `[5]` | 📜 Riwayat Convert |

Bot otomatis menampilkan:
- Stok yang tersedia
- Rate koin per item (realtime dari server)
- Estimasi total koin sebelum konfirmasi

---

## ⏰ Cron Job Otomatis

Bot menjalankan tugas terjadwal di background secara otomatis:

| Jadwal | Tugas |
|--------|-------|
| Setiap **2 jam** | 🌾 Auto harvest semua hewan |
| Setiap **10 menit** | 📺 Auto klaim Watch Ad |
| Jam **08:00** setiap hari | ⬆️ Auto upgrade semua hewan |
| Jam **00:05** setiap hari | 📋 Auto join tasks harian |

> Semua cron job menggunakan timezone **Asia/Jakarta (WIB)**

---

## ❓ FAQ & Troubleshooting

**❌ Error: `Cannot find module 'axios'`**
```bash
npm install axios dotenv node-cron
```

**❌ Error: `401 Unauthorized`**
> Token kamu sudah expired. Ambil token baru dari browser dan perbarui file `.env`

**❌ Error: `ENOTFOUND` atau koneksi gagal**
> Cek koneksi internet. Pastikan BASE_URL di `.env` sudah benar.

**⏳ Bot tidak harvest padahal sudah waktunya**
> Cron job berjalan setiap 2 jam. Atau gunakan menu `[2]` untuk harvest manual.

**🔑 Token berapa lama berlaku?**
> Token biasanya berlaku sekitar 30 hari. Jika bot tiba-tiba error 401, perbarui tokennya.

---

<div align="center">

---

Made with ❤️ by [19seniman](https://github.com/19seniman)

⭐ Jangan lupa **star** repo ini kalau bermanfaat!

</div>
