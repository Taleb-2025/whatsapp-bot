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

// حفظ ملف AUTH TAR.GZ من .env
function saveAuthArchive() {
    if (AUTH_TAR_GZ && !fs.existsSync(archivePath)) {
        fs.writeFileSync(archivePath, Buffer.from(AUTH_TAR_GZ, 'base64'));
        console.log('✅ auth_info_diginetz.tar.gz gespeichert');
    }
}

// فك الأرشيف إذا كان موجودًا
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

        // ------------------------- SERVICES START -------------------------
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            console.log(`📩 Nachricht empfangen: ${text} | Aktueller State: ${userState[from]}`);

            // Schritt 1: Start
            if (text === 'start' || text === 'jetzt starten') {
                userState[from] = 'lang';
                await sock.sendMessage(from, {
                    text: '🔗 Offizieller DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
                });
                await sock.sendMessage(from, {
                    text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
                });
                return;
            }

            // Schritt 2: Sprachauswahl
            if (userState[from] === 'lang') {
                if (text === '1') {
                    userState[from] = 'de';
                    userState[from + "_lang"] = 'de';
                    await sock.sendMessage(from, {
                        text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft.\nEr führt dich Schritt für Schritt durch Vorlagen, z.B. Rechnungen oder Ausgabenübersicht.\nOhne Registrierung. Ohne Vorkenntnisse.\n\nJetzt kostenlos ausprobieren!'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '💾 Tippe oben auf „DigiNetz“, um den Bot zu speichern.'
                        });
                        setTimeout(async () => {
                            await sock.sendMessage(from, {
                                text: '🟩 Schritt 3 – Auswahl der Templates:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung\n3️⃣ Privat Ausgaben'
                            });
                        }, 3000);
                    }, 7000);
                    return;
                }

                if (text === '2') {
                    userState[from] = 'ar';
                    userState[from + "_lang"] = 'ar';
                    await sock.sendMessage(from, {
                        text: '🇸🇦 DigiNetz Assistant هو بوت ذكي يساعدك خطوة بخطوة عبر قوالب جاهزة مثل إنشاء فاتورة أو متابعة مصاريفك.\nبدون تسجيل دخول. بدون معرفة مسبقة.\n\nجرّب الخدمة الآن مجانًا!'
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
                        text: '🇹🇷 DigiNetz Assistant akıllı bir bottur. Sana hızlı ve kolay bir şekilde yardımcı olur.\nFatura oluşturma veya gider takibi gibi şablonlarla seni adım adım yönlendirir.\nKayıt gerekmez. Ön bilgiye ihtiyaç yok.\n\nHemen ücretsiz dene!'
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

            // ========== Schritt 3: Kleingewerbe Rechnung ==========
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

            if (userState[from] === 'kg_rechnungsnr') {
                userData[from] = userData[from] || {};
                userData[from].rechnungsnr = body;
                userState[from] = 'kg_firma';
                const lang = userState[from + "_lang"];
                if (lang === 'de') {
                    await sock.sendMessage(from, { text: '🏢 Bitte gib den *Firmennamen* ein:' });
                } else if (lang === 'ar') {
                    await sock.sendMessage(from, { text: '🏢 من فضلك أدخل *اسم الشركة*:' });
                } else {
                    await sock.sendMessage(from, { text: '🏢 Lütfen *firma adını* girin:' });
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
setInterval(() => {}, 1000);
