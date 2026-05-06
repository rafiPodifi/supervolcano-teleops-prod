const admin = require('firebase-admin');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let email = envFile.match(/GOOGLE_SERVICE_ACCOUNT_EMAIL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const base64Key = envFile.match(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64=(.+)/)?.[1]?.trim();
let key = base64Key ? Buffer.from(base64Key, 'base64').toString('utf8') : null;
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: 'super-volcano-oem-portal', clientEmail: email, privateKey: key }) });
}
const db = admin.firestore();
db.collection('deliveries').get().then(snap => {
  let totalVideos = 0, totalHours = 0, totalGB = 0;
  snap.docs.forEach(doc => {
    const d = doc.data();
    const hours = d.hours !== null && d.hours !== undefined ? d.hours : (d.sizeGB || 0) / 15;
    totalVideos += d.videoCount || 0;
    totalHours += hours;
    totalGB += d.sizeGB || 0;
    console.log(doc.id.substring(0,8), '|', d.videoCount, 'videos |', d.hours, 'hrs (stored) |', hours.toFixed(2), 'hrs (used) |', d.sizeGB, 'GB');
  });
  console.log('---');
  console.log('TOTAL:', totalVideos, 'videos |', totalHours.toFixed(2), 'hrs |', totalGB.toFixed(2), 'GB');
  process.exit(0);
});
