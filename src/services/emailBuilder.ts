
/**
 * Nera Email Builder
 * Centralizes the premium visual identity for all transactional emails.
 */

interface EmailBaseOptions {
  topbarText: string;
  heroVariant: 'ink' | 'terracotta' | 'parchment';
  heroLabel: string;
  heroTitle: string;
  heroTitleItalic?: string;
  badgeText?: string;
  badgeVariant?: 'pending' | 'success' | 'alert' | 'info';
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerLinksHtml?: string;
}

export const COLORS = {
  ink: '#18120E',
  terracotta: '#A85C3A',
  parchment: '#F9F5F0',
  linen: '#F2EBE3',
  stone: '#8A7060',
  mist: '#E5DDD6',
  white: '#FDFAF7',
};

export const FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, sans-serif',
};

export function buildEmailBase(options: EmailBaseOptions): string {
  const {
    topbarText,
    heroVariant,
    heroLabel,
    heroTitle,
    heroTitleItalic,
    badgeText,
    badgeVariant = 'info',
    bodyHtml,
    ctaText,
    ctaUrl,
    footerLinksHtml,
  } = options;

  const heroBg = COLORS[heroVariant];
  const heroText = heroVariant === 'parchment' ? COLORS.ink : COLORS.white;
  const heroLabelColor = heroVariant === 'parchment' ? COLORS.terracotta : COLORS.linen;

  // Badge styles
  const badgeColors = {
    pending: { bg: '#FDF2F2', text: '#9B1C1C', border: '#FBD5D5' },
    success: { bg: '#F3FAF7', text: '#03543F', border: '#DEF7EC' },
    alert: { bg: '#FFF8F1', text: '#8A4B00', border: '#FFECCF' },
    info: { bg: COLORS.linen, text: COLORS.ink, border: COLORS.mist },
  };
  const badgeStyle = badgeColors[badgeVariant];

  return `
    <!DOCTYPE html>
    <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="x-apple-disable-message-reformatting">
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <title>Nera</title>
      <style>
        html, body { margin: 0 auto !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
        * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
        div[style*="margin: 16px 0"] { margin: 0 !important; }
        table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
        table { border-spacing: 0 !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 0 auto !important; }
        img { -ms-interpolation-mode:bicubic; }
        a { text-decoration: none; }
        *[x-apple-data-detectors], .x-gmail-data-detectors, .x-gmail-data-detectors *, .aBn { border-bottom: 0 !important; cursor: default !important; color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
      </style>
    </head>
    <body style="margin: 0; padding: 0 !important; background-color: ${COLORS.linen}; mso-line-height-rule: exactly;">
      <center style="width: 100%; background-color: ${COLORS.linen};">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.linen};">
          <tr>
            <td align="center" style="padding: 20px 0;">
              
              <!--[if mso]>
              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
              <tr>
              <td align="center" valign="top" width="600">
              <![endif]-->
              
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; max-width: 600px; background-color: ${COLORS.white}; border: 1px solid ${COLORS.mist};">
                
                <!-- Topbar -->
                <tr>
                  <td bgcolor="${COLORS.ink}" style="padding: 12px 40px; text-align: right;">
                    <font style="color: ${COLORS.linen}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; font-family: ${FONTS.sans};">
                      ${topbarText}
                    </font>
                  </td>
                </tr>

                <!-- Stripe -->
                <tr>
                  <td height="4" bgcolor="${COLORS.terracotta}" style="line-height: 4px; font-size: 4px;">&nbsp;</td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td bgcolor="${heroBg}" style="padding: 60px 40px; text-align: left;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <font style="color: ${heroLabelColor}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.35em; font-family: ${FONTS.sans};">
                            ${heroLabel}
                          </font>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <h1 style="color: ${heroText}; font-family: ${FONTS.serif}; font-size: 38px; line-height: 1.2; margin: 0; font-weight: normal;">
                            ${heroTitle}
                            ${heroTitleItalic ? `<br><span style="font-style: italic; color: ${heroText}; opacity: 0.85;">${heroTitleItalic}</span>` : ''}
                          </h1>
                        </td>
                      </tr>
                      ${badgeText ? `
                      <tr>
                        <td style="padding-top: 30px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" bgcolor="${badgeStyle.bg}" style="border: 1px solid ${badgeStyle.border}; padding: 6px 16px;">
                                <font style="color: ${badgeStyle.text}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; font-family: ${FONTS.sans};">
                                  ${badgeText}
                                </font>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 50px 40px; background-color: ${COLORS.white};">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.6; color: ${COLORS.ink};">
                          ${bodyHtml}
                        </td>
                      </tr>
                      
                      ${ctaUrl && ctaText ? `
                      <tr>
                        <td align="center" style="padding-top: 45px;">
                          <!-- Bulletproof Button -->
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                                <a href="${ctaUrl}" target="_blank" style="font-size: 11px; font-family: ${FONTS.sans}; color: ${COLORS.white}; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; display: inline-block;">
                                  ${ctaText}
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 50px 40px; text-align: center; border-top: 1px solid ${COLORS.mist}; background-color: ${COLORS.white};">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding-bottom: 25px;">
                          <font style="font-family: ${FONTS.serif}; font-size: 24px; color: ${COLORS.ink}; letter-spacing: 0.2em;">NERA</font>
                        </td>
                      </tr>
                      
                      ${footerLinksHtml ? `
                      <tr>
                        <td align="center" style="padding-bottom: 25px; font-size: 12px; font-family: ${FONTS.sans}; color: ${COLORS.stone};">
                          ${footerLinksHtml}
                        </td>
                      </tr>
                      ` : ''}

                      <tr>
                        <td align="center">
                          <p style="margin: 0; color: ${COLORS.stone}; font-size: 11px; font-family: ${FONTS.sans}; line-height: 1.5;">
                            NERA &copy; 2026 &bull; Agendamento Premium.<br>
                            Este é um comunicado automático do sistema Nera.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>

              <!--[if mso]>
              </td>
              </tr>
              </table>
              <![endif]-->

            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
  `;
}

export function buildEmailCard(items: { label: string; value: string }[]): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLORS.parchment}" style="border: 1px solid ${COLORS.mist}; margin: 30px 0;">
      <tr>
        <td style="padding: 30px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            ${items.map((item, index) => `
              <tr>
                <td style="padding-bottom: ${index === items.length - 1 ? '0' : '20px'};">
                  <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.stone}; margin-bottom: 4px; font-family: ${FONTS.sans};">${item.label}</font>
                  <font style="display: block; font-size: 16px; color: ${COLORS.ink}; font-family: ${FONTS.serif}; line-height: 1.3;">${item.value}</font>
                </td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    </table>
  `;
}
