import admin from "firebase-admin";
import fetch from "node-fetch";

async function run() {
  const uid = 'UvE1Cah1s5ccy7rV3Ld8r032x9D2';
  const customToken = await admin.auth().createCustomToken(uid);
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  
  const identityRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const idToken = (await identityRes.json()).idToken;

  const data1 = { professionalId: uid, date: "2026-06-25", time: "14:00", clientName: 'Manual 1', serviceId: 'design_henna', duration: 60, price: 45, locationType: 'studio', source: 'manual' };
  const res1 = await fetch("http://localhost:3000/api/manual", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` }, body: JSON.stringify(data1) });
  console.log("Manual 1:", res1.status, await res1.text());

  const data2 = { professionalId: uid, date: "2026-06-25", time: "15:00", clientName: 'Manual 2', serviceId: 'design_henna', duration: 60, price: 45, locationType: 'studio', source: 'manual' };
  const res2 = await fetch("http://localhost:3000/api/manual", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` }, body: JSON.stringify(data2) });
  console.log("Manual 2:", res2.status, await res2.text());
}
run().then(() => process.exit(0)).catch(console.error);
