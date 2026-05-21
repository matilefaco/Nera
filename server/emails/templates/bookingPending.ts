
import { COLORS, FONTS, buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';

interface BookingPendingData {
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price: string;
  reservationCode: string;
  manageUrl: string;
  whatsappUrl: string;
  clientName: string;
  paymentMethods?: string[];
}

export function buildBookingPendingEmail(data: BookingPendingData): string {
  const {
    professionalName,
    serviceName,
    formattedDate,
    time,
    price,
    reservationCode,
    manageUrl,
    whatsappUrl,
    clientName
  } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 25px; font-weight: 500;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 35px; line-height: 1.7;">
      Seu pedido de agendamento com <strong>${professionalName}</strong> foi enviado. Você receberá uma confirmação quando o seu horário for garantido.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Valor', value: price },
      { label: 'Sua Reserva', value: reservationCode || '-' }
    ])}

    <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid ${COLORS.mist}; text-align: center;">
      <a href="${whatsappUrl}" style="color: ${COLORS.stone}; font-family: ${FONTS.sans}; font-size: 13px; text-decoration: underline;">
        Dúvidas? Fale com a profissional no WhatsApp.
      </a>
      <p style="font-family: ${FONTS.sans}; font-size: 11px; color: ${COLORS.stone}; margin-top: 15px; line-height: 1.6;">
        Você pode alterar seu agendamento a qualquer momento pelo painel.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Sua solicitação',
    heroVariant: 'parchment',
    heroLabel: 'Solicitação Enviada',
    heroTitle: 'Seu pedido',
    heroTitleItalic: 'foi recebido',
    bodyHtml,
    ctaText: 'Acompanhar Reserva',
    ctaUrl: manageUrl
  });
}

