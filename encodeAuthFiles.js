const fs = require('fs');
const path = require('path');

const credsPath = path.join(__dirname, 'auth_info_baileys', 'creds.json');
const keysPath = path.join(__dirname, 'auth_info_baileys', 'keys.json');

const encodeFile = (filePath) => {
  const content = fs.readFileSync(filePath);
  return Buffer.from(content).toString('base64');
};

const credsBase64 = encodeFile(credsPath);
const keysBase64 = encodeFile(keysPath);

console.log('\n----- CREDS_JSON -----\n');
console.log(credsBase64);

console.log('\n----- KEYS_JSON -----\n');
console.log(keysBase64);
