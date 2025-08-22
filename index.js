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

    const text = body.trim();

    if (!userState[from]) userState[from] = 'lang';
    if (!global.userData) global.userData = {};
    if (!userData[from]) userData[from] = {};

    if (text.toLowerCase() === 'start' || text.toLowerCase() === 'jetzt starten') {
        userState[from] = 'lang';
        await sock.sendMessage(from, {
            text: '🔗 Dies ist der offizielle DigiNetz Bot-Link:\nhttps://wa.me/4915563691188?text=Jetzt%20starten\n\nSpeichere diesen Link, um jederzeit zurückzukehren.'
        });
        await sock.sendMessage(from, {
            text: '👋 Ich bin dein Assistant. Bitte antworte mit:\n1 = Deutsch\n2 = Arabisch\n3 = Türkisch'
        });
        return;
    }

    // Sprache wählen
    if (userState[from] === 'lang') {
        if (text === '1') {
            userState[from] = 'de_template';
            await sock.sendMessage(from, {
                text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft. Er führt dich Schritt für Schritt durch Vorlagen (Templates).'
            });
            await sock.sendMessage(from, {
                contacts: {
                    displayName: 'DigiNetz Template',
                    contacts: [
                        {
                            displayName: 'DigiNetz Template',
                            vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:DigiNetz Template\nTEL;type=CELL;type=VOICE;waid=4915563691188:+49 155 63691188\nEND:VCARD'
                        }
                    ]
                }
            });
            setTimeout(async () => {
                await sock.sendMessage(from, {
                    text: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit einer Zahl:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung (mit MwSt)\n3️⃣ Privat Ausgaben'
                });
            }, 3000);
        }
        // (Arabisch و Türkisch bleiben wie gehabt)
    }

    // Auswahl Kleingewerbe Rechnung
    if (userState[from] === 'de_template' && text === '1') {
        userState[from] = 'klein_1';
        userData[from] = {};
        await sock.sendMessage(from, {
            text: '🧾 Schritt 1 – Wie lautet dein vollständiger Name oder Firmenname?'
        });
        return;
    }

    // Schritt 1
    if (userState[from] === 'klein_1') {
        userData[from].name = text;
        userState[from] = 'klein_2';
        await sock.sendMessage(from, {
            text: '🏡 Schritt 2 – Bitte gib deine Adresse ein (Straße, PLZ, Stadt)'
        });
        return;
    }

    // Schritt 2
    if (userState[from] === 'klein_2') {
        userData[from].adresse = text;
        userState[from] = 'klein_3';
        await sock.sendMessage(from, {
            text: '👤 Schritt 3 – Bitte gib die Kundendaten ein (Name + Adresse)'
        });
        return;
    }

    // Schritt 3
    if (userState[from] === 'klein_3') {
        userData[from].kundendaten = text;
        userState[from] = 'klein_4';

        const today = new Date().toISOString().split('T')[0];
        userData[from].defaultDatum = today;

        await sock.sendMessage(from, {
            text: `📅 Schritt 4 – Rechnungsdatum (Standard: ${today}). Möchtest du ein anderes Datum? Antworte mit Datum oder "ok"`
        });
        return;
    }

    // Schritt 4
    if (userState[from] === 'klein_4') {
        userData[from].datum = text.toLowerCase() === 'ok' ? userData[from].defaultDatum : text;
        userState[from] = 'klein_5';
        await sock.sendMessage(from, {
            text: '🧾 Schritt 5 – Beschreibe deine Leistung (z. B. Webdesign, Beratung etc.)'
        });
        return;
    }

    // Schritt 5
    if (userState[from] === 'klein_5') {
        userData[from].leistung = text;
        userState[from] = 'klein_6';
        await sock.sendMessage(from, {
            text: '💶 Schritt 6 – Gib den Betrag ein (z. B. 100 EUR)'
        });
        return;
    }

    // Schritt 6
    if (userState[from] === 'klein_6') {
        userData[from].betrag = text;
        userState[from] = 'klein_7';
        await sock.sendMessage(from, {
            text: '💳 Schritt 7 – Zahlungsart (z. B. Überweisung, bar)'
        });
        return;
    }

    // Schritt 7
    if (userState[from] === 'klein_7') {
        userData[from].zahlung = text;
        userState[from] = 'klein_8';
        await sock.sendMessage(from, {
            text: '🏦 Schritt 8 – IBAN (optional, z. B. DE89...)'
        });
        return;
    }

    // Schritt 8
    if (userState[from] === 'klein_8') {
        userData[from].iban = text;
        userState[from] = 'klein_9';
        await sock.sendMessage(from, {
            text: '📝 Schritt 9 – Zusätzliche Notizen oder "keine"'
        });
        return;
    }

    // Schritt 9
    if (userState[from] === 'klein_9') {
        userData[from].notizen = text;
        userState[from] = 'fertig';

        await sock.sendMessage(from, {
            text: '✅ Vielen Dank! Deine Rechnung wird vorbereitet...'
        });

        // Hier könnte man ein PDF generieren oder eine Bestätigung senden
        return;
    }
});
// 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // verhindert das Beenden durch Railway
