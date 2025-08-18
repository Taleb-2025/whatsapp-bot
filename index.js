require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');

let sock;
let userState = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_diginetz');

    sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        browser: ['DigiNetz', 'WebApp', '1.0']
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("📷 QR-Code bereit:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            console.log("🔁 Reconnecting...");
            startBot();
        }

        if (connection === 'open') {
            console.log('✅ Bot ist verbunden mit WhatsApp');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            let text = '';

            if (msg.message.conversation) text = msg.message.conversation;
            else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
            else if (msg.message.buttonsResponseMessage?.selectedButtonId) text = msg.message.buttonsResponseMessage.selectedButtonId;
            else if (msg.message.buttonsResponseMessage?.selectedDisplayText) text = msg.message.buttonsResponseMessage.selectedDisplayText;
            else return await sock.sendMessage(sender, { text: '⚠️ Bitte sende normalen Text wie "start".' });

            text = text.trim().toLowerCase();
            console.log("Empfangen:", text);

            // 🌍 Sprache wählen
            if (text === 'start' || text === 'hallo') {
                await sock.sendMessage(sender, {
                    text: '👋 Hallo DigiNetz! Bitte wähle deine Sprache:\n\n1️⃣ Deutsch\n2️⃣ Arabisch\n3️⃣ Türkisch'
                });
                userState[sender] = { stage: 'choose_language' };
                return;
            }

            if (userState[sender]?.stage === 'choose_language') {
                const langs = { '1': 'de', '2': 'ar', '3': 'tr' };
                if (!langs[text]) {
                    return await sock.sendMessage(sender, { text: '❗ Bitte wähle 1, 2 oder 3.' });
                }
                userState[sender].lang = langs[text];
                userState[sender].stage = 'main_menu';

                // Weiterleitung zum Menü
                text = 'zurück';
            }

            // ⬅️ Zurück zum Hauptmenü
            if (text === 'zurück' && userState[sender]?.lang) {
                const lang = userState[sender].lang;

                const messages = {
                    de: {
                        welcome: `👋 Willkommen bei *DigiNetz!*\n\nUnsere Plattform bietet schnelle und einfache Dienstleistungen für digitale Vorlagen ✅\n\nBitte wähle eine Option:`,
                        tip: `💡 *Tipp:* Speichere diesen Kontakt als DigiNetz, um alle Dienste einfacher zu nutzen.`,
                        buttons: [
                            { buttonId: '1', buttonText: { displayText: '🧾 Template 1' }, type: 1 },
                            { buttonId: '2', buttonText: { displayText: '🧾 Template 2' }, type: 1 },
                            { buttonId: '3', buttonText: { displayText: '🧾 Template 3' }, type: 1 },
                            { buttonId: '4', buttonText: { displayText: '🧾 Template 4' }, type: 1 },
                            { buttonId: '5', buttonText: { displayText: '🧾 Template 5' }, type: 1 }
                        ],
                        footer: '👉 Zahl eingeben oder Button drücken:',
                        templateText: `❓ *Wähle das passende Template aus der Liste unten aus:*`
                    },
                    ar: {
                        welcome: `👋 مرحبًا بك في *DigiNetz!*\n\nمنصتنا تقدم خدمات سريعة وسهلة للقوالب الرقمية ✅\n\nاختر أحد الخيارات:`,
                        tip: `💡 *نصيحة:* احفظ هذا الرقم كـ DigiNetz لتسهل عليك كل الخدمات.`,
                        buttons: [
                            { buttonId: '1', buttonText: { displayText: '🧾 القالب 1' }, type: 1 },
                            { buttonId: '2', buttonText: { displayText: '🧾 القالب 2' }, type: 1 },
                            { buttonId: '3', buttonText: { displayText: '🧾 القالب 3' }, type: 1 },
                            { buttonId: '4', buttonText: { displayText: '🧾 القالب 4' }, type: 1 },
                            { buttonId: '5', buttonText: { displayText: '🧾 القالب 5' }, type: 1 }
                        ],
                        footer: '👉 أرسل رقم القالب أو اضغط على زر:',
                        templateText: `❓ *اختر القالب المناسب من القائمة التالية:*`
                    },
                    tr: {
                        welcome: `👋 *DigiNetz*'e Hoş Geldiniz!\n\nPlatformumuz dijital şablonlar için hızlı ve kolay hizmetler sunar ✅\n\nLütfen bir seçenek seçin:`,
                        tip: `💡 *İpucu:* Bu kişiyi DigiNetz olarak kaydedin, tüm hizmetleri daha kolay kullanırsınız.`,
                        buttons: [
                            { buttonId: '1', buttonText: { displayText: '🧾 Şablon 1' }, type: 1 },
                            { buttonId: '2', buttonText: { displayText: '🧾 Şablon 2' }, type: 1 },
                            { buttonId: '3', buttonText: { displayText: '🧾 Şablon 3' }, type: 1 },
                            { buttonId: '4', buttonText: { displayText: '🧾 Şablon 4' }, type: 1 },
                            { buttonId: '5', buttonText: { displayText: '🧾 Şablon 5' }, type: 1 }
                        ],
                        footer: '👉 Numarayı yaz veya butona tıkla:',
                        templateText: `❓ *Aşağıdaki listeden uygun şablonu seçin:*`
                    }
                };

                const m = messages[lang];

                await sock.sendMessage(sender, { text: m.welcome });

                setTimeout(() => sock.sendMessage(sender, { text: m.tip }), 5000);
                setTimeout(() => sock.sendMessage(sender, {
                    text: m.templateText,
                    footer: m.footer,
                    buttons: m.buttons
                }), 8000);
                setTimeout(() => sock.sendMessage(sender, {
                    contacts: {
                        displayName: "DigiNetz",
                        contacts: [{
                            vcard: `BEGIN:VCARD
VERSION:3.0
FN:DigiNetz
ORG:DigiNetz Template
TEL;type=CELL;type=VOICE;waid=4915563691188:+49 1556 3691188
EMAIL:support@diginetz-template.com
END:VCARD`
                        }]
                    }
                }), 12000);

                return;
            }

            // 📍 Auswahl bearbeiten
            if (userState[sender]?.stage === 'main_menu') {
                const antworten = {
                    '1': 'https://diginetz-template.com/kleingewerbe',
                    '2': 'https://diginetz-template.com/mwst-rechnung',
                    '3': 'https://diginetz-template.com/sparadar',
                    '4': 'https://diginetz-template.com/app',
                    '5': 'mailto:support@diginetz-template.com'
                };

                if (antworten[text]) {
                    await sock.sendMessage(sender, {
                        text: `📄 Öffnen: ${antworten[text]}`,
                        buttons: [{ buttonId: 'zurück', buttonText: { displayText: '🔙 Zurück / رجوع / Geri' }, type: 1 }],
                        footer: '👉 Hauptmenü mit "zurück".'
                    });
                } else {
                    await sock.sendMessage(sender, { text: '❗ Ungültige Eingabe. Bitte wähle 1–5 oder Button.' });
                }

                return;
            }

        } catch (err) {
            console.error('❌ Fehler:', err);
        }
    });
}

startBot();
