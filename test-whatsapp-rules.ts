import { config } from "dotenv";
config();
import { initializeApp } from "firebase-admin/app";
try { initializeApp(); } catch (e) {}

import { getDb } from "./server/firebaseAdmin.js";
import { sendWhatsApp } from "./server/services/whatsappService.js";
import admin from "firebase-admin";

async function run() {
  const db = getDb();
  
  const mockProBase = {
    whatsappNotifications: true,
  };

  const results: any[] = [];

  const testCases = [
    { name: 'Cenario 1 (Profissional Free) - Novo Pedido (professional_new_booking)', type: 'professional_new_booking', plan: 'free', expected: 'requires_pro_plan' },
    { name: 'Cenario 2 (Profissional Free) - Aprova Pedido (booking_confirmed_client)', type: 'booking_confirmed_client', plan: 'free', expected: 'success' },
    { name: 'Cenario 3 (Profissional Essencial) - Novo Pedido (professional_new_booking)', type: 'professional_new_booking', plan: 'essencial', expected: 'requires_pro_plan' },
    { name: 'Cenario 4 (Profissional Essencial) - Aprova Pedido (booking_confirmed_client)', type: 'booking_confirmed_client', plan: 'essencial', expected: 'success' },
    { name: 'Cenario 5 (Profissional Pro) - Novo Pedido (professional_new_booking)', type: 'professional_new_booking', plan: 'pro', expected: 'success' },
    { name: 'Cenario 6 (Profissional Pro) - Aprova Pedido (booking_confirmed_client)', type: 'booking_confirmed_client', plan: 'pro', expected: 'success' },
    { name: 'Cenario 7 (Cliente) - Review (review_request)', type: 'review_request', plan: 'pro', expected: 'blocked_by_policy_review_email_only' },
  ];

  for (const tc of testCases) {
    const userId = `test_pro_${tc.plan}`;
    await db.collection("users").doc(userId).set({ ...mockProBase, plan: tc.plan });
    
    // We mock fetch so we don't really send a message
    global.fetch = async () => ({ ok: true, json: async () => ({}) }) as any;
    
    // Mock the environment
    process.env.ZAPI_INSTANCE_ID = "mock_id";
    process.env.ZAPI_INSTANCE_TOKEN = "mock_token";

    const res = await sendWhatsApp(db, "5511999999999", "Test", {
      userId,
      type: tc.type,
      clientName: "Test",
    });

    // determine actual
    let actual = 'unknown';
    if (res.skipped) actual = res.skipped;
    else if (res.success) actual = 'success';
    else if (res.error) actual = res.error;

    results.push({
      scenario: tc.name,
      plan: tc.plan,
      type: tc.type,
      expected: tc.expected,
      actual: actual,
      pass: actual === tc.expected
    });
  }

  console.table(results);
  process.exit(0);
}

run().catch(console.error);
