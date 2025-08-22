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
        if (qr) {
            generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ WhatsApp verbunden!');
        } else if (connection === 'close') {
            console.log('❌ Verbindung geschlossen. Starte neu...');
            startBot();
        }
    });
// 🔽🔽🔽 SERVICES START 🔽🔽🔽
sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!body) return;

    const text = body.trim().toLowerCase();
    const lang = userState[from]?.lang || 'de';

    // Start-Befehl
    if (text === 'start' || text === 'jetzt starten') {
        userState[from] = { step: 'lang' };

        await sock.sendMessage(from, {
            text: '🔗 Dies ist der offizielle DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
        });

        await sock.sendMessage(from, {
            text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
        });
        return;
    }

    // Sprachauswahl
    if (userState[from]?.step === 'lang') {
        if (['1', '2', '3'].includes(text)) {
            const languageMap = { '1': 'de', '2': 'ar', '3': 'tr' };
            const selectedLang = languageMap[text];
            userState[from] = { step: 'template', lang: selectedLang };

            const welcomeMessages = {
                de: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft. Er führt dich Schritt für Schritt durch Vorlagen (Templates), z. B. zum Erstellen einer Rechnung oder zur Ausgabenübersicht – ohne Registrierung und ohne Vorkenntnisse. Jetzt kostenlos ausprobieren!',
                ar: '🇸🇦 هو بوت ذكي يساعدك بسرعة وسهولة، خطوة بخطوة، من خلال قوالب جاهزة مثل إنشاء فاتورة أو متابعة مصاريفك – دون الحاجة لتسجيل دخول أو معرفة مسبقة. جرّب الخدمة الآن مجانًا!',
                tr: '🇹🇷 DigiNetz Assistant, akıllı bir bottur. Sana hızlı ve kolay bir şekilde yardımcı olur. Seni adım adım fatura oluşturma veya gider takibi gibi şablonlarla yönlendirir – kayıt gerekmeden ve ön bilgiye ihtiyaç duymadan. Hemen ücretsiz dene!'
            };

            await sock.sendMessage(from, {
                text: welcomeMessages[selectedLang]
            });

            await sock.sendMessage(from, {
                contacts: {
                    displayName: 'DigiNetz Template',
                    contacts: [{
                        displayName: 'DigiNetz Template',
                        vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:DigiNetz Template\nTEL;type=CELL;type=VOICE;waid=4915563691188:+49 155 63691188\nEND:VCARD'
                    }]
                }
            });

            setTimeout(async () => {
                const messages = {
                    de: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit einer Zahl:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung (mit MwSt)\n3️⃣ Privat Ausgaben',
                    ar: '🟩 الخطوة 3 – اختر نوع القالب:\nيرجى الرد برقم:\n1️⃣ فاتورة مشروع صغير\n2️⃣ فاتورة شركة (مع ضريبة القيمة المضافة)\n3️⃣ المصاريف الخاصة',
                    tr: '🟩 Adım 3 – Şablon türünü seç:\nLütfen bir numara ile cevap ver:\n1️⃣ Küçük işletme faturası\n2️⃣ Şirket faturası (KDV dahil)\n3️⃣ Özel harcamalar.'
                };
                await sock.sendMessage(from, {
                    text: messages[selectedLang]
                });
            }, 7000);
        }
        return;
    }

    // Auswahl Template
    if (userState[from]?.step === 'template') {
        if (text === '1') {
            userState[from].step = 'klein_name';
            await sock.sendMessage(from, {
                text: {
                    de: '🧾 Schritt 1 – Wie lautet dein vollständiger Name oder Firmenname?',
                    ar: '🧾 الخطوة 1 – ما هو اسمك الكامل أو اسم شركتك؟',
                    tr: '🧾 Adım 1 – Tam adınızı veya şirket adınızı yazınız?'
                }[lang]
            });
            return;
        }
    }

    // Schritt 2 – Adresse
    if (userState[from]?.step === 'klein_name') {
        userState[from].name = text;
        userState[from].step = 'klein_adresse';
        await sock.sendMessage(from, {
            text: {
                de: '🏠 Schritt 2 – Bitte gib deine Adresse ein (Straße, PLZ, Stadt)',
                ar: '🏠 الخطوة 2 – أدخل عنوانك بالكامل (الشارع، الرمز البريدي، المدينة)',
                tr: '🏠 Adım 2 – Lütfen adresinizi girin (sokak, posta kodu, şehir)'
            }[lang]
        });
        return;
    }

    // Schritt 3 – Kundendaten
    if (userState[from]?.step === 'klein_adresse') {
        userState[from].adresse = text;
        userState[from].step = 'klein_kunde';
        await sock.sendMessage(from, {
            text: {
                de: '👤 Schritt 3 – Bitte gib die Kundendaten ein (Name + Adresse)',
                ar: '👤 الخطوة 3 – الرجاء إدخال بيانات العميل (الاسم + العنوان)',
                tr: '👤 Adım 3 – Müşteri bilgilerini girin (ad + adres)'
            }[lang]
        });
        return;
    }

    // Schritt 4 – Rechnungsdatum
    if (userState[from]?.step === 'klein_kunde') {
        userState[from].kunde = text;
        userState[from].step = 'klein_datum';
        const today = new Date().toISOString().split('T')[0];
        await sock.sendMessage(from, {
            text: {
                de: `📅 Schritt 4 – Rechnungsdatum (Standard: ${today}). Möchtest du ein anderes Datum? Antworte mit Datum oder "ok"`,
                ar: `📅 الخطوة 4 – تاريخ الفاتورة (افتراضي: ${today}). هل تريد تاريخًا آخر؟ أكتب التاريخ أو "ok"`,
                tr: `📅 Adım 4 – Fatura tarihi (varsayılan: ${today}). Başka bir tarih istiyor musunuz? Tarihi yazın veya "ok" yazın`
            }[lang]
        });
        return;
    }

    // Schritt 5 – Positionen
    if (userState[from]?.step === 'klein_datum') {
        const today = new Date().toISOString().split('T')[0];
        userState[from].datum = text === 'ok' ? today : text;
        userState[from].step = 'klein_leistung';
        await sock.sendMessage(from, {
            text: {
                de: '🧾 Schritt 5 – Beschreibe deine Leistung (z. B. Webdesign, Beratung etc.)',
                ar: '🧾 الخطوة 5 – صف الخدمة أو المنتج (مثل تصميم موقع، استشارة، إلخ)',
                tr: '🧾 Adım 5 – Hizmeti tanımlayın (örn. Web tasarımı, danışmanlık)'
            }[lang]
        });
        return;
    }

    // Schritt 6 – Betrag
    if (userState[from]?.step === 'klein_leistung') {
        userState[from].leistung = text;
        userState[from].step = 'klein_betrag';
        await sock.sendMessage(from, {
            text: {
                de: '💶 Schritt 6 – Gib den Betrag ein (z. B. 100 EUR)',
                ar: '💶 الخطوة 6 – أدخل المبلغ (مثال: 100 يورو)',
                tr: '💶 Adım 6 – Tutarı girin (ör. 100 EUR)'
            }[lang]
        });
        return;
    }

    // Schritt 7 – Zahlungsmethode
    if (userState[from]?.step === 'klein_betrag') {
        userState[from].betrag = text;
        userState[from].step = 'klein_zahlung';
        await sock.sendMessage(from, {
            text: {
                de: '🏦 Schritt 7 – Zahlungsart (z. B. Überweisung, bar)',
                ar: '🏦 الخطوة 7 – طريقة الدفع (مثال: تحويل بنكي، نقدًا)',
                tr: '🏦 Adım 7 – Ödeme yöntemi (örn. havale, nakit)'
            }[lang]
        });
        return;
    }

    // Schritt 8 – IBAN (optional)
    if (userState[from]?.step === 'klein_zahlung') {
        userState[from].zahlung = text;
        userState[from].step = 'klein_iban';
        await sock.sendMessage(from, {
            text: {
                de: '💳 Schritt 8 – IBAN (optional, z. B. DE89...)',
                ar: '💳 الخطوة 8 – رقم IBAN (اختياري)',
                tr: '💳 Adım 8 – IBAN numarası (isteğe bağlı)'
            }[lang]
        });
        return;
    }

    // Schritt 9 – Notizen (optional)
    if (userState[from]?.step === 'klein_iban') {
        userState[from].iban = text;
        userState[from].step = 'klein_notiz';
        await sock.sendMessage(from, {
            text: {
                de: '📝 Schritt 9 – Zusätzliche Notizen oder "keine"',
                ar: '📝 الخطوة 9 – ملاحظات إضافية أو "لا شيء"',
                tr: '📝 Adım 9 – Ek notlar veya "yok"'
            }[lang]
        });
        return;
    }

    // Schritt 10 – Vorschau
    if (userState[from]?.step === 'klein_notiz') {
        userState[from].notiz = text;
        userState[from].step = 'fertig';

        await sock.sendMessage(from, {
            text: {
                de: '✅ Vielen Dank! Deine Rechnung wird vorbereitet...',
                ar: '✅ شكرًا لك! يتم الآن تجهيز فاتورتك...',
                tr: '✅ Teşekkürler! Faturanız hazırlanıyor...'
            }[lang]
        });

        // PDF-Generierung kommt später
    }
});
// 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // verhindert das Beenden durch Railway
