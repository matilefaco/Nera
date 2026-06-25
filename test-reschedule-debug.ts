import { getAuth } from 'firebase-admin/auth';
import { db as dbAdmin, initFirebase } from './server/firebaseAdmin';

async function run() {
  await initFirebase();
  const uid = 'Mu9ACLqCV9PSDMCkBQzQGF3Q0RV2';
  
  try {
    const customToken = await getAuth().createCustomToken(uid);
    console.log("Got custom token:", customToken.substring(0, 20) + "...");
    
    // Exchange for ID token
    const apiKey = "AIzaSyDO2OcFecgXEfATajxcY0piPP8VfCoQGWU";
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const data = await res.json();
    const idToken = data.idToken;
    console.log("Got ID token:", idToken ? "yes" : "no");
    
    // Now simulate the transaction using REST API?
    // Actually, it's easier to just use the Firebase JS SDK in Node!
  } catch (e) {
    console.error(e);
  }
}
run().catch(console.error);
