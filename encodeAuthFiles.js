const fs = require('fs');

function encodeFileToBase64(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    return Buffer.from(data).toString('base64');
}

const credsBase64 = encodeFileToBase64('creds.json');
const keysBase64 = encodeFileToBase64('keys.json');

console.log('=== BASE64 CREDS ===');
console.log(credsBase64);
console.log('\n=== BASE64 KEYS ===');
console.log(keysBase64);