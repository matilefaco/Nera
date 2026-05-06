const fs = require('fs');

let c = fs.readFileSync('src/pages/ManageBookingPage.tsx', 'utf-8');
c = c.replace(/await cancelBookingByClient\(appointment.id, reason\);/, "await cancelBookingByClient(token || appointment.manageSlug || appointment.token, reason);");
fs.writeFileSync('src/pages/ManageBookingPage.tsx', c);

let f = fs.readFileSync('src/firebase.ts', 'utf-8');
// Fix src/firebase.ts
f = f.replace(/export async function cancelBookingByClient\(appointmentId: string, reason\?: string\) \{[\s\S]*?notify\('BOOKING_CANCELLED_BY_CLIENT', \{[\s\S]*?\}\);[\s\S]*?\}\n\}/, 
`export async function cancelBookingByClient(manageSlug: string, reason?: string) {
  console.log(\`[Client] Cancelling booking via slug \${manageSlug}\`);
  const response = await fetch(\`/api/public/manage/\${manageSlug}/cancel\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao cancelar o agendamento.');
  }

  const result = await response.json();
  const data = result.appointmentData;

  if (data) {
    // Notify pro about cancellation
    console.log(\`[Client Cancel] Triggering notification format \${data.id}\`);
    notify('BOOKING_CANCELLED_BY_CLIENT', { 
      appointmentId: data.id, 
      id: data.id, 
      ...data 
    }).catch(err => console.error(err));

    triggerWaitlistCheck(data.professionalId, data.date, data.time);
  }
}`);
fs.writeFileSync('src/firebase.ts', f);

// Now we need to modify the backend route `/public/manage/:manageSlug/cancel` to return appointmentData.
let b = fs.readFileSync('server/routes/bookingRoutes.ts', 'utf-8');
b = b.replace(/return \{ success: true, appointmentId \};/, `return { success: true, appointmentId, appointmentData: updatedData };`);
fs.writeFileSync('server/routes/bookingRoutes.ts', b);

console.log('Update fix done');
