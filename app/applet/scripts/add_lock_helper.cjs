const fs = require('fs');
let c = fs.readFileSync('server/routes/bookingRoutes.ts', 'utf-8');

if (!c.includes('function getBookingLockId')) {
  const helper = `
function getBookingLockId(appointment: any): string | null {
  const dateAttr = appointment.date || appointment.appointmentDate || appointment.selectedDate || appointment.scheduledDate;
  const timeAttr = appointment.time || appointment.appointmentTime || appointment.selectedTime || appointment.startTime;
  if (!appointment?.professionalId || !dateAttr || !timeAttr) return null;
  const cleanTime = String(timeAttr).replace(':', '');
  return \`\${appointment.professionalId}_\${dateAttr}_\${cleanTime}\`;
}
`;

  c = c.replace('const sanitizeAppointment', helper + '\nconst sanitizeAppointment');
  fs.writeFileSync('server/routes/bookingRoutes.ts', c);
  console.log('Added getBookingLockId helper');
} else {
  console.log('getBookingLockId already exists');
}
