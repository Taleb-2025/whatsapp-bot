// index.js – DigiNetz WhatsApp Bot (QR عبر المتصفح)
require('dotenv').config();
const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const P = require("pino");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// 1. صفحة رئيسية للـ QR
// ---------------------------
let qrCodeData = "";
app.get("/", (req, res) => {
    if (qrCodeData) {
        res.send(`<h2>Scan den QR Code</h2><img src="${qrCodeData}" />`);
    } else {
        res.send("<h3>QR Code wird generiert... Aktualisiere die Seite gleich!</h3>");
    }
});

app.listen(PORT, () => console.log(`🌍 Server läuft: https://diginetz-bot.up.railway.app`));

// ---------------------------
// 2. تشغيل بوت DigiNetz
// ---------------------------
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info_diginetz");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: "silent" })
    });

    // ---------------------------
    // 3. توليد QR Code تلقائيًا
    // ---------------------------
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            console.log(`📌 Öffne diesen Link und scanne den QR: https://diginetz-bot.up.railway.app`);
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Verbindung geschlossen, erneuter Versuch...", shouldReconnect);
            if (shouldReconnect) startBot();
        }

        if (connection === "open") {
            console.log("✅ Bot ist erfolgreich verbunden!");
        }
    });

    // ---------------------------
    // 4. الرد على رسالة البداية
    // ---------------------------
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (body && body.toLowerCase() === "jetzt starten") {
            await sock.sendMessage(msg.key.remoteJid, {
                text: "👋 Hallo! Dein DigiNetz-Bot ist jetzt verbunden ✅"
            });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

startBot();
