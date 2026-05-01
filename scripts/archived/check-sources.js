const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
db.collection('dataSources').get().then(snap => {
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('Name:', d.name);
    console.log('Folder ID:', doc.id);
    console.log('Videos:', d.videoCount);
    console.log('Hours:', d.totalHours);
  });
  process.exit(0);
});
