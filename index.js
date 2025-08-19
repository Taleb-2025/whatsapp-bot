const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

// Auth über Multi-File State
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_diginetz');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        browser: ['DigiNetz', 'WebApp', '1.0']
    });

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("📷 QR-Code scannen:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 Verbindung geschlossen. Neuverbinden:', shouldReconnect);
            if (shouldReconnect) startBot();
        }

        if (connection === 'open') {
            console.log('✅ Bot ist verbunden!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`📨 Nachricht von ${sender}: ${text}`);

        if (text?.toLowerCase().includes('start')) {
            await sock.sendMessage(sender, { text: '👋 Willkommen bei DigiNetz!' });
        }
    });
}

startBot();
