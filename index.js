require('dotenv').config();
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const axios = require('axios');

const ADMIN_NUMBER = '4915563691188@s.whatsapp.net';
let players = {};
let gameState = {};
let sock;

// 🟡 1. استخراج الملفات من Base64 إلى ملفات auth
if (process.env.CREDS_JSON) {
  const decoded = Buffer.from(process.env.CREDS_JSON, 'base64').toString('utf8');
  fs.mkdirSync('./auth_info_baileys', { recursive: true });
  fs.writeFileSync('./auth_info_baileys/creds.json', decoded);
}

if (process.env.KEYS_JSON) {
  const decoded = Buffer.from(process.env.KEYS_JSON, 'base64').toString('utf8');
  fs.mkdirSync('./auth_info_baileys', { recursive: true });
  fs.writeFileSync('./auth_info_baileys/keys.json', decoded);
}

// 🟡 2. أدوات
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function istFrage(text) {
  const lower = text.toLowerCase();
  return text.endsWith('?') ||
    lower.startsWith('ist') ||
    lower.startsWith('hat') ||
    lower.startsWith('lebt') ||
    lower.startsWith('gibt') ||
    lower.startsWith('kann') ||
    lower.startsWith('wer') ||
    lower.startsWith('was') ||
    lower.startsWith('wo') ||
    lower.startsWith('wann') ||
    lower.startsWith('wieviel') ||
    lower.includes('geheim');
}

// 🟡 3. GPT-Generierung
async function generiereGeheimnisMitGPT(thema) {
  try {
    const themaText = {
      '1': 'ein einfaches Rätsel.',
      '2': 'ein berühmter Spieler oder eine Mannschaft.',
      '3': 'ein Begriff aus der Straßenverkehr.',
      '4': 'eine bekannte Automarke.',
      '5': 'ein beliebtes Videospiel.',
    }[thema] || 'ein zufälliges Thema.';

    const prompt = `Denke dir ein Geheimnis aus, das ${themaText} ist. Gib nur das Geheimnis aus, ohne Erklärung.`;

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });

    const secret = response.data.choices[0].message.content.trim();
    return secret;
  } catch (err) {
    console.error('Fehler bei GPT:', err);
    return 'Ich konnte das Geheimnis nicht generieren.';
  }
}

// 🟡 4. Start Bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Verbindung getrennt. Erneut verbinden:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Verbunden mit WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    const from = msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (!body) return;

    console.log(`[Nachricht] ${from}: ${body}`);

    if (body.toLowerCase() === 'start') {
      await sock.sendMessage(from, { text: '👋 Willkommen beim DigiNetz Bot! Bitte wähle ein Thema:\n1️⃣ Rätsel\n2️⃣ Fußball\n3️⃣ Verkehr\n4️⃣ Auto\n5️⃣ Videospiel' });
      gameState[from] = { phase: 'thema_wählen' };
      return;
    }

    if (gameState[from]?.phase === 'thema_wählen' && ['1', '2', '3', '4', '5'].includes(body.trim())) {
      const thema = body.trim();
      const geheimnis = await generiereGeheimnisMitGPT(thema);
      gameState[from] = { phase: 'raten', geheimnis };
      await sock.sendMessage(from, { text: `🕵️ Ich habe ein Geheimnis gewählt. Stelle jetzt Ja/Nein-Fragen, um es zu erraten.` });
      return;
    }

    if (gameState[from]?.phase === 'raten') {
      if (istFrage(body)) {
        await sock.sendMessage(from, { text: '🤖 Gute Frage. Ich kann sie leider nicht beantworten. Rate lieber direkt das Geheimnis!' });
      } else if (body.toLowerCase().includes(gameState[from].geheimnis.toLowerCase())) {
        await sock.sendMessage(from, { text: `🎉 Richtig! Das Geheimnis war: *${gameState[from].geheimnis}*` });
        delete gameState[from];
      } else {
        await sock.sendMessage(from, { text: `❌ Falsch. Versuche es weiter oder tippe "start", um neu zu beginnen.` });
      }
    }
  });
}

startBot();
