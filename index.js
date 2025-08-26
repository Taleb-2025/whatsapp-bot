require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const P = require("pino");

async function startBot() {
    const authDir = "./auth_info_diginetz";

    // إنشاء المجلد إذا لم يكن موجودًا
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // تحميل حالة المصادقة
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // إنشاء الاتصال مع واتساب
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // لعرض QR في Railway Logs
        logger: P({ level: "silent" }),
    });

    // حفظ بيانات الجلسة (creds و keys) بعد أي تحديث
    sock.ev.on("creds.update", saveCreds);

    // عند استقبال رسالة جديدة
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        // الرد على "Jetzt starten"
        if (body.toLowerCase().includes("jetzt starten")) {
            await sock.sendMessage(from, {
                text: "👋 Hallo! Dein DigiNetz Bot ist jetzt aktiv ✅",
            });
        }
    });

    // عند حدوث انقطاع في الاتصال
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const reason =
                lastDisconnect?.error?.output?.statusCode || "Unknown";
            console.log("Verbindung geschlossen:", reason);

            // إعادة الاتصال تلقائيًا إذا تم تسجيل الخروج
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Verbinde erneut...");
                startBot();
            } else {
                console.log("❌ Sitzung abgelaufen. Bitte QR erneut scannen.");
            }
        } else if (connection === "open") {
            console.log("✅ Erfolgreich verbunden!");
        }
    });
}

startBot();
