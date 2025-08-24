require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const tar = require('tar');
const qrcode = require('qrcode-terminal');

const PORT = process.env.PORT || 3000;
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;
const CREDS_JSON = process.env.CREDS_JSON;
const KEYS_JSON = process.env.KEYS_JSON;
const AUTH_TAR_GZ = process.env.AUTH_TAR_GZ;

const authFolder = './auth_info_diginetz';
const credsPath = `${authFolder}/creds.json`;
const keysPath = `${authFolder}/keys.json`;
const archivePath = './auth_info_diginetz.tar.gz';

let userState = {}; // حالة المستخدم
let userData = {};  // بيانات الفاتورة

// حفظ auth_info_diginetz.tar.gz إذا كان موجودًا في ENV
function saveAuthArchive() {
    if (AUTH_TAR_GZ && !fs.existsSync(archivePath)) {
        const buffer = Buffer.from(AUTH_TAR_GZ, 'base64');
        fs.writeFileSync(archivePath, buffer);
        console.log('✅ auth_info_diginetz.tar.gz gespeichert');
    }
}

// فك الضغط عن بيانات الدخول إذا كانت موجودة
async function extractAuthArchive() {
    if (fs.existsSync(archivePath)) {
        console.log('📦 Entpacke auth_info_diginetz.tar.gz...');
        await tar.x({ file: archivePath });
        console.log('✅ Entpackt!');
    }
}

// حفظ ملفات الاعتماد creds.json و keys.json
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

// بدء تشغيل البوت
async function startBot() {
    try {
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

        // مراقبة الاتصال وإعادة تشغيل البوت تلقائيًا عند الانقطاع
        sock.ev.on('connection.update', ({ connection, qr }) => {
            if (qr) qrcode.generate(qr, { small: true });

            if (connection === 'open') {
                console.log('✅ WhatsApp verbunden!');
            } else if (connection === 'close') {
                console.log('❌ Verbindung geschlossen. Starte neu in 3s...');
                setTimeout(startBot, 3000);
            }
        });

        // ---------------- Kleingewerbe Rechnung Steps ----------------
            if (userState[from] === 'de' && text === '1') {
                userState[from] = 'kg_firma';
                userData[from] = {};
                await sock.sendMessage(from, { text: '🏢 Bitte gib deinen Firmennamen ein:' });
                return;
            }

            // 1. Firmenname
            if (userState[from] === 'kg_firma') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib deinen Firmennamen ein!' });
                    return;
                }
                userData[from].firma = body;
                userState[from] = 'kg_adresse';
                await sock.sendMessage(from, { text: '📍 Bitte gib deine Firmenadresse ein:' });
                return;
            }

            // 2. Adresse
            if (userState[from] === 'kg_adresse') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib deine Adresse ein!' });
                    return;
                }
                userData[from].adresse = body;
                userState[from] = 'kg_kunde';
                await sock.sendMessage(from, { text: '👤 Bitte gib den Kundennamen ein:' });
                return;
            }

            // 3. Kundendaten
            if (userState[from] === 'kg_kunde') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib den Kundennamen ein!' });
                    return;
                }
                userData[from].kunde = body;
                userState[from] = 'kg_rechnungsnr';
                await sock.sendMessage(from, { text: '🧾 Bitte gib die Rechnungsnummer ein:' });
                return;
            }

            // 4. Rechnungsnummer
            if (userState[from] === 'kg_rechnungsnr') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib die Rechnungsnummer ein!' });
                    return;
                }
                userData[from].rechnungsnr = body;
                userState[from] = 'kg_datum';
                await sock.sendMessage(from, { text: '📅 Bitte gib das Rechnungsdatum ein (z.B. 23.08.2025):' });
                return;
            }

            // 5. Rechnungsdatum
            if (userState[from] === 'kg_datum') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib das Datum ein!' });
                    return;
                }
                userData[from].datum = body;
                userState[from] = 'kg_betrag';
                await sock.sendMessage(from, { text: '💶 Bitte gib den Gesamtbetrag ein (z.B. 299.99):' });
                return;
            }

            // 6. Betrag
            if (userState[from] === 'kg_betrag') {
                if (!body) {
                    await sock.sendMessage(from, { text: '⚠️ Bitte gib den Betrag ein!' });
                    return;
                }
                userData[from].betrag = body;
                userState[from] = 'kg_bestaetigung';

                // عرض ملخص الفاتورة قبل التأكيد
                await sock.sendMessage(from, {
                    text: 📌 **Zusammenfassung deiner Rechnung:**\n\n +
                        🏢 Firma: ${userData[from].firma}\n +
                        📍 Adresse: ${userData[from].adresse}\n +
                        👤 Kunde: ${userData[from].kunde}\n +
                        🧾 Rechnungsnummer: ${userData[from].rechnungsnr}\n +
                        📅 Datum: ${userData[from].datum}\n +
                        💶 Betrag: ${userData[from].betrag}\n\n +
                        ✅ Wenn alles korrekt ist, antworte mit: *Bestätigen*\n +
                        ❌ Zum Abbrechen: *Abbrechen*
                });
                return;
            }

            // 7. Bestätigung
            if (userState[from] === 'kg_bestaetigung') {
                if (text === 'bestätigen' || text === 'bestaetigen') {
                    await sock.sendMessage(from, { text: '✅ Perfekt! Deine Rechnung wird jetzt erstellt...' });
                    userState[from] = 'fertig';
                    return;
                }

                if (text === 'abbrechen') {
                    userState[from] = 'fertig';
                    await sock.sendMessage(from, { text: '🚫 Rechnungserstellung abgebrochen.' });
                    return;
                }

                await sock.sendMessage(from, { text: '⚠️ Bitte antworte mit Bestätigen oder Abbrechen!' });
                return;
            }
        });
        // ------------------------- SERVICES END -------------------------
    } catch (error) {
        console.error('❌ Fehler in startBot:', error);
        setTimeout(startBot, 5000);
    }
}

startBot();
setInterval(() => {}, 1000); // لإبقاء Railway نشطًا
