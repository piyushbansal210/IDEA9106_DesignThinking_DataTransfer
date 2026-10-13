const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 20 * 1024 * 1024 });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'CrossBorder Transfer Lab' }));

// Demo relay only: it forwards encrypted envelopes and does not decrypt them.
// In-memory rooms; restart the server to clear them. Not production security.
const peers = new Map();
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function roomPeers(room, except) {
  return [...(peers.get(room) || [])].filter(p => p !== except && p.readyState === WebSocket.OPEN);
}
wss.on('connection', (ws) => {
  ws.id = crypto.randomUUID();
  ws.room = null;
  ws.region = 'unknown';
  send(ws, { type: 'connected', peerId: ws.id, serverTime: new Date().toISOString() });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Invalid JSON message.' }); }

    if (msg.type === 'join') {
      const room = String(msg.room || '').trim().slice(0, 80);
      const region = ['AU', 'EU'].includes(msg.region) ? msg.region : 'unknown';
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(room)) return send(ws, { type: 'error', message: 'Room code must be 3–80 letters, numbers, _ or -.' });
      if (ws.room && peers.has(ws.room)) peers.get(ws.room).delete(ws);
      ws.room = room; ws.region = region;
      if (!peers.has(room)) peers.set(room, new Set());
      peers.get(room).add(ws);
      send(ws, { type: 'joined', room, region, peers: peers.get(room).size });
      for (const p of roomPeers(room, ws)) send(p, { type: 'peer-joined', peerId: ws.id, region });
      for (const p of roomPeers(room, ws)) send(ws, { type: 'peer-present', peerId: p.id, region: p.region });
      return;
    }

    if (msg.type === 'transfer') {
      if (!ws.room) return send(ws, { type: 'error', message: 'Join a room before sending data.' });
      const envelope = msg.envelope;
      if (!envelope || envelope.version !== 1 || typeof envelope.ciphertext !== 'string' || typeof envelope.iv !== 'string') {
        return send(ws, { type: 'error', message: 'Malformed encrypted envelope.' });
      }
      // Size guard, approx 15 MiB base64 payload. Relay never receives plaintext or key.
      if (envelope.ciphertext.length > 15 * 1024 * 1024) return send(ws, { type: 'error', message: 'Payload too large (15 MiB limit).' });
      const recipients = roomPeers(ws.room, ws);
      if (!recipients.length) return send(ws, { type: 'error', message: 'No other browser is connected to this room.' });
      const packet = {
        type: 'incoming-transfer',
        transferId: String(msg.transferId || crypto.randomUUID()),
        fromRegion: ws.region,
        sentAt: new Date().toISOString(),
        envelope
      };
      recipients.forEach(p => send(p, packet));
      send(ws, { type: 'transfer-sent', transferId: packet.transferId, recipientCount: recipients.length, sentAt: packet.sentAt });
      return;
    }

    if (msg.type === 'presence') {
      if (ws.room) for (const p of roomPeers(ws.room, ws)) send(p, { type: 'peer-presence', region: ws.region, status: String(msg.status || 'online').slice(0, 30) });
    }
  });

  ws.on('close', () => {
    if (ws.room && peers.has(ws.room)) {
      peers.get(ws.room).delete(ws);
      for (const p of roomPeers(ws.room, ws)) send(p, { type: 'peer-left', region: ws.region });
      if (peers.get(ws.room).size === 0) peers.delete(ws.room);
    }
  });
});

server.listen(PORT, () => console.log(`CrossBorder Transfer Lab running at http://localhost:${PORT}`));
