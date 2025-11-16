 const nodemailer = require('nodemailer');
const https = require('https');
require('dotenv').config();

// Configuration du transporteur d'emails
console.log('Configuration SMTP:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  user: process.env.EMAIL_USER
});

// Déterminer si nous sommes en environnement de développement
const isDevelopment = process.env.NODE_ENV !== 'production';

// URL de base pour les liens dans les emails
const baseUrl = isDevelopment ? 'http://localhost:3001' : (process.env.WEBSITE_URL || 'https://carpartsfrance.fr');
console.log('URL de base pour les emails:', baseUrl);

// Transport SMTP (préférence aux variables d'environnement)
const defaultPort = (process.env.NODE_ENV === 'production') ? 587 : 465;
const defaultSecure = (process.env.NODE_ENV === 'production') ? false : true;
const transportOptions = {
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: Number(process.env.EMAIL_PORT || defaultPort),
  secure: (process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : defaultSecure),
  auth: {
    user: process.env.EMAIL_USER || 'sav@carpartsfrance.fr',
    pass: process.env.EMAIL_PASS || ''
  },
  requireTLS: (process.env.EMAIL_REQUIRE_TLS ? process.env.EMAIL_REQUIRE_TLS === 'true' : ((process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : defaultSecure) ? false : true)),
  connectionTimeout: Number(process.env.EMAIL_CONN_TIMEOUT_MS || 10000),
  greetingTimeout: Number(process.env.EMAIL_GREET_TIMEOUT_MS || 10000),
  socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 15000),
  pool: false,
  tls: { minVersion: 'TLSv1.2' },
  debug: isDevelopment
};

/**
 * Envoie un email demandant au client s'il est satisfait (Oui/Non)
 * Oui => lien Trustpilot ; Non => lien interne feedback
 * @param {Object} p
 * @param {string} p.toEmail
 * @param {string} p.yesLink
 * @param {string} p.noLink
 */
const sendReviewInviteEmail = async ({ toEmail, yesLink, noLink }) => {
  const to = String(toEmail || '').trim();
  if (!to || !yesLink || !noLink) return null;
  // Extraire le token depuis yesLink/noLink afin de générer les liens de notation 1..5
  const extractToken = (link) => {
    try {
      const u = new URL(link, baseUrl);
      const parts = (u.pathname || '').split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch (_) { return ''; }
  };
  const token = extractToken(yesLink) || extractToken(noLink);
  const rateLink = (n) => token ? `${baseUrl}/r/rate/${token}/${n}` : '#';
  const subject = 'Votre avis compte – recevez 40 € de bon d\'achat';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background:#f5f6f8; padding:24px 0;">
      <!-- Preheader -->
      <div style="display:none; max-height:0; overflow:hidden; color:transparent; opacity:0;">Votre avis nous aide à améliorer nos services.</div>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table role="presentation" width="640" border="0" cellspacing="0" cellpadding="0" style="width:640px; max-width:100%; background:#ffffff; border:1px solid #e6e7eb; border-radius:14px; box-shadow:0 12px 28px rgba(34,34,34,0.06);">
              <!-- Brand header -->
              <tr>
                <td style="padding:18px 20px; border-bottom:1px solid #eef0f2;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        <img src="${baseUrl}/logo.png" alt="Car Parts France" width="120" style="display:block; height:auto; border:0; outline:none; text-decoration:none;">
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <span style="display:inline-block; padding:6px 10px; border:1px solid #e6e7eb; border-radius:999px; color:#1f2937; font-weight:600; font-size:12px;">Demande d'avis</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Title / Intro -->
              <tr>
                <td style="padding:26px 24px 10px 24px;">
                  <h1 style="margin:0; font-size:20px; line-height:1.4; color:#111827;">Nous avons besoin de votre avis</h1>
                  <p style="margin:8px 0 0; color:#4b5563; font-size:14px; line-height:1.6;">
                    Bonjour,<br>
                    Vous avez commandé chez nous une pièce automobile récemment.<br>
                    Votre satisfaction est essentielle pour nous. En quelques secondes, dites-nous simplement si tout s’est bien passé ou si quelque chose mérite notre attention.
                  </p>
                </td>
              </tr>
              <!-- Notation par étoiles -->
              <tr>
                <td align="center" style="padding:18px 24px 6px 24px;">
                  <div style="color:#111827; font-size:16px; font-weight:700; margin-bottom:4px;">Notez votre expérience (1 à 5)</div>
                  <div style="color:#6b7280; font-size:12px; margin-bottom:12px;">Cliquez sur une étoile pour sélectionner votre note</div>
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:auto;">
                    <tr>
                      <td style="padding:0 6px 12px 6px;">
                        <a href="${rateLink(1)}" aria-label="1 étoile (très insatisfait)" style="display:inline-block; width:48px; height:48px; line-height:48px; text-align:center; font-size:26px; background:#fff7ed; border:1px solid #fde68a; border-radius:999px; color:#d97706; text-decoration:none;">★</a>
                        <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:4px;">1</div>
                      </td>
                      <td style="padding:0 6px 12px 6px;">
                        <a href="${rateLink(2)}" aria-label="2 étoiles" style="display:inline-block; width:48px; height:48px; line-height:48px; text-align:center; font-size:26px; background:#fff7ed; border:1px solid #fde68a; border-radius:999px; color:#d97706; text-decoration:none;">★</a>
                        <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:4px;">2</div>
                      </td>
                      <td style="padding:0 6px 12px 6px;">
                        <a href="${rateLink(3)}" aria-label="3 étoiles" style="display:inline-block; width:48px; height:48px; line-height:48px; text-align:center; font-size:26px; background:#fff7ed; border:1px solid #fde68a; border-radius:999px; color:#d97706; text-decoration:none;">★</a>
                        <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:4px;">3</div>
                      </td>
                      <td style="padding:0 6px 12px 6px;">
                        <a href="${rateLink(4)}" aria-label="4 étoiles" style="display:inline-block; width:48px; height:48px; line-height:48px; text-align:center; font-size:26px; background:#fff7ed; border:1px solid #fde68a; border-radius:999px; color:#d97706; text-decoration:none;">★</a>
                        <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:4px;">4</div>
                      </td>
                      <td style="padding:0 6px 12px 6px;">
                        <a href="${rateLink(5)}" aria-label="5 étoiles (très satisfait)" style="display:inline-block; width:48px; height:48px; line-height:48px; text-align:center; font-size:26px; background:#fff7ed; border:1px solid #fde68a; border-radius:999px; color:#d97706; text-decoration:none;">★</a>
                        <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:4px;">5</div>
                      </td>
                    </tr>
                  </table>
                  <div style="color:#6b7280; font-size:12px; margin-top:6px;">1 = Très insatisfait • 5 = Très satisfait</div>
                </td>
              </tr>

              <!-- Info text (neutre) -->
              <tr>
                <td style="padding:4px 24px 20px 24px;">
                  <p style="margin:0; color:#6b7280; font-size:12px; line-height:1.6;">Merci d’avance pour votre retour.</p>
                </td>
              </tr>

              <!-- Incentive neutre: bon d'achat -->
              <tr>
                <td style="padding:0 24px 20px 24px;">
                  <div style="margin-top:6px; padding:12px 14px; border:1px dashed #e5e7eb; border-radius:12px; background:#fff5f5;">
                    <strong style="display:block; color:#e30613; font-size:14px; margin-bottom:4px;">Bon d’achat de 40€</strong>
                    <p style="margin:0; color:#4b5563; font-size:12px; line-height:1.6;">Après avoir laissé votre retour, vous recevrez un bon d’achat de 40€ à utiliser sur votre prochaine commande. Cette offre s’applique à tout retour, qu’il soit positif ou négatif.</p>
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
  const textContent = `Vous avez commandé chez nous une pièce automobile récemment.\nNous avons besoin de votre avis.\n\nNotez votre expérience :\n1 étoile : ${rateLink(1)}\n2 étoiles : ${rateLink(2)}\n3 étoiles : ${rateLink(3)}\n4 étoiles : ${rateLink(4)}\n5 étoiles : ${rateLink(5)}\n\nBonus: 40€ de bon d'achat après votre retour (positif ou négatif), à utiliser sur votre prochaine commande.`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'sav@carpartsfrance.fr',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'sav@carpartsfrance.fr'
  };
  try {
    const info = await safeSendMail(mailOptions);
    try {
      const transportType = process.env.MAILERSEND_API_KEY ? 'mailerSend-or-smtp-fallback' : 'smtp';
      const accepted = info && (info.accepted || info.response || info.messageId);
      const rejected = info && info.rejected;
      console.log('[emailService] sendReviewInviteEmail delivered', {
        to,
        from: mailOptions.from,
        transport: transportType,
        accepted,
        rejected
      });
    } catch(_) {}
    return info;
  } catch (e) {
    console.error('[emailService] sendReviewInviteEmail error:', e);
    return null;
  }
};

/**
 * Notifie l'utilisateur assigné qu'un ticket lui a été attribué
 * @param {Object} ticket - Le ticket complet
 * @param {Object} assignedUser - L'utilisateur assigné (email requis)
 */
const sendAssignmentEmail = async (ticket, assignedUser) => {
  const to = (assignedUser && assignedUser.email) ? String(assignedUser.email).trim() : '';
  if (!to) return null;
  const subject = `Nouveau ticket assigné: ${ticket.ticketNumber}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #003366; color: white; padding: 16px; text-align: center;">
        <h2>Assignation d'un ticket</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p>Bonjour ${assignedUser.firstName || ''} ${assignedUser.lastName || ''},</p>
        <p>Le ticket <strong>${ticket.ticketNumber}</strong> vous a été assigné.</p>
        <ul>
          <li>Client: ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName} (${ticket.clientInfo.email})</li>
          <li>Type: ${ticket.claimType}</li>
          <li>Statut: ${ticket.currentStatus}</li>
          <li>Priorité: ${ticket.priority}</li>
        </ul>
        <p>Merci de le prendre en charge dès que possible.</p>
      </div>
    </div>
  `;
  const textContent = `Ticket ${ticket.ticketNumber} assigné. Client: ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}.`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'contact@carpartsfrance.fr',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') }
  };
  try { return await safeSendMail(mailOptions); } catch (e) { console.error('[emailService] sendAssignmentEmail error:', e); return null; }
};

/**
 * Notifie l'équipe qu'une assistance est demandée par un agent
 * @param {Object} ticket - Le ticket
 * @param {Object} byUser - L'utilisateur demandeur
 * @param {String} message - Détail de la demande
 */
const sendAssistanceRequestEmail = async (ticket, byUser, message = '') => {
  const to = (process.env.SUPPORT_TEAM_EMAIL || process.env.EMAIL_USER || 'sav@carpartsfrance.fr');
  const subject = `Demande d'assistance - Ticket ${ticket.ticketNumber}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #8a2be2; color: white; padding: 16px; text-align: center;">
        <h2>Demande d'assistance</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p><strong>Ticket:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Demandée par:</strong> ${(byUser && (byUser.email || byUser.firstName)) ? (byUser.email || (byUser.firstName + ' ' + (byUser.lastName || ''))) : 'Utilisateur inconnu'}</p>
        <p><strong>Message:</strong><br>${(String(message || '')).replace(/\n/g, '<br/>')}</p>
      </div>
    </div>
  `;
  const textContent = `Demande d'assistance sur ${ticket.ticketNumber} par ${(byUser && byUser.email) || 'inconnu'}\n${message || ''}`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'sav@carpartsfrance.fr',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'sav@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') }
  };
  try { return await safeSendMail(mailOptions); } catch (e) { console.error('[emailService] sendAssistanceRequestEmail error:', e); return null; }
};

/**
 * Notifie l'équipe d'une escalade de ticket
 * @param {Object} ticket - Le ticket
 * @param {String} reason - Raison de l'escalade
 * @param {Object} byUser - Utilisateur qui escalade (admin)
 */
const sendEscalationEmail = async (ticket, reason = '', byUser) => {
  const to = (process.env.SUPPORT_TEAM_EMAIL || process.env.EMAIL_USER || 'sav@carpartsfrance.fr');
  const subject = `Escalade - Ticket ${ticket.ticketNumber}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #b91c1c; color: white; padding: 16px; text-align: center;">
        <h2>Escalade de ticket</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p><strong>Ticket:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Par:</strong> ${(byUser && (byUser.email || byUser.firstName)) ? (byUser.email || (byUser.firstName + ' ' + (byUser.lastName || ''))) : 'Administrateur'}</p>
        <p><strong>Raison:</strong><br>${(String(reason || '')).replace(/\n/g, '<br/>')}</p>
      </div>
    </div>
  `;
  const textContent = `Escalade du ticket ${ticket.ticketNumber}. Raison: ${reason || ''}`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'sav@carpartsfrance.fr',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'sav@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') }
  };
  try { return await safeSendMail(mailOptions); } catch (e) { console.error('[emailService] sendEscalationEmail error:', e); return null; }
};

/**
 * Envoie un email de rappel/alerte SLA à l'agent (ou à l'équipe en secours)
 * @param {Object} ticket - Le ticket concerné
 * @param {Object} assignedUser - L'utilisateur assigné (peut être nul)
 * @param {number} hoursLate - Heures sans réponse agent (ex: 20 pour pré-alerte, 24 pour alerte)
 */
const sendSlaReminderEmail = async (ticket, assignedUser, hoursLate = 20) => {
  const agentEmail = (assignedUser && assignedUser.email) ? String(assignedUser.email).trim() : '';
  const teamEmail = process.env.SUPPORT_TEAM_EMAIL ? String(process.env.SUPPORT_TEAM_EMAIL).trim() : '';
  const to = agentEmail || teamEmail;
  if (!to) {
    console.warn('[emailService] Aucun destinataire pour sendSlaReminderEmail');
    return null;
  }

  const isBreach = Number(hoursLate) >= 24;
  const subject = `${isBreach ? 'ALERTE SLA' : 'Rappel SLA'} ${hoursLate}h - Ticket ${ticket.ticketNumber}`;

  const headerColor = isBreach ? '#b91c1c' : '#d97706'; // rouge si alerte, ambre si rappel
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${headerColor}; color: white; padding: 16px; text-align: center;">
        <h2>${isBreach ? 'Alerte SLA 24h' : `Rappel SLA ${hoursLate}h`}</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p>Bonjour ${(assignedUser && (assignedUser.firstName || assignedUser.email)) ? (assignedUser.firstName || assignedUser.email) : 'équipe'},</p>
        <p>Le ticket <strong>${ticket.ticketNumber}</strong> n'a pas reçu de réponse agent depuis <strong>${hoursLate}h</strong>.</p>
        <ul>
          <li>Client: ${ticket.clientInfo && ticket.clientInfo.firstName ? ticket.clientInfo.firstName : ''} ${ticket.clientInfo && ticket.clientInfo.lastName ? ticket.clientInfo.lastName : ''} ${ticket.clientInfo && ticket.clientInfo.email ? '(' + ticket.clientInfo.email + ')' : ''}</li>
          <li>Type: ${ticket.claimType || '-'}</li>
          <li>Statut: ${ticket.currentStatus || '-'}</li>
          <li>Priorité: ${ticket.priority || '-'}</li>
        </ul>
        <div style="margin: 20px 0; text-align: center;">
          <a href="${baseUrl}/tracking/?ticket=${ticket.ticketNumber}" style="background-color: #003366; color: white; padding: 10px 16px; text-decoration: none; border-radius: 4px; font-weight: bold;">Voir le ticket</a>
        </div>
        <p style="color: ${isBreach ? '#991b1b' : '#92400e'};">${isBreach ? 'Escalade recommandée si non traité immédiatement.' : 'Merci de répondre au client afin de respecter la SLA.'}</p>
      </div>
    </div>
  `;

  const textContent = `Ticket ${ticket.ticketNumber} sans réponse agent depuis ${hoursLate}h.\nClient: ${ticket.clientInfo && ticket.clientInfo.firstName ? ticket.clientInfo.firstName : ''} ${ticket.clientInfo && ticket.clientInfo.lastName ? ticket.clientInfo.lastName : ''}${ticket.clientInfo && ticket.clientInfo.email ? ' (' + ticket.clientInfo.email + ')' : ''}.`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'contact@carpartsfrance.fr',
    to,
    cc: (isBreach && teamEmail) ? teamEmail : undefined,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') }
  };

  try {
    return await safeSendMail(mailOptions);
  } catch (e) {
    console.error('[emailService] sendSlaReminderEmail error:', e);
    return null;
  }
};

/**
 * Notifie l'équipe interne lorsqu'un client indique qu'il n'est pas satisfait
 * et soumet un feedback via la page dédiée (flux avis clients Oui/Non).
 * @param {Object} params
 * @param {string} params.email - Email du client (optionnel)
 * @param {string} params.orderNumber - Numéro de commande (optionnel)
 * @param {string} params.token - Jeton d'invitation (optionnel)
 * @param {string} params.feedbackReason - Motif synthétique
 * @param {string} params.feedbackDetails - Détails fournis par le client
 */
const sendNegativeReviewFeedback = async ({ email = '', orderNumber = '', token = '', feedbackReason = '', feedbackDetails = '' }) => {
  const to = (process.env.SUPPORT_TEAM_EMAIL || process.env.EMAIL_USER || 'sav@carpartsfrance.fr');
  const subject = `Retour insatisfait client${orderNumber ? ` - Commande ${orderNumber}` : ''}`;
  const safeReason = String(feedbackReason || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDetailsHtml = String(feedbackDetails || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  const tokenPart = token ? `<p style="color:#666;font-size:12px;margin-top:8px">Token: ${token}</p>` : '';
  const emailPart = email ? `<li>Email client: ${email}</li>` : '';
  const orderPart = orderNumber ? `<li>Commande: ${orderNumber}</li>` : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background-color: #b91c1c; color: white; padding: 16px; text-align: center;">
        <h2>Retour insatisfait (avis)</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p>Un client a indiqué ne pas être satisfait et a envoyé un feedback via le formulaire interne.</p>
        <ul>
          ${emailPart}
          ${orderPart}
          <li>Motif: <strong>${safeReason || '-'}</strong></li>
        </ul>
        <div style="margin-top:12px;">
          <div style="font-weight:600;margin-bottom:6px;">Détails:</div>
          <div style="white-space:normal;line-height:1.45;">${safeDetailsHtml || '-'}</div>
        </div>
        ${tokenPart}
        <div style="margin-top:16px; text-align:center;">
          <a href="${baseUrl}/tracking/" style="background-color:#003366;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;">Ouvrir l'outil</a>
        </div>
      </div>
    </div>
  `;
  const textContent = `Retour insatisfait client${orderNumber ? ` - Commande ${orderNumber}` : ''}
Email: ${email || '-'}
Motif: ${feedbackReason || '-'}
Détails: ${feedbackDetails || '-'}
Token: ${token || '-'}
`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'sav@carpartsfrance.fr',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'sav@carpartsfrance.fr'
  };
  try {
    return await safeSendMail(mailOptions);
  } catch (e) {
    console.error('[emailService] sendNegativeReviewFeedback error:', e);
    return null;
  }
};

// DKIM (optionnel si variables fournies)
if (process.env.DKIM_PRIVATE_KEY && process.env.DKIM_DOMAIN && process.env.DKIM_SELECTOR) {
  transportOptions.dkim = {
    domainName: process.env.DKIM_DOMAIN,
    keySelector: process.env.DKIM_SELECTOR,
    privateKey: process.env.DKIM_PRIVATE_KEY
  };
}

const transporter = nodemailer.createTransport(transportOptions);

// Journaliser la configuration effective (sans informations sensibles)
console.log('[emailService] SMTP options effectives:', {
  host: transportOptions.host,
  port: transportOptions.port,
  secure: transportOptions.secure,
  requireTLS: transportOptions.requireTLS
});

// --- Envoi via API MailerSend (si configuré) ---
function parseAddress(input) {
  if (!input) return { email: '' };
  const str = String(input).trim();
  // Exemples acceptés: "Nom" <mail@domaine>, Nom <mail@domaine>, mail@domaine
  const m = str.match(/^\s*\"?([^\"]*)\"?\s*<\s*([^<>@\s]+@[^<>@\s]+)\s*>\s*$/);
  if (m) {
    const name = m[1] && m[1].trim() ? m[1].trim() : undefined;
    const email = m[2].trim();
    return { name, email };
  }
  return { email: str };
}

function httpPostJSON(hostname, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    try {
      const data = JSON.stringify(body);
      const options = {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...extraHeaders
        }
      };
      const req = https.request(options, (res) => {
        let chunks = '';
        res.on('data', (d) => { chunks += d; });
        res.on('end', () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: chunks,
              messageId: res.headers && (res.headers['x-message-id'] || res.headers['x-message-id'.toLowerCase()]) ? (res.headers['x-message-id'] || res.headers['x-message-id'.toLowerCase()]) : undefined
            });
          } else {
            const err = new Error(`MailerSend HTTP ${res.statusCode}: ${chunks}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });
      req.on('error', (e) => reject(e));
      req.setTimeout(Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 15000), () => {
        req.destroy(new Error('MailerSend timeout'));
      });
      req.write(data);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function sendViaMailerSend(mailOptions) {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    throw new Error('MAILERSEND_API_KEY non défini');
  }

  // Déterminer le FROM
  const fromRaw = process.env.MAILERSEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || mailOptions.from;
  const fromParsed = parseAddress(fromRaw);
  const fromName = process.env.MAILERSEND_FROM_NAME || fromParsed.name;

  // Destinataires
  const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const to = toList.filter(Boolean).map((addr) => {
    const p = parseAddress(addr);
    return p.name ? { email: p.email, name: p.name } : { email: p.email };
  });

  // Reply-To
  const replyToParsed = mailOptions.replyTo ? parseAddress(mailOptions.replyTo) : null;

  const payload = {
    from: fromName ? { email: fromParsed.email, name: fromName } : { email: fromParsed.email },
    to,
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text
  };
  if (replyToParsed && replyToParsed.email) {
    payload.reply_to = replyToParsed.name ? { email: replyToParsed.email, name: replyToParsed.name } : { email: replyToParsed.email };
  }

  const result = await httpPostJSON('api.mailersend.com', '/v1/email', payload, {
    Authorization: `Bearer ${apiKey}`
  });
  return { messageId: result.messageId || undefined, response: `MailerSend ${result.statusCode}` };
}

// Transport de secours (fallback) vers STARTTLS (587 puis 2525)
function buildFallbackOptions(port) {
  const fbPort = Number(port);
  const fbSecure = false; // STARTTLS
  return {
    ...transportOptions,
    port: fbPort,
    secure: fbSecure,
    requireTLS: true,
  };
}

async function safeSendMail(mailOptions) {
  // 1) Tenter MailerSend si configuré
  if (process.env.MAILERSEND_API_KEY) {
    try {
      console.log('[emailService] Envoi via MailerSend API...');
      const info = await sendViaMailerSend(mailOptions);
      return info;
    } catch (apiErr) {
      console.error('[emailService] MailerSend API a échoué, bascule vers SMTP:', apiErr && apiErr.message ? apiErr.message : apiErr);
      // on continue vers SMTP
    }
  }

  // 2) SMTP classique avec fallback
  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    const transientCodes = ['ETIMEDOUT', 'ECONNECTION', 'EAI_AGAIN', 'ESOCKET'];
    const isConnIssue = err && (transientCodes.includes(err.code) || err.command === 'CONN');
    const isPrimary587 = transportOptions.port === 587 && transportOptions.secure === false;
    if (!isConnIssue) {
      throw err;
    }

    if (isPrimary587) {
      // Si le primaire est déjà 587, on saute directement à 2525
      try {
        console.warn('[emailService] Connexion SMTP 587 échouée, tentative directe avec fallback STARTTLS:2525 ...', err && err.code ? err.code : err);
        const fbTransport2525 = nodemailer.createTransport(buildFallbackOptions(2525));
        return await fbTransport2525.sendMail(mailOptions);
      } catch (e3) {
        console.error('[emailService] Échec via fallback 2525:', e3 && e3.message ? e3.message : e3);
        throw e3;
      }
    } else {
      // Sinon on tente d'abord 587 puis 2525
      try {
        console.warn('[emailService] Connexion SMTP primaire échouée, tentative avec fallback STARTTLS:587 ...', err && err.code ? err.code : err);
        const fbTransport587 = nodemailer.createTransport(buildFallbackOptions(587));
        return await fbTransport587.sendMail(mailOptions);
      } catch (e2) {
        console.error('[emailService] Échec via fallback 587:', e2 && e2.message ? e2.message : e2);
        try {
          console.warn('[emailService] Nouvelle tentative avec fallback STARTTLS:2525 ...');
          const fbTransport2525 = nodemailer.createTransport(buildFallbackOptions(2525));
          return await fbTransport2525.sendMail(mailOptions);
        } catch (e3) {
          console.error('[emailService] Échec via fallback 2525:', e3 && e3.message ? e3.message : e3);
          throw e3;
        }
      }
    }
  }
}

// Alerter en cas d'absence de mot de passe SMTP
if (!process.env.EMAIL_PASS || String(process.env.EMAIL_PASS).trim() === '') {
  console.warn('[emailService] Attention: EMAIL_PASS n\'est pas défini. L\'authentification SMTP échouera (EAUTH) et aucun email ne sera envoyé.');
}

// Vérifier la connexion SMTP en développement pour diagnostiquer rapidement
if (isDevelopment) {
  transporter.verify((err, success) => {
    if (err) {
      console.error('[emailService] SMTP verify a échoué:', err && err.message ? err.message : err);
    } else {
      console.log('[emailService] SMTP prêt à envoyer des emails.');
    }
  });
}

/**
 * Envoie un email de notification au client lors d'un changement de statut de son ticket
 * @param {Object} ticket - Le ticket avec les informations client
 * @param {String} status - Le nouveau statut du ticket
 * @param {String} comment - Commentaire optionnel à inclure dans l'email
 * @returns {Promise} - Résultat de l'envoi d'email
 */
const sendStatusUpdateEmail = async (ticket, status, comment = '') => {
  // Normaliser et valider l'email destinataire
  const to = (ticket && ticket.clientInfo && ticket.clientInfo.email)
    ? String(ticket.clientInfo.email).trim()
    : '';
  if (!to) {
    console.log('Impossible d\'envoyer un email: adresse email du client manquante');
    return null;
  }

  // Traduire le statut en texte plus lisible
  const statusTranslation = {
    'nouveau': 'Nouveau',
    'en_analyse': 'En cours d\'analyse',
    'info_complementaire': 'Informations complémentaires requises',
    'validé': 'Validé',
    'refusé': 'Refusé',
    'en_cours_traitement': 'En cours de traitement',
    'expédié': 'Expédié',
    'clôturé': 'Clôturé'
  };

  // Construire le sujet et le corps de l'email
  const subject = `Mise à jour de votre ticket SAV ${ticket.ticketNumber}`;
  const preheader = `Statut mis à jour: ${statusTranslation[status] || status} pour le ticket ${ticket.ticketNumber}`;
  
  let htmlContent = `
    <span style="display:none!important;opacity:0;color:transparent;visibility:hidden;height:0;width:0;">${preheader}</span>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
        <h1>Car Parts France - Service Après-Vente</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
        <h2>Mise à jour de votre ticket SAV</h2>
        <p>Bonjour ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName},</p>
        <p>Nous vous informons que le statut de votre ticket SAV <strong>${ticket.ticketNumber}</strong> a été mis à jour.</p>
        
        <div style="background-color: #eef6ff; border-left: 4px solid #003366; padding: 15px; margin: 20px 0;">
          <p><strong>Nouveau statut :</strong> ${statusTranslation[status] || status}</p>
        </div>
  `;

  // Ajouter le commentaire s'il existe
  if (comment) {
    htmlContent += `
        <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Message de notre équipe :</strong></p>
          <p>${comment.replace(/\n/g, '<br>')}</p>
        </div>
    `;
  }

  // Ajouter le bouton de suivi, lien de secours et le pied de page
  htmlContent += `
        <div style="margin: 30px 0; text-align: center;">
          <a href="${baseUrl}/tracking/?ticket=${ticket.ticketNumber}" style="background-color: #E60000; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Suivre votre ticket</a>
        </div>
        <p style="font-size: 12px; color: #666;">Si le bouton ne fonctionne pas, copiez/collez ce lien dans votre navigateur :<br>
          <a href="${baseUrl}/tracking/?ticket=${ticket.ticketNumber}" style="color: #003366;">${baseUrl}/tracking/?ticket=${ticket.ticketNumber}</a>
        </p>
        <p>Nous vous remercions de votre confiance.</p>
        <p>L'équipe Car Parts France</p>
      </div>
      <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>Ce message est envoyé automatiquement, merci de ne pas y répondre directement.</p>
        <p>© ${new Date().getFullYear()} Car Parts France - Tous droits réservés</p>
      </div>
    </div>
  `;

  // Normaliser le destinataire
  const recipient = String(ticket.clientInfo.email || '').trim();
  if (!recipient) {
    console.warn('[emailService] Aucun destinataire pour email de mise à jour de statut (ticket', ticket.ticketNumber, ')');
    return null;
  }

  // Options de l'email
  const textContent = `Bonjour ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName},\n\n` +
    `Le statut de votre ticket SAV ${ticket.ticketNumber} a été mis à jour en: ${statusTranslation[status] || status}.\n` +
    (comment ? `\nMessage de notre équipe:\n${comment}\n\n` : '\n') +
    `Suivre votre ticket: ${baseUrl}/tracking/?ticket=${ticket.ticketNumber}\n\n` +
    `L'équipe Car Parts France`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Car Parts France SAV" <contact@carpartsfrance.fr>',
    to: recipient,
    subject: subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') },
    envelope: { from: (process.env.EMAIL_RETURN_PATH || process.env.EMAIL_USER || 'contact@carpartsfrance.fr'), to: [recipient] }
  };

  try {
    // Envoyer l'email
    const info = await safeSendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return null;
  }
};

/**
 * Envoie un email de confirmation au client lors de la création d'un nouveau ticket
 * @param {Object} ticket - Le ticket avec les informations client
 * @returns {Promise} - Résultat de l'envoi d'email
 */
const sendTicketCreationEmail = async (ticket) => {
  // Normaliser et valider l'email destinataire
  const to = (ticket && ticket.clientInfo && ticket.clientInfo.email)
    ? String(ticket.clientInfo.email).trim()
    : '';
  if (!to) {
    console.log('Impossible d\'envoyer un email: adresse email du client manquante');
    return null;
  }

  // Construire le sujet et le corps de l'email
  const subject = `Confirmation de votre demande SAV ${ticket.ticketNumber}`;
  const preheader = `Nous avons bien reçu votre demande SAV ${ticket.ticketNumber}`;
  
  let htmlContent = `
    <span style="display:none!important;opacity:0;color:transparent;visibility:hidden;height:0;width:0;">${preheader}</span>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
        <h1>Car Parts France - Service Après-Vente</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
        <h2>Confirmation de votre demande SAV</h2>
        <p>Bonjour ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName},</p>
        <p>Nous avons bien reçu votre demande de SAV concernant <strong>${ticket.partInfo.partType === 'autres' ? 'une pièce' : 'un(e) ' + ticket.partInfo.partType.replace('_', ' ')}</strong>.</p>
        <p>Votre numéro de ticket est : <strong style="font-size: 18px;">${ticket.ticketNumber}</strong></p>
        <p>Notre équipe technique va étudier votre demande dans les plus brefs délais.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${baseUrl}/tracking/?ticket=${ticket.ticketNumber}" style="background-color: #E60000; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Suivre votre ticket</a>
        </div>
        <p>Vous recevrez des notifications par email à chaque mise à jour de votre ticket.</p>
        <p>Si vous avez des questions, n'hésitez pas à nous contacter en répondant à cet email ou en appelant notre service client.</p>
      </div>
      <div style="padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>Car Parts France - Service Après-Vente</p>
        <p>Tél: 01 23 45 67 89 | Email: sav@carpartsfrance.fr</p>
      </div>
    </div>
  `;

  // Options de l'email
  const textContent = `Bonjour ${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName},\n\n` +
    `Nous confirmons la création de votre demande SAV. Votre numéro de ticket est ${ticket.ticketNumber}.\n` +
    `Suivre votre ticket: ${baseUrl}/tracking/?ticket=${ticket.ticketNumber}\n\n` +
    `L'équipe Car Parts France`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Car Parts France SAV" <contact@carpartsfrance.fr>',
    to,
    subject: subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@carpartsfrance.fr',
    headers: { 'X-Entity-Ref-ID': String(ticket.ticketNumber || '') },
    envelope: {
      from: (process.env.EMAIL_RETURN_PATH || process.env.EMAIL_USER || 'contact@carpartsfrance.fr'),
      to
    }
  };

  try {
    // Envoyer l'email
    const info = await safeSendMail(mailOptions);
    console.log('Email de confirmation envoyé:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de confirmation:', error);
    return null;
  }
};

// Envoi email de réinitialisation de mot de passe
const sendPasswordResetEmail = async (user, resetLink) => {
  const to = String(user.email || '').trim();
  if (!to) return null;
  const subject = 'Réinitialisation de votre mot de passe SAV';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #003366; color: white; padding: 16px; text-align: center;">
        <h2>Réinitialisation du mot de passe</h2>
      </div>
      <div style="padding: 16px; border: 1px solid #eee;">
        <p>Bonjour ${user.firstName || ''} ${user.lastName || ''},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetLink}" style="background-color: #E60000; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">Choisir un nouveau mot de passe</a>
        </div>
        <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:<br>
          <a href="${resetLink}">${resetLink}</a>
        </p>
        <p style="color:#666; font-size:12px;">Ce lien expire dans 60 minutes.</p>
      </div>
    </div>
  `;
  const textContent = `Bonjour,\n\nPour réinitialiser votre mot de passe, ouvrez ce lien (valide 60 minutes):\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Car Parts France SAV" <contact@carpartsfrance.fr>',
    to,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: process.env.EMAIL_REPLY_TO || 'contact@carpartsfrance.fr'
  };
  try {
    return await safeSendMail(mailOptions);
  } catch (e) {
    console.error('[emailService] sendPasswordResetEmail error:', e);
    return null;
  }
};

async function sendGenericEmail({ to, subject, html, text, replyTo, headers, from }) {
  const dest = String(to || '').trim();
  if (!dest) return null;
  const mailOptions = {
    from: from || (process.env.EMAIL_FROM || 'sav@carpartsfrance.fr'),
    to: dest,
    subject: String(subject || '').trim(),
    html: String(html || ''),
    text: String(text || ''),
    replyTo: replyTo || (process.env.EMAIL_REPLY_TO || 'sav@carpartsfrance.fr'),
    headers: headers || undefined
  };
  try {
    return await safeSendMail(mailOptions);
  } catch (e) {
    console.error('[emailService] sendGenericEmail error:', e);
    return null;
  }
}

module.exports = {
  sendStatusUpdateEmail,
  sendTicketCreationEmail,
  // Nouvelles notifications
  sendAssignmentEmail,
  sendAssistanceRequestEmail,
  sendEscalationEmail,
  sendSlaReminderEmail,
  sendPasswordResetEmail,
  sendNegativeReviewFeedback,
  sendReviewInviteEmail,
  sendGenericEmail
};
