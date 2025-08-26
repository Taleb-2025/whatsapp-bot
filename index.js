// index.js – DigiNetz WhatsApp Bot
require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// ==== بدء البوت ====
async function startBot() {
    // تخزين بيانات الاتصال
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_diginetz');

    // إنشاء اتصال
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // QR سيظهر في اللوج مباشرة
    });

    // حفظ التوكنات تلقائياً
    sock.ev.on('creds.update', saveCreds);

    // === متابعة حالة الاتصال ===
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📸 مسح هذا QR لربط واتساب...");

            // إنشاء رابط مباشر لفتح QR في المتصفح
            const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log(`🌍 افتح هذا الرابط لمسح الكود مباشرة:\n${qrLink}`);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log('❌ تم قطع الاتصال. إعادة المحاولة...');
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('🚪 تم تسجيل الخروج. امسح QR جديد للمتابعة.');
            }
        }

        if (connection === 'open') {
            console.log('✅ تم ربط البوت بنجاح!');
        }
    });

    // === استقبال الرسائل ===
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.message || message.key.fromMe) return;

        const sender = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text || '';

        console.log('📩 رسالة جديدة من', sender, ':', text);

        // مثال: تفعيل البوت بكلمة Start
        if (text.toLowerCase().includes('start')) {
            await sock.sendMessage(sender, { text: '👋 Hallo! Dein DigiNetz-Bot ist jetzt aktiv ✅' });
        }
    });
}

startBot();
