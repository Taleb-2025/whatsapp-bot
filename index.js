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

    // Sprachwahl
    if (userState[from] === 'lang') {
        if (text === '1') {
            userState[from] = 'de';

            await sock.sendMessage(from, {
                text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft. Er führt dich Schritt für Schritt durch Vorlagen (Templates), z. B. zum Erstellen einer Rechnung oder zur Ausgabenübersicht – ohne Registrierung und ohne Vorkenntnisse. Jetzt kostenlos ausprobieren!'
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
                await sock.sendMessage(from, {
                    text: '💾 Tippe auf „DigiNetz“ oben, um den Bot zu speichern und leichter wiederzufinden.'
                });

                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: '🟩 Schritt 3 – Auswahl der Templates:\nBitte antworte mit einer Zahl:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung (mit MwSt)\n3️⃣ Privat Ausgaben'
                    });
                    userState[from] = 'template';
                }, 3000);
            }, 7000);
        }
    }

    // Auswahl der Vorlage
    if (userState[from] === 'template') {
        if (text === '1') {
            userState[from] = 'k1';
            userData[from] = {};
            await sock.sendMessage(from, {
                text: '🧾 Schritt 1 – Wie lautet dein vollständiger Name oder Firmenname?'
            });
            return;
        }
    }

    // Kleingewerbe Schritte
    if (userState[from]?.startsWith('k')) {
        if (userState[from] === 'k1') {
            userData[from].name = text;
            userState[from] = 'k2';
            await sock.sendMessage(from, {
                text: '🏡 Schritt 2 – Bitte gib deine Adresse ein (Straße, PLZ, Stadt)'
            });
            return;
        }

        if (userState[from] === 'k2') {
            userData[from].adresse = text;
            userState[from] = 'k3';
            await sock.sendMessage(from, {
                text: '🧑‍🤝‍🧑 Schritt 3 – Bitte gib die Kundendaten ein (Name + Adresse)'
            });
            return;
        }

        if (userState[from] === 'k3') {
            userData[from].kundendaten = text;
            userState[from] = 'k4';
            const today = new Date().toISOString().split('T')[0];
            userData[from].rechnungsdatum = today;
            await sock.sendMessage(from, {
                text: `📅 Schritt 4 – Rechnungsdatum (Standard: ${today}).\nMöchtest du ein anderes Datum? Antworte mit Datum oder "ok"`
            });
            return;
        }

        if (userState[from] === 'k4') {
            if (text !== 'ok') {
                userData[from].rechnungsdatum = text;
            }
            userState[from] = 'k5';
            await sock.sendMessage(from, {
                text: '🧾 Schritt 5 – Beschreibe deine Leistung (z. B. Webdesign, Beratung etc.)'
            });
            return;
        }

        if (userState[from] === 'k5') {
            userData[from].leistung = text;
            userState[from] = 'k6';
            await sock.sendMessage(from, {
                text: '💶 Schritt 6 – Gib den Betrag ein (z. B. 100 EUR)'
            });
            return;
        }

        if (userState[from] === 'k6') {
            userData[from].betrag = text;
            userState[from] = 'k7';
            await sock.sendMessage(from, {
                text: '💳 Schritt 7 – Zahlungsart (z. B. Überweisung, bar)'
            });
            return;
        }

        if (userState[from] === 'k7') {
            userData[from].zahlungsart = text;
            userState[from] = 'k8';
            await sock.sendMessage(from, {
                text: '🏦 Schritt 8 – IBAN (optional, z. B. DE89...)'
            });
            return;
        }

        if (userState[from] === 'k8') {
            userData[from].iban = text;
            userState[from] = 'k9';
            await sock.sendMessage(from, {
                text: '📝 Schritt 9 – Zusätzliche Notizen oder "keine"'
            });
            return;
        }

        if (userState[from] === 'k9') {
            userData[from].notizen = text;
            userState[from] = 'fertig';

            await sock.sendMessage(from, {
                text: '✅ Vielen Dank! Deine Rechnung wird vorbereitet…'
            });

            // Optional: Hier PDF-Erstellung oder API-Aufruf einfügen
            return;
        }
    }
});
// 🔼🔼🔼 SERVICES END 🔼🔼🔼
}

startBot();
setInterval(() => {}, 1000); // verhindert das Beenden durch Railway
