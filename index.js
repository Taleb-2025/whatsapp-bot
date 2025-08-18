require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

// ✅ WhatsApp Verbindung
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
  });

  // ✅ Nachricht empfangen
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log('📩 Nachricht:', text);

    // 👋 Begrüßung
    if (text.toLowerCase() === 'hallo diginetz') {
      await sock.sendMessage(sender, { text: '👋 Hallo DigiNetz!' });
    }

    // ▶️ Startbefehl
    else if (text.toLowerCase() === 'start') {
      await sock.sendMessage(sender, { text: '📦 Dein Bot ist startklar!' });
    }
  });

  // 🔁 Verbindung speichern
  sock.ev.on('creds.update', saveCreds);

  // ❌ Fehlerbehandlung
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Verbindung getrennt:', reason);
    } else if (connection === 'open') {
      console.log('✅ Verbindung erfolgreich aufgebaut');
    }
  });
}

startSock();
