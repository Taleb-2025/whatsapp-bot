require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const tar = require('tar');
const qrcode = require('qrcode-terminal');

const CREDS_JSON = process.env.CREDS_JSON;
const KEYS_JSON = process.env.KEYS_JSON;
const AUTH_TAR_GZ = process.env.AUTH_TAR_GZ;

const authFolder = './auth_info_diginetz';
const credsPath = `${authFolder}/creds.json`;
const keysPath = `${authFolder}/keys.json`;
const archivePath = './auth_info_diginetz.tar.gz';

// حفظ الأرشيف إذا كان موجودًا
function saveAuthArchive() {
    if (AUTH_TAR_GZ && !fs.existsSync(archivePath)) {
        fs.writeFileSync(archivePath, Buffer.from(AUTH_TAR_GZ, 'base64'));
        console.log('✅ auth_info_diginetz.tar.gz gespeichert');
    }
}

// فك الأرشيف
async function extractAuthArchive() {
    if (fs.existsSync(archivePath)) {
        console.log('📦 Entpacke auth_info_diginetz.tar.gz...');
        await tar.x({ file: archivePath });
        console.log('✅ Entpackt!');
    }
}

// حفظ ملفات الاعتماد
function saveAuthFiles() {
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);

    if (CREDS_JSON && !fs.existsSync(credsPath)) {
        fs.writeFileSync(credsPath, Buffer.from(CREDS_JSON, 'base64').toString('utf-8'));
        console.log('✅ creds.json gespeichert');
    }

    if (KEYS_JSON && !fs.existsSync(keysPath)) {
        fs.writeFileSync(keysPath, Buffer.from(KEYS_JSON, 'base64').toString('utf-8'));
        console.log('✅ keys.json gespeichert');
    }
}

// بدء البوت
async function startBot() {
    try {
        saveAuthArchive();
        await extractAuthArchive();
        saveAuthFiles();

        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: P({ level: 'info' }),
            printQRInTerminal: false,
            auth: state,
        });

        sock.ev.on('creds.update', saveCreds);

        // متابعة الاتصال
        sock.ev.on('connection.update', ({ connection, qr }) => {
            if (qr) qrcode.generate(qr, { small: true });
            if (connection === 'open') {
                console.log('✅ WhatsApp verbunden!');
            } else if (connection === 'close') {
                console.log('❌ Verbindung geschlossen. Starte neu in 3s...');
                setTimeout(startBot, 3000);
            }
        });

        // استقبال الرسائل والرد
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            console.log(`📩 Nachricht empfangen: ${text}`);

            // ✅ الرد الفوري عند "Jetzt starten" أو "Start"
            if (text === 'jetzt starten' || text === 'start') {
                await sock.sendMessage(from, {
                    text: '👋 Hallo! Dein DigiNetz Bot ist jetzt aktiv ✅'
                });
            }
        });

    } catch (error) {
        console.error('❌ Fehler in startBot:', error);
        setTimeout(startBot, 5000);
    }
}

startBot();
setInterval(() => {}, 1000); // إبقاء Railway شغال
