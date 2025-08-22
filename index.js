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

let userState = {};
let userData = {};

// 🔽🔽🔽 SERVICES START 🔽🔽🔽
async function handleServices(msg, userState, userData, lang, sock) {
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
  const sender = msg.key.remoteJid;
  if (!text || !sender) return;

  const reply = async (content) => {
    await sock.sendMessage(sender, { text: content });
  };

  // Schritt 3 – Auswahl der Templates
  if (userState[sender] === 'template_selection') {
    if (text === '1') {
      userState[sender] = 'kleingewerbe_step_1';
      userData[sender] = { template: 'kleingewerbe' };

      if (lang === 'de') {
        await reply('🧾 Schritt 1 – Wie lautet dein vollständiger Name oder Firmenname?');
      } else if (lang === 'ar') {
        await reply('🧾 الخطوة 1 – ما هو اسمك الكامل أو اسم شركتك؟');
      } else if (lang === 'tr') {
        await reply('🧾 Adım 1 – Tam adınız veya firma adınız nedir?');
      }
      return;
    }
  }

  // Schritte für Kleingewerbe Rechnung
  const steps = {
    kleingewerbe_step_1: {
      next: 'kleingewerbe_step_2',
      key: 'name',
      msg: {
        de: '🏠 Schritt 2 – Bitte gib deine Adresse ein (Straße, PLZ, Stadt)',
        ar: '🏠 الخطوة 2 – الرجاء إدخال العنوان الكامل (الشارع، الرمز البريدي، المدينة)',
        tr: '🏠 Adım 2 – Lütfen adresinizi girin (Sokak, Posta kodu, Şehir)',
      },
    },
    kleingewerbe_step_2: {
      next: 'kleingewerbe_step_3',
      key: 'adresse',
      msg: {
        de: '👤 Schritt 3 – Bitte gib die Kundendaten ein (Name + Adresse)',
        ar: '👤 الخطوة 3 – أدخل بيانات العميل (الاسم + العنوان)',
        tr: '👤 Adım 3 – Lütfen müşteri bilgilerini girin (Ad + Adres)',
      },
    },
    kleingewerbe_step_3: {
      next: 'kleingewerbe_step_4',
      key: 'kundendaten',
      msg: {
        de: `📅 Schritt 4 – Rechnungsdatum (Standard: ${new Date().toISOString().split('T')[0]}). Möchtest du ein anderes Datum? Antworte mit Datum oder "ok"`,
        ar: `📅 الخطوة 4 – تاريخ الفاتورة (افتراضي: ${new Date().toISOString().split('T')[0]}). هل ترغب بتاريخ آخر؟ أجب بالتاريخ أو "ok"`,
        tr: `📅 Adım 4 – Fatura tarihi (Varsayılan: ${new Date().toISOString().split('T')[0]}). Başka bir tarih istiyor musun? Tarih veya "ok" yaz`,
      },
    },
    kleingewerbe_step_4: {
      next: 'kleingewerbe_step_5',
      key: 'datum',
      msg: {
        de: '🧾 Schritt 5 – Beschreibe deine Leistung (z. B. Webdesign, Beratung etc.)',
        ar: '🧾 الخطوة 5 – صف خدمتك (مثلاً تصميم مواقع، استشارة...)',
        tr: '🧾 Adım 5 – Hizmetinizi açıklayın (örn. web tasarım, danışmanlık)',
      },
    },
    kleingewerbe_step_5: {
      next: 'kleingewerbe_step_6',
      key: 'leistung',
      msg: {
        de: '💶 Schritt 6 – Gib den Betrag ein (z. B. 100 EUR)',
        ar: '💶 الخطوة 6 – أدخل المبلغ (مثلاً 100 EUR)',
        tr: '💶 Adım 6 – Tutarı girin (ör. 100 EUR)',
      },
    },
    kleingewerbe_step_6: {
      next: 'kleingewerbe_step_7',
      key: 'betrag',
      msg: {
        de: '💳 Schritt 7 – Zahlungsart (z. B. Überweisung, bar)',
        ar: '💳 الخطوة 7 – طريقة الدفع (مثلاً تحويل بنكي، نقدًا)',
        tr: '💳 Adım 7 – Ödeme yöntemi (örn. havale, nakit)',
      },
    },
    kleingewerbe_step_7: {
      next: 'kleingewerbe_step_8',
      key: 'zahlung',
      msg: {
        de: '🏦 Schritt 8 – IBAN (optional, z. B. DE89...)',
        ar: '🏦 الخطوة 8 – رقم الحساب البنكي IBAN (اختياري، مثل DE89...)',
        tr: '🏦 Adım 8 – IBAN (isteğe bağlı, örn. DE89...)',
      },
    },
    kleingewerbe_step_8: {
      next: 'kleingewerbe_step_9',
      key: 'iban',
      msg: {
        de: '📝 Schritt 9 – Zusätzliche Notizen oder "keine"',
        ar: '📝 الخطوة 9 – ملاحظات إضافية أو اكتب "لا شيء"',
        tr: '📝 Adım 9 – Ek notlar veya "yok"',
      },
    },
    kleingewerbe_step_9: {
      next: 'done',
      key: 'notizen',
      msg: {
        de: '✅ Vielen Dank! Deine Rechnung wird vorbereitet...',
        ar: '✅ شكراً لك! يتم الآن إعداد فاتورتك...',
        tr: '✅ Teşekkürler! Faturanız hazırlanıyor...',
      },
    },
  };

  const current = userState[sender];
  if (steps[current]) {
    if (!text || text.trim() === '') return;
    userData[sender][steps[current].key] = text.trim();

    if (steps[current].next === 'done') {
      await reply(steps[current].msg[lang]);
      userState[sender] = null;
    } else {
      userState[sender] = steps[current].next;
      await reply(steps[current].msg[lang]);
    }
  }
}
// 🔼🔼🔼 SERVICES END 🔼🔼🔼


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
    if (connection === 'open') console.log('✅ WhatsApp verbunden!');
    if (connection === 'close') {
      console.log('❌ Verbindung geschlossen. Starte neu...');
      startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    if (text.toLowerCase() === 'start' || text.toLowerCase() === 'jetzt starten') {
      userState[sender] = 'template_selection';
      userData[sender] = { lang: 'de' }; // Standard: Deutsch
      await sock.sendMessage(sender, { text: 'Bitte wähle ein Template:\n1️⃣ Kleingewerbe\n2️⃣ Unternehmen\n3️⃣ Privat' });
      return;
    }

    const lang = userData[sender]?.lang || 'de';
    await handleServices(msg, userState, userData, lang, sock);
  });
}

startBot();
setInterval(() => {}, 1000); // hält Railway aktiv
