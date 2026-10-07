// Exclusively for the local demo emulators. Never initializes a production project.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const password = process.env.COMMERCIUM_TEST_PASSWORD;
if (!password || password.length < 12) throw new Error('Informe COMMERCIUM_TEST_PASSWORD com ao menos 12 caracteres.');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const app = initializeApp({ projectId: 'demo-commercium-functions' });
const db = getFirestore(app);
const auth = getAuth(app);
try {
  const company = db.doc('business/demo-restaurante');
  if (!(await company.get()).exists) throw new Error('Prepare a empresa local com npm run seed:emulator primeiro.');
  const uid = 'demo-admin';
  const email = 'admin@commercium.test';
  let existing;
  try { existing = await auth.getUser(uid); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  if (existing) throw new Error('O administrador de teste já existe. A senha não foi alterada.');
  await auth.createUser({ uid, email, password, displayName: 'Administrador de Teste' });
  await company.collection('users').doc(uid).set({ id: uid, nome: 'Administrador de Teste', email, acesso: 'administrador', perfilId: 'administrador' });
  console.log('Administrador de teste criado somente na empresa demo-restaurante dos emuladores locais.');
} finally { await db.terminate(); await deleteApp(app); }
