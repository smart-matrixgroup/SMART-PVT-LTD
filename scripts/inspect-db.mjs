import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
  try {
    await signInWithEmailAndPassword(auth, 'admin@smart.com', 'admin123');
    console.log('Signed in as admin@smart.com!');
  } catch (err) {
    console.log('Could not sign in with admin123:', err.message);
  }

  const staffSnap = await getDocs(collection(db, 'staff'));
  console.log('Staff count in Firestore:', staffSnap.docs.length);
  staffSnap.docs.forEach(d => {
    const data = d.data();
    console.log(` - ID: ${d.id} | Name: ${data.name} | StaffId: ${data.staffId} | Role: ${data.role || data.position}`);
  });

  const attSnap = await getDocs(collection(db, 'attendance'));
  console.log('Attendance records count in Firestore:', attSnap.docs.length);
  const byStaff = {};
  attSnap.docs.forEach(d => {
    const data = d.data();
    const sName = data.staffName || data.staffId;
    if (!byStaff[sName]) byStaff[sName] = [];
    byStaff[sName].push(data.date);
  });
  
  for (const [sName, dates] of Object.entries(byStaff)) {
    dates.sort();
    console.log(` Staff: ${sName} | Records: ${dates.length} | Range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
