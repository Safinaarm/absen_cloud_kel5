# Sistem Absensi Mahasiswa - QR Code Generator & Presence Recorder
Link Deploy: https://script.google.com/macros/s/AKfycbwqMFE4sAPV4GZ8jxKhUri1TpV7vTGVTpyF66tYn5F96vc-P1tnYaV5Kh6y9RwwNS8/exec 

Sistem absensi digital yang menggunakan QR code untuk mencatat kehadiran mahasiswa. Repository ini menangani **generate QR code** dan **penyimpanan data absensi di Google Sheets**.

---

## Arsitektur Sistem

Sistem ini terdiri dari **2 repository** yang harus diinstall dan dikonfigurasi bersama:

### 1. **Repository Ini** (QR Generator & Presence Recorder)
- Generate QR code untuk sesi perkuliahan
- Menerima data checkin dari scanner
- Menyimpan data kehadiran ke Google Sheets

### 2. **Repository Scanner** 
- URL: https://github.com/Safinaarm/Kamera_Scan.git
- Scan QR code menggunakan kamera
- Mengirim data absensi ke repository ini

**Kedua repository harus diinstall dan dikonfigurasi bersama untuk sistem bekerja optimal.**

---

## Stack & Dependencies

### Backend
- **Google Apps Script**: Menjalankan API untuk generate token QR dan proses checkin
- **Google Sheets API**: Menyimpan data tokens dan presence records

### Frontend  
- **HTML/JavaScript**: Halaman checkin sederhana
- **PHP Service**: QR generation helper (`src/QrService.php`)

---

## File Struktur

```
.
├── Kode.js                    # Google Apps Script utama
├── appsscript.json           # Konfigurasi Google Apps Script
├── checkin-public.html        # HTML halaman checkin
├── src/
│   └── QrService.php         # Service untuk generate QR (helper)
├── tests/
│   └── QrServiceTest.php      # Unit test untuk QrService
└── README.md                  # Dokumentasi ini
```

---

## Setup & Instalasi

### Prerequisites
- Google Account dengan Google Sheets dan Google Apps Script access
- Editor teks atau IDE (untuk edit Google Apps Script)
- Browser modern untuk akses halaman checkin

### Step 1: Setup Google Sheets

1. **Buat Spreadsheet baru** di Google Drive
2. **Buat 2 sheet baru** dengan nama:
   - `tokens` - untuk menyimpan QR tokens
   - `presence` - untuk menyimpan data kehadiran

**Sheet: `tokens`**
Kolom:
- A: `qr_token`
- B: `course_id`
- C: `session_id`
- D: `expires_at`
- E: `ts` (timestamp)

**Sheet: `presence`**
Kolom:
- A: `presence_id`
- B: `user_id`
- C: `device_id`
- D: `course_id`
- E: `session_id`
- F: `qr_token`
- G: `status`
- H: `ts` (timestamp)

3. **Copy Spreadsheet ID** dari URL
   - Format: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### Step 2: Setup Google Apps Script

1. Buka [Google Apps Script Console](https://script.google.com)
2. **Buat project baru**
3. **Copy seluruh kode** dari `Kode.js` ke editor Apps Script
4. **Update SPREADSHEET_ID** di baris atas:
   ```javascript
   const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
   ```
5. **Deploy sebagai Web App**:
   - Klik `Deploy` → `New Deployment`
   - Type: `Web app`
   - Execute as: `Me` (akun Google Anda)
   - Who has access: `Anyone`
   - Catat URL yang digenerate (format: `https://script.google.com/macros/s/.../exec`)

6. **Update BASE_WEBAPP_URL** di `Kode.js` dengan URL dari step 5

### Step 3: Upload HTML ke GitHub Pages (Optional)

Jika ingin akses publik untuk halaman checkin:
1. Push `checkin-public.html` ke GitHub repository
2. Enable GitHub Pages
3. Akses via: `https://username.github.io/repo/checkin-public.html`

### Step 4: Install Repository Scanner

```bash
git clone https://github.com/Safinaarm/Kamera_Scan.git
cd Kamera_Scan
```

Update konfigurasi scanner dengan BASE_WEBAPP_URL dari Step 2.

---

## API Endpoints

Semua endpoint dijalankan via Google Apps Script.

### 1. Generate QR Token
**Endpoint**: `GET/POST ?action=generate`

**Response**:
```json
{
  "ok": true,
  "data": {
    "qr_token": "TKN-ABC123DEF",
    "course_id": "cloud-101",
    "session_id": "sesi-100000",
    "expires_at": "2024-02-25T10:30:00Z",
    "checkin_url": "https://script.google.com/.../exec?mode=checkin&qr_token=..."
  }
}
```

**Digunakannya**: Dosen untuk generate QR sebelum perkuliahan dimulai.

---

### 2. Check Token Status
**Endpoint**: `GET ?action=status&qr_token=TKN-ABC123DEF`

**Response**:
```json
{
  "ok": true,
  "data": {
    "qr_token": "TKN-ABC123DEF",
    "course_id": "cloud-101",
    "session_id": "sesi-100000",
    "expires_at": "2024-02-25T10:30:00Z",
    "valid": true,
    "expired_in_minutes": 5
  }
}
```

**Error Response**:
```json
{
  "ok": false,
  "error": "Token tidak ditemukan"
}
```

---

### 3. Submit Checkin (Process Attendance)
**Endpoint**: `POST ?action=checkin`

**Request Body**:
```json
{
  "user_id": "12345678",
  "device_id": "Mozilla/5.0...",
  "course_id": "cloud-101",
  "session_id": "sesi-100000",
  "qr_token": "TKN-ABC123DEF",
  "ts": "2024-02-25T10:25:00Z"
}
```

**Validasi**:
- Token harus valid dan belum expired
- Duplikat absensi di sesi yang sama tidak diperbolehkan

**Success Response**:
```json
{
  "ok": true,
  "data": {
    "presence_id": "PR-ABC123DEF",
    "status": "checked_in"
  }
}
```

**Error Response**:
```json
{
  "ok": false,
  "error": "Token sudah kadaluarsa"
}
```

**Kemungkinan Error**:
- `"Data tidak lengkap"` - Field wajib tidak ada
- `"Token tidak valid atau tidak sesuai course/session"` - Token salah
- `"Token sudah kadaluarsa"` - Token expired (default 5 menit)
- `"Sudah melakukan absensi di sesi ini"` - Duplikat absensi

---

## Workflow Sistem

### Flow Checkin

```
┌─────────────┐
│   Dosen     │
│ Generate QR │
└────────────┬┘
             │ Generate Token (5 menit valid)
             │ + Simpan ke Sheet "tokens"
             │
    ┌────────▼─────────┐
    │ QR Code Display  │
    │ (Dosen)          │
    └────────┬─────────┘
             │ Mahasiswa scan QR
             │
    ┌────────▼──────────────────┐
    │ Camera Scanner             │
    │ (Repository Kamera_Scan)   │
    └────────┬──────────────────┘
             │ Kirim checkin request
             │ POST ?action=checkin
             │
    ┌────────▼────────────────────┐
    │ Validasi Token               │
    │ - Valid?                      │
    │ - Expired?                    │
    │ - Duplikat?                   │
    └────────┬────────────────────┘
             │
    ┌────────▼────────────────────┐
    │ Simpan ke Sheet "presence"   │
    │ Buat presence_id             │
    └─────────────────────────────┘
```

---

## Troubleshooting

### Error: "Token tidak ditemukan"
- Pastikan Spreadsheet ID benar di `Kode.js`
- Pastikan sheet `tokens` dan `presence` sudah dibuat
- Periksa apakah token sudah expired (default 5 menit)

### Error: "Sheet tidak ditemukan"
- Verifikasi nama sheet di Google Sheets: `tokens` dan `presence` (case-sensitive)
- Pastikan sheet sudah dibuat dan bukan sheet yang tersembunyi

### CORS Error
- Pastikan Google Apps Script di-deploy dengan akses `ANYONE_ANONYMOUS`
- Header CORS sudah ditambahkan di `jsonResponse()` function

### Duplikat Absensi
- Sistem memblok mahasiswa untuk absen 2x di sesi yang sama
- Jika perlu reset, hapus row di sheet `presence`

---

## Configuration

### Google Sheets Integration
File: `Kode.js` (baris pertama)
```javascript
const SPREADSHEET_ID = "1Pfux_MzbMKyj7bMXAG50PTvAeN9vZk3OFbI3vmeCrDA";
const SHEET_TOKENS   = "tokens";
const SHEET_PRESENCE = "presence";
const BASE_WEBAPP_URL = "https://script.google.com/macros/s/.../exec";
```

### Token Expiration
Durasi token valid: **5 menit** (dapat diubah di `generateQRServer()`)
```javascript
const expires_at = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
```

### Session ID Pattern
Session dibuat per 5 menit untuk group multiple tokens:
```javascript
const minutes = Math.floor(now.getTime() / (5 * 60 * 1000));
const session_id = "sesi-" + minutes;
```

---

## Integration dengan Repository Kamera_Scan

Repository scanner mengirim data checkin ke endpoint `?action=checkin` dengan format:
```json
{
  "user_id": "NIM_dari_scanner",
  "device_id": "device_info",
  "course_id": "cloud-101",
  "session_id": "sesi-100000",
  "qr_token": "TKN-ABC123DEF",
  "ts": "timestamp"
}
```

**Setup Repository Scanner**:
1. Clone: `https://github.com/Safinaarm/Kamera_Scan.git`
2. Update `BASE_WEBAPP_URL` dengan URL dari Google Apps Script yang sudah di-deploy
3. Scanner akan langsung mengirim hasil scan ke API ini

---

## Development & Testing

### Unit Test
```bash
npm install
npm test
```

File: `tests/QrServiceTest.php`

### Manual Test Generate Token
```bash
curl "https://script.google.com/macros/s/.../exec?action=generate"
```

### Manual Test Checkin
```bash
curl -X POST "https://script.google.com/macros/s/.../exec?action=checkin" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "12345678",
    "device_id": "test-device",
    "course_id": "cloud-101",
    "session_id": "sesi-100000",
    "qr_token": "TKN-ABC123DEF",
    "ts": "2024-02-25T10:25:00Z"
  }'
```

---

## Notes

- Data disimpan di Google Sheets (bukan database tradisional)
- Token berlaku 5 menit, dapat disesuaikan
- Sistem mencegah duplikat absensi per user per session
- Access control di Google Sheets: gunakan row-level permission jika perlu

---

## License

Proyek QRAbsen dikembangkan oleh kelompok 5 mahasiswa Tekni Informatika Universitas Airlangga untuk keperluan tugas mata kuliah cloud computing.

- **Repository Kamera_Scan**: https://github.com/Safinaarm/Kamera_Scan.git
- **Repository Backend**: https://github.com/Safinaarm/absen_cloud_kel5.git

**Last Updated**: Februari 2026  
**Status**: Active Development ✨

Dibuat dengan ❤️ oleh Tim Kelompok 5 Cloud computing praktikum


