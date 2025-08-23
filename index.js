require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const P = require("pino");

// ✅ حفظ حالة المستخدمين
let userState = {};
let userData = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info_diginetz");
    const sock = makeWASocket({
        logger: P({ level: "silent" }),
        printQRInTerminal: true,
        auth: state
    });

    // 🔄 إعادة الاتصال تلقائياً
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                console.log("❌ Session beendet. Bitte neu starten.");
            }
        } else if (connection === "open") {
            console.log("✅ WhatsApp verbunden!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // ✅ جميع خطوات الفاتورة
    const invoiceSteps = [
        { key: "firma", question: "🏢 Bitte gib deinen Firmennamen ein:" },
        { key: "adresse", question: "📍 Bitte gib deine Firmenadresse ein:" },
        { key: "kunde", question: "👤 Bitte gib den Kundennamen ein:" },
        { key: "rechnungsnummer", question: "🧾 Bitte gib die Rechnungsnummer ein:" },
        { key: "datum", question: "📅 Bitte gib das Rechnungsdatum ein (z.B. 23.08.2025):" },
        { key: "betrag", question: "💵 Bitte gib den Gesamtbetrag ein (z.B. 299.99):" }
    ];

    // ✅ إرسال رسالة
    async function sendMessage(jid, text) {
        await sock.sendMessage(jid, { text });
    }

    // ✅ منطق البوت
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation?.trim() || msg.message.extendedTextMessage?.text?.trim();

        // ✅ بدء المحادثة
        if (body?.toLowerCase() === "jetzt starten" || body?.toLowerCase() === "start") {
            userState[from] = "choose_template";
            userData[from] = {};
            await sendMessage(from, "Templates:\n1️⃣ Kleingewerbe Rechnungen\n2️⃣ Unternehmen Rechnung (mit MwSt)\n3️⃣ Privat Ausgaben");
            return;
        }

        // ✅ اختيار القالب
        if (userState[from] === "choose_template") {
            if (body === "1") {
                userState[from] = "kleingewerbe_1";
                await sendMessage(from, invoiceSteps[0].question);
                return;
            } else if (body === "2" || body === "3") {
                await sendMessage(from, "⚠️ Diese Templates sind bald verfügbar!");
                return;
            } else {
                await sendMessage(from, "Bitte antworte mit 1, 2 oder 3.");
                return;
            }
        }

        // ✅ خطوات Kleingewerbe Rechnung واحدة تلو الأخرى
        if (userState[from]?.startsWith("kleingewerbe_")) {
            const stepIndex = parseInt(userState[from].split("_")[1]) - 1;

            // حفظ الإجابة
            userData[from][invoiceSteps[stepIndex].key] = body;

            // إذا لم نصل إلى آخر خطوة
            if (stepIndex + 1 < invoiceSteps.length) {
                const nextStep = invoiceSteps[stepIndex + 1];
                userState[from] = `kleingewerbe_${stepIndex + 2}`;
                await sendMessage(from, nextStep.question);
                return;
            }

            // ✅ ملخص الفاتورة
            userState[from] = "confirm_invoice";
            const summary = `📌 *Zusammenfassung deiner Rechnung:*\n\n🏢 Firma: ${userData[from].firma}\n📍 Adresse: ${userData[from].adresse}\n👤 Kunde: ${userData[from].kunde}\n🧾 Rechnungsnummer: ${userData[from].rechnungsnummer}\n📅 Datum: ${userData[from].datum}\n💵 Betrag: ${userData[from].betrag}\n\n✅ Wenn alles korrekt ist, antworte mit: *Bestätigen*\n❌ Zum Abbrechen: *Abbrechen*`;
            await sendMessage(from, summary);
            return;
        }

        // ✅ تأكيد أو إلغاء الفاتورة
        if (userState[from] === "confirm_invoice") {
            if (body?.toLowerCase() === "bestätigen") {
                await sendMessage(from, "✅ Deine Rechnung wurde bestätigt! PDF wird erstellt...");
                userState[from] = "completed";
                return;
            } else if (body?.toLowerCase() === "abbrechen") {
                await sendMessage(from, "❌ Rechnung abgebrochen.");
                delete userState[from];
                delete userData[from];
                return;
            } else {
                // لا تكرار الرسائل – إرسالها مرة واحدة فقط
                if (userData[from]?.warned !== true) {
                    userData[from].warned = true;
                    await sendMessage(from, "⚠️ Bitte antworte mit *Bestätigen* oder *Abbrechen*!");
                }
                return;
            }
        }
    });
}

startBot();
