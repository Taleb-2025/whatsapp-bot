// encodeAuthFiles.js

const fs = require('fs');

// 🛑 تأكد أن الملفات موجودة في نفس المسار
const credsPath = './auth_info_baileys/creds.json';
const keysPath = './auth_info_baileys/keys.json';

// ✅ قراءة وتحويل creds.json
const creds = fs.readFileSync(credsPath, 'utf8');
const credsBase64 = Buffer.from(creds).toString('base64');
console.log('\n=== BASE64 CREDS ===\n');
console.log(credsBase64);

// ✅ قراءة وتحويل keys.json
const keys = fs.readFileSync(keysPath, 'utf8');
const keysBase64 = Buffer.from(keys).toString('base64');
console.log('\n=== BASE64 KEYS ===\n');
console.log(keysBase64);
