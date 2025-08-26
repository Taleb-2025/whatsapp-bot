require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

// تشغيل البوت
async function startBot() {
    // مسار حفظ الجلسة الجديدة
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_diginetz');

    // إنشاء اتصال
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // ✅ QR سيظهر في LOGS مباشرة
    });

    // حفظ بيانات الجلسة الجديدة
    sock.ev.on('creds.update', saveCreds);

    // التحقق من حالة الاتصال
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📌 Scan diesen QR Code mit WhatsApp:');
            console.log(qr);
        }

        if (connection === 'close') {
            const shouldReconnect = new Boom(lastDisconnect?.error).output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Verbindung verloren. Starte neu…');
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('🚪 Bot wurde ausgeloggt. Bitte QR-Code erneut scannen.');
            }
        }

        if (connection === 'open') {
            console.log('✅ Erfolgreich verbunden!');
        }
    });

    // استقبال الرسائل
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.message || message.key.fromMe) return;

        const sender = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text || '';

        console.log(`📩 Neue Nachricht von ${sender}: ${text}`);

        if (text.toLowerCase() === 'start') {
            await sock.sendMessage(sender, { text: '👋 Hallo! Dein WhatsApp-Bot ist jetzt aktiv ✅' });
        }
    });
}

startBot();
