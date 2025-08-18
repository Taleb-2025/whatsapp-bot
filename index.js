require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version ${version.join(".")} (latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("Connection closed. Reconnecting...");
            startSock(); // إعادة الاتصال تلقائيًا
        } else if (connection === "open") {
            console.log("✅ Bot ist verbunden mit WhatsApp");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        const msg = messages[0];
        const from = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        if (!from || msg.key.fromMe) return;

        const text = body.trim().toLowerCase();

        if (text === "start") {
            await sock.sendMessage(from, { text: "👋 Hallo DigiNetz!\nBitte wähle deine Sprache:\n1️⃣ Deutsch\n2️⃣ Arabisch\n3️⃣ Türkisch" });
        }

        if (text === "hallo diginetz") {
            await sock.sendMessage(from, { text: "👋 Willkommen! Was möchtest du tun?" });
        }

        // أضف المزيد من الأوامر هنا حسب الحاجة
    });
}

startSock();
