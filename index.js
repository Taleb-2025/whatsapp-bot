require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');

// إعداد المتغيرات البيئية
const CREDS_PATH = process.env.CREDS_JSON || './creds.json';
const KEYS_PATH = process.env.KEYS_JSON || './keys.json';

// تحميل الحالة المخزنة (الاعتماد على ملفات الجلسة المشفرة)
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_diginetz');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Verbindung geschlossen. Neu verbinden:', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot ist verbunden mit WhatsApp');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log('📥 Nachricht erhalten:', text);

        if (text.toLowerCase() === 'start') {
            await sock.sendMessage(sender, { text: '👋 Hallo! Dein Bot ist aktiv und bereit.' });
        }
    });
}

startBot();
