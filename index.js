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

let userState = {};
let userData = {};

// حفظ auth_info_diginetz.tar.gz إذا كان موجود في ENV
function saveAuthArchive() {
    if (AUTH_TAR_GZ && !fs.existsSync(archivePath)) {
        const buffer = Buffer.from(AUTH_TAR_GZ, 'base64');
        fs.writeFileSync(archivePath, buffer);
        console.log('✅ auth_info_diginetz.tar.gz gespeichert');
    }
}

// فك الضغط عن بيانات الدخول
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

        // ------------------------- SERVICES START -------------------------
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            console.log(`📩 Nachricht empfangen: ${text} | Aktueller State: ${userState[from]}`);

            // خطوة البداية
            if (text === 'start' || text === 'jetzt starten') {
                userState[from] = 'lang';

                await sock.sendMessage(from, {
                    text: '🔗 Dies ist der offizielle DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
                });

                await sock.sendMessage(from, {
                    text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
                });
                return;
            }

            // اختيار اللغة
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
                                text: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit einer Zahl:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung\n3️⃣ Privat Ausgaben'
                            });
                        }, 3000);
                    }, 7000);
                    return;
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
                                text: '🟩 الخطوة 3 – اختر نوع القالب:\n1️⃣ فاتورة مشروع صغير\n2️⃣ فاتورة شركة\n3️⃣ المصاريف الخاصة'
                            });
                        }, 3000);
                    }, 7000);
                    return;
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
                    return;
                }
            }

            // ---------------- Kleingewerbe Rechnung ----------------
            if (userState[from] === 'de' && text === '1') {
                userState[from] = 'kg_firma';
                userData[from] = {};
                await sock.sendMessage(from, { text: '🏢 Bitte gib deinen Firmennamen ein:' });
                return;
            }

            // 1. Firmenname
            if (userState[from] === 'kg_firma' && body) {
                userData[from].firma = body;
                userState[from] = 'kg_adresse';
                await sock.sendMessage(from, { text: '📍 Bitte gib deine Firmenadresse ein:' });
                return;
            }

            // 2. Adresse
            if (userState[from] === 'kg_adresse' && body) {
                userData[from].adresse = body;
                userState[from] = 'kg_kunde';
                await sock.sendMessage(from, { text: '👤 Bitte gib den Kundennamen ein:' });
                return;
            }

            // 3. Kundendaten
            if (userState[from] === 'kg_kunde' && body) {
                userData[from].kunde = body;
                userState[from] = 'kg_rechnungsnr';
                await sock.sendMessage(from, { text: '🧾 Bitte gib die Rechnungsnummer ein:' });
                return;
            }

            // 4. Rechnungsnummer
            if (userState[from] === 'kg_rechnungsnr' && body) {
                userData[from].rechnungsnr = body;
                userState[from] = 'kg_datum';
                await sock.sendMessage(from, { text: '📅 Bitte gib das Rechnungsdatum ein (z.B. 23.08.2025):' });
                return;
            }

            // 5. Rechnungsdatum
            if (userState[from] === 'kg_datum' && body) {
                userData[from].datum = body;
                userState[from] = 'kg_betrag';
                await sock.sendMessage(from, { text: '💶 Bitte gib den Gesamtbetrag ein (z.B. 299.99):' });
                return;
            }

            // 6. Betrag + عرض الملخص
            if (userState[from] === 'kg_betrag' && body) {
                userData[from].betrag = body;
                userState[from] = 'kg_bestaetigung';

                await sock.sendMessage(from, {
                    text: `📌 **Zusammenfassung deiner Rechnung:**\n\n` +
                        `🏢 Firma: ${userData[from].firma}\n` +
                        `📍 Adresse: ${userData[from].adresse}\n` +
                        `👤 Kunde: ${userData[from].kunde}\n` +
                        `🧾 Rechnungsnummer: ${userData[from].rechnungsnr}\n` +
                        `📅 Datum: ${userData[from].datum}\n` +
                        `💶 Betrag: ${userData[from].betrag}\n\n` +
                        `✅ Wenn alles korrekt ist, antworte mit: *Bestätigen*\n` +
                        `❌ Zum Abbrechen: *Abbrechen*`
                });
                userData[from].warned = false; // Reset التحذير
                return;
            }

            // 7. Bestätigung (إصلاح تكرار الرسائل)
            if (userState[from] === 'kg_bestaetigung') {
                if (text === 'bestätigen' || text === 'bestaetigen') {
                    await sock.sendMessage(from, { text: '✅ Perfekt! Deine Rechnung wird jetzt erstellt...' });
                    userState[from] = 'fertig';
                    userData[from].warned = false;
                    return;
                }

                if (text === 'abbrechen') {
                    userState[from] = 'fertig';
                    userData[from].warned = false;
                    await sock.sendMessage(from, { text: '🚫 Rechnungserstellung abgebrochen.' });
                    return;
                }

                // التحذير لمرة واحدة فقط
                if (!userData[from].warned) {
                    userData[from].warned = true;
                    await sock.sendMessage(from, { text: '⚠️ Bitte antworte mit *Bestätigen* oder *Abbrechen*!' });
                }
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
setInterval(() => {}, 1000); // لإبقاء Railway شغال
