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

        // ------------------------- SERVICES START -------------------------
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            console.log(`📩 Nachricht empfangen: ${text} | Aktueller State: ${userState[from]}`);

            // Schritt 1 - Start
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

            // Schritt 2 - Sprachauswahl
            if (userState[from] === 'lang') {
                if (text === '1') {
                    userState[from] = 'de';
                    userState[from + "_lang"] = 'de';
                    await sock.sendMessage(from, {
                        text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell hilft.\nEr führt dich Schritt für Schritt durch Vorlagen, z.B. Rechnungen erstellen oder Ausgaben verwalten – ohne Registrierung und ohne Vorkenntnisse.\nJetzt kostenlos ausprobieren!'
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
                    userState[from + "_lang"] = 'ar';
                    await sock.sendMessage(from, {
                        text: '🇸🇦 هو بوت ذكي يساعدك بسرعة وسهولة خطوة بخطوة من خلال قوالب جاهزة مثل إنشاء فاتورة أو متابعة مصاريفك – دون الحاجة لتسجيل دخول أو معرفة مسبقة. جرّب الخدمة الآن مجانًا!'
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
                    userState[from + "_lang"] = 'tr';
                    await sock.sendMessage(from, {
                        text: '🇹🇷 DigiNetz Assistant akıllı bir bottur. Sana hızlı ve kolay bir şekilde yardımcı olur. Fatura oluşturma veya gider takibi gibi şablonlarla seni adım adım yönlendirir – kayıt gerekmeden ve ön bilgiye ihtiyaç duymadan. Hemen ücretsiz dene!'
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

            // === Schritt 3: Kleingewerbe Rechnung – Erste Abfrage ===
            if ((userState[from] === 'de' || userState[from] === 'ar' || userState[from] === 'tr') && text === '1') {
                userState[from] = 'kg_rechnungsnr';

                const lang = userState[from + "_lang"];
                if (lang === 'de') {
                    await sock.sendMessage(from, { text: '🧾 Bitte gib die *Rechnungsnummer* ein:\n(z.B. RE-2025-001)' });
                } else if (lang === 'ar') {
                    await sock.sendMessage(from, { text: '🧾 من فضلك أدخل *رقم الفاتورة*:\n(مثال: RE-2025-001)' });
                } else {
                    await sock.sendMessage(from, { text: '🧾 Lütfen *fatura numarasını* girin:\n(Örn: RE-2025-001)' });
                }
                return;
            }

            // 4. Rechnungsnummer speichern
            if (userState[from] === 'kg_rechnungsnr') {
                userData[from] = {};
                userData[from].rechnungsnr = body;

                userState[from] = 'kg_bestaetigung';
                await sock.sendMessage(from, {
                    text: `✅ Deine Rechnungsnummer ist: *${body}*\n\nAntworte mit *Bestätigen* oder *Abbrechen*.`
                });
                return;
            }

            // 5. Bestätigung
            if (userState[from] === 'kg_bestaetigung') {
                if (text === 'bestätigen' || text === 'bestaetigen') {
                    await sock.sendMessage(from, { text: '✅ Perfekt! Deine Rechnung wird jetzt erstellt...' });
                    delete userState[from];
                    delete userData[from];
                    return;
                }

                if (text === 'abbrechen') {
                    await sock.sendMessage(from, { text: '🚫 Rechnungserstellung abgebrochen.' });
                    delete userState[from];
                    delete userData[from];
                    return;
                }

                await sock.sendMessage(from, { text: '⚠️ Bitte antworte mit *Bestätigen* oder *Abbrechen*!' });
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
