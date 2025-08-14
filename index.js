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

            // 🧠 Text erkennen
            let text = '';
            if (msg.message.conversation) text = msg.message.conversation;
            else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
            else if (msg.message.buttonsResponseMessage?.selectedButtonId) text = msg.message.buttonsResponseMessage.selectedButtonId;
            else if (msg.message.buttonsResponseMessage?.selectedDisplayText) text = msg.message.buttonsResponseMessage.selectedDisplayText;
            else return await sock.sendMessage(sender, { text: '⚠️ Bitte sende normalen Text wie "start".' });

            text = text.trim().toLowerCase();
            console.log("Empfangen:", text);

            // 📍 Menü starten
            if (text === 'start' || text === 'hallo' || text === 'zurück') {
                // 1. Begrüßung
                await sock.sendMessage(sender, {
                    text: `👋 Willkommen bei *DigiNetz!*\n\nUnsere Plattform bietet schnelle und einfache Dienstleistungen für digitale Vorlagen ✅\n\nBitte wähle eine Option:`
                });

                // 2. Tipp nach 5 Sekunden
                setTimeout(async () => {
                    await sock.sendMessage(sender, {
                        text: `💡 *Tipp:* Speichere diesen Kontakt als DigiNetz, um alle Dienste einfacher zu nutzen.`
                    });
                }, 5000);

                // 3. Kontaktkarte nach 7 Sekunden
                setTimeout(async () => {
                    await sock.sendMessage(sender, {
                        contacts: {
                            displayName: "DigiNetz",
                            contacts: [
                                {
                                    vcard: `BEGIN:VCARD
VERSION:3.0
FN:DigiNetz
ORG:DigiNetz Template
TEL;type=CELL;type=VOICE;waid=4915563691188:+49 1556 3691188
EMAIL:support@diginetz-template.com
END:VCARD`
                                }
                            ]
                        }
                    });
                }, 7000);

                // 4. Template-Optionen nach 12 Sekunden
                setTimeout(async () => {
                    await sock.sendMessage(sender, {
                        text:
`❓ *Wähle das passende Template aus der Liste unten aus:*

🧾 Template 1
🧾 Template 2
🧾 Template 3
🧾 Template 4
🧾 Template 5

📩 Schreibe einfach die passende Nummer zur Auswahl.`,
                        footer: '👉 Zahl eingeben oder Button drücken:',
                        buttons: [
                            { buttonId: '1', buttonText: { displayText: '🧾 Template 1' }, type: 1 },
                            { buttonId: '2', buttonText: { displayText: '🧾 Template 2' }, type: 1 },
                            { buttonId: '3', buttonText: { displayText: '🧾 Template 3' }, type: 1 },
                            { buttonId: '4', buttonText: { displayText: '🧾 Template 4' }, type: 1 },
                            { buttonId: '5', buttonText: { displayText: '🧾 Template 5' }, type: 1 }
                        ]
                    });
                }, 12000);

                userState[sender] = { stage: 'main_menu' };
                return;
            }

            // 📍 Antwort auf Menü-Auswahl
            if (userState[sender]?.stage === 'main_menu') {
                const antworten = {
                    '1': {
                        text: `📄 Kleingewerbe Rechnung\n\nErstelle deine Rechnung hier:\n👉 https://diginetz-template.com/kleingewerbe`
                    },
                    '2': {
                        text: `📑 Unternehmen mit MwSt\n\nJetzt starten:\n👉 https://diginetz-template.com/mwst-rechnung`
                    },
                    '3': {
                        text: `🧘 SpaRadar Template\n\nTemplate öffnen:\n👉 https://diginetz-template.com/sparadar`
                    },
                    '4': {
                        text: `🔗 App Verbindung\n\nZur Verbindung:\n👉 https://diginetz-template.com/app`
                    },
                    '5': {
                        text: `📬 Kontakt & Hilfe\n\n✉️ E-Mail: support@diginetz-template.com\n📱 Oder schreibe hier direkt.`
                    }
                };

                if (antworten[text]) {
                    await sock.sendMessage(sender, {
                        text: antworten[text].text,
                        buttons: [{ buttonId: 'zurück', buttonText: { displayText: '🔙 Zurück zum Menü' }, type: 1 }],
                        footer: '👉 Menü erneut aufrufen mit "zurück".'
                    });
                } else {
                    await sock.sendMessage(sender, { text: '❗ Ungültige Auswahl. Bitte 1–5 tippen oder Button verwenden.' });
                }

                return;
            }

        } catch (err) {
            console.error('❌ Fehler:', err);
        }
    });
}

startBot();