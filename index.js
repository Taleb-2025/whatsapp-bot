require('dotenv').config();
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');

// قراءة الاعتماديات من متغيرات البيئة على Railway
fs.writeFileSync('./creds.json', Buffer.from(process.env.CREDS_JSON, 'base64').toString('utf-8'));
fs.writeFileSync('./keys.json', Buffer.from(process.env.KEYS_JSON, 'base64').toString('utf-8'));

const { state, saveState } = useSingleFileAuthState('./creds.json');

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (messageContent?.toLowerCase().includes("start")) {
      await sock.sendMessage(sender, { text: "👋 Hallo DigiNetz! Bitte wähle deine Sprache:\n1️⃣ Deutsch\n2️⃣ Arabisch\n3️⃣ Türkisch" });
    }
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log("✅ Bot ist verbunden mit WhatsApp");
    }
  });
}

startBot();
