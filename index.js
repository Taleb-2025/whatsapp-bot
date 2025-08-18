require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');

const ADMIN_NUMBER = '4915563691188@s.whatsapp.net'; // عدّله برقمك

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Verbindung zu WhatsApp hergestellt!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!messageContent) return;

    const text = messageContent.trim().toLowerCase();

    if (text === 'start') {
      await sock.sendMessage(sender, { text: '👋 Hallo DigiNetz! Bitte wähle deine Sprache:\n\n1️⃣ Deutsch\n2️⃣ Arabisch\n3️⃣ Türkisch' });
    }

    // Beispiel: einfache Reaktion auf Auswahl
    if (text === '1') {
      await sock.sendMessage(sender, { text: '✅ Du hast Deutsch ausgewählt. Wie kann ich dir helfen?' });
    }

    if (text === '2') {
      await sock.sendMessage(sender, { text: '✅ لقد اخترت العربية. كيف يمكنني مساعدتك؟' });
    }

    if (text === '3') {
      await sock.sendMessage(sender, { text: '✅ Türkçe seçtiniz. Size nasıl yardımcı olabilirim?' });
    }

    if (text === 'kontakt') {
      await sock.sendMessage(sender, {
        contacts: {
          displayName: "DigiNetz Support",
          contacts: [{
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:DigiNetz Support\nTEL;type=CELL;type=VOICE;waid=4915563691188:+49 1556 3691188\nEND:VCARD`
          }]
        }
      });
    }
  });
}

startBot();
