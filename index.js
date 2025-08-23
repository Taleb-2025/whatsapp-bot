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
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!body) return;

    const text = body.trim();
    if (!userState[from]) userState[from] = null;
    if (!userData[from]) userData[from] = {};

    // بداية المحادثة مع البوت
    if (text.toLowerCase() === 'start' || text.toLowerCase() === 'jetzt starten') {
        userState[from] = 'lang';
        userData[from] = {};

        await sock.sendMessage(from, {
            text: '🔗 Dies ist der offizielle DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
        });

        await sock.sendMessage(from, {
            text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
        });
        return;
    }

    const lang = userState[from];

    // اختيار اللغة
    if (userState[from] === 'lang') {
        if (text === '1') {
            userState[from] = 'de';
            await sock.sendMessage(from, {
                text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell hilft...'
            });
            setTimeout(async () => {
                await sock.sendMessage(from, { text: '💾 Tippe auf „DigiNetz“ oben, um den Bot zu speichern.' });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung\n3️⃣ Privat Ausgaben'
                    });
                }, 3000);
            }, 7000);
            return;
        }

        if (text === '2') {
            userState[from] = 'ar';
            await sock.sendMessage(from, {
                text: '🇸🇦 هو بوت ذكي يساعدك بسرعة وسهولة خطوة بخطوة...'
            });
            setTimeout(async () => {
                await sock.sendMessage(from, { text: '💾 اضغط على اسم "DigiNetz" في الأعلى لحفظ البوت.' });
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
                await sock.sendMessage(from, { text: '💾 Botu kaydetmek için yukarıdaki "DigiNetz" adına dokun.' });
                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '🟩 Adım 3 – Şablon türünü seç:\n1️⃣ Küçük işletme\n2️⃣ Şirket\n3️⃣ Özel harcamalar'
                    });
                }, 3000);
            }, 7000);
            return;
        }
    }

    // اختيار القالب
    if (['de', 'ar', 'tr'].includes(lang)) {
        if (text === '1') {
            userState[from] = 'klein_1';
            await sendStep(from, lang,
                '🧾 Schritt 1 – Wie lautet dein vollständiger Name oder Firmenname?',
                '🧾 الخطوة 1 – ما هو اسمك الكامل أو اسم شركتك؟',
                '🧾 Adım 1 – Tam adınız veya firma adınız nedir?'
            );
            return;
        }
    }

    // خطوات Kleingewerbe Rechnung
    const steps = {
        klein_1: { key: 'name', next: 'klein_2', msg: ['🏠 Schritt 2 – Adresse eingeben', '🏠 الخطوة 2 – أدخل العنوان', '🏠 Adım 2 – Adresinizi girin'] },
        klein_2: { key: 'adresse', next: 'klein_3', msg: ['👤 Schritt 3 – Kundendaten', '👤 الخطوة 3 – بيانات العميل', '👤 Adım 3 – Müşteri bilgileri'] },
        klein_3: { key: 'kundendaten', next: 'klein_4', msg: [`📅 Schritt 4 – Rechnungsdatum (Standard: ${new Date().toISOString().split('T')[0]})`, `📅 الخطوة 4 – تاريخ الفاتورة`, `📅 Adım 4 – Fatura tarihi`] },
        klein_4: { key: 'datum', next: 'klein_5', msg: ['🧾 Schritt 5 – Leistung beschreiben', '🧾 الخطوة 5 – صف خدمتك', '🧾 Adım 5 – Hizmetinizi açıklayın'] },
        klein_5: { key: 'leistung', next: 'klein_6', msg: ['💶 Schritt 6 – Betrag (z. B. 100 EUR)', '💶 الخطوة 6 – أدخل المبلغ', '💶 Adım 6 – Tutarı girin'] },
        klein_6: { key: 'betrag', next: 'klein_7', msg: ['💳 Schritt 7 – Zahlungsart', '💳 الخطوة 7 – طريقة الدفع', '💳 Adım 7 – Ödeme yöntemi'] },
        klein_7: { key: 'zahlung', next: 'klein_8', msg: ['🏦 Schritt 8 – IBAN (optional)', '🏦 الخطوة 8 – IBAN (اختياري)', '🏦 Adım 8 – IBAN (isteğe bağlı)'] },
        klein_8: { key: 'iban', next: 'klein_9', msg: ['📝 Schritt 9 – Notizen oder "keine"', '📝 الخطوة 9 – ملاحظات إضافية أو "لا شيء"', '📝 Adım 9 – Ek notlar veya "yok"'] },
        klein_9: { key: 'notizen', next: 'bestätigung', msg: ['✅ Fast fertig! Bitte bestätige deine Daten...', '✅ شكراً لك! يرجى تأكيد بياناتك...', '✅ Teşekkürler! Lütfen verilerinizi onaylayın...'] },
    };

    const currentStep = userState[from];
    const stepData = steps[currentStep];

    if (stepData) {
        if (!text) return;

        // تخزين البيانات
        userData[from][stepData.key] = text;

        // الانتقال للخطوة التالية أو عرض الملخص
        if (stepData.next) {
            userState[from] = stepData.next;
            await sendStep(from, lang, ...stepData.msg);

            // عند الوصول إلى خطوة التأكيد
            if (stepData.next === 'bestätigung') {
                const invoice = userData[from];
                const summary = `
📄 **Bitte überprüfe deine Angaben:**  
👤 Name: ${invoice.name}
🏠 Adresse: ${invoice.adresse}
👤 Kunde: ${invoice.kundendaten}
📅 Datum: ${invoice.datum}
🧾 Leistung: ${invoice.leistung}
💶 Betrag: ${invoice.betrag}
💳 Zahlungsart: ${invoice.zahlung}
🏦 IBAN: ${invoice.iban}
📝 Notizen: ${invoice.notizen}
                `;
                await sock.sendMessage(from, { text: summary });
                await sock.sendMessage(from, {
                    text: '✅ Antworte mit **Bestätigen** um die Rechnung zu erstellen, oder **Abbrechen** um neu zu beginnen.'
                });
            }
        }
        return;
    }

    // خطوة التأكيد
    if (userState[from] === 'bestätigung') {
        if (text.toLowerCase() === 'bestätigen') {
            await sock.sendMessage(from, {
                text: '🎉 Deine Rechnung wird jetzt erstellt! (API-Anbindung folgt später)'
            });
            userState[from] = null;
        } else if (text.toLowerCase() === 'abbrechen') {
            await sock.sendMessage(from, { text: '❌ Erstellung abgebrochen. Starte mit "Jetzt starten" neu.' });
            userState[from] = null;
            userData[from] = {};
        }
    }

    // وظيفة لإرسال الرسائل باللغات الثلاثة
    async function sendStep(to, lang, de, ar, tr) {
        const msg = lang === 'de' ? de : lang === 'ar' ? ar : tr;
        await sock.sendMessage(to, { text: msg });
    }
});
// 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // Railway am Leben halten
