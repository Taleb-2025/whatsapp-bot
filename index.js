// index.js - DigiNetz WhatsApp Bot on Railway

require("dotenv").config();
const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = "";
let sock;

// === إنشاء سيرفر Express لعرض QR Code كرابط ===
app.get("/", (req, res) => {
    if (!qrCodeData) {
        return res.send("<h2>⏳ انتظر قليلاً... يتم توليد QR Code الآن</h2>");
    }
    res.send(`
        <h1>امسح QR Code لتفعيل البوت</h1>
        <img src="${qrCodeData}" width="300" height="300" />
    `);
});

// === تشغيل السيرفر على Railway ===
app.listen(PORT, () => {
    console.log(`🌐 Server läuft auf: http://localhost:${PORT}`);
});

// === بدء الاتصال مع WhatsApp ===
async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_diginetz");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // لن نعرض QR هنا بل على الرابط
    });

    // عند ظهور QR جديد → نحوله إلى صورة Base64 ونحفظه للعرض في الرابط
    sock.ev.on("connection.update", async (update) => {
        const { connection, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            console.log("✅ QR Code جاهز → افتحه عبر الرابط في Railway Logs");
        }

        if (connection === "open") {
            console.log("✅ WhatsApp Bot متصل الآن!");
        } else if (connection === "close") {
            console.log("⚠️ انقطع الاتصال، إعادة المحاولة...");
            startSock();
        }
    });

    // حفظ بيانات الجلسة
    sock.ev.on("creds.update", saveCreds);

    // الرد على "Jetzt starten"
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.toLowerCase() === "jetzt starten") {
            await sock.sendMessage(from, { text: "👋 Hallo! Dein DigiNetz WhatsApp Bot ist jetzt aktiv ✅" });
        }
    });
}

startSock();
