import fetch from 'node-fetch';

async function run() {
  const payload = {
    type: 'BOOKING_RESCHEDULED',
    payload: {
      professionalId: 'test_pro',
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      clientWhatsapp: '5511999999999',
      previousDate: '2024-07-01',
      previousTime: '10:00',
      date: '2024-07-02',
      time: '11:00',
      appointmentId: 'test_appt',
      serviceName: 'Test Service',
      rescheduledBy: 'professional'
    }
  };
  const res = await fetch('http://localhost:3000/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
run();
