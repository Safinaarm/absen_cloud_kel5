

function getScanPage() {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scan QR Absensi - Cloud Kel5</title>
      <script src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          margin: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .container {
          background: rgba(255,255,255,0.95);
          color: #333;
          border-radius: 16px;
          padding: 25px;
          max-width: 420px;
          width: 90%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        h1 { color: #4c1d95; margin: 0 0 10px; }
        p { color: #555; margin-bottom: 15px; }
        video {
          width: 100%;
          max-width: 400px;
          border: 4px solid #7c3aed;
          border-radius: 12px;
          margin: 15px 0;
        }
        #form { display: none; margin-top: 20px; }
        input[type="text"] {
          padding: 14px;
          width: 100%;
          font-size: 18px;
          border: 2px solid #ddd;
          border-radius: 8px;
          margin-bottom: 15px;
          box-sizing: border-box;
        }
        button {
          padding: 14px 40px;
          background: #7c3aed;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
        }
        button:hover { background: #5a1ed8; }
        #status {
          margin-top: 20px;
          font-weight: bold;
          font-size: 18px;
          min-height: 30px;
        }
        .success { color: #065f46; }
        .error { color: #991b1b; }
        .loading { color: #7c3aed; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Scan QR Absensi</h1>
        <p>Arahkan kamera ke QR dosen</p>

        <video id="video" autoplay playsinline></video>

        <div id="form">
          <p>QR berhasil discan!</p>
          <input type="text" id="user_id" placeholder="Masukkan Nama atau NIM" required autofocus>
          <br>
          <button onclick="submitAbsen()">Submit Absen</button>
        </div>

        <div id="loading" class="loading">Memproses...</div>
        <div id="status">Memulai kamera...</div>
      </div>

      <script>
        const codeReader = new ZXing.BrowserMultiFormatReader();
        const video = document.getElementById("video");
        const form = document.getElementById("form");
        const status = document.getElementById("status");
        const loading = document.getElementById("loading");
        let params = {};
        let scanning = true;

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
          .then(stream => {
            video.srcObject = stream;
            video.play();
            status.textContent = "Kamera aktif. Arahkan ke QR...";
            startScanning();
          })
          .catch(err => {
            status.textContent = "Gagal akses kamera: " + err.message;
            status.className = "error";
            console.error("Kamera error:", err);
          });

        function startScanning() {
          codeReader.decodeFromVideoDevice(undefined, "video", (result, err) => {
            if (result) {
              console.log("QR detected:", result.text);
              scanning = false;
              codeReader.reset();
              processQR(result.text);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
              console.error("Scan error:", err);
              status.textContent = "Error scan: " + err.message;
              status.className = "error";
            }
          });
        }

        function processQR(qrData) {
          try {
            let url = new URL(qrData);
            params.qr_token = url.searchParams.get("qr_token");
            params.course_id = url.searchParams.get("course_id");
            params.session_id = url.searchParams.get("session_id");

            if (params.qr_token && params.course_id && params.session_id) {
              status.textContent = "QR valid! Masukkan Nama/NIM.";
              status.className = "success";
              form.style.display = "block";
            } else {
              status.textContent = "QR terdeteksi tapi parameter tidak lengkap.";
              status.className = "error";
            }
          } catch (err) {
            console.error("Parse URL gagal:", err);
            status.textContent = "QR terdeteksi tapi format URL salah.";
            status.className = "error";
          }
        }

        async function submitAbsen() {
          const user_id = document.getElementById("user_id").value.trim();
          if (!user_id) {
            status.textContent = "Nama/NIM wajib diisi!";
            status.className = "error";
            return;
          }

          loading.style.display = "block";
          status.textContent = "";
          status.className = "loading";

          const payload = {
            user_id,
            device_id: navigator.userAgent || "unknown",
            course_id: params.course_id,
            session_id: params.session_id,
            qr_token: params.qr_token,
            ts: new Date().toISOString()
          };

          try {
            const res = await fetch(location.href.split('?')[0] + '?action=checkin', {
              method: "POST",
              mode: "cors",
              credentials: "omit",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("HTTP " + res.status);

            const data = await res.json();

            loading.style.display = "none";
            if (data.ok) {
              status.textContent = "Absen berhasil! ID: " + (data.data.presence_id || "Sukses");
              status.className = "success";
              form.style.display = "none";
            } else {
              status.textContent = "Gagal: " + (data.error || "Unknown");
              status.className = "error";
            }
          } catch (err) {
            loading.style.display = "none";
            status.textContent = "Gagal koneksi: " + err.message;
            status.className = "error";
            console.error(err);
          }
        }
      </script>
    </body>
    </html>
  `;
}