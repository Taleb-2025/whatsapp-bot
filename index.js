require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");

async function startBot() {
    const authPath = path.join(__dirname, "auth_info_diginetz");
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS("Desktop"),
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("🔗 رابط QR جاهز:");
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log("❌ تم تسجيل الخروج. حذف ملفات المصادقة وإعادة الاتصال...");
                fs.rmSync(authPath, { recursive: true, force: true });
                startBot();
            } else {
                console.log("⚠️ انقطع الاتصال. إعادة المحاولة...");
                startBot();
            }
        } else if (connection === "open") {
            console.log("✅ تم الاتصال بنجاح! البوت جاهز الآن 🚀");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!text) return;

        if (text.toLowerCase() === "start") {
            await sock.sendMessage(from, { text: "👋 Hallo, dein DigiNetz Bot ist aktiv und bereit!" });
        }
    });
}

startBot();
