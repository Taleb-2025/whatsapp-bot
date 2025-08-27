const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Express endpoint just to keep Railway alive
app.get("/", (req, res) => {
    res.send("✅ WhatsApp Bot is running on Railway!");
});

app.listen(PORT, () => {
    console.log(`🌐 Server is running on port ${PORT}`);
});

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_diginetz');
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('📱 Scan the QR Code below to connect:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('❌ Session expired. Please rescan QR.');
                startSock();
            } else {
                console.log('⚡ Connection closed. Reconnecting...');
                startSock();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot connected successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startSock();
