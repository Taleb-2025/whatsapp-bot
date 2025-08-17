const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');

async function convertAuthToJson() {
    const { state } = await useMultiFileAuthState('./auth_info_diginetz');

    const creds = JSON.stringify(state.creds, null, 2);
    const keys = JSON.stringify(state.keys, null, 2);

    fs.writeFileSync('creds.json', creds);
    fs.writeFileSync('keys.json', keys);

    console.log('✅ Die Dateien creds.json und keys.json wurden erfolgreich erstellt!');
}

convertAuthToJson();