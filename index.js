// index.js – DigiNetz WhatsApp Bot (Railway Ready)
require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const P = require("pino");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_diginetz");

    const sock = makeWASocket({
        logger: P({ level: "silent" }),
        auth: state,
        printQRInTerminal: false // ❌ إيقاف الطباعة التلقائية للـ QR
    });

    // عند ظهور QR Code جديد
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log("\n============================");
            console.log("🔗 امسح هذا الـ QR Code من الرابط التالي:");
            console.log(qrLink);
            console.log("============================\n");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ الاتصال مغلق، إعادة المحاولة:", shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === "open") {
            console.log("✅ تم الاتصال بنجاح مع WhatsApp!");
        }
    });

    // حفظ بيانات الجلسة تلقائياً
    sock.ev.on("creds.update", saveCreds);

    // الرد على رسالة "Start"
    sock.ev.on("messages.upsert", async (msg) => {
        const m = msg.messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation?.toLowerCase() || "";

        if (text === "start") {
            await sock.sendMessage(from, {
                text: "👋 Hallo, dein DigiNetz WhatsApp-Bot ist jetzt aktiv!"
            });
        }
    });
}

startBot();
