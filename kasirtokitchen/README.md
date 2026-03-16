# DiPojok Kitchen System — Panduan Setup Localhost

## Isi Folder
```
📁 dipojok-kitchen/
├── server.js          ← Server Node.js (jalankan ini)
├── kasir-input.html   ← Halaman Kasir
├── kitchen.html       ← Halaman Dapur
└── README.md          ← Panduan ini
```

---

## CARA PAKAI (Mode WiFi / Localhost)

### Langkah 1 — Install Node.js
Download & install dari: https://nodejs.org  
Pilih versi **LTS** (misal: 20.x)

### Langkah 2 — Jalankan Server
1. Taruh semua file di **satu folder** (misal `C:\dipojok\`)
2. Buka **Command Prompt** / **Terminal** di folder itu
3. Ketik dan enter:
   ```
   node server.js
   ```
4. Akan muncul tampilan seperti ini:
   ```
   ╔══════════════════════════════════════════════╗
   ║         DiPojok Kitchen Server               ║
   ╠══════════════════════════════════════════════╣
   ║  Server berjalan di port 3000               ║
   ║                                              ║
   ║  Buka di browser:                            ║
   ║  Kasir  → http://localhost:3000/kasir        ║
   ║  Dapur  → http://localhost:3000/kitchen      ║
   ║                                              ║
   ║  Dari device lain (WiFi sama):               ║
   ║  Kasir  → http://192.168.1.10:3000/kasir     ║
   ║  Dapur  → http://192.168.1.10:3000/kitchen   ║
   ╚══════════════════════════════════════════════╝
   ```

### Langkah 3 — Buka di Browser
- **Laptop/PC kasir**: buka `http://localhost:3000/kasir`
- **Tablet/HP dapur**: buka `http://[IP-LAPTOP]:3000/kitchen`
  - IP laptop terlihat di tampilan terminal (contoh: 192.168.1.10)
  - Semua device HARUS terhubung ke **WiFi yang sama**

---

## CATATAN PENTING

### Cari IP Laptop
- **Windows**: buka CMD → ketik `ipconfig` → lihat "IPv4 Address"
- **Mac/Linux**: buka Terminal → ketik `ifconfig` atau `ip addr`

### Syarat
- Laptop menjalankan `node server.js` HARUS tetap menyala selama operasional
- Semua device (kasir, dapur, dll) harus terhubung WiFi yang sama
- Tidak butuh internet — hanya jaringan lokal

### Reset Port
Jika port 3000 sudah terpakai, edit baris `const PORT = 3000;` di `server.js`

---

## MODE ALTERNATIF (tanpa server)

### 🔥 Firebase (butuh internet)
Klik tombol **Firebase** di mode bar. Data tersimpan di cloud Firebase.

### 💾 Offline (satu perangkat saja)
Klik tombol **Offline** di mode bar. Data tersimpan di browser.
⚠️ Kasir dan dapur HARUS dibuka di browser yang sama (satu laptop).

---

## TROUBLESHOOTING

| Masalah | Solusi |
|---|---|
| "node is not recognized" | Install Node.js dari nodejs.org |
| Port sudah dipakai | Ganti PORT di server.js |
| Dapur tidak menerima pesanan | Pastikan URL pakai IP laptop, bukan localhost |
| Koneksi terputus | Server masih jalan? Cek terminal laptop |
| Data hilang saat server restart | Normal — data in-memory. Gunakan Firebase untuk data permanen |
