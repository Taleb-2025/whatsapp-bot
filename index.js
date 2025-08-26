require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const P = require("pino");
const fs = require("fs");
const path = require("path");

// تحميل بيانات الاعتماد من متغيرات البيئة
const credsPath = path.join(__dirname, "auth_info_diginetz");
if (!fs.existsSync(credsPath)) {
    fs.mkdirSync(credsPath, { recursive: true });
}

// استرجاع بيانات الاعتماد من base64 إذا كانت موجودة
if (process.env.CREDS_JSON && process.env.KEYS_JSON) {
    try {
        const creds = Buffer.from(process.env.CREDS_JSON, "base64");
        const keys = Buffer.from(process.env.KEYS_JSON, "base64");

        fs.writeFileSync(path.join(credsPath, "creds.json"), creds);
        fs.writeFileSync(path.join(credsPath, "keys.json"), keys);
    } catch (err) {
        console.error("خطأ في فك تشفير بيانات الاعتماد:", err);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(credsPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" }),
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("امسح هذا الكود لربط البوت:");
            qrcode.generate(qr, { small: true });
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("تم قطع الاتصال، جارٍ إعادة الاتصال...", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ تم الاتصال بنجاح!");
        }
    });

    sock.ev.on("messages.upsert", async (msg) => {
        const message = msg.messages[0];
        if (!message.message || message.key.fromMe) return;

        const from = message.key.remoteJid;
        const text = message.message.conversation || message.message.extendedTextMessage?.text;

        if (!text) return;

        if (text.toLowerCase() === "start" || text.toLowerCase() === "hallo") {
            await sock.sendMessage(from, { text: "👋 Hallo, dein WhatsApp-Bot ist aktiv!" });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

startBot();
