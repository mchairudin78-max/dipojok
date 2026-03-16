/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   DiPojok Kitchen Server — Node.js localhost         ║
 * ║   Kasir ↔ Kitchen real-time via WebSocket            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * CARA PAKAI:
 * 1. Install Node.js dari https://nodejs.org
 * 2. Taruh file ini di folder, lalu buka terminal di folder tsb
 * 3. Jalankan:  node server.js
 * 4. Buka kasir: http://[IP-LAPTOP]:3000/kasir
 *    Buka dapur: http://[IP-LAPTOP]:3000/kitchen
 *
 * Cari IP laptop: Windows → ipconfig | Mac/Linux → ifconfig
 * Semua device harus terhubung WiFi yang SAMA
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const net  = require('net');

// ── CONFIG ──────────────────────────────────────────────
const PORT = 3000;

// ── IN-MEMORY DATA STORE ─────────────────────────────────
let orders = {};          // { key: orderObject }
let orderCounter = 0;     // auto-increment nomor pesanan
let clients = [];         // WebSocket connections

// ── SIMPLE WEBSOCKET IMPLEMENTATION ─────────────────────
// (no npm needed — pure Node.js built-in)
const crypto = require('crypto');

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
}

function wsSend(socket, data) {
  try {
    const json = JSON.stringify(data);
    const buf  = Buffer.from(json);
    const len  = buf.length;
    let frame;
    if (len < 126) {
      frame = Buffer.allocUnsafe(2 + len);
      frame[0] = 0x81;
      frame[1] = len;
      buf.copy(frame, 2);
    } else if (len < 65536) {
      frame = Buffer.allocUnsafe(4 + len);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(len, 2);
      buf.copy(frame, 4);
    } else {
      frame = Buffer.allocUnsafe(10 + len);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(len), 2);
      buf.copy(frame, 10);
    }
    socket.write(frame);
  } catch(e) {}
}

function wsParseFrame(buf) {
  try {
    const b1 = buf[1];
    const masked = !!(b1 & 0x80);
    let len = b1 & 0x7f;
    let offset = 2;
    if (len === 126) { len = buf.readUInt16BE(2); offset = 4; }
    else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); offset = 10; }
    let payload;
    if (masked) {
      const mask = buf.slice(offset, offset + 4);
      offset += 4;
      payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = buf[offset + i] ^ mask[i % 4];
    } else {
      payload = buf.slice(offset, offset + len);
    }
    return payload.toString('utf8');
  } catch(e) { return null; }
}

function broadcast(data) {
  clients.forEach(c => { try { wsSend(c.socket, data); } catch(e) {} });
}

function broadcastOrders() {
  broadcast({ type: 'orders', data: orders });
}

// ── HTTP SERVER ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── SERVE HTML FILES ──
  if (url === '/' || url === '/kasir') {
    serveFile(res, path.join(__dirname, 'kasir-input.html'), 'text/html');
    return;
  }
  if (url === '/kitchen') {
    serveFile(res, path.join(__dirname, 'kitchen.html'), 'text/html');
    return;
  }

  // ── PWA FILES ──
  if (url === '/sw.js') {
    serveFile(res, path.join(__dirname, 'sw.js'), 'application/javascript');
    return;
  }
  if (url === '/manifest-kasir.json') {
    serveFile(res, path.join(__dirname, 'manifest-kasir.json'), 'application/manifest+json');
    return;
  }
  if (url === '/manifest-kitchen.json') {
    serveFile(res, path.join(__dirname, 'manifest-kitchen.json'), 'application/manifest+json');
    return;
  }
  if (url === '/icon-kasir.png' || url === '/icon-kasir.svg') {
    serveFile(res, path.join(__dirname, 'icon-kasir.svg'), 'image/svg+xml');
    return;
  }
  if (url === '/icon-kitchen.png' || url === '/icon-kitchen.svg') {
    serveFile(res, path.join(__dirname, 'icon-kitchen.svg'), 'image/svg+xml');
    return;
  }

  // ── REST API ──

  // GET all orders
  if (url === '/api/orders' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(orders));
    return;
  }

  // GET counter
  if (url === '/api/counter' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ counter: orderCounter }));
    return;
  }

  // POST new order
  if (url === '/api/orders' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const order = JSON.parse(body);
        orderCounter++;
        order.orderNumber = orderCounter;
        const key = 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        order._key = key;
        orders[key] = order;
        broadcast({ type: 'new_order', key, order });
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ key, orderNumber: orderCounter }));
      } catch(e) {
        res.writeHead(400); res.end('Bad Request');
      }
    });
    return;
  }

  // PATCH order (update status)
  const patchMatch = url.match(/^\/api\/orders\/(.+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const key = patchMatch[1];
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const patch = JSON.parse(body);
        if (orders[key]) {
          Object.assign(orders[key], patch);
          broadcast({ type: 'order_updated', key, order: orders[key] });
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(orders[key]));
        } else {
          res.writeHead(404); res.end('Not Found');
        }
      } catch(e) {
        res.writeHead(400); res.end('Bad Request');
      }
    });
    return;
  }

  // DELETE all orders (reset)
  if (url === '/api/orders' && req.method === 'DELETE') {
    orders = {};
    orderCounter = 0;
    broadcast({ type: 'reset' });
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET server info (untuk cek IP)
  if (url === '/api/info' && req.method === 'GET') {
    const interfaces = require('os').networkInterfaces();
    const ips = [];
    Object.values(interfaces).forEach(iface => {
      iface.forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); });
    });
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ port: PORT, ips, orderCount: Object.keys(orders).length, counter: orderCounter }));
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

// ── WEBSOCKET UPGRADE ────────────────────────────────────
server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade !== 'websocket') { socket.destroy(); return; }
  wsHandshake(req, socket);

  const client = { socket, id: Date.now() };
  clients.push(client);

  // Send current state to new client
  wsSend(socket, { type: 'orders', data: orders });
  wsSend(socket, { type: 'info', counter: orderCounter });

  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    const text = wsParseFrame(buf);
    if (text) {
      buf = Buffer.alloc(0);
      try {
        const msg = JSON.parse(text);
        // Handle client messages (ping, etc)
        if (msg.type === 'ping') wsSend(socket, { type: 'pong' });
      } catch(e) {}
    }
  });

  socket.on('close', () => { clients = clients.filter(c => c !== client); });
  socket.on('error', () => { clients = clients.filter(c => c !== client); });
});

// ── HELPER ──────────────────────────────────────────────
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('File not found: ' + path.basename(filePath));
      return;
    }
    res.writeHead(200, {'Content-Type': contentType + '; charset=utf-8'});
    res.end(data);
  });
}

// ── START ────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach(iface => {
    iface.forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); });
  });

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         DiPojok Kitchen Server               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Server berjalan di port ${PORT}                 ║`);
  console.log('║                                              ║');
  console.log('║  Buka di browser:                            ║');
  console.log(`║  Kasir  → http://localhost:${PORT}/kasir        ║`);
  console.log(`║  Dapur  → http://localhost:${PORT}/kitchen      ║`);
  console.log('║                                              ║');
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`║  Dari device lain (WiFi sama):               ║`);
      console.log(`║  Kasir  → http://${ip}:${PORT}/kasir`.padEnd(47) + '║');
      console.log(`║  Dapur  → http://${ip}:${PORT}/kitchen`.padEnd(47) + '║');
    });
  }
  console.log('║                                              ║');
  console.log('║  ⚠️  JANGAN tutup jendela ini saat beroperasi ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} sudah dipakai! Tutup aplikasi lain atau ganti PORT di baris 13.\n`);
  } else {
    console.error('Server error:', e);
  }
  process.exit(1);
});
