const admin = require('firebase-admin');
const fs = require('fs');

// Read Firebase credentials from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
let email = envFile.match(/GOOGLE_SERVICE_ACCOUNT_EMAIL=(.+)/)?.[1]?.trim();
email = email?.replace(/^["']|["']$/g, '');

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

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'super-volcano-oem-portal',
    clientEmail: email,
    privateKey: key,
  }),
});

const db = admin.firestore();

async function cleanup() {
  const duplicates = [
    { id: '1Pd1NINc9qAJcePUn_KvFa5AszJWeuupa', name: 'Dustin' },
    { id: '1afid0QmCmAUKMr7PUDpnxFQnzC3EsJXs', name: 'Bhritny' },
  ];
  
  console.log('=== Deleting duplicate data sources ===\n');
  
  for (const dup of duplicates) {
    try {
      await db.collection('dataSources').doc(dup.id).delete();
      console.log('Deleted: ' + dup.name + ' (' + dup.id + ')');
    } catch (err) {
      console.log('Error deleting ' + dup.name + ': ' + err.message);
    }
  }
  
  console.log('\nDone! Refresh your dashboard to see updated totals.');
  process.exit(0);
}

cleanup();
