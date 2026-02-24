// === KONFIGURASI ===
const SPREADSHEET_ID = "1Pfux_MzbMKyj7bMXAG50PTvAeN9vZk3OFbI3vmeCrDA";
const SHEET_TOKENS   = "tokens";     // qr_token | course_id | session_id | expires_at | ts
const SHEET_PRESENCE = "presence";   // presence_id | user_id | device_id | course_id | session_id | qr_token | status | ts

const BASE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwtaOPeaNCevIXk1SaP2KlhFrsUFAc0fyn_vPwiqUVEiJSzF_9nn56zH_hKEYjzaweG/exec";

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" tidak ditemukan`);
  return sheet;
}

function generateToken() {
  return "TKN-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function jsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*"); // <--- wajib
}

function jsonError(message, statusCode = 400) {
  return jsonResponse({ ok: false, error: message }, statusCode);
}

// Tangani OPTIONS preflight (penting untuk POST dari GitHub Pages)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type")
    .setHeader("Access-Control-Max-Age", "3600");
}

// === HALAMAN QR DOSEN & CHECKIN (HTML) ===
function doGet(e) {
  const mode   = e.parameter.mode   || "";
  const action = e.parameter.action || "";

  // API endpoints (JSON response)
  if (action) {
    try {
      if (action === "generate") {
        return jsonResponse(generateQRServer());
      }
      
      if (action === "status") {
        const qr_token = e.parameter.qr_token;
        if (!qr_token) return jsonError("Parameter qr_token wajib diisi");
        
        const sheet = getSheet(SHEET_TOKENS);
        const data = sheet.getDataRange().getValues();
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === qr_token) {
            const expires = new Date(data[i][3]);
            return jsonResponse({
              ok: true,
              data: {
                qr_token: qr_token,
                course_id: data[i][1],
                session_id: data[i][2],
                expires_at: data[i][3],
                valid: new Date() < expires,
                expired_in_minutes: Math.max(0, Math.round((expires - new Date()) / 60000))
              }
            });
          }
        }
        return jsonError("Token tidak ditemukan", 404);
      }

      // Jika action tidak dikenal
      return jsonError("Action tidak dikenal: " + action, 400);
      
    } catch (err) {
      console.error("Error di doGet action: " + err);
      return jsonError("Server error: " + err.message, 500);
    }
  }

  // Mode HTML (asli)
  if (mode === "checkin") {
    return HtmlService.createHtmlOutput(getScanPage())
      .setTitle('Absen Mahasiswa')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Halaman utama dosen
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('QR Absensi Digital')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// === DO POST: untuk checkin (dan generate jika mau) ===
function doPost(e) {
  try {
    const action = e.parameter.action || "";

    let payload = {};
    
    // Parse body (support JSON atau form data)
    if (e.postData && e.postData.type === "application/json") {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    } else if (e.postData) {
      payload = JSON.parse(e.postData.contents || "{}");
    }

    if (action === "checkin") {
      const result = processCheckin(payload);
      return jsonResponse(result);
    }

    if (action === "generate") {
      return jsonResponse(generateQRServer());
    }

    return jsonError("Action POST tidak dikenal: " + action, 400);

  } catch (err) {
    console.error("Error di doPost: " + err + " | Payload: " + JSON.stringify(e.postData?.contents || e.parameter));
    return jsonError("Invalid request: " + err.message, 400);
  }
}

// === GENERATE QR ===
function generateQRServer() {
  const course_id = "cloud-101"; // bisa diganti jadi parameter nanti

  const now = new Date();
  const minutes = Math.floor(now.getTime() / (5 * 60 * 1000));
  const session_id = "sesi-" + minutes;

  const qr_token = generateToken();
  const expires_at = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const sheet = getSheet(SHEET_TOKENS);
  sheet.appendRow([
    qr_token,
    course_id,
    session_id,
    expires_at,
    now.toISOString()
  ]);

  const checkin_url = `${BASE_WEBAPP_URL}?mode=checkin&qr_token=${qr_token}&course_id=${course_id}&session_id=${session_id}`;

  return {
    ok: true,
    data: {
      qr_token,
      course_id,
      session_id,
      expires_at,
      checkin_url
    }
  };
}

// === PROSES ABSEN ===
function processCheckin(payload) {
  const { user_id, device_id, course_id, session_id, qr_token, ts } = payload;

  if (!user_id || !qr_token || !course_id || !session_id) {
    return { ok: false, error: "Data tidak lengkap (user_id, qr_token, course_id, session_id wajib)" };
  }

  const now = new Date();

  // Validasi token
  const tokenSheet = getSheet(SHEET_TOKENS);
  const tokenData = tokenSheet.getDataRange().getValues();
  let validToken = null;

  for (let i = 1; i < tokenData.length; i++) {
    if (tokenData[i][0] === qr_token &&
        tokenData[i][1] === course_id &&
        tokenData[i][2] === session_id) {
      validToken = tokenData[i];
      break;
    }
  }

  if (!validToken) return { ok: false, error: "Token tidak valid atau tidak sesuai course/session" };
  if (now > new Date(validToken[3])) return { ok: false, error: "Token sudah kadaluarsa" };

  // Cek duplikat absen
  const presenceSheet = getSheet(SHEET_PRESENCE);
  const presenceData = presenceSheet.getDataRange().getValues();

  for (let i = 1; i < presenceData.length; i++) {
    if (presenceData[i][1] === user_id &&
        presenceData[i][3] === course_id &&
        presenceData[i][4] === session_id) {
      return { ok: false, error: "Sudah melakukan absensi di sesi ini" };
    }
  }

  // Simpan absen
  const presence_id = "PR-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  presenceSheet.appendRow([
    presence_id,
    user_id,
    device_id || "unknown",
    course_id,
    session_id,
    qr_token,
    "checked_in",
    ts || now.toISOString()
  ]);

  return { ok: true, data: { presence_id, status: "checked_in" } };
}