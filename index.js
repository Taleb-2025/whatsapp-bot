require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');

// إعداد المجلد لحفظ بيانات الاتصال
const authFolder = './auth_info_diginetz';

// بدء تشغيل البوت
async function startBot() {
    // تحميل حالة الاتصال
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    // إنشاء اتصال مع WhatsApp
    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    // حفظ التحديثات في حالة الاتصال
    sock.ev.on('creds.update', saveCreds);

    // مراقبة الاتصال وإعادة التشغيل تلقائيًا عند انقطاعه
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('📸 Scan den QR Code:\n', qr);
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp erfolgreich verbunden!');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Verbindung geschlossen:', reason);

            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Versuche erneut zu verbinden...');
                startBot();
            } else {
                console.log('🚪 Bot wurde ausgeloggt. Bitte QR-Code erneut scannen.');
            }
        }
    });

    // استقبال الرسائل الواردة
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`📩 Nachricht von ${from}: ${text}`);

        // الرد عند استقبال كلمة Start
        if (text.trim().toLowerCase() === 'start' || text.trim().toLowerCase() === 'jetzt starten') {
            await sock.sendMessage(from, {
                text: '👋 Hallo! Dein DigiNetz WhatsApp-Bot ist jetzt aktiv ✅'
            });
        }
    });
}

// تشغيل البوت
startBot();

// منع Railway من إيقاف العملية
setInterval(() => {}, 1000);
