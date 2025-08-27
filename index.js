require('dotenv').config();
const express = require('express');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_FOLDER = './auth_info_diginetz';

if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER);
}

let qrCodeData = null;

// رابط مسح QR Code من المتصفح مباشرة
app.get('/qr', async (req, res) => {
    if (!qrCodeData) {
        return res.send('<h2>⏳ في انتظار توليد QR Code ... أعد تحميل الصفحة بعد لحظات</h2>');
    }

    try {
        const qrImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <div style="display:flex;justify-content:center;align-items:center;flex-direction:column;height:100vh;">
                <h2>📱 امسح هذا الكود لتفعيل البوت</h2>
                <img src="${qrImage}" />
            </div>
        `);
    } catch (err) {
        console.error('❌ خطأ في إنشاء QR Code:', err);
        res.status(500).send('حدث خطأ أثناء إنشاء QR Code');
    }
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        version,
    });

    // حفظ الـ creds و keys تلقائيًا عند أي تحديث
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            qrCodeData = qr;
            console.log(`🌐 افتح هذا الرابط لمسح QR Code:\n`);
            console.log(`${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/qr`);
        }

        if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح مع WhatsApp!');
        } else if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 إعادة الاتصال...');
                startBot();
            } else {
                console.log('🚪 تم تسجيل الخروج. أعد تشغيل البوت لمسح كود جديد.');
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`📩 رسالة من ${from}: ${text}`);

        if (text?.toLowerCase() === 'jetzt starten') {
            await sock.sendMessage(from, { text: '👋 Hallo! Dein DigiNetz Bot ist jetzt aktiv ✅' });
        }
    });
}

startBot();

app.listen(PORT, () => {
    console.log(`🚀 DigiNetz Bot läuft auf Port ${PORT}`);
    console.log(`🌐 افتح هذا الرابط لمسح QR Code:\n`);
    console.log(`${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/qr`);
});
