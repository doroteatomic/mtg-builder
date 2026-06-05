const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

if (!admin.apps.length) {
  // On Render: secret file at /etc/secrets/firebase.json
  // Locally: service account JSON in project root
  const secretPath  = '/etc/secrets/firebase.json';
  const localPath   = path.join(__dirname, '..', 'mtg-builder-28a10-firebase-adminsdk-fbsvc-841d4d5fe0.json');
  const accountPath = fs.existsSync(secretPath) ? secretPath : localPath;

  admin.initializeApp({
    credential: admin.credential.cert(require(accountPath))
  });
}

const db   = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
