require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');

// إعداد المتغيرات
const PORT = process.env.PORT || 3000;
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CREDS_JSON = process.env.CREDS_JSON;
const KEYS_JSON = process.env.KEYS_JSON;
const NODE_ENV = process.env.NODE_ENV || 'development';

// كتابة بيانات auth من base64 إلى ملفات محلية
const authFolder = './auth_info_diginetz';
const credsPath = `${authFolder}/creds.json`;
const keysPath = `${authFolder}/keys.json`;

if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);

// حفظ creds.json
if (CREDS_JSON && !fs.existsSync(credsPath)) {
    const credsDecoded = Buffer.from(CREDS_JSON, 'base64').toString('utf-8');
    fs.writeFileSync(credsPath, credsDecoded);
    console.log('✅ creds.json gespeichert');
}

// حفظ keys.json
if (KEYS_JSON && !fs.existsSync(keysPath)) {
    const keysDecoded = Buffer.from(KEYS_JSON, 'base64').toString('utf-8');
    fs.writeFileSync(keysPath, keysDecoded);
    console.log('✅ keys.json gespeichert');
}

// الاتصال بـ WhatsApp
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            console.log('✅ WhatsApp verbunden!');
        } else if (connection === 'close') {
            console.log('❌ Verbindung geschlossen. Starte neu...');
            startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (body === 'start') {
            await sock.sendMessage(from, { text: '👋 Hallo, dein WhatsApp-Bot ist aktiv!' });
        }
    });
}

startBot();