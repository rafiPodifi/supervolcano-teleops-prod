const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'super-volcano-oem-portal'
});

admin.firestore().collection('dataSources').get().then(snap => {
  console.log('DATA SOURCES:\n');
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`Name: ${d.name}`);
    console.log(`Folder ID: ${doc.id}`);
    console.log(`Videos: ${d.videoCount}`);
    console.log('---');
  });
  process.exit(0);
});
