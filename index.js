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
let userLang = {};

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
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!body) return;

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
            return;
        }

        // Schritt 2 – Sprachauswahl
        if (userState[from] === 'lang') {
            if (text === '1') {
                userState[from] = 'template';
                userLang[from] = 'de';
                await sock.sendMessage(from, {
                    text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft. '
                        + 'Er führt dich Schritt für Schritt durch Vorlagen (Templates), z. B. zum Erstellen einer Rechnung oder zur Ausgabenübersicht '
                        + '– ohne Registrierung und ohne Vorkenntnisse. Jetzt kostenlos ausprobieren!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 Tippe auf „DigiNetz“ oben, um den Bot zu speichern.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Schritt 3 – Auswahl der Templates:\n'
                                + 'Bitte antworte mit einer Zahl:\n'
                                + '1️⃣ Kleingewerbe Rechnungen\n'
                                + '2️⃣ Unternehmen Rechnung (mit MwSt)\n'
                                + '3️⃣ Privat Ausgaben'
                        });
                    }, 3000);
                }, 7000);
                return;
            }

            if (text === '2') {
                userState[from] = 'template';
                userLang[from] = 'ar';
                await sock.sendMessage(from, {
                    text: '🇸🇦 DigiNetz Assistant هو بوت ذكي يساعدك بسرعة وسهولة، خطوة بخطوة، من خلال قوالب جاهزة '
                        + 'مثل إنشاء فاتورة أو متابعة مصاريفك – دون الحاجة لتسجيل دخول أو معرفة مسبقة. '
                        + 'جرّب الخدمة الآن مجانًا!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 اضغط على اسم "DigiNetz" في الأعلى لحفظ البوت.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 الخطوة 3 – اختر نوع القالب:\n'
                                + 'يرجى الرد برقم:\n'
                                + '1️⃣ فاتورة مشروع صغير\n'
                                + '2️⃣ فاتورة شركة (مع ضريبة القيمة المضافة)\n'
                                + '3️⃣ المصاريف الخاصة'
                        });
                    }, 3000);
                }, 7000);
                return;
            }

            if (text === '3') {
                userState[from] = 'template';
                userLang[from] = 'tr';
                await sock.sendMessage(from, {
                    text: '🇹🇷 DigiNetz Assistant, akıllı bir bottur. Sana hızlı ve kolay bir şekilde yardımcı olur. '
                        + 'Seni adım adım fatura oluşturma veya gider takibi gibi şablonlarla yönlendirir '
                        + '– kayıt gerekmeden ve ön bilgiye ihtiyaç duymadan. Hemen ücretsiz dene!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '💾 Botu kaydetmek için "DigiNetz" adına dokun.'
                    });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Adım 3 – Şablon türünü seç:\n'
                                + 'Lütfen bir numara ile cevap ver:\n'
                                + '1️⃣ Küçük işletme faturası\n'
                                + '2️⃣ Şirket faturası (KDV dahil)\n'
                                + '3️⃣ Özel harcamalar'
                        });
                    }, 3000);
                }, 7000);
                return;
            }
        }
        // Schritt 3 – Template Auswahl
        if (userState[from] === 'template') {
            if (text === '1') {
                userState[from] = 'kleine_rechnung_nummer';

                // رسالة حسب اللغة المختارة
                if (userLang[from] === 'de') {
                    await sock.sendMessage(from, {
                        text: '🧾 Bitte gib die Rechnungsnummer ein:'
                    });
                } else if (userLang[from] === 'ar') {
                    await sock.sendMessage(from, {
                        text: '🧾 من فضلك أدخل رقم الفاتورة:'
                    });
                } else if (userLang[from] === 'tr') {
                    await sock.sendMessage(from, {
                        text: '🧾 Lütfen fatura numarasını giriniz:'
                    });
                }
                return;
            }

            if (text === '2') {
                await sock.sendMessage(from, {
                    text: '📄 Unternehmen Rechnung (mit MwSt) kommt bald!'
                });
                return;
            }

            if (text === '3') {
                await sock.sendMessage(from, {
                    text: '💰 Privat Ausgaben Template kommt bald!'
                });
                return;
            }
        }

        // Schritt 4 – Rechnungsnummer speichern
        if (userState[from] === 'kleine_rechnung_nummer') {
            const rechnungsnummer = body.trim();

            // حفظ الرقم المدخل للمستخدم
            if (!global.userData) global.userData = {};
            if (!global.userData[from]) global.userData[from] = {};
            global.userData[from].rechnungsnummer = rechnungsnummer;

            if (userLang[from] === 'de') {
                await sock.sendMessage(from, {
                    text: `✅ Deine Rechnungsnummer wurde gespeichert: *${rechnungsnummer}*`
                });
            } else if (userLang[from] === 'ar') {
                await sock.sendMessage(from, {
                    text: `✅ تم حفظ رقم فاتورتك: *${rechnungsnummer}*`
                });
            } else if (userLang[from] === 'tr') {
                await sock.sendMessage(from, {
                    text: `✅ Fatura numaranız kaydedildi: *${rechnungsnummer}*`
                });
            }

            // بعد الحفظ نعيد المستخدم لقائمة القوالب
            userState[from] = 'template';

            if (userLang[from] === 'de') {
                await sock.sendMessage(from, {
                    text: '🟩 Schritt 3 – Auswahl der Templates:\n'
                        + 'Bitte antworte mit einer Zahl:\n'
                        + '1️⃣ Kleingewerbe Rechnungen\n'
                        + '2️⃣ Unternehmen Rechnung (mit MwSt)\n'
                        + '3️⃣ Privat Ausgaben'
                });
            } else if (userLang[from] === 'ar') {
                await sock.sendMessage(from, {
                    text: '🟩 الخطوة 3 – اختر نوع القالب:\n'
                        + 'يرجى الرد برقم:\n'
                        + '1️⃣ فاتورة مشروع صغير\n'
                        + '2️⃣ فاتورة شركة (مع ضريبة القيمة المضافة)\n'
                        + '3️⃣ المصاريف الخاصة'
                });
            } else if (userLang[from] === 'tr') {
                await sock.sendMessage(from, {
                    text: '🟩 Adım 3 – Şablon türünü seç:\n'
                        + 'Lütfen bir numara ile cevap ver:\n'
                        + '1️⃣ Küçük işletme faturası\n'
                        + '2️⃣ Şirket faturası (KDV dahil)\n'
                        + '3️⃣ Özel harcamalar'
                });
            }

            return;
        }
    });
    // 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // Railway am Leben halten
