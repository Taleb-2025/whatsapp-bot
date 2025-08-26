require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_diginetz');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // ❌ نوقف النظام القديم لأنه لم يعد مدعوم
    });

    // ✅ عندما يولد Baileys QR جديد
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.clear();
            console.log('🔗 رابط رسمي لمسح QR عبر المتصفح:\n');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('\nأو امسح QR مباشرة من الرابط أعلاه ✅');
        }

        if (connection === 'open') {
            console.log('✅ تم الربط بنجاح مع واتساب');
        } else if (connection === 'close') {
            console.log('❌ تم قطع الاتصال.. إعادة المحاولة');
            startBot();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // الرد على رسالة "start"
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.message || message.key.fromMe) return;

        const sender = message.key.remoteJid;
        const text = message.message.conversation || '';

        if (text.toLowerCase() === 'start') {
            await sock.sendMessage(sender, { text: '👋 Hallo! Dein WhatsApp-Bot ist jetzt aktiv ✅' });
        }
    });
}

startBot();
