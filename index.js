require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const tar = require('tar');
const { generate } = require('qrcode-terminal');

const PORT = process.env.PORT || 3000;
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CREDS_JSON = process.env.CREDS_JSON;
const KEYS_JSON = process.env.KEYS_JSON;
const AUTH_TAR_GZ = process.env.AUTH_TAR_GZ;
const NODE_ENV = process.env.NODE_ENV || 'development';

const authFolder = './auth_info_diginetz';
const credsPath = `${authFolder}/creds.json`;
const keysPath = `${authFolder}/keys.json`;
const archivePath = './auth_info_diginetz.tar.gz';

function saveAuthArchive() {
    if (AUTH_TAR_GZ && !fs.existsSync(archivePath)) {
        const buffer = Buffer.from(AUTH_TAR_GZ, 'base64');
        fs.writeFileSync(archivePath, buffer);
        console.log('✅ auth_info_diginetz.tar.gz gespeichert');
    }
}

async function extractAuthArchive() {
    if (fs.existsSync(archivePath)) {
        console.log('📦 Entpacke auth_info_diginetz.tar.gz...');
        await tar.x({ file: archivePath });
        console.log('✅ Entpackt!');
    }
}

function saveAuthFiles() {
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);

    if (CREDS_JSON && !fs.existsSync(credsPath)) {
        const credsDecoded = Buffer.from(CREDS_JSON, 'base64').toString('utf-8');
        fs.writeFileSync(credsPath, credsDecoded);
        console.log('✅ creds.json gespeichert');
    }

    if (KEYS_JSON && !fs.existsSync(keysPath)) {
        const keysDecoded = Buffer.from(KEYS_JSON, 'base64').toString('utf-8');
        fs.writeFileSync(keysPath, keysDecoded);
        console.log('✅ keys.json gespeichert');
    }
}

let userState = {};

async function startBot() {
    saveAuthArchive();
    await extractAuthArchive();
    saveAuthFiles();

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, qr }) => {
        if (qr) generate(qr, { small: true });

        if (connection === 'open') {
            console.log('✅ WhatsApp verbunden!');
        } else if (connection === 'close') {
            console.log('❌ Verbindung geschlossen. Starte neu...');
            startBot();
        }
    });

    // 🔽🔽🔽 SERVICES START 🔽🔽🔽
    sock.ev.on('messages.upsert', async ({ messages }) => {
        console.log('📩 Neue Nachricht erhalten:', messages);

        const msg = messages[0];
        if (!msg.message) {
            console.log('⚠️ Nachricht ohne Inhalt!');
            return;
        }

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!body) {
            console.log('⚠️ Kein Text gefunden');
            return;
        }

        const text = body.trim().toLowerCase();
        console.log(`📥 Von ${from}: ${text}`);

        // Schritt 1 – Start
        if (text === 'start' || text === 'jetzt starten') {
            userState[from] = 'lang';

            await sock.sendMessage(from, {
                text: '🔗 Dies ist der offizielle DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
            });

            await sock.sendMessage(from, {
                text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
            });
        }

        // Schritt 2 – Sprachauswahl
        if (userState[from] === 'lang') {
            if (text === '1') {
                userState[from] = 'de';
                await sock.sendMessage(from, {
                    text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft...'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 Tippe auf „DigiNetz“ oben, um den Bot zu speichern.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit einer Zahl:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung (mit MwSt)\n3️⃣ Privat Ausgaben'
                        });
                    }, 3000);
                }, 7000);
            }

            if (text === '2') {
                userState[from] = 'ar';
                await sock.sendMessage(from, {
                    text: '🇸🇦 هو بوت ذكي يساعدك بسرعة وسهولة...'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 اضغط على اسم "DigiNetz" في الأعلى لحفظ البوت.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 الخطوة 3 – اختر نوع القالب:\nيرجى الرد برقم:\n1️⃣ فاتورة مشروع صغير\n2️⃣ فاتورة شركة\n3️⃣ المصاريف الخاصة'
                        });
                    }, 3000);
                }, 7000);
            }

            if (text === '3') {
                userState[from] = 'tr';
                await sock.sendMessage(from, {
                    text: '🇹🇷 DigiNetz Assistant, akıllı bir bottur...'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 Botu kaydetmek için "DigiNetz" adına dokun.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Adım 3 – Şablon türünü seç:\n1️⃣ Küçük işletme\n2️⃣ Şirket\n3️⃣ Özel harcamalar'
                        });
                    }, 3000);
                }, 7000);
            }
        }
    });
    // 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // Railway am Leben halten
