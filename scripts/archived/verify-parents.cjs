const { google } = require('googleapis');
const fs = require('fs');

// Read credentials from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
let email = envFile.match(/GOOGLE_SERVICE_ACCOUNT_EMAIL=(.+)/)?.[1]?.trim();
email = email?.replace(/^["']|["']$/g, ''); // Strip quotes

// Try base64 first, then raw key
const base64Key = envFile.match(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64=(.+)/)?.[1]?.trim();
let key;
if (base64Key) {
  key = Buffer.from(base64Key, 'base64').toString('utf8');
} else {
  const rawMatch = envFile.match(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="([\s\S]*?)"\n/);
  if (rawMatch) {
    key = rawMatch[1].replace(/\\n/g, '\n');
  }
}

console.log('Service account email:', email);
console.log('Key found:', key ? 'Yes' : 'No');

async function checkParents() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  
  const drive = google.drive({ version: 'v3', auth });
  
  const folders = [
    { name: 'Contributors (Research)', id: '1t26VeRCKklGGh9vT5aTGaZ7OGezxekOH' },
    { name: 'Dustin', id: '1Pd1NINc9qAJcePUn_KvFa5AszJWeuupa' },
    { name: 'Bhritny', id: '1afid0QmCmAUKMr7PUDpnxFQnzC3EsJXs' },
    { name: 'Los Angeles Footage', id: '1EOzylQlQC4whx-IT7iGkzRnl1kf4Bpq0' },
  ];
  
  console.log('\n=== Checking folder parent relationships ===\n');
  
  for (const folder of folders) {
    try {
      const res = await drive.files.get({
        fileId: folder.id,
        fields: 'id, name, parents',
        supportsAllDrives: true,
      });
      
      console.log(folder.name + ':');
      console.log('  ID: ' + res.data.id);
      console.log('  Actual name in Drive: ' + res.data.name);
      console.log('  Parent folder ID(s): ' + (res.data.parents?.join(', ') || 'none'));
      console.log('');
    } catch (err) {
      console.log(folder.name + ': ERROR - ' + err.message + '\n');
    }
  }
  
  console.log('=== Analysis ===');
  console.log('If Dustin and Bhritny show parent ID = 1t26VeRCKklGGh9vT5aTGaZ7OGezxekOH');
  console.log('Then they ARE children of Contributors and are being double-counted.');
}

checkParents().catch(console.error);
