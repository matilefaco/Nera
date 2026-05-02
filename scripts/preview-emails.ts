import fs from 'fs';
import path from 'path';

// Import templates
import { buildWelcomeEmail } from '../server/emails/templates/welcome';
import { buildProfessionalNewBookingEmail } from '../server/emails/templates/professionalNewBooking';
import { buildBookingConfirmedEmail } from '../server/emails/templates/bookingConfirmed';
import { buildBookingPendingEmail } from '../server/emails/templates/bookingPending';
import { buildBookingReminder24hEmail } from '../server/emails/templates/bookingReminder24h';
import { buildConfirmationRequest24hEmail } from '../server/emails/templates/confirmationRequest24h';
import { buildBookingRescheduledEmail } from '../server/emails/templates/bookingRescheduled';
import { buildBookingCancelledEmail } from '../server/emails/templates/bookingCancelled';
import { buildWaitlistInviteEmail } from '../server/emails/templates/waitlistInvite';
import { buildReviewRequestEmail } from '../server/emails/templates/reviewRequest';
import { buildRetentionEmail } from '../server/emails/templates/retention';
import { buildPasswordResetEmail } from '../server/emails/templates/passwordReset';

// Mock Data
const MOCK = {
  proName: "Helena Prado",
  clientName: "Mariana Costa",
  service: "Limpeza de Pele Profunda",
  date: "Segunda-feira, 28 de abril de 2026",
  time: "14:30",
  price: "R$ 250,00",
  location: "Estúdio em Jardins, São Paulo",
  url: "https://usenera.com/manage/abc123",
  waUrl: "https://wa.me/5511999999999"
};

const emails = [
  {
    name: 'Welcome',
    html: buildWelcomeEmail({
      name: MOCK.proName,
      slug: 'helena-prado',
      onboardingUrl: 'https://usenera.com/onboarding'
    })
  },
  {
    name: 'Professional New Booking',
    html: buildProfessionalNewBookingEmail({
      professionalName: MOCK.proName,
      clientName: MOCK.clientName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      price: MOCK.price,
      location: MOCK.location,
      agendaUrl: MOCK.url,
      clientWhatsapp: '(11) 99999-9999',
      whatsappUrl: MOCK.waUrl
    })
  },
  {
    name: 'Booking Confirmed (Client)',
    html: buildBookingConfirmedEmail({
      clientName: MOCK.clientName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      professionalName: MOCK.proName,
      location: MOCK.location,
      calendarUrl: MOCK.url + '/calendar',
      manageUrl: MOCK.url,
      whatsappUrl: MOCK.waUrl
    })
  },
  {
    name: 'Booking Pending (Client)',
    html: buildBookingPendingEmail({
      clientName: MOCK.clientName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      professionalName: MOCK.proName,
      price: MOCK.price,
      reservationCode: 'NERA-123',
      manageUrl: MOCK.url,
      whatsappUrl: MOCK.waUrl
    })
  },
  {
    name: 'Booking Reminder 24h',
    html: buildBookingReminder24hEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      location: MOCK.location,
      manageUrl: MOCK.url,
      whatsappUrl: MOCK.waUrl,
      duration: 60
    })
  },
  {
    name: 'Confirmation Request 24h',
    html: buildConfirmationRequest24hEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      confirmUrl: MOCK.url + '/confirm',
      rescheduleUrl: MOCK.url + '/reschedule',
      cancelUrl: MOCK.url + '/cancel'
    })
  },
  {
    name: 'Booking Rescheduled',
    html: buildBookingRescheduledEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      oldDate: 'Sexta-feira, 25 de abril',
      oldTime: '10:00',
      newDate: MOCK.date,
      newTime: MOCK.time,
      rescheduledBy: 'professional',
      manageUrl: MOCK.url,
    })
  },
  {
    name: 'Booking Cancelled (Pro)',
    html: buildBookingCancelledEmail({
      professionalName: MOCK.proName,
      clientName: MOCK.clientName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      time: MOCK.time,
      waitlistUrl: MOCK.url + '/waitlist',
      cancellationReason: 'Imprevisto de saúde',
      waitlistCount: 3,
      profileUrl: MOCK.url + '/profile'
    })
  },
  {
    name: 'Waitlist Invite',
    html: buildWaitlistInviteEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      servicePrice: MOCK.price,
      formattedDate: MOCK.date,
      time: MOCK.time,
      bookingUrl: MOCK.url,
      expiresInHours: 2,
      isExclusive: false
    })
  },
  {
    name: 'Review Request',
    html: buildReviewRequestEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      formattedDate: MOCK.date,
      reviewUrl: MOCK.url + '/review'
    })
  },
  {
    name: 'Retention (Loyalty)',
    html: buildRetentionEmail({
      clientName: MOCK.clientName,
      professionalName: MOCK.proName,
      serviceName: MOCK.service,
      lastServiceDate: '25 de março',
      daysSince: 30,
      bookingUrl: MOCK.url
    })
  },
  {
    name: 'Password Reset',
    html: buildPasswordResetEmail({
      resetUrl: MOCK.url + '/reset',
      expiresInMinutes: 60,
      requestedAt: '25 de abril às 14h32'
    })
  }
];

// Ensure directory exists
const outputDir = path.join(process.cwd(), 'scripts', 'email-previews');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write files
const fileList = emails.map(email => {
  const fileName = email.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html';
  fs.writeFileSync(path.join(outputDir, fileName), email.html);
  return { name: email.name, fileName };
});

console.log(`Generated ${emails.length} email previews in scripts/email-previews/`);

// Generate Index HTML
const indexHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nera - Email Previews</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; display: flex; height: 100vh; overflow: hidden; background: #fafafa; }
        #sidebar { width: 300px; border-right: 1px solid #ddd; background: #fff; overflow-y: auto; padding: 20px; flex-shrink: 0; }
        #main { flex-grow: 1; display: flex; flex-direction: column; }
        #toolbar { padding: 10px 20px; background: #fff; border-bottom: 1px solid #ddd; display: flex; align-items: center; justify-content: space-between; }
        #preview-container { flex-grow: 1; display: flex; justify-content: center; align-items: flex-start; padding: 40px; overflow-y: auto; }
        iframe { border: 1px solid #ddd; background: #fff; transition: width 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        h1 { font-size: 18px; margin-bottom: 20px; color: #18120E; }
        .email-link { display: block; padding: 10px 15px; text-decoration: none; color: #666; border-radius: 6px; margin-bottom: 5px; font-size: 14px; }
        .email-link:hover { background: #f5f5f5; color: #A85C3A; }
        .email-link.active { background: #18120E; color: #fff; }
        .btn-group { display: flex; background: #eee; border-radius: 6px; padding: 2px; }
        .btn { border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }
        .btn.active { background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div id="sidebar">
        <h1>Nera Emails</h1>
        ${fileList.map(f => `<a href="#" class="email-link" data-file="${f.fileName}">${f.name}</a>`).join('')}
    </div>
    <div id="main">
        <div id="toolbar">
            <div id="current-name">Selecione um email</div>
            <div class="btn-group">
                <button class="btn active" id="btn-desktop">Desktop (600px)</button>
                <button class="btn" id="btn-mobile">Mobile (375px)</button>
            </div>
        </div>
        <div id="preview-container">
            <iframe id="preview" src="" width="600" height="800"></iframe>
        </div>
    </div>

    <script>
        const preview = document.getElementById('preview');
        const links = document.querySelectorAll('.email-link');
        const currentName = document.getElementById('current-name');
        const btnDesktop = document.getElementById('btn-desktop');
        const btnMobile = document.getElementById('btn-mobile');

        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                preview.src = link.dataset.file;
                currentName.textContent = link.textContent;
            });
        });

        btnDesktop.addEventListener('click', () => {
            btnDesktop.classList.add('active');
            btnMobile.classList.remove('active');
            preview.style.width = '600px';
        });

        btnMobile.addEventListener('click', () => {
            btnMobile.classList.add('active');
            btnDesktop.classList.remove('active');
            preview.style.width = '375px';
        });

        // Load first email
        if (links.length > 0) links[0].click();
    </script>
</body>
</html>
`;

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);
console.log('Index generated: scripts/email-previews/index.html');
