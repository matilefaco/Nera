import admin from "firebase-admin";
import fetch from "node-fetch";

async function run() {
  const data = {
    professionalId: 'UvE1Cah1s5ccy7rV3Ld8r032x9D2',
    date: '2026-06-25',
    time: '16:00',
    clientName: 'Public Client',
    clientEmail: 'public@test.com',
    clientWhatsapp: '85988726662',
    serviceId: 'design_henna',
  };
  const res = await fetch("http://localhost:3000/api/public/create-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data) // Implicitly missing source, will be assigned "public" on backend
  });
  console.log("Public booking:", res.status, await res.text());
}
run().then(() => process.exit(0)).catch(console.error);
