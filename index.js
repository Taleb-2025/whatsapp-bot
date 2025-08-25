require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const P = require('pino');

const authDir = path.join(__dirname, 'auth_info_diginetz');
const tarPath = path.join(__dirname, 'auth_tra.gz');
const userState = {};
const userData = {};

async function startBot() {
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tarPath)) {
        const zlib = require('zlib');
        const tar = require('tar');
        fs.createReadStream(tarPath).pipe(zlib.createGunzip()).pipe(tar.x({ C: __dirname }));
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Verbindung verloren. Neuverbinden...');
                startBot();
            } else {
                console.log('❌ Session ausgeloggt. Bitte AUTH_TRA_GZ prüfen.');
            }
        } else if (connection === 'open') {
            console.log('✅ Bot erfolgreich verbunden!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation?.trim() || msg.message.extendedTextMessage?.text?.trim() || '';

        if (!userState[from]) {
            userState[from] = 'lang';
            await sock.sendMessage(from, {
                text: '👋 Hallo! Ich bin dein DigiNetz Assistant.\n\nBitte antworte mit:\n1️⃣ Deutsch\n2️⃣ Arabisch\n3️⃣ Türkisch'
            });
            return;
        }

        // Schritt 2 – Sprachauswahl
        if (userState[from] === 'lang') {
            if (text === '1') {
                userState[from] = 'de';
                await sock.sendMessage(from, {
                    text: '🇩🇪 DigiNetz Assistant ist ein intelligenter Bot, der dir blitzschnell und einfach hilft. '
                        + 'Er führt dich Schritt für Schritt durch Vorlagen (Templates), z. B. zum Erstellen einer Rechnung oder zur Ausgabenübersicht '
                        + '– ohne Registrierung und ohne Vorkenntnisse. Jetzt kostenlos ausprobieren!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, { text: '💾 Tippe auf „DigiNetz“ oben, um den Bot zu speichern.' });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Schritt 3 – Auswahl der Templates:\n'
                                + 'Bitte antworte mit einer Zahl:\n'
                                + '1️⃣ Kleingewerbe Rechnungen\n'
                                + '2️⃣ Unternehmen Rechnung (mit MwSt)\n'
                                + '3️⃣ Privat Ausgaben'
                        });
                    }, 3000);
                }, 7000);
            }

            if (text === '2') {
                userState[from] = 'ar';
                await sock.sendMessage(from, {
                    text: '🇸🇦 DigiNetz Assistant هو بوت ذكي يساعدك بسرعة وسهولة، خطوة بخطوة، من خلال قوالب جاهزة '
                        + 'مثل إنشاء فاتورة أو متابعة مصاريفك – دون الحاجة لتسجيل دخول أو معرفة مسبقة. '
                        + 'جرّب الخدمة الآن مجانًا!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, { text: '💾 اضغط على اسم "DigiNetz" في الأعلى لحفظ البوت.' });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 الخطوة 3 – اختر نوع القالب:\n'
                                + 'يرجى الرد برقم:\n'
                                + '1️⃣ فاتورة مشروع صغير\n'
                                + '2️⃣ فاتورة شركة (مع ضريبة القيمة المضافة)\n'
                                + '3️⃣ المصاريف الخاصة'
                        });
                    }, 3000);
                }, 7000);
            }

            if (text === '3') {
                userState[from] = 'tr';
                await sock.sendMessage(from, {
                    text: '🇹🇷 DigiNetz Assistant, akıllı bir bottur. Sana hızlı ve kolay bir şekilde yardımcı olur. '
                        + 'Seni adım adım fatura oluşturma veya gider takibi gibi şablonlarla yönlendirir '
                        + '– kayıt gerekmeden ve ön bilgiye ihtiyaç duymadan. Hemen ücretsiz dene!'
                });
                setTimeout(async () => {
                    await sock.sendMessage(from, { text: '💾 Botu kaydetmek için "DigiNetz" adına dokun.' });
                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: '🟩 Adım 3 – Şablon türünü seç:\n'
                                + 'Lütfen bir numara ile cevap ver:\n'
                                + '1️⃣ Küçük işletme faturası\n'
                                + '2️⃣ Şirket faturası (KDV dahil)\n'
                                + '3️⃣ Özel harcamalar'
                        });
                    }, 3000);
                }, 7000);
            }
        }
    });
}

startBot();
setInterval(() => {}, 1000); // Railway am Leben halten
