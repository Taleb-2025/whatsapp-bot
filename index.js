require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

// 🔁 Startfunktion
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_diginetz');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // ⬅️ QR سيظهر في LOGS
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📸 Scan this QR Code to connect your WhatsApp:\n', qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Verbindung geschlossen. Starte neu…');
            if (shouldReconnect) {
                startBot(); // 🔁 Versuche erneut zu verbinden
            } else {
                console.log('🚪 Bot wurde ausgeloggt. Bitte QR-Code erneut scannen.');
            }
        }

        if (connection === 'open') {
            console.log('✅ Bot erfolgreich verbunden!');
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.message || message.key.fromMe) return;

        const sender = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text || '';

        console.log('📩 Neue Nachricht von', sender, ':', text);

        if (text.toLowerCase().includes('start')) {
            await sock.sendMessage(sender, { text: '👋 Hallo! Dein WhatsApp-Bot ist aktiv.' });
        }
    });
}

startBot();
