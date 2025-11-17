const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./db');
const Ticket = require('./models/ticket');
const StatusUpdate = require('./models/status');
const User = require('./models/user');
const ResponseTemplate = require('./models/responseTemplate');
const Notification = require('./models/notification');
const Documentation = require('./models/documentation');
const Order = require('./models/order');
const Task = require('./models/task');
const TaskTemplate = require('./models/taskTemplate');
const ReviewInvite = require('./models/reviewInvite');
const Quote = require('./models/quote');
const bcrypt = require('bcryptjs');
// Assurer la disponibilité de fetch côté serveur (Node < 18)
let fetch = global.fetch;
if (!fetch) {
  try { fetch = require('undici').fetch; } catch (_) {}

}

const AUTO_TECHREF_START = new Date(Date.UTC(2025, 6, 1));

function isAfterAutoTechRefThreshold(dateLike) {
  if (!dateLike) return true;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d.getTime())) return true;
  return d >= AUTO_TECHREF_START;
}

// Détection auto: commande susceptible d'exiger des références techniques (méca/TCU)
function detectTechRefFromItems(items, sourceDate) {
  try {
    if (!isAfterAutoTechRefThreshold(sourceDate)) return false;
    return detectProductTypeFromItems(items) === 'mecatronique_tcu';
  } catch { return false; }
}

// Détection du type de produit (mécatronique/TCU, pont, boîte de transfert, moteur, autres)
function detectProductTypeFromItems(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) return 'autres';
    const norm = (s) => String(s || '').toLowerCase();
    // Groupes de mots-clés par catégorie (priorité: méca/TCU > pont > boîte transfert > moteur)
    const kw = {
      mecatronique_tcu: [
        'mecatron', 'mécatron', 'mechatron', 'mechatronic', 'mechatronics',
        'tcu', 'dq200', 'dq250', 'dq381', 'dq500', 'dq501', 'dq400', '0am', '0cq', '0cw',
        '0am927', '0am 927', '0am-927', '0am927769', '0am927769d'
      ],
      pont: [ 'pont', 'differential', 'différentiel', 'differentiel', 'diff ', 'diff-' ],
      boite_transfert: [ 'boite de transfert', 'boîte de transfert', 'transfer case', 'atc', 'xdrive', 'nvg', 'vg ' ],
      moteur: [ 'moteur', 'engine', 'bloc moteur', 'block engine', 'block moteur', 'mtr ' ]
    };
    const containsAny = (text, keys) => keys.some(k => text.includes(k));
    for (const it of items) {
      const name = norm(it?.name);
      const sku = norm(it?.sku);
      const text = `${name} ${sku}`;
      if (containsAny(text, kw.mecatronique_tcu)) return 'mecatronique_tcu';
      if (containsAny(text, kw.pont)) return 'pont';
      if (containsAny(text, kw.boite_transfert)) return 'boite_transfert';
      if (containsAny(text, kw.moteur)) return 'moteur';
    }
    return 'autres';
  } catch { return 'autres'; }
}
const { sendStatusUpdateEmail, sendTicketCreationEmail, sendAssignmentEmail, sendAssistanceRequestEmail, sendEscalationEmail, sendSlaReminderEmail, sendPasswordResetEmail, sendNegativeReviewFeedback, sendReviewInviteEmail, sendGenericEmail } = require('./services/emailService');
const setupStatsRoutes = require('./stats-api');
const { authenticateAdmin: adminAuthMW } = require('./middleware/auth');
const { startSlaWatcher } = require('./jobs/slaWatcher');
const { startDeliveryWatcher, runDeliveryReconciliationOnce } = require('./jobs/deliveryWatcher');
require('dotenv').config();
const { isS3Enabled, uploadBuffer, streamToResponse } = require('./services/storage');
const { getCarrierTrackingEvents, getCarrierPublicLink } = require('./services/carrierTracking');

module.exports.rebuildTechnicalRefsInternal = rebuildTechnicalRefsInternal;

async function rebuildVinOrPlateInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({}, { provider: 1, providerOrderId: 1, meta: 1 }).cursor();
  const wooBase = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
  const wooCk = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
  const wooCs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const hasMeta = !!doc.meta && typeof doc.meta === 'object';
    const previous = hasMeta ? (doc.meta.vinOrPlate || '') : '';
    const cleanPrev = typeof previous === 'string' ? previous.trim() : '';
    let nextValue = '';

    if (doc.provider === 'woocommerce' && doc.providerOrderId && wooBase && wooCk && wooCs) {
      try {
        const wooResp = await fetchWooOrderDetail(wooBase, wooCk, wooCs, doc.providerOrderId);
        if (wooResp) {
          const metaCandidate = extractVinFromWooOrder(wooResp);
          if (metaCandidate && metaCandidate.value) {
            nextValue = metaCandidate.value;
          }
        }
      } catch (err) {
        console.warn('[rebuildVin] fetch WooCommerce order failed', doc._id, err?.message || err);
      }
    }

    if (!nextValue && hasMeta) {
      const fallback = extractVinOrPlateFromText(doc.meta.notes?.join(' ') || '');
      if (fallback && fallback.value) nextValue = fallback.value;
    }

    nextValue = typeof nextValue === 'string' ? nextValue.trim() : '';
    if (nextValue && nextValue !== cleanPrev) {
      doc.meta = doc.meta || {};
      doc.meta.vinOrPlate = nextValue;
      doc.events = doc.events || [];
      doc.events.push({
        type: 'vin_recomputed',
        message: `VIN/Plaque recalculé: ${nextValue}`,
        at: new Date()
      });

// Mettre à jour un modèle
app.put('/api/admin/tasks/templates/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const b = req.body || {};
    const tpl = await TaskTemplate.findById(req.params.id);
    if (!tpl) return res.status(404).json({ success: false, message: 'Modèle introuvable' });
    if (b.name !== undefined) tpl.name = String(b.name || '').trim();
    if (b.title !== undefined) tpl.title = String(b.title || '').trim();
    if (b.description !== undefined) tpl.description = String(b.description || '').trim();
    if (b.priority) tpl.priority = b.priority;
    if (Array.isArray(b.tags)) tpl.tags = b.tags;
    await tpl.save();
    res.json({ success: true, template: tpl });
  } catch (e) {
    console.error('[tasks:templates:update] erreur', e);
    if (e && e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Nom déjà utilisé' });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Liste des invitations (admin) avec recherche/tri/pagination
app.get('/api/admin/reviews/invites', adminAuthMW, async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    const sortKey = String(req.query.sort || 'createdAt');
    const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10) || 20, 1), 200);

    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { email: re },
        { orderNumber: re },
        { token: re }
      ];
    }

    const total = await ReviewInvite.countDocuments(filter);
    const list = await ReviewInvite.find(filter)
      .sort({ [sortKey]: dir, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const rows = list.map(inv => {
      const token = inv.token;
      const yesLink = `${base}/r/yes/${token}`;
      const noLink = `${base}/r/no/${token}`;
      return { ...inv, yesLink, noLink };
    });

    res.json({ success: true, total, page, pageSize, invites: rows });
  } catch (e) {
    console.error('[reviews] list invites error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Export CSV des invitations (admin)
app.get('/api/admin/reviews/invites/export.csv', adminAuthMW, async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    const sortKey = String(req.query.sort || 'createdAt');
    const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [ { email: re }, { orderNumber: re }, { token: re } ];
    }
    const list = await ReviewInvite.find(filter).sort({ [sortKey]: dir, _id: -1 }).lean();
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const lines = [];
    lines.push(['createdAt','email','orderNumber','token','yesLink','noLink','decision','clickedYesAt','clickedNoAt','lockedByNo','revoked','revokedAt','feedbackReason'].join(','));
    for (const inv of list) {
      const yesLink = `${base}/r/yes/${inv.token}`;
      const noLink = `${base}/r/no/${inv.token}`;
      const cells = [
        inv.createdAt ? new Date(inv.createdAt).toISOString() : '',
        inv.email || '',
        inv.orderNumber || '',
        inv.token || '',
        yesLink,
        noLink,
        inv.decision || '',
        inv.clickedYesAt ? new Date(inv.clickedYesAt).toISOString() : '',
        inv.clickedNoAt ? new Date(inv.clickedNoAt).toISOString() : '',
        inv.lockedByNo ? 'true' : 'false',
        inv.revoked ? 'true' : 'false',
        inv.revokedAt ? new Date(inv.revokedAt).toISOString() : '',
        (inv.feedbackReason || '').replace(/[\r\n,]/g, ' ')
      ];
      lines.push(cells.map(v => typeof v === 'string' && v.includes(',') ? '"' + v.replace(/"/g, '""') + '"' : v).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="review-invites.csv"');
    res.send(csv);
  } catch (e) {
    console.error('[reviews] export csv error:', e);
    res.status(500).send('Erreur serveur');
  }
});

// Renvoyer l'email d'invitation (admin)
app.post('/api/admin/reviews/invites/:id/resend', adminAuthMW, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const inv = await ReviewInvite.findById(id).lean();
    if (!inv) return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    if (inv.revoked) return res.status(400).json({ success: false, message: 'Invitation révoquée' });
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const yesLink = `${base}/r/yes/${inv.token}`;
    const noLink = `${base}/r/no/${inv.token}`;
    const toEmail = String(req.body?.toEmail || inv.email || '').trim();
    if (!toEmail) return res.status(400).json({ success: false, message: 'Email destinataire requis' });
    try { await sendReviewInviteEmail({ toEmail, yesLink, noLink }); } catch (e) { console.warn('[reviews] resend email failed:', e?.message || e); }
    res.json({ success: true });
  } catch (e) {
    console.error('[reviews] resend error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Révoquer une invitation (admin)
app.post('/api/admin/reviews/invites/:id/revoke', adminAuthMW, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const inv = await ReviewInvite.findById(id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    if (inv.revoked) return res.json({ success: true });
    inv.revoked = true;
    inv.revokedAt = new Date();
    await inv.save();
    res.json({ success: true });
  } catch (e) {
    console.error('[reviews] revoke error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Dupliquer un modèle
app.post('/api/admin/tasks/templates/:id/duplicate', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const source = await TaskTemplate.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ success: false, message: 'Modèle introuvable' });
    const b = req.body || {};
    const name = String(b.name || `${source.name} (copie)`).trim();
    const doc = new TaskTemplate({
      name,
      title: source.title || '',
      description: source.description || '',
      priority: source.priority || 'medium',
      tags: Array.isArray(source.tags) ? source.tags : []
    });
    await doc.save();
    res.json({ success: true, template: doc });
  } catch (e) {
    console.error('[tasks:templates:duplicate] erreur', e);
    if (e && e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Nom déjà utilisé' });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
      await doc.save();
      updated++;
    }
  }
  return { scanned, updated };
}

module.exports.rebuildVinOrPlateInternal = rebuildVinOrPlateInternal;

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3001;
const WEBSITE_URL = (process.env.WEBSITE_URL && process.env.WEBSITE_URL.trim()) || `http://localhost:${PORT}`;
const TRUSTPILOT_URL = (process.env.TRUSTPILOT_URL && process.env.TRUSTPILOT_URL.trim()) || 'https://fr.trustpilot.com/review/carpartsfrance.fr';
const ORDERS_SYNC_ENABLED = String(process.env.ORDERS_SYNC_ENABLED || 'false').toLowerCase() === 'true';
const ORDERS_SYNC_INTERVAL_MINUTES = parseInt(process.env.ORDERS_SYNC_INTERVAL_MINUTES || '15', 10);
// L'application est derrière un proxy (Railway/Render)
app.set('trust proxy', 1);

// Connexion à MongoDB
connectDB();

// Quand la connexion DB est ouverte, lancer l'import auto si nécessaire
mongoose.connection.once('open', () => {
  try { autoImportDocsFromFSIfEmpty(); } catch (_) {}
  // Recalcul rétroactif automatique des références requises sur anciennes commandes
  try {
    rebuildTechnicalRefsInternal()
      .then(({ scanned, updated }) => {
        console.log(`[techref] Rétroactif terminé: ${updated} mise(s) à jour sur ${scanned} commande(s)`);
      })
      .catch((e) => console.warn('[techref] Rétroactif: erreur non bloquante', e?.message || e));
  } catch(_) {}
  // Recalcul rétroactif automatique du type de produit (pour tri/filtre UI)
  try {
    rebuildProductTypeInternal()
      .then(({ scanned, updated }) => {
        console.log(`[ptype] Rétroactif terminé: ${updated} mise(s) à jour sur ${scanned} commande(s)`);
      })
      .catch((e) => console.warn('[ptype] Rétroactif: erreur non bloquante', e?.message || e));
  } catch(_) {}
  // Normaliser: toute commande avec un numéro de suivi passe à "expédiée"
  try {
    normalizeShippedStatusInternal()
      .then(({ scanned, updated }) => {
        console.log(`[shipnorm] Normalisation: ${updated} statut(s) mis à jour sur ${scanned}`);
      })
      .catch((e) => console.warn('[shipnorm] Erreur non bloquante', e?.message || e));
  } catch(_) {}
  // Migration optionnelle: delivered -> delivered_awaiting_deposit (si activée par env)
  try {
    const MIGRATE_FLAG = String(process.env.MIGRATE_DELIVERED_TO_AWAITING_ON_START || 'false').toLowerCase() === 'true';
    if (MIGRATE_FLAG) {
      migrateDeliveredToAwaitingOnce()
        .then((count) => console.log(`[migrate-delivered] ${count} commande(s) mises à jour (delivered -> delivered_awaiting_deposit)`))
        .catch((e) => console.warn('[migrate-delivered] Erreur non bloquante', e?.message || e));
    }
  } catch(_) {}
  // Réconciliation optionnelle: repasser en "Expédié" les commandes marquées trop tôt
  try {
    const RECONCILE_FLAG = String(process.env.RECONCILE_DELIVERY_ON_START || 'false').toLowerCase() === 'true';
    if (RECONCILE_FLAG) {
      runDeliveryReconciliationOnce()
        .then(({ scanned, reverted }) => console.log(`[deliveryReconcile] Scannés=${scanned}, remis à expédié=${reverted}`))
        .catch((e) => console.warn('[deliveryReconcile] Erreur non bloquante', e?.message || e));
    }
  } catch(_) {}
});

// (route sync-woo-one déplacée plus bas)

// (Route diagnostics/env déplacée plus bas après définition des middlewares)

// (Route DELETE déplacée plus bas après définition des middlewares)

// (Route déplacée plus bas après définition des middlewares)

// Seed default response templates if collection is empty
async function seedResponseTemplates() {
  try {
    const count = await ResponseTemplate.countDocuments();
    if (count === 0) {
      await ResponseTemplate.insertMany([
        { key: 'ask_more_info', label: 'Demande d\'informations complémentaires', content: 'Bonjour {{client.firstName}},\n\nPour avancer sur votre dossier {{ticket.number}}, pourriez-vous nous préciser: {{ticket.missingInfo}}\n\nCordialement,\nService SAV', isActive: true },
        { key: 'in_supplier_process', label: 'Dossier en cours chez le fournisseur', content: 'Bonjour {{client.firstName}},\n\nVotre dossier {{ticket.number}} est actuellement en cours d\'analyse chez notre fournisseur. Nous reviendrons vers vous dès que possible.\n\nCordialement,\nService SAV', isActive: true },
        { key: 'waiting_client', label: 'En attente du client', content: 'Bonjour {{client.firstName}},\n\nNous restons en attente de votre retour concernant le dossier {{ticket.number}}.\n\nCordialement,\nService SAV', isActive: true },
        { key: 'blocked', label: 'Dossier temporairement bloqué', content: 'Bonjour {{client.firstName}},\n\nVotre dossier {{ticket.number}} est temporairement bloqué. Nous vous tiendrons informé dès évolution.\n\nCordialement,\nService SAV', isActive: true }
      ]);
      console.log('[seed] Modèles de réponse par défaut insérés');
    }
  } catch (e) {
    console.error('[seed] Erreur lors du seed des modèles de réponse:', e);
  }
}

// Fonction interne: recalculer en base les références techniques requises (rétroactif)
async function rebuildTechnicalRefsInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({}, { items: 1, meta: 1, createdAt: 1 }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const items = Array.isArray(doc.items) ? doc.items : [];
    const sourceDate = (doc.meta && doc.meta.sourceCreatedAt) ? new Date(doc.meta.sourceCreatedAt) : doc.createdAt;
    const needs = detectTechRefFromItems(items, sourceDate);
    const current = !!(doc.meta && doc.meta.technicalRefRequired);
    doc.meta = doc.meta || {};
    if (needs && !current) {
      // Activer seulement si nécessaire; ne JAMAIS désactiver automatiquement pour respecter un choix manuel
      doc.meta.technicalRefRequired = true;
      doc.events = doc.events || [];
      doc.events.push({ type: 'technical_ref_required_set', message: 'Référence technique requise (rétroactif auto)', at: new Date() });
      await doc.save();
      updated++;
    }
  }
  return { scanned, updated };
}

// Fonction interne: recalculer en base le type de produit à partir des items
async function rebuildProductTypeInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({}, { items: 1, meta: 1 }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const items = Array.isArray(doc.items) ? doc.items : [];
    const ptype = detectProductTypeFromItems(items);
    const hasMeta = !!doc.meta && typeof doc.meta === 'object';
    const current = hasMeta ? doc.meta.productType : undefined;
    if (current !== ptype) {
      doc.meta = doc.meta || {};
      doc.meta.productType = ptype;
      doc.events = doc.events || [];
      doc.events.push({ type: 'product_type_set', message: `Type produit = ${ptype}`, at: new Date() });
      await doc.save();
      updated++;
    }
  }
  return { scanned, updated };
}

// Fonction interne: normaliser les statuts d'expédition
async function normalizeShippedStatusInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({ 'shipping.trackingNumber': { $exists: true, $ne: '' }, status: { $nin: ['fulfilled','delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded','failed'] } }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    doc.status = 'fulfilled';
    doc.shipping = doc.shipping || {};
    if (!doc.shipping.shippedAt) doc.shipping.shippedAt = new Date();
    doc.events = doc.events || [];
    doc.events.push({ type: 'order_shipped', message: 'Commande expédiée', payloadSnippet: { carrier: (doc.shipping && doc.shipping.carrier) ? doc.shipping.carrier : '', trackingNumber: (doc.shipping && doc.shipping.trackingNumber) ? doc.shipping.trackingNumber : '' } });
    await doc.save();
    updated++;
  }
  return { scanned, updated };
}

// Migration ponctuelle: delivered -> delivered_awaiting_deposit
async function migrateDeliveredToAwaitingOnce() {
  try {
    const res = await Order.updateMany(
      { status: 'delivered' },
      {
        $set: { status: 'delivered_awaiting_deposit' },
        $push: {
          events: {
            $each: [
              { type: 'status_migrated', message: 'Migration: delivered -> delivered_awaiting_deposit', at: new Date() }
            ]
          }
        }
      }
    );
    return (res && (res.modifiedCount || res.nModified)) ? (res.modifiedCount || res.nModified) : 0;
  } catch (e) {
    console.warn('[migrate-delivered] erreur', e && e.message ? e.message : e);
    return 0;
  }
}
seedResponseTemplates();

// Middleware
// CORS configurable via CORS_ORIGIN (ex: "https://example.com,https://admin.example.com").
// Défaut à '*' si non spécifié (développement).
app.use(cors({
  origin: (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim() !== '')
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Sécurité HTTP de base (désactive CSP stricte pour éviter de casser l'admin inline)
app.use(helmet({
  contentSecurityPolicy: false,
}));
// Compression des réponses
app.use(compression());
// Parsing
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      // Conserver le body brut pour WooCommerce (signature HMAC)
      if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/woocommerce')) {
        req.rawBody = Buffer.from(buf);
      }
    } catch (_) {}
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting sur les routes admin (anti-abus)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes/15min/IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur pour les demandes de réinitialisation de mot de passe
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requêtes/15min/IP
  standardHeaders: true,
  legacyHeaders: false,
});

 

// S'assurer que le répertoire d'uploads existe (supporte UPLOADS_DIR)
const configuredUploadsDir = (process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim() !== '')
  ? process.env.UPLOADS_DIR.trim()
  : path.join(__dirname, '../uploads');
const uploadsDir = path.isAbsolute(configuredUploadsDir)
  ? configuredUploadsDir
  : path.join(__dirname, '..', configuredUploadsDir);
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.error('Impossible de créer le répertoire uploads:', e);
}

// Synchroniser toutes les commandes WooCommerce (pagination complète)
async function syncWooAllOrders() {
  try {
    const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
    const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
    const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
    if (!base || !ck || !cs) throw new Error('Variables WooCommerce manquantes');
    let page = 1;
    const perPage = 25; // réduire davantage pour fiabiliser en prod (Railway)
    let processed = 0;
    for (;;) {
      const baseUrl = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&orderby=date&order=desc`;
      const headers = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
      let resp = await fetch(baseUrl, { headers });
      if (!resp.ok) {
        const alt = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&per_page=${perPage}&page=${page}&orderby=date&order=desc`;
        resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
        if (!resp.ok) {
          // backoff 1s puis 2e tentative en alt
          await new Promise(r => setTimeout(r, 1000));
          resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
        }
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.warn('[orders-sync-full] Woo HTTP', resp.status, txt);
        break;
      }
      const list = await resp.json().catch(() => []);
      if (!Array.isArray(list) || list.length === 0) break;
      for (const payload of list) {
        const wooId = String(payload.id || payload.resource_id || '').trim();
        if (!wooId) continue;
        const internalStatus = mapWooStatusToInternal(payload.status);
        const amount = parseFloat((payload.total || payload.total_due || '0').toString());
        const currency = (payload.currency || 'EUR').toString();
        const shippingLines = Array.isArray(payload.shipping_lines) ? payload.shipping_lines : [];
        const shippingLinesTotal = shippingLines.reduce((acc, sl) => acc + (parseFloat((sl.total || 0).toString()) || 0), 0);
        const itemsForTax = Array.isArray(payload.line_items) ? payload.line_items : [];
        const itemsTaxSum = itemsForTax.reduce((acc, li) => acc + (parseFloat((li.total_tax || 0).toString()) || 0), 0);
        const shippingTaxSum = shippingLines.reduce((acc, sl) => acc + (parseFloat((sl.total_tax || 0).toString()) || 0), 0);
        const taxTotal = (() => {
          const t = parseFloat((payload.total_tax || payload.cart_tax || 0).toString()) || 0;
          return t || (itemsTaxSum + shippingTaxSum);
        })();
        const shippingTotal = (() => {
          const v = parseFloat((payload.shipping_total || 0).toString()) || 0;
          return v || shippingLinesTotal;
        })();
        const wooCreatedRaw = payload.date_created_gmt || payload.date_created || null;
        const wooUpdatedRaw = payload.date_modified_gmt || payload.date_modified || null;
        const wooCreated = wooCreatedRaw ? new Date(wooCreatedRaw) : null;
        const wooUpdated = wooUpdatedRaw ? new Date(wooUpdatedRaw) : null;
        const customer = payload.billing ? {
          name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
          email: payload.billing.email || '',
          phone: payload.billing.phone || ''
        } : { name: '', email: '', phone: '' };
        let items = Array.isArray(payload.line_items) ? payload.line_items.map(li => {
          const meta = Array.isArray(li.meta_data) ? li.meta_data : [];
          const attrs = meta
            .filter(m => m && typeof m.key === 'string' && typeof m.value !== 'undefined')
            // Garder les clés lisibles (ne commençant pas par '_') ou correspondant à nos motifs
            .filter(m => !/^_/.test(m.key) || /^(pa_|attribute_|variation|variante|option|reference|référence|ref|tcu)/i.test(m.key))
            .map(m => {
              const raw = m.value;
              let val;
              if (raw && typeof raw === 'object') {
                val = raw.value || raw.label || raw.name || raw.display_value || JSON.stringify(raw);
              } else {
                val = raw;
              }
              const k = (m.display_key && typeof m.display_key === 'string') ? m.display_key : m.key;
              return { key: String(k), value: String(val) };
            });
          return {
            sku: li.sku || '',
            name: li.name || '',
            qty: li.quantity || 0,
            unitPrice: parseFloat((li.price || li.total || 0).toString()),
            options: attrs
          };
        }) : [];
        // Fallback: si aucune option captée, recharger le détail de la commande pour obtenir meta_data complet
        if (items.length && items.every(it => !Array.isArray(it.options) || it.options.length === 0)) {
          try {
            const full = await fetchWooOrderDetail(base, ck, cs, wooId);
            const di = Array.isArray(full?.line_items) ? full.line_items : [];
            if (di.length) {
              items = di.map(li => {
                const meta = Array.isArray(li.meta_data) ? li.meta_data : [];
                const attrs = meta
                  .filter(m => m && typeof m.key === 'string' && typeof m.value !== 'undefined')
                  .filter(m => !/^_/.test(m.key) || /^(pa_|attribute_|variation|variante|option|reference|référence|ref|tcu)/i.test(m.key))
                  .map(m => {
                    const raw = m.value;
                    let val;
                    if (raw && typeof raw === 'object') {
                      val = raw.value || raw.label || raw.name || raw.display_value || JSON.stringify(raw);
                    } else {
                      val = raw;
                    }
                    const k = (m.display_key && typeof m.display_key === 'string') ? m.display_key : m.key;
                    return { key: String(k), value: String(val) };
                  });
                return {
                  sku: li.sku || '',
                  name: li.name || '',
                  qty: li.quantity || 0,
                  unitPrice: parseFloat((li.price || li.total || 0).toString()),
                  options: attrs
                };
              });
            }
          } catch(_) {}
        }
        const productType = detectProductTypeFromItems(items);
        const billingAddress = payload.billing ? {
          name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
          company: payload.billing.company || '',
          address1: payload.billing.address_1 || '',
          address2: payload.billing.address_2 || '',
          city: payload.billing.city || '',
          postcode: payload.billing.postcode || '',
          country: payload.billing.country || '',
          email: payload.billing.email || '',
          phone: payload.billing.phone || ''
        } : null;
        const shippingAddress = payload.shipping ? {
          name: `${payload.shipping.first_name || ''} ${payload.shipping.last_name || ''}`.trim(),
          company: payload.shipping.company || '',
          address1: payload.shipping.address_1 || '',
          address2: payload.shipping.address_2 || '',
          city: payload.shipping.city || '',
          postcode: payload.shipping.postcode || '',
          country: payload.shipping.country || '',
          phone: payload.shipping.phone || (payload.billing?.phone || '')
        } : null;
        // Expédition (méthode, transporteur, suivi si présent dans meta)
        const shipLine = Array.isArray(payload.shipping_lines) && payload.shipping_lines.length ? payload.shipping_lines[0] : null;
        const shippingMethod = shipLine?.method_title || shipLine?.method_id || '';
        const shippingMeta = Array.isArray(shipLine?.meta_data) ? shipLine.meta_data : [];
        const trackingMeta = (Array.isArray(payload.meta_data) ? payload.meta_data : []).concat(shippingMeta);
        const metaGet = (key) => {
          const m = trackingMeta.find(m => (m?.key || '').toLowerCase().includes(String(key).toLowerCase()));
          return m ? (m.value || '') : '';
        };
        const trackingNumber = metaGet('tracking');
        const carrier = metaGet('carrier') || metaGet('shipping_provider') || '';
        let statusToSet = internalStatus;
        if (trackingNumber && !['delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded','failed'].includes(internalStatus)) {
          statusToSet = 'fulfilled';
        }
        // Ne jamais écraser un statut final déjà présent en base
        const finals = ['delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded','failed'];
        let existingOrder = null;
        try { existingOrder = await Order.findOne({ provider: 'woocommerce', providerOrderId: wooId }, { status: 1, 'meta.vinOrPlate': 1 }).lean(); } catch(_) {}
        if (existingOrder && finals.includes(existingOrder.status)) {
          statusToSet = existingOrder.status;
        }

        const update = {
          provider: 'woocommerce',
          providerOrderId: wooId,
          number: payload.number ? String(payload.number) : undefined,
          status: statusToSet,
          customer,
          totals: { currency, amount: isNaN(amount) ? 0 : amount, tax: taxTotal, shipping: shippingTotal },
          items,
          ...(wooCreated ? { 'meta.sourceCreatedAt': wooCreated } : {}),
          ...(wooUpdated ? { 'meta.sourceUpdatedAt': wooUpdated } : {}),
          ...(billingAddress ? { 'billing.address': billingAddress } : {}),
          ...(shippingAddress ? { 'shipping.address': shippingAddress } : {}),
          ...(shippingMethod ? { 'shipping.method': shippingMethod } : {}),
          ...(carrier ? { 'shipping.carrier': carrier } : {}),
          ...(trackingNumber ? { 'shipping.trackingNumber': trackingNumber, 'shipping.shippedAt': new Date() } : {})
        };
        update['meta.productType'] = productType;
        // VIN/Plaque depuis meta_data / lignes / note client
        let vinMeta = null;
        try { vinMeta = extractVinFromWooOrder(payload); } catch {}
        // Fallback: si non trouvé, charger le détail de la commande (liste tronque parfois les métadonnées)
        if (!vinMeta || !vinMeta.value) {
          try {
            const detail = await fetchWooOrderDetail(base, ck, cs, wooId);
            const v2 = extractVinFromWooOrder(detail);
            if (v2 && v2.value) vinMeta = v2;
          } catch { /* ignore */ }
        }
        if (vinMeta && vinMeta.value) {
          const hasManualVin = !!(existingOrder && existingOrder.meta && existingOrder.meta.vinOrPlate && String(existingOrder.meta.vinOrPlate).trim());
          if (!hasManualVin) {
            update['meta.vinOrPlate'] = vinMeta.value;
            if (vinMeta.key) update['meta.wooVinMetaKey'] = vinMeta.key;
            if (vinMeta.id) update['meta.wooVinMetaId'] = String(vinMeta.id);
          }
        }
        const setOnInsert = wooCreated ? { createdAt: wooCreated } : {};
        // Définir le flag de référence technique requise uniquement à la création (respect du toggle manuel ensuite)
        try {
          const autoFlag = detectTechRefFromItems(items);
          if (autoFlag) setOnInsert['meta.technicalRefRequired'] = true;
        } catch {}
        const ops = { $set: update, $setOnInsert: setOnInsert, $push: { events: { $each: [ { type: 'woo_sync_full', message: `Full sync Woo status=${payload.status}`, payloadSnippet: { id: wooId, status: payload.status }, at: new Date() } ] } } };
        await Order.updateOne(
          { provider: 'woocommerce', providerOrderId: wooId },
          ops,
          { upsert: true }
        );
      }
      processed += list.length;
      console.log(`[orders-sync-full] Page ${page} -> ${list.length} commande(s)`);
      page += 1;
      await new Promise(r => setTimeout(r, 300)); // petite pause pour éviter le rate-limit
    }
    console.log(`[orders-sync-full] Terminé. Total importé/actualisé: ${processed}`);
    return { processed };
  } catch (e) {
    console.error('[orders-sync-full] Erreur', e && e.message ? e.message : e);
    throw e;
  }
}

// Préparer une liste d'emplacements possibles pour servir les fichiers (compatibilité)
// 1) uploadsDir (valeur actuelle de UPLOADS_DIR)
// 2) uploadsDir + '/uploads' (cas où les fichiers ont été stockés dans un sous-dossier "uploads")
// 3) parent de uploadsDir (cas où les fichiers sont à la racine du volume)
const altUploadDirs = [uploadsDir];
const nestedUploads = path.join(uploadsDir, 'uploads');
try {
  if (fs.existsSync(nestedUploads) && !altUploadDirs.includes(nestedUploads)) {
    altUploadDirs.push(nestedUploads);
  }
} catch {}
const parentUploads = path.dirname(uploadsDir);
try {
  // Ne jamais ajouter la racine '/': risque de fuite de fichiers système
  if (parentUploads !== '/' && fs.existsSync(parentUploads) && !altUploadDirs.includes(parentUploads)) {
    altUploadDirs.push(parentUploads);
  }
} catch {}
// Ajouter aussi des emplacements historiques probables
const appUploads = path.join(__dirname, '../uploads'); // ex: /app/uploads
try {
  if (fs.existsSync(appUploads) && !altUploadDirs.includes(appUploads)) {
    altUploadDirs.push(appUploads);
  }
} catch {}
const dataUploads = '/data/uploads';
try {
  if (fs.existsSync(dataUploads) && !altUploadDirs.includes(dataUploads)) {
    altUploadDirs.push(dataUploads);
  }
} catch {}
const dataRoot = '/data';
try {
  if (fs.existsSync(dataRoot) && !altUploadDirs.includes(dataRoot)) {
    altUploadDirs.push(dataRoot);
  }
} catch {}

console.log('UPLOADS_DIR env =', process.env.UPLOADS_DIR, ' -> resolved uploadsDir =', uploadsDir);
console.log('Static uploads mapping order:', altUploadDirs);

// Activer le stockage S3/R2 si configuré
const S3_ENABLED = isS3Enabled();
console.log('Storage driver:', S3_ENABLED ? 's3' : 'local');

// Configuration de multer pour le téléchargement de fichiers
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// (routes des modèles de tâches déplacées plus bas après authenticateAdmin)
// (routes des modèles de tâches déplacées plus bas après authenticateAdmin)

// (route sync-woo-one déplacée plus bas)

// Helpers WooCommerce
async function wooUpdateOrder(wooOrderId, wooPayload) {
  const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
  const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
  const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
  if (!base || !ck || !cs) throw new Error('Config WooCommerce manquante');
  const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders/${encodeURIComponent(String(wooOrderId))}`;
  const headersPut = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
  let resp = await fetch(url, { method: 'PUT', headers: headersPut, body: JSON.stringify(wooPayload) });
  if (!resp.ok) {
    const alt = `${url}?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
    resp = await fetch(alt, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' }, body: JSON.stringify(wooPayload) });
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Woo update HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

// Récupérer le détail d'une commande Woo (contient meta_data complet, notes, etc.)
async function fetchWooOrderDetail(base, ck, cs, wooOrderId) {
  const baseClean = base.replace(/\/$/, '');
  const headers = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
  let resp = await fetch(`${baseClean}/wp-json/wc/v3/orders/${encodeURIComponent(wooOrderId)}`, { headers });
  if (!resp.ok) {
    const alt = `${baseClean}/wp-json/wc/v3/orders/${encodeURIComponent(wooOrderId)}?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
    resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Woo order detail HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

function splitName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return { first_name: '', last_name: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  const last = parts.pop();
  return { first_name: parts.join(' '), last_name: last };
}

// Extraire un VIN ou une plaque depuis un texte libre (ex: "VIN: WVWZZZ...")
function extractVinOrPlateFromText(text) {
  try {
    const str = String(text ?? '').trim();
    if (!str) return null;
    // Chercher un VIN n'importe où dans la chaîne
    const vinMatch = str.match(/([A-HJ-NPR-Z0-9]{17})/i); // exclut I, O, Q
    if (vinMatch && vinMatch[1]) {
      return { type: 'vin', value: vinMatch[1].toUpperCase() };
    }
    // Chercher une plaque FR AA-123-AA (avec ou sans tirets)
    const plateMatch = str.match(/\b([A-Z]{2}-?\d{3}-?[A-Z]{2})\b/i);
    if (plateMatch && plateMatch[1]) {
      // Normaliser en AA-123-AA
      const raw = plateMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      return { type: 'plate', value: `${raw.slice(0,2)}-${raw.slice(2,5)}-${raw.slice(5,7)}` };
    }
    return null;
  } catch { return null; }
}

// Extraire VIN / Plaque depuis les meta WooCommerce
function extractVinFromWooMeta(metaArr) {
  try {
    if (!Array.isArray(metaArr)) return null;
    const norm = (s) => String(s || '').toLowerCase();
    const normKey = (s) => norm(s).replace(/[^a-z0-9]/g, '');
    const isUrl = (v) => /^(https?:\/\/|www\.)/i.test(v) || v.includes('://') || /\/(product|wp-|\?|#)/i.test(v);
    const looksVin = (v) => /^[A-HJ-NPR-Z0-9]{17}$/i.test(String(v).replace(/\s/g, ''));
    const looksFrPlate = (v) => /\b[A-Z]{2}-?\d{3}-?[A-Z]{2}\b/i.test(String(v).replace(/\s/g, ''));
    const keywordKeys = [
      'vin', 'vin_', 'vinclient', 'vinplaque', 'vinouplaque', 'vinimmatriculation',
      'plaque', 'immatriculation', 'numeroimmatriculation',
      'registration', 'licenseplate', 'numberplate', 'vehiclevin', 'vehiculevin'
    ];
    const keyIncludes = ['vin', 'immatric', 'plaque', 'registration', 'license', 'plate'];

    let best = null;
    let bestScore = -1;
    for (const m of metaArr) {
      const rawKey = m?.key ?? m?.display_key ?? '';
      const keyL = norm(rawKey);
      const keyN = normKey(rawKey);
      const rawVal = m?.value;
      let val = '';
      if (rawVal == null) val = '';
      else if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') val = String(rawVal);
      else if (Array.isArray(rawVal)) val = rawVal.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
      else if (typeof rawVal === 'object') val = JSON.stringify(rawVal);
      val = String(val).trim();
      if (!val) continue;
      if (isUrl(val)) continue; // ignorer URLs et referrers

      const byExactKey = keywordKeys.some(k => keyN === normKey(k));
      const byKeyInclude = keyIncludes.some(k => keyL.includes(k));
      const foundInText = extractVinOrPlateFromText(val);
      const byVin = looksVin(val) || (foundInText?.type === 'vin');
      const byPlate = looksFrPlate(val) || (foundInText?.type === 'plate');

      // Si aucun motif VIN/plaque détecté, ignorer même si la clé semble pertinente
      if (!byVin && !byPlate) {
        continue;
      }

      // Scoring: clé exacte + contenu trouvé > clé indicative + contenu > détection brute
      let score = -1;
      if (byExactKey && (byVin || byPlate)) score = 110;
      else if (byExactKey) score = 100;
      else if (byKeyInclude && (byVin || byPlate)) score = 90;
      else if (byKeyInclude) score = 80;
      if (byVin) score = Math.max(score, 78);
      if (byPlate) score = Math.max(score, 68);
      if (score < 0) continue; // rien d'assez fiable

      // Préférence: si clé parle de vin/plaque mais valeur trop longue, on filtre
      if ((byExactKey || byKeyInclude) && val.length > 64) continue;

      let chosen = val;
      if (foundInText && foundInText.value) chosen = foundInText.value; // extraire proprement "VIN: XXXXX"
      if (score > bestScore) {
        bestScore = score;
        best = { key: rawKey || 'vin_or_plaque', id: m.id != null ? String(m.id) : undefined, value: chosen };
      }
    }
    return best;
  } catch { return null; }
}

// Chercher VIN/plaques dans les meta des lignes d'articles
function extractVinFromWooLineItems(lineItems) {
  try {
    if (!Array.isArray(lineItems)) return null;
    for (const li of lineItems) {
      const metas = Array.isArray(li?.meta_data) ? li.meta_data : [];
      const found = extractVinFromWooMeta(metas);
      if (found && found.value) return found;
      // Essayer aussi dans le nom de la ligne
      const fromName = extractVinOrPlateFromText(li?.name || '');
      if (fromName) return { key: 'line_item_name', value: fromName.value };
    }
    return null;
  } catch { return null; }
}

// Orchestrateur: extrait depuis order.meta_data, lignes et customer_note
function extractVinFromWooOrder(payload) {
  try {
    // 1) meta_data de la commande
    const a = extractVinFromWooMeta(payload?.meta_data);
    if (a && a.value) return a;
    // 2) meta_data des lignes (ou nom)
    const b = extractVinFromWooLineItems(payload?.line_items);
    if (b && b.value) return b;
    // 3) note client
    const c0 = extractVinOrPlateFromText(payload?.customer_note || '');
    if (c0 && c0.value) return { key: 'customer_note', value: c0.value };
    // 4) à défaut, tenter certains champs texte
    const d0 = extractVinOrPlateFromText(payload?.billing?.company || '');
    if (d0 && d0.value) return { key: 'billing.company', value: d0.value };
    const d1 = extractVinOrPlateFromText(payload?.shipping?.company || '');
    if (d1 && d1.value) return { key: 'shipping.company', value: d1.value };
    return null;
  } catch { return null; }
}
// Mise à jour d'une commande (et sync Woo si provider=woocommerce)
app.put('/api/admin/orders/:id', adminAuthMW, async (req, res) => {
  const body = req.body || {};

  const applyUpdate = async (order) => {
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const eventLog = Array.isArray(order.events) ? [...order.events] : [];
    const allowedStatuses = Order?.schema?.path('status')?.enumValues || [];

    // Customer
    if (body.customer && typeof body.customer === 'object') {
      order.customer = order.customer || {};
      if (typeof body.customer.name === 'string') order.customer.name = body.customer.name;
      if (typeof body.customer.email === 'string') order.customer.email = body.customer.email;
      if (typeof body.customer.phone === 'string') order.customer.phone = body.customer.phone;
    }

    // Billing address
    if (body.billing && typeof body.billing === 'object' && body.billing.address) {
      order.billing = order.billing || {};
      order.billing.address = body.billing.address;
    }

    // Shipping address
    if (body.shipping && typeof body.shipping === 'object' && body.shipping.address) {
      order.shipping = order.shipping || {};
      order.shipping.address = body.shipping.address;
    }

    // Estimated delivery date (optionnelle)
    if (body.shipping && typeof body.shipping === 'object' && 'estimatedDeliveryAt' in body.shipping) {
      order.shipping = order.shipping || {};
      const raw = body.shipping.estimatedDeliveryAt;
      if (typeof raw === 'string') {
        const s = raw.trim();
        if (s) {
          // Accepte 'YYYY-MM-DD' ou ISO
          const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
          const d = new Date(iso);
          if (!isNaN(d.getTime())) {
            order.shipping.estimatedDeliveryAt = d;
            eventLog.push({ type: 'estimated_delivery_set', message: `Livraison estimée: ${d.toISOString().slice(0,10)}`, at: new Date() });
          }
        } else {
          // Vide => suppression
          order.shipping.estimatedDeliveryAt = undefined;
          eventLog.push({ type: 'estimated_delivery_unset', message: 'Livraison estimée retirée', at: new Date() });
        }
      }
    }

    // VIN / Plaque (métadonnée interne et Woo)
    let vinFromBody;
    if (body.meta && typeof body.meta === 'object' && typeof body.meta.vinOrPlate === 'string') {
      vinFromBody = body.meta.vinOrPlate.trim();
      order.meta = order.meta || {};
      order.meta.vinOrPlate = vinFromBody;
    }

    // Références techniques (mécatronique/TCU)
    if (body.meta && typeof body.meta === 'object') {
      order.meta = order.meta || {};
      if (typeof body.meta.engineDisplacement === 'string') {
        const prev = order.meta.engineDisplacement || '';
        const nextVal = body.meta.engineDisplacement.trim();
        order.meta.engineDisplacement = nextVal;
        if (nextVal !== prev) eventLog.push({ type: 'technical_ref_updated', message: `Cylindrée: ${nextVal || '—'}`, at: new Date() });
      }
      if (typeof body.meta.tcuReference === 'string') {
        const prev = order.meta.tcuReference || '';
        const nextVal = body.meta.tcuReference.trim().toUpperCase();
        order.meta.tcuReference = nextVal;
        if (nextVal !== prev) eventLog.push({ type: 'technical_ref_updated', message: `TCU: ${nextVal || '—'}`, at: new Date() });
      }
      if (typeof body.meta.technicalRefRequired === 'boolean') {
        const prev = !!order.meta.technicalRefRequired;
        const nextVal = !!body.meta.technicalRefRequired;
        order.meta.technicalRefRequired = nextVal;
        if (nextVal !== prev) eventLog.push({ type: 'technical_ref_required_set', message: nextVal ? 'Référence technique requise' : 'Référence technique non requise', at: new Date() });
      }
    }

    // Préparer push Woo si applicable
    if (order.provider === 'woocommerce' && order.providerOrderId) {
      const billingAddr = body.billing?.address || order.billing?.address || {};
      const shippingAddr = body.shipping?.address || order.shipping?.address || {};
      const nameForBilling = (body.customer?.name) || billingAddr.name || order.customer?.name || '';
      const splitBill = splitName(nameForBilling);
      const wooPayload = {
        billing: {
          first_name: splitBill.first_name,
          last_name: splitBill.last_name,
          company: billingAddr.company || '',
          address_1: billingAddr.address1 || '',
          address_2: billingAddr.address2 || '',
          city: billingAddr.city || '',
          postcode: billingAddr.postcode || '',
          country: billingAddr.country || '',
          email: (body.customer?.email) || order.customer?.email || '',
          phone: (body.customer?.phone) || order.customer?.phone || ''
        },
        shipping: {
          first_name: (shippingAddr.name ? splitName(shippingAddr.name).first_name : splitBill.first_name),
          last_name: (shippingAddr.name ? splitName(shippingAddr.name).last_name : splitBill.last_name),
          company: shippingAddr.company || '',
          address_1: shippingAddr.address1 || '',
          address_2: shippingAddr.address2 || '',
          city: shippingAddr.city || '',
          postcode: shippingAddr.postcode || '',
          country: shippingAddr.country || ''
        }
      };

      // Inclure meta_data si vin/plaque fourni
      if (typeof vinFromBody === 'string') {
        const metaArr = [];
        const keyToUse = (order.meta?.wooVinMetaKey) || 'vin_or_plaque';
        const idToUse = order.meta?.wooVinMetaId ? Number(order.meta.wooVinMetaId) : undefined;
        const metaEntry = { key: keyToUse, value: vinFromBody };
        if (!Number.isNaN(idToUse) && idToUse) metaEntry.id = idToUse;
        metaArr.push(metaEntry);
        wooPayload.meta_data = metaArr;
      }

      const wooResp = await wooUpdateOrder(order.providerOrderId, wooPayload);
      try {
        const wooCreated = wooResp.date_created_gmt || wooResp.date_created || null;
        const wooUpdated = wooResp.date_modified_gmt || wooResp.date_modified || null;
        order.meta = order.meta || {};
        if (wooCreated) order.meta.sourceCreatedAt = new Date(wooCreated);
        if (wooUpdated) order.meta.sourceUpdatedAt = new Date(wooUpdated);
        const metaFromResp = extractVinFromWooOrder(wooResp);
        if (metaFromResp && metaFromResp.value) {
          order.meta.vinOrPlate = metaFromResp.value;
          order.meta.wooVinMetaKey = metaFromResp.key || order.meta.wooVinMetaKey || 'vin_or_plaque';
          if (metaFromResp.id) order.meta.wooVinMetaId = metaFromResp.id;
        }
      } catch {}
      eventLog.push({ type: 'woo_update_pushed', message: 'Mise à jour envoyée à Woo', payloadSnippet: { id: order.providerOrderId } });
    }

    if (typeof body.status === 'string') {
      const nextRaw = body.status.trim().toLowerCase();
      if (nextRaw && allowedStatuses.includes(nextRaw)) {
        if (order.status !== nextRaw) {
          eventLog.push({ type: 'status_changed', message: `Statut: ${order.status || '—'} → ${nextRaw}`, at: new Date() });
          order.status = nextRaw;
        }
      } else if (nextRaw) {
        throw new Error(`Statut invalide: ${nextRaw}`);
      }
    }

    eventLog.push({ type: 'order_updated_admin', message: 'Commande modifiée par admin' });
    order.events = eventLog;
    await order.save();
    return order;
  };

  try {
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        order = await applyUpdate(order);
        return res.json({ success: true, order });
      } catch (err) {
        if (err instanceof mongoose.Error.VersionError) {
          console.warn(`[orders:update] conflit de version sur ${req.params.id}, tentative ${attempt + 1}`);
          order = await Order.findById(req.params.id);
          if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
          continue;
        }
        throw err;
      }
    }

    return res.status(409).json({ success: false, message: 'Conflit de mise à jour, réessayez.' });
  } catch (e) {
    if (e.message === 'ORDER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    console.error('[orders:update] erreur', e);
    return res.status(500).json({ success: false, message: e.message || 'Erreur serveur' });
  }
});

// --- Job de secours: resynchronisation périodique des commandes (Woo & Mollie) ---
function base64(str) { return Buffer.from(str, 'utf8').toString('base64'); }

async function syncWooRecentOrders() {
  try {
    const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
    const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
    const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
    if (!base || !ck || !cs) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?after=${encodeURIComponent(since)}&per_page=20&orderby=date&order=desc`;
    const headers2 = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
    let resp = await fetch(url, { headers: headers2 });
    if (!resp.ok) {
      const url2 = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&after=${encodeURIComponent(since)}&per_page=20&orderby=date&order=desc`;
      resp = await fetch(url2, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      if (!resp.ok) {
        await new Promise(r => setTimeout(r, 1000));
        resp = await fetch(url2, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      }
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('[orders-sync] Woo HTTP', resp.status, txt);
      return;
    }
    const list = await resp.json().catch(() => []);
    if (!Array.isArray(list) || list.length === 0) return;
    for (const payload of list) {
      const wooId = String(payload.id || payload.resource_id || '').trim();
      if (!wooId) continue;
      const internalStatus = mapWooStatusToInternal(payload.status);
      const amount = parseFloat((payload.total || payload.total_due || '0').toString());
      const currency = (payload.currency || 'EUR').toString();
      const shippingLines2 = Array.isArray(payload.shipping_lines) ? payload.shipping_lines : [];
      const shippingLinesTotal2 = shippingLines2.reduce((acc, sl) => acc + (parseFloat((sl.total || 0).toString()) || 0), 0);
      const itemsForTax2 = Array.isArray(payload.line_items) ? payload.line_items : [];
      const itemsTaxSum2 = itemsForTax2.reduce((acc, li) => acc + (parseFloat((li.total_tax || 0).toString()) || 0), 0);
      const shippingTaxSum2 = shippingLines2.reduce((acc, sl) => acc + (parseFloat((sl.total_tax || 0).toString()) || 0), 0);
      const taxTotal2 = (() => {
        const t = parseFloat((payload.total_tax || payload.cart_tax || 0).toString()) || 0;
        return t || (itemsTaxSum2 + shippingTaxSum2);
      })();
      const shippingTotal2 = (() => {
        const v = parseFloat((payload.shipping_total || 0).toString()) || 0;
        return v || shippingLinesTotal2;
      })();
      const wooCreatedRaw = payload.date_created_gmt || payload.date_created || null;
      const wooUpdatedRaw = payload.date_modified_gmt || payload.date_modified || null;
      const wooCreated = wooCreatedRaw ? new Date(wooCreatedRaw) : null;
      const wooUpdated = wooUpdatedRaw ? new Date(wooUpdatedRaw) : null;
      const customer = payload.billing ? {
        name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
        email: payload.billing.email || '',
        phone: payload.billing.phone || ''
      } : { name: '', email: '', phone: '' };
      let items = Array.isArray(payload.line_items) ? payload.line_items.map(li => {
        const meta = Array.isArray(li.meta_data) ? li.meta_data : [];
        const attrs = meta
          .filter(m => m && typeof m.key === 'string' && typeof m.value !== 'undefined')
          .filter(m => !/^_/.test(m.key) || /^(pa_|attribute_|variation|variante|option|reference|référence|ref|tcu)/i.test(m.key))
          .map(m => {
            const raw = m.value;
            let val;
            if (raw && typeof raw === 'object') {
              val = raw.value || raw.label || raw.name || raw.display_value || JSON.stringify(raw);
            } else {
              val = raw;
            }
            const k = (m.display_key && typeof m.display_key === 'string') ? m.display_key : m.key;
            return { key: String(k), value: String(val) };
          });
        return {
          sku: li.sku || '',
          name: li.name || '',
          qty: li.quantity || 0,
          unitPrice: parseFloat((li.price || li.total || 0).toString()),
          options: attrs
        };
      }) : [];
      if (items.length && items.every(it => !Array.isArray(it.options) || it.options.length === 0)) {
        try {
          const full2 = await fetchWooOrderDetail(base, ck, cs, wooId);
          const di2 = Array.isArray(full2?.line_items) ? full2.line_items : [];
          if (di2.length) {
            items = di2.map(li => {
              const meta = Array.isArray(li.meta_data) ? li.meta_data : [];
              const attrs = meta
                .filter(m => m && typeof m.key === 'string' && typeof m.value !== 'undefined')
                .filter(m => !/^_/.test(m.key) || /^(pa_|attribute_|variation|variante|option|reference|référence|ref|tcu)/i.test(m.key))
                .map(m => {
                  const raw = m.value;
                  let val;
                  if (raw && typeof raw === 'object') {
                    val = raw.value || raw.label || raw.name || raw.display_value || JSON.stringify(raw);
                  } else {
                    val = raw;
                  }
                  const k = (m.display_key && typeof m.display_key === 'string') ? m.display_key : m.key;
                  return { key: String(k), value: String(val) };
                });
              return {
                sku: li.sku || '',
                name: li.name || '',
                qty: li.quantity || 0,
                unitPrice: parseFloat((li.price || li.total || 0).toString()),
                options: attrs
              };
            });
          }
        } catch(_) {}
      }
      const billingAddress2 = payload.billing ? {
        name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
        company: payload.billing.company || '',
        address1: payload.billing.address_1 || '',
        address2: payload.billing.address_2 || '',
        city: payload.billing.city || '',
        postcode: payload.billing.postcode || '',
        country: payload.billing.country || '',
        email: payload.billing.email || '',
        phone: payload.billing.phone || ''
      } : null;
      const shippingAddress2 = payload.shipping ? {
        name: `${payload.shipping.first_name || ''} ${payload.shipping.last_name || ''}`.trim(),
        company: payload.shipping.company || '',
        address1: payload.shipping.address_1 || '',
        address2: payload.shipping.address_2 || '',
        city: payload.shipping.city || '',
        postcode: payload.shipping.postcode || '',
        country: payload.shipping.country || '',
        phone: payload.shipping.phone || (payload.billing?.phone || '')
      } : null;
      // Expédition (méthode, transporteur, suivi si présent dans meta)
      const shipLine2 = Array.isArray(payload.shipping_lines) && payload.shipping_lines.length ? payload.shipping_lines[0] : null;
      const shippingMethod2 = shipLine2?.method_title || shipLine2?.method_id || '';
      const shippingMeta2 = Array.isArray(shipLine2?.meta_data) ? shipLine2.meta_data : [];
      const trackingMeta2 = (Array.isArray(payload.meta_data) ? payload.meta_data : []).concat(shippingMeta2);
      const metaGet2 = (key) => {
        const m = trackingMeta2.find(m => (m?.key || '').toLowerCase().includes(String(key).toLowerCase()));
        return m ? (m.value || '') : '';
      };
      const trackingNumber2 = metaGet2('tracking');
      const carrier2 = metaGet2('carrier') || metaGet2('shipping_provider') || '';
      let statusToSet2 = internalStatus;
      if (trackingNumber2 && !['delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded','failed'].includes(internalStatus)) {
        statusToSet2 = 'fulfilled';
      }
      // Ne jamais écraser un statut final déjà présent en base
      const finals2 = ['delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded','failed'];
      let existingOrder2 = null;
      try { existingOrder2 = await Order.findOne({ provider: 'woocommerce', providerOrderId: wooId }, { status: 1, 'meta.vinOrPlate': 1 }).lean(); } catch(_) {}
      if (existingOrder2 && finals2.includes(existingOrder2.status)) {
        statusToSet2 = existingOrder2.status;
      }

      const update = {
        provider: 'woocommerce',
        providerOrderId: wooId,
        number: payload.number ? String(payload.number) : undefined,
        status: statusToSet2,
        customer,
        totals: { currency, amount: isNaN(amount) ? 0 : amount, tax: taxTotal2, shipping: shippingTotal2 },
        items,
        ...(wooCreated ? { 'meta.sourceCreatedAt': wooCreated } : {}),
        ...(wooUpdated ? { 'meta.sourceUpdatedAt': wooUpdated } : {}),
        ...(billingAddress2 ? { 'billing.address': billingAddress2 } : {}),
        ...(shippingAddress2 ? { 'shipping.address': shippingAddress2 } : {}),
        ...(shippingMethod2 ? { 'shipping.method': shippingMethod2 } : {}),
        ...(carrier2 ? { 'shipping.carrier': carrier2 } : {}),
        ...(trackingNumber2 ? { 'shipping.trackingNumber': trackingNumber2, 'shipping.shippedAt': new Date() } : {})
      };
      const productType2 = detectProductTypeFromItems(items);
      update['meta.productType'] = productType2;
      // VIN/Plaque depuis meta_data / lignes / note client
      let vinMeta2 = null;
      try { vinMeta2 = extractVinFromWooOrder(payload); } catch {}
      if (!vinMeta2 || !vinMeta2.value) {
        try {
          const detail2 = await fetchWooOrderDetail(base, ck, cs, wooId);
          const v3 = extractVinFromWooOrder(detail2);
          if (v3 && v3.value) vinMeta2 = v3;
        } catch { /* ignore */ }
      }
      if (vinMeta2 && vinMeta2.value) {
        const hasManualVin2 = !!(existingOrder2 && existingOrder2.meta && existingOrder2.meta.vinOrPlate && String(existingOrder2.meta.vinOrPlate).trim());
        if (!hasManualVin2) {
          update['meta.vinOrPlate'] = vinMeta2.value;
          if (vinMeta2.key) update['meta.wooVinMetaKey'] = vinMeta2.key;
          if (vinMeta2.id) update['meta.wooVinMetaId'] = String(vinMeta2.id);
        }
      }
      const setOnInsert = wooCreated ? { createdAt: wooCreated } : {};
      try {
        const autoFlag = detectTechRefFromItems(items);
        if (autoFlag) setOnInsert['meta.technicalRefRequired'] = true;
      } catch {}
      const ops2 = { $set: update, $setOnInsert: setOnInsert, $push: { events: { $each: [ { type: 'woo_sync', message: `Sync Woo status=${payload.status}`, payloadSnippet: { id: wooId, status: payload.status }, at: new Date() } ] } } };
      await Order.updateOne(
        { provider: 'woocommerce', providerOrderId: wooId },
        ops2,
        { upsert: true }
      );
    }
    console.log(`[orders-sync] Woo: ${list.length} commande(s) synchronisées`);
  } catch (e) {
    console.error('[orders-sync] Woo erreur', e && e.message ? e.message : e);
  }
}

async function syncMollieRecentPayments() {
  try {
    const key = (process.env.MOLLIE_API_KEY || '').trim();
    if (!key) return;
    const resp = await fetch('https://api.mollie.com/v2/payments?limit=50', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('[orders-sync] Mollie HTTP', resp.status, txt);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const list = Array.isArray(data._embedded?.payments) ? data._embedded.payments : [];
    if (list.length === 0) return;
    for (const p of list) {
      if (!p || !p.id) continue;
      let order = await Order.findOne({ 'payment.molliePaymentId': p.id });
      const amountValue = parseFloat(p.amount?.value || '0');
      if (!order) {
        order = new Order({
          provider: 'mollie',
          status: mapMollieStatusToInternal(p.status),
          totals: { currency: p.amount?.currency || 'EUR', amount: isNaN(amountValue) ? 0 : amountValue },
          payment: {
            method: `mollie:${p.method || 'link'}`,
            molliePaymentId: p.id,
            mollieMode: p.mode,
            mollieStatus: p.status,
            paidAt: p.paidAt ? new Date(p.paidAt) : undefined
          },
          customer: {
            name: p.consumerName || '',
            email: (p.billingEmail || p.email) || ''
          },
          events: [{ type: 'mollie_sync_create', message: 'Commande créée par sync Mollie', payloadSnippet: { id: p.id, status: p.status } }]
        });
        await order.save();
      } else {
        order.payment = order.payment || {};
        order.payment.method = `mollie:${p.method || 'link'}`;
        order.payment.molliePaymentId = p.id;
        order.payment.mollieMode = p.mode;
        order.payment.mollieStatus = p.status;
        if (p.paidAt) order.payment.paidAt = new Date(p.paidAt);
        order.status = mapMollieStatusToInternal(p.status);
        order.events = order.events || [];
        order.events.push({ type: 'mollie_sync_update', message: 'Mise à jour par sync Mollie', payloadSnippet: { id: p.id, status: p.status } });
        await order.save();
      }
    }
    console.log(`[orders-sync] Mollie: ${list.length} paiement(s) synchronisés`);
  } catch (e) {
    console.error('[orders-sync] Mollie erreur', e && e.message ? e.message : e);
  }
}

async function runOrdersSync() {
  // Désactivé : synchronisation Mollie
  await syncWooRecentOrders();
}

if (ORDERS_SYNC_ENABLED) {
  // Lancer au démarrage (après connexion DB) et ensuite périodiquement
  mongoose.connection.once('open', () => {
    setTimeout(() => { try { runOrdersSync(); } catch(_) {} }, 2000);
  });
  setInterval(() => { try { runOrdersSync(); } catch(_) {} }, Math.max(1, ORDERS_SYNC_INTERVAL_MINUTES) * 60 * 1000);
  console.log(`[orders-sync] Activé (intervalle: ${ORDERS_SYNC_INTERVAL_MINUTES} min)`);
}

// Renseigner l'expédition et marquer comme expédiée (déplacée plus bas après authenticateAdmin)
// app.post('/api/admin/orders/:id/ship', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);
//     if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
//     const { carrier, trackingNumber, address } = req.body || {};
//     order.shipping = order.shipping || {};
//     if (address && typeof address === 'object') order.shipping.address = address;
//     if (carrier) order.shipping.carrier = String(carrier);
//     if (trackingNumber) order.shipping.trackingNumber = String(trackingNumber);
//     order.shipping.shippedAt = new Date();
//     order.status = 'fulfilled';
//     order.events = order.events || [];
//     order.events.push({ type: 'order_shipped', message: 'Commande expédiée', payloadSnippet: { carrier: order.shipping.carrier, trackingNumber: order.shipping.trackingNumber } });
//     await order.save();
//     res.json({ success: true, order });
//   } catch (e) {
//     console.error('[orders:ship] erreur', e);
//     res.status(500).json({ success: false, message: 'Erreur serveur' });
//   }
// });

// Limite de taille de fichier configurable (par défaut 25MB)
const MAX_FILE_SIZE_MB = parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '25', 10);

const upload = multer({ 
  storage: S3_ENABLED ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }, // Limite en MB
  fileFilter: (req, file, cb) => {
    // Vérifier les types de fichiers autorisés
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|mp4|avi|mov|wmv|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls les images, vidéos (MP4, AVI, MOV), PDF, documents Office et archives sont acceptés.'));
    }
  }
});

// En mode S3/R2, exposer une route /uploads/:key qui streame depuis le bucket
if (S3_ENABLED) {
  app.get('/uploads/:key', async (req, res) => {
    try {
      const key = String(req.params.key || '').trim();
      if (!key) return res.status(400).send('Clé manquante');
      await streamToResponse(res, key);
    } catch (e) {
      console.error('[uploads] Erreur de lecture depuis R2:', e && e.message ? e.message : e);
      return res.status(404).send('Fichier non trouvé');
    }
  });
}

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../')));
// On sert /uploads depuis plusieurs emplacements, dans l'ordre, pour couvrir les anciens et nouveaux chemins
for (const d of altUploadDirs) {
  app.use('/uploads', express.static(d, { fallthrough: true }));
}
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/tracking', express.static(path.join(__dirname, '../tracking')));
// Nouvelle page publique de suivi commande (distincte de la page SAV existante)
app.use('/order-tracking', express.static(path.join(__dirname, '../order-tracking')));

// --- routes publiques avis clients ---
// Lien Oui: redirige vers Trustpilot, sauf si le jeton a été verrouillé par un clic "Non"
app.get('/r/yes/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.redirect('/reviews/lien-invalide/');
    const inv = await ReviewInvite.findOne({ token }).lean();
    if (!inv) return res.redirect('/reviews/lien-invalide/');
    if (inv.revoked) {
      return res.redirect('/reviews/lien-invalide/');
    }
    if (inv.lockedByNo || inv.decision === 'no') {
      return res.redirect('/reviews/merci-interne/');
    }
    // Marquer la décision "yes" si non déjà fait
    if (!inv.clickedYesAt || inv.decision !== 'yes') {
      await ReviewInvite.updateOne({ _id: inv._id }, { $set: { decision: 'yes', clickedYesAt: new Date() } });
    }
    const dest = TRUSTPILOT_URL.startsWith('http') ? TRUSTPILOT_URL : `https://${TRUSTPILOT_URL}`;
    return res.redirect(dest);
  } catch (e) {
    console.error('[reviews] yes redirect error:', e);
    return res.redirect('/reviews/lien-invalide/');
  }
});

// Lien Non: verrouille le jeton et redirige vers la page de feedback interne
app.get('/r/no/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.redirect('/reviews/lien-invalide/');
    const inv = await ReviewInvite.findOne({ token }).lean();
    if (!inv) return res.redirect('/reviews/lien-invalide/');
    if (inv.revoked) return res.redirect('/reviews/lien-invalide/');
    await ReviewInvite.updateOne({ _id: inv._id }, { $set: { decision: 'no', lockedByNo: true, clickedNoAt: new Date() } });
    return res.redirect(`/reviews/feedback/?t=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error('[reviews] no redirect error:', e);
    return res.redirect('/reviews/lien-invalide/');
  }
});

app.get('/r/rate/:token/:rating', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const rating = parseInt(String(req.params.rating || '').trim(), 10);
    if (!token || !(rating >= 1 && rating <= 5)) return res.redirect('/reviews/lien-invalide/');
    const inv = await ReviewInvite.findOne({ token }).lean();
    if (!inv) return res.redirect('/reviews/lien-invalide/');
    if (inv.revoked) return res.redirect('/reviews/lien-invalide/');

    if (rating <= 2) {
      await ReviewInvite.updateOne(
        { _id: inv._id },
        { $set: { decision: 'no', lockedByNo: true, clickedNoAt: inv.clickedNoAt ? inv.clickedNoAt : new Date() } }
      );
      return res.redirect(`/reviews/feedback/?t=${encodeURIComponent(token)}`);
    }

    if (inv.lockedByNo || inv.decision === 'no') {
      return res.redirect('/reviews/merci-interne/');
    }

    if (!inv.clickedYesAt || inv.decision !== 'yes') {
      await ReviewInvite.updateOne({ _id: inv._id }, { $set: { decision: 'yes', clickedYesAt: new Date() } });
    }
    const dest = TRUSTPILOT_URL.startsWith('http') ? TRUSTPILOT_URL : `https://${TRUSTPILOT_URL}`;
    return res.redirect(dest);
  } catch (e) {
    console.error('[reviews] rate redirect error:', e);
    return res.redirect('/reviews/lien-invalide/');
  }
});
// Réception du feedback négatif (raison + détail)
app.post('/api/reviews/feedback/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const body = req.body || {};
    const feedbackReason = String(body.reason || body.feedbackReason || '').slice(0, 200);
    const feedbackDetails = String(body.details || body.feedbackDetails || '').slice(0, 5000);
    const inv = await ReviewInvite.findOne({ token });
    if (!inv) return res.status(404).json({ success: false, message: 'Lien invalide ou expiré' });
    inv.decision = 'no';
    inv.lockedByNo = true;
    inv.feedbackReason = feedbackReason;
    inv.feedbackDetails = feedbackDetails;
    inv.feedbackSubmittedAt = new Date();
    await inv.save();
    try {
      await sendNegativeReviewFeedback({ email: inv.email || '', orderNumber: inv.orderNumber || '', token, feedbackReason, feedbackDetails });
    } catch (e) {
      console.warn('[reviews] email feedback negative failed (non bloquant):', e && e.message ? e.message : e);
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('[reviews] feedback submit error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Création d'une invitation (admin) pour générer des liens Oui/Non (+ option envoi email)
app.post('/api/admin/reviews/invites', adminAuthMW, async (req, res) => {
  try {
    const b = req.body || {};
    const email = b.email ? String(b.email).toLowerCase().trim() : '';
    const orderNumber = b.orderNumber ? String(b.orderNumber).trim() : '';
    const token = crypto.randomBytes(24).toString('hex');
    const doc = await new ReviewInvite({ token, email, orderNumber }).save();
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const yesLink = `${base}/r/yes/${token}`;
    const noLink = `${base}/r/no/${token}`;

    if (b.sendEmail === true || String(b.sendEmail).toLowerCase() === 'true') {
      const toEmail = b.toEmail ? String(b.toEmail).trim() : email;
      if (toEmail) {
        try { await sendReviewInviteEmail({ toEmail, yesLink, noLink }); } catch (e) { console.warn('[reviews] send invite email failed:', e && e.message ? e.message : e); }
      }
    }

    res.json({ success: true, invite: { id: doc._id.toString(), token, email, orderNumber, yesLink, noLink } });
  } catch (e) {
    console.error('[reviews] create invite error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Création en lot d'invitations (à partir d'une sélection de commandes) + option envoi d'email
app.post('/api/admin/reviews/invites/bulk', adminAuthMW, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
    const sendEmail = (req.body?.sendEmail === true) || (String(req.body?.sendEmail).toLowerCase() === 'true');
    if (!ids.length) return res.status(400).json({ success: false, message: 'orderIds requis' });
    const limit = Math.min(ids.length, 50); // sécurité: limiter par requête
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const results = [];
    for (const id of ids.slice(0, limit)) {
      try {
        const order = await Order.findById(id).lean();
        if (!order) { results.push({ id, ok: false, error: 'order_not_found' }); continue; }
        const email = (order.customer && order.customer.email) ? String(order.customer.email).trim() : '';
        const orderNumber = order.number ? String(order.number).trim() : '';
        const token = crypto.randomBytes(24).toString('hex');
        await new ReviewInvite({ token, email, orderNumber }).save();
        const yesLink = `${base}/r/yes/${token}`;
        const noLink = `${base}/r/no/${token}`;
        if (sendEmail && email) {
          try { await sendReviewInviteEmail({ toEmail: email, yesLink, noLink }); } catch (e) { console.warn('[reviews] bulk send failed (non bloquant):', e && e.message ? e.message : e); }
        }
        results.push({ id, ok: true, email, orderNumber, yesLink, noLink });
      } catch (e) {
        results.push({ id, ok: false, error: e && e.message ? e.message : String(e) });
      }
    }
    return res.json({ success: true, total: ids.length, processed: results.length, created: results.filter(r => r.ok).length, results });
  } catch (e) {
    console.error('[reviews] bulk invites error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Historique invitations (admin) — top-level pour éviter tout 404 si dupliqué ailleurs ---
app.get('/api/admin/reviews/invites', adminAuthMW, async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    const sortKey = String(req.query.sort || 'createdAt');
    const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10) || 20, 1), 200);

    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [ { email: re }, { orderNumber: re }, { token: re } ];
    }

    const total = await ReviewInvite.countDocuments(filter);
    const list = await ReviewInvite.find(filter)
      .sort({ [sortKey]: dir, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const rows = list.map(inv => ({
      ...inv,
      yesLink: `${base}/r/yes/${inv.token}`,
      noLink: `${base}/r/no/${inv.token}`
    }));

    res.json({ success: true, total, page, pageSize, invites: rows });
  } catch (e) {
    console.error('[reviews] list invites error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.get('/api/admin/reviews/invites/export.csv', adminAuthMW, async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    const sortKey = String(req.query.sort || 'createdAt');
    const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [ { email: re }, { orderNumber: re }, { token: re } ];
    }
    const list = await ReviewInvite.find(filter).sort({ [sortKey]: dir, _id: -1 }).lean();
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const lines = [];
    lines.push(['createdAt','email','orderNumber','token','yesLink','noLink','decision','clickedYesAt','clickedNoAt','lockedByNo','revoked','revokedAt','feedbackReason'].join(','));
    for (const inv of list) {
      const yesLink = `${base}/r/yes/${inv.token}`;
      const noLink = `${base}/r/no/${inv.token}`;
      const cells = [
        inv.createdAt ? new Date(inv.createdAt).toISOString() : '',
        inv.email || '',
        inv.orderNumber || '',
        inv.token || '',
        yesLink,
        noLink,
        inv.decision || '',
        inv.clickedYesAt ? new Date(inv.clickedYesAt).toISOString() : '',
        inv.clickedNoAt ? new Date(inv.clickedNoAt).toISOString() : '',
        inv.lockedByNo ? 'true' : 'false',
        inv.revoked ? 'true' : 'false',
        inv.revokedAt ? new Date(inv.revokedAt).toISOString() : '',
        (inv.feedbackReason || '').replace(/[\r\n,]/g, ' ')
      ];
      lines.push(cells.map(v => typeof v === 'string' && v.includes(',') ? '"' + v.replace(/"/g, '""') + '"' : v).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="review-invites.csv"');
    res.send(csv);
  } catch (e) {
    console.error('[reviews] export csv error:', e);
    res.status(500).send('Erreur serveur');
  }
});

app.post('/api/admin/reviews/invites/:id/resend', adminAuthMW, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const inv = await ReviewInvite.findById(id).lean();
    if (!inv) return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    if (inv.revoked) return res.status(400).json({ success: false, message: 'Invitation révoquée' });
    const base = (WEBSITE_URL || '').replace(/\/$/, '');
    const yesLink = `${base}/r/yes/${inv.token}`;
    const noLink = `${base}/r/no/${inv.token}`;
    const toEmail = String(req.body?.toEmail || inv.email || '').trim();
    if (!toEmail) return res.status(400).json({ success: false, message: 'Email destinataire requis' });
    try { await sendReviewInviteEmail({ toEmail, yesLink, noLink }); } catch (e) { console.warn('[reviews] resend email failed:', e?.message || e); }
    res.json({ success: true });
  } catch (e) {
    console.error('[reviews] resend error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.post('/api/admin/reviews/invites/:id/revoke', adminAuthMW, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const inv = await ReviewInvite.findById(id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    if (inv.revoked) return res.json({ success: true });
    inv.revoked = true;
    inv.revokedAt = new Date();
    await inv.save();
    res.json({ success: true });
  } catch (e) {
    console.error('[reviews] revoke error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
app.get('/api/track/order', async (req, res) => {
  try {
    const orderNumber = String(req.query.orderNumber || '').trim();
    const trackingNumber = String(req.query.trackingNumber || '').trim();

    if (!orderNumber && !trackingNumber) {
      return res.status(400).json({ success: false, message: 'Merci de fournir un numéro de commande ou un numéro de suivi.' });
    }

    const filter = {};
    if (orderNumber) filter.number = orderNumber;
    if (trackingNumber) filter['shipping.trackingNumber'] = trackingNumber;

    const order = await Order.findOne(filter).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable. Vérifiez les informations fournies.' });
    }

    // Si la recherche se fait uniquement via le numéro de commande mais qu'un numéro de suivi existe, vérifier la cohérence
    if (orderNumber && trackingNumber && order?.shipping?.trackingNumber && order.shipping.trackingNumber !== trackingNumber) {
      return res.status(400).json({ success: false, message: 'Le numéro de suivi ne correspond pas à cette commande.' });
    }

    const updates = Array.isArray(order.events)
      ? order.events
          .map(ev => ({
            at: ev.at ? new Date(ev.at) : null,
            type: ev.type || '',
            message: ev.message || '',
            payloadSnippet: ev.payloadSnippet || {}
          }))
          .sort((a, b) => {
            const aTime = a.at ? a.at.getTime() : 0;
            const bTime = b.at ? b.at.getTime() : 0;
            return aTime - bTime;
          })
      : [];

    // Ne garder que les événements pertinents pour le suivi colis
    const ALLOWED_EVENT_TYPES = new Set([
      'order_shipped',            // expédition avec transporteur + tracking
      'estimated_delivery_set'    // date de livraison estimée
      // 'tracking_added', 'tracking_updated' // (si ajoutés à l'avenir)
    ]);
    const filteredUpdates = updates.filter(ev => ALLOWED_EVENT_TYPES.has(String(ev.type || '').toLowerCase()));

    res.json({
      success: true,
      order: {
        number: order.number || '',
        provider: order.provider || 'manual',
        status: order.status || 'processing',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        customer: {
          name: order?.customer?.name || '',
          email: order?.customer?.email || '',
          phone: order?.customer?.phone || ''
        },
        shipping: {
          carrier: order?.shipping?.carrier || '',
          trackingNumber: order?.shipping?.trackingNumber || '',
          shippedAt: order?.shipping?.shippedAt || null,
          estimatedDeliveryAt: order?.shipping?.estimatedDeliveryAt || null,
          address: order?.shipping?.address || {}
        },
        items: Array.isArray(order.items) ? order.items.map(item => ({
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice
        })) : []
      },
      events: filteredUpdates.map(ev => ({
        at: ev.at ? ev.at.toISOString() : null,
        type: ev.type,
        message: ev.message,
        payload: ev.payloadSnippet || {}
      }))
    });
  } catch (e) {
    console.error('[public-track] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur interne, veuillez réessayer plus tard.' });
  }
});

app.post('/api/track/order/contact', async (req, res) => {
  try {
    const body = req.body || {};
    const orderNumber = String(body.orderNumber || '').trim();
    const trackingNumber = String(body.trackingNumber || '').trim();
    const message = String(body.message || '').trim();
    const email = String(body.email || '').trim();

    if (!orderNumber && !trackingNumber) {
      return res.status(400).json({ success: false, message: 'Numéro de commande ou de suivi requis.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'Merci de nous indiquer votre message.' });
    }

    const filter = {};
    if (orderNumber) filter.number = orderNumber;
    if (trackingNumber) filter['shipping.trackingNumber'] = trackingNumber;

    const order = await Order.findOne(filter);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    const note = `Contact client via page suivi: ${message}${email ? ` (email: ${email})` : ''}`;
    order.events = order.events || [];
    order.events.push({ type: 'client_contact', message: note, at: new Date(), payloadSnippet: { source: 'tracking-page' } });
    await order.save();

    try {
      console.log('[public-track] contact reçu', {
        order: order.number || String(order._id),
        tracking: (order && order.shipping && order.shipping.trackingNumber) ? order.shipping.trackingNumber : null,
        email,
        messageLength: message.length
      });
      // TODO: Intégrer un envoi d'email interne (support) si nécessaire.
    } catch (err) {
      console.warn('[public-track] log contact impossible', err && err.message ? err.message : err);
    }

    res.json({ success: true, message: 'Votre message a bien été transmis à notre équipe. Merci.' });
  } catch (e) {
    console.error('[public-track:contact] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur interne, veuillez réessayer plus tard.' });
  }
});

// Health check (statut et DB)
app.get('/healthz', (req, res) => {
  const dbState = (mongoose && mongoose.connection)
    ? mongoose.connection.readyState
    : -1;
  res.json({ status: 'ok', db: dbState, uptime: process.uptime() });
});

// Readiness probe (prêt à recevoir du trafic)
app.get('/readyz', (req, res) => {
  const dbState = (mongoose && mongoose.connection)
    ? mongoose.connection.readyState
    : -1;
  const ok = dbState === 1; // prêt si DB connectée
  if (!ok) return res.status(503).json({ status: 'not-ready', db: dbState });
  return res.json({ status: 'ready', db: dbState });
});

// --- Auth publique: demande de réinitialisation de mot de passe ---
// Body: { email }
app.post('/api/auth/request-password-reset', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email manquant' });
    }
    const user = await User.findOne({ email, isActive: true });
    // Toujours répondre succès pour éviter l'énumération d'emails
    if (!user) {
      return res.json({ success: true, message: 'Si un compte existe, un email a été envoyé' });
    }

    // Générer un token aléatoire et stocker le hash + expiration (60 min)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    user.lastPasswordResetRequestedAt = new Date();
    await user.save();

    // Construire le lien de réinitialisation (même domaine que la requête)
    const origin = `${req.protocol}://${req.get('host')}`;
    const resetLink = `${origin}/admin/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Envoyer l'email (ne bloque pas la réponse au client si l'envoi échoue)
    try {
      await sendPasswordResetEmail(user, resetLink);
    } catch (mailErr) {
      console.error('[auth] request-password-reset email send failed:', mailErr);
      // On ne renvoie pas d'erreur au client pour éviter de révéler des détails et améliorer l'UX
    }
    return res.json({ success: true, message: 'Si un compte existe, un email a été envoyé' });
  } catch (e) {
    console.error('[auth] request-password-reset error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Page publique: formulaire de réinitialisation ---
app.get('/admin/reset-password', (req, res) => {
  const token = String(req.query.token || '');
  const email = String(req.query.email || '');
  const html = `<!doctype html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Réinitialiser le mot de passe</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:0}
      .card{max-width:420px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);overflow:hidden}
      .header{background:#003366;color:#fff;padding:16px;text-align:center}
      .content{padding:20px}
      label{display:block;margin:12px 0 6px;color:#111827}
      input{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px}
      button{background:#E60000;color:#fff;border:none;padding:10px 14px;border-radius:6px;cursor:pointer;margin-top:16px}
      .info{font-size:12px;color:#6b7280;margin-top:10px}
      .error{color:#b91c1c;margin-top:10px}
      .success{color:#065f46;margin-top:10px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header"><h2>Réinitialiser le mot de passe</h2></div>
      <div class="content">
        <form id="resetForm">
          <input type="hidden" name="token" value="${token}" />
          <input type="hidden" name="email" value="${email}" />
          <label for="password">Nouveau mot de passe</label>
          <input id="password" name="password" type="password" minlength="8" required />
          <label for="confirm">Confirmer le mot de passe</label>
          <input id="confirm" name="confirm" type="password" minlength="8" required />
          <button type="submit">Valider</button>
          <div class="info">Le mot de passe doit contenir au moins 8 caractères.</div>
          <div id="msg" class="info"></div>
        </form>
      </div>
    </div>
    <script>
      const form = document.getElementById('resetForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const email = fd.get('email');
        const token = fd.get('token');
        const password = fd.get('password');
        const confirm = fd.get('confirm');
        const msg = document.getElementById('msg');
        msg.className='info'; msg.textContent='';
        if (!password || password.length < 8) { msg.className='error'; msg.textContent='Mot de passe trop court'; return; }
        if (password !== confirm) { msg.className='error'; msg.textContent='Les mots de passe ne correspondent pas'; return; }
        try {
          const resp = await fetch('/api/auth/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token, password })
          });
          const data = await resp.json();
          if (resp.ok) { msg.className='success'; msg.textContent='Mot de passe mis à jour. Vous pouvez vous connecter.'; }
          else { msg.className='error'; msg.textContent=data && data.message ? data.message : 'Erreur'; }
        } catch (err){ msg.className='error'; msg.textContent='Erreur réseau'; }
      });
    </script>
  </body>
  </html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
});

// --- Auth publique: réinitialisation de mot de passe ---
// Body: { email, token, password }
app.post('/api/auth/reset-password', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    if (!email || !token || !password) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe trop court (min 8)' });
    }
    const user = await User.findOne({ email, isActive: true });
    if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpires) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }
    if (user.passwordResetTokenExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Lien expiré' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== String(user.passwordResetTokenHash)) {
      return res.status(400).json({ success: false, message: 'Lien invalide' });
    }

    // Mettre à jour le mot de passe
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(password, salt);
    user.passwordHash = newHash;
    // Invalider le token
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpires = null;
    await user.save();
    return res.json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (e) {
    console.error('[auth] reset-password error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
// --- Diagnostic: savoir où se trouve un fichier (protégé admin) ---
// Exemple: GET /api/admin/uploads/where?name=documents-123.jpeg
app.get('/api/admin/uploads/where', adminAuthMW, (req, res) => {
  try {
    const name = (req.query.name || '').toString();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Paramètre "name" manquant' });
    }

    const results = [];
    let foundPath = null;
    for (const base of altUploadDirs) {
      const candidate = path.join(base, name);
      let exists = false;
      try {
        exists = fs.existsSync(candidate);
      } catch {}
      results.push({ base, path: candidate, exists });
      if (exists && !foundPath) foundPath = candidate;
    }

    return res.json({ success: true, name, found: !!foundPath, foundPath, checked: results, mappingOrder: altUploadDirs });
  } catch (e) {
    console.error('Erreur where uploads:', e);
    return res.status(500).json({ success: false, message: 'Erreur interne during where check' });
  }
});

// --- Utilitaires encodage noms de fichiers ---
function looksMojibake(str) {
  if (!str) return false;
  // Détection simple de suites typiques: "Ã", "Â", "â", "€"
  return /[ÃÂâ€]/.test(str);
}

function sanitizeFileName(input) {
  try {
    let name = String(input || '').trim();
    if (typeof name.normalize === 'function') name = name.normalize('NFC');
    if (looksMojibake(name)) {
      try { name = Buffer.from(name, 'latin1').toString('utf8'); } catch (_) {}
    }
    name = name.replace(/[\u0000-\u001F\u007F]/g, '');
    name = name.replace(/[\\/]/g, '_');
    if (name.length > 180) name = name.slice(0, 180);
    if (!name) name = 'fichier';
    return name;
  } catch (_) {
    return 'fichier';
  }
}

// Routes API

// Créer un nouveau ticket
app.post('/api/tickets', upload.array('documents', 10), async (req, res) => {
  try {
    console.log('Requête reçue:', req.body);
    console.log('Fichiers reçus:', req.files);
    
    // Générer un numéro de ticket unique
    const ticketNumber = Ticket.generateTicketNumber();
    
    // Préparer les données du ticket
    const ticketData = {
      ticketNumber,
      // Définir le type de réclamation
      claimType: req.body.claimType || 'piece_defectueuse',
      clientInfo: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone
      },
      orderInfo: {
        orderNumber: req.body.orderNumber,
        orderDate: req.body.orderDate
      },
      vehicleInfo: {
        make: req.body.make,
        model: req.body.model,
        year: req.body.year,
        vin: req.body.vin,
        registrationNumber: req.body.registrationNumber,
        installationDate: req.body.installationDate
      },
      partInfo: {
        // Définir une valeur par défaut 'autres' si le type de pièce est vide
        partType: req.body.partType || 'autres',
        symptom: req.body.symptom,
        failureTime: req.body.failureTime,
        errorCodes: req.body.errorCodes,
        // Correction des noms de champs pour correspondre au formulaire
        professionalInstallation: req.body.montage_pro === 'oui' || req.body.professionalInstallation === 'true' || req.body.professionalInstallation === 'on' || req.body.professionalInstallation === true || req.body.professionalInstallation === '1' || req.body.professionalInstallation === 'yes' || req.body.professionalInstallation === 'oui',
        oilFilled: req.body.mise_huile === 'oui' || req.body.oilFilled === 'true' || req.body.oilFilled === 'on' || req.body.oilFilled === true || req.body.oilFilled === '1' || req.body.oilFilled === 'yes' || req.body.oilFilled === 'oui',
        oilQuantity: req.body.oilQuantity,
        oilReference: req.body.oilReference,
        newParts: req.body.newParts === 'true' || req.body.pieces_neuves === 'oui',
        // Correction pour prendre en compte le nom du champ dans le formulaire
        newPartsDetails: req.body.pieces_details || req.body.newPartsDetails
      },
      documents: []
    };
    
    // Ajouter les documents téléchargés
    if (req.files && req.files.length > 0) {
      // Récupérer les types de documents
      const documentTypes = Array.isArray(req.body.documentTypes) ? req.body.documentTypes : [req.body.documentTypes];
      
      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];
        // Mapper les types de documents du formulaire vers les types autorisés dans le schéma
        let documentType = 'documents_autres'; // Type par défaut
        
        // Récupérer le type de document du formulaire
        const formDocType = documentTypes[index] || '';
        
        // Mapper les types de documents du formulaire vers les types autorisés
        if (formDocType.includes('justificatif_pro')) {
          documentType = 'factures_pieces';
        } else if (formDocType.includes('lecture_obd')) {
          documentType = 'lecture_obd';
        } else if (formDocType.includes('photo')) {
          documentType = 'photo_piece';
        } else if (formDocType.includes('facture')) {
          documentType = 'factures_pieces';
        } else if (formDocType.includes('media')) {
          documentType = 'media_transmission';
        } else if (formDocType.includes('moteur')) {
          documentType = 'photos_moteur';
        } else if (formDocType.includes('entretien')) {
          documentType = 'factures_entretien';
        }
        
        console.log(`Mappage de type de document: ${formDocType} -> ${documentType}`);
        
        // Déterminer le chemin/clé stockée selon le driver
        let storedPath = '';
        if (S3_ENABLED) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          const key = `${file.fieldname}-${uniqueSuffix}${ext}`;
          try {
            await uploadBuffer(key, file.mimetype, file.buffer);
            storedPath = `/uploads/${key}`;
          } catch (upErr) {
            console.error('[upload] Erreur upload R2:', upErr && upErr.message ? upErr.message : upErr);
            throw upErr;
          }
        } else {
          storedPath = file.path;
        }
        
        ticketData.documents.push({
          type: documentType,
          fileName: sanitizeFileName(file.originalname),
          filePath: storedPath,
          fileType: file.mimetype,
          uploadedBy: 'client',
          uploadDate: new Date()
        });
      }
    }
    
    // Créer le ticket dans la base de données
    const newTicket = new Ticket(ticketData);
    await newTicket.save();
    
    // Créer la première mise à jour de statut
    const statusUpdate = new StatusUpdate({
      ticketId: newTicket._id,
      status: 'nouveau',
      comment: 'Ticket créé',
      updatedBy: 'system',
      clientNotified: true
    });
    await statusUpdate.save();
    
    // Envoyer un email de confirmation au client
    try {
      const info = await sendTicketCreationEmail(newTicket);
      if (info) {
        console.log(`Email de confirmation envoyé au client ${newTicket.clientInfo.email}`);
      } else {
        console.warn(`Envoi de l'email de confirmation échoué pour ${newTicket.clientInfo.email}`);
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
      // On continue même si l'envoi d'email échoue
    }
    
    // Envoyer la réponse
    res.status(201).json({
      success: true,
      ticketNumber: ticketNumber,
      message: 'Votre demande SAV a été enregistrée avec succès'
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de l\'enregistrement de votre demande'
    });
  }
});

// Obtenir un ticket par son numéro
app.get('/api/tickets/:ticketNumber', async (req, res) => {
  try {
    console.log('Recherche du ticket:', req.params.ticketNumber);
    
    if (!req.params.ticketNumber) {
      console.log('Numéro de ticket manquant dans la requête');
      return res.status(400).json({
        success: false,
        message: 'Numéro de ticket requis'
      });
    }
    
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
    console.log('Résultat de la recherche:', ticket ? 'Ticket trouvé' : 'Ticket non trouvé');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé. Vérifiez le numéro et réessayez.'
      });
    }
    
    // Obtenir l'historique des statuts
    const statusHistory = await StatusUpdate.find({ ticketId: ticket._id }).sort({ updatedAt: -1 });
    console.log(`${statusHistory.length} mises à jour de statut trouvées pour le ticket`);
    
    res.status(200).json({
      success: true,
      ticket,
      statusHistory
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération du ticket'
    });
  }
});

// Middleware d'authentification simple pour l'interface admin
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  // Décodage de l'authentification Basic
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // Identifiants fixes pour l'accès directeur (optionnels via env)
  const DIRECTOR_ACCOUNT_ENABLED = process.env.DIRECTOR_ACCOUNT_ENABLED === 'true';
  const directeurUsername = 'directeur';
  const directeurPassword = 'CarParts2025';
  
  // Vérification des identifiants ENV/directeur (fallback)
  if ((username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) ||
      (DIRECTOR_ACCOUNT_ENABLED && username.toLowerCase() === directeurUsername && password === directeurPassword)) {
    req.auth = {
      type: 'env',
      role: 'admin',
      id: `env-${username || 'admin'}`,
      email: username,
      firstName: 'Admin',
      lastName: 'Principal'
    };
    return next();
  }

  // Vérification en base (utilisateurs SAV)
  try {
    const user = await User.findOne({ email: username.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }
    // Auth OK
    req.auth = { type: 'user', role: user.role, id: user._id.toString(), email: user.email };
    return next();
  } catch (err) {
    console.error('Erreur d\'authentification admin:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'authentification' });
  }
};

// Routes admin (protégées par authentification)

// Middleware d'autorisation réservé aux administrateurs
const ensureAdmin = (req, res, next) => {
  if (req.auth && req.auth.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
};

// Autoriser les rôles admin OU agent (SAV)
const ensureAdminOrAgent = (req, res, next) => {
  if (req.auth && (req.auth.role === 'admin' || req.auth.role === 'agent')) return next();
  return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs ou agents SAV' });
};

// Informations sur l'utilisateur authentifié
app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  try {
    const info = req.auth || {};
    return res.json({ success: true, role: info.role, id: info.id, email: info.email });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ========= Modèles de tâches =========
// Liste des modèles
app.get('/api/admin/tasks/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const list = await TaskTemplate.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, templates: list });
  } catch (e) {
    console.error('[tasks:templates:list] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un modèle
app.post('/api/admin/tasks/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nom requis' });
    const t = new TaskTemplate({
      name,
      title: String(b.title || '').trim(),
      description: String(b.description || '').trim(),
      priority: b.priority || 'medium',
      tags: Array.isArray(b.tags) ? b.tags : []
    });
    await t.save();
    res.json({ success: true, template: t });
  } catch (e) {
    console.error('[tasks:templates:create] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un modèle
app.delete('/api/admin/tasks/templates/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    await TaskTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('[tasks:templates:delete] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
// Diagnostic des variables d'environnement (ADMIN uniquement)
app.get('/api/admin/diagnostics/env', authenticateAdmin, ensureAdmin, (req, res) => {
  const mask = (v, start = 2, end = 4) => {
    if (!v) return '';
    const s = String(v);
    if (s.length <= start + end) return '*'.repeat(Math.max(4, s.length));
    return s.slice(0, start) + '***' + s.slice(-end);
  };
  const maskUri = (uri) => {
    if (!uri) return '';
    try {
      const u = new URL(uri);
      const host = u.host;
      const db = (u.pathname || '').replace(/^\//, '');
      return `${u.protocol}//${host}/${db ? db : ''}`;
    } catch {
      return mask(uri, 4, 4);
    }
  };
  const envOut = {
    NODE_ENV: process.env.NODE_ENV || '',
    WEBSITE_URL: process.env.WEBSITE_URL || '',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '',
    WOOCOMMERCE_BASE_URL: process.env.WOOCOMMERCE_BASE_URL || '',
    WOOCOMMERCE_CONSUMER_KEY: mask(process.env.WOOCOMMERCE_CONSUMER_KEY || ''),
    WOOCOMMERCE_CONSUMER_SECRET: mask(process.env.WOOCOMMERCE_CONSUMER_SECRET || ''),
    ORDERS_SYNC_ENABLED: process.env.ORDERS_SYNC_ENABLED || '',
    ORDERS_SYNC_INTERVAL_MINUTES: process.env.ORDERS_SYNC_INTERVAL_MINUTES || '',
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || '',
    UPLOADS_DIR: process.env.UPLOADS_DIR || '',
    MONGODB_URI: maskUri(process.env.MONGODB_URI || ''),
  };
  const present = Object.fromEntries(Object.entries(envOut).map(([k, v]) => [k, !!(v && String(v).length > 0)]));
  res.json({ success: true, env: envOut, present });
});

// Diagnostic de l'API WooCommerce (ADMIN uniquement)
app.get('/api/admin/diagnostics/woo', authenticateAdmin, ensureAdmin, async (req, res) => {
  const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
  const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
  const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
  const present = { base: !!base, ck: !!ck, cs: !!cs };
  let urlUsed = null; let method = null; let status = null; let bodySnippet = '';
  try {
    if (!present.base || !present.ck || !present.cs) {
      return res.json({ success: false, message: 'Variables WooCommerce manquantes', present });
    }
    const baseUrl = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=1&orderby=date&order=desc`;
    urlUsed = baseUrl; method = 'basic';
    let r = await fetch(baseUrl, { headers: { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
    status = r.status;
    if (!r.ok) {
      const alt = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&per_page=1&orderby=date&order=desc`;
      urlUsed = alt; method = 'query';
      r = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      status = r.status;
    }
    const txt = await r.text().catch(() => '');
    bodySnippet = (txt || '').slice(0, 600);
    return res.json({ success: true, present, method, status, urlUsed, bodySnippetLength: bodySnippet.length, bodySnippet });
  } catch (e) {
    return res.json({ success: false, present, method, status, urlUsed, error: (e && e.message) || String(e) });
  }
});

// Supprimer une commande (ADMIN uniquement)
app.delete('/api/admin/orders/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    await Order.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('[orders:delete] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lister les commandes (pagination + filtres de base)
app.get('/api/admin/orders', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const provider = String(req.query.provider || '').trim();
    const status = String(req.query.status || '').trim();
    const productType = String(req.query.productType || '').trim();
    const reviewDecision = String(req.query.reviewDecision || '').trim(); // réservé, si présent on ne filtre pas pour l'instant
    const missingTechRef = String(req.query.missingTechRef || '').trim() === '1';
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const sortKeyRaw = String(req.query.sort || 'date');
    const dirRaw = String(req.query.dir || 'desc');

    const filter = {};
    if (provider) filter.provider = provider;
    if (status) filter.status = status;
    if (productType) filter['meta.productType'] = productType;
    if (missingTechRef) filter['meta.technicalRefRequired'] = true;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { number: re },
        { providerOrderId: re },
        { 'customer.name': re },
        { 'customer.email': re }
      ];
    }
    if (from || to) {
      const range = {};
      if (from) { const d = new Date(from); if (!isNaN(d.getTime())) range.$gte = d; }
      if (to) { const d = new Date(to); if (!isNaN(d.getTime())) range.$lte = new Date(new Date(to).getTime() + 24*60*60*1000 - 1); }
      if (Object.keys(range).length) filter.createdAt = range;
    }

    // Tri
    const sort = {};
    const dir = dirRaw === 'asc' ? 1 : -1;
    switch (sortKeyRaw) {
      case 'amount': sort['totals.amount'] = dir; break;
      case 'number': sort['number'] = dir; break;
      case 'status': sort['status'] = dir; break;
      case 'type': sort['meta.productType'] = dir; break;
      case 'date':
      default: sort['createdAt'] = dir; break;
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Métriques simples pour l'en-tête
    const [missingRefCount, missingVinCount, awaitingShipCount] = await Promise.all([
      Order.countDocuments({ 'meta.technicalRefRequired': true }),
      Order.countDocuments({ $or: [ { 'meta.vinOrPlate': { $exists: false } }, { 'meta.vinOrPlate': '' } ] }),
      Order.countDocuments({ status: { $in: ['processing','paid','awaiting_transfer'] } })
    ]);
    const metrics = {
      missingTechRef: missingRefCount,
      missingVin: missingVinCount,
      awaitingShip: awaitingShipCount
    };

    return res.json({ success: true, orders, total, page, limit, metrics });
  } catch (e) {
    console.error('[orders:list] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Détail d'une commande
app.get('/api/admin/orders/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const byId = id.match(/^[0-9a-fA-F]{24}$/);
    const order = byId ? await Order.findById(id) : await Order.findOne({ number: id });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    return res.json({ success: true, order });
  } catch (e) {
    console.error('[orders:detail] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Recalculer les références requises (rétroactif) sur toutes les commandes existantes
app.post('/api/admin/orders/rebuild-technical-refs', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    let scanned = 0;
    let updated = 0;
    const cursor = Order.find({}, { items: 1, meta: 1 }).cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      scanned++;
      const items = Array.isArray(doc.items) ? doc.items : [];
      const needs = detectTechRefFromItems(items);
      const alreadyTrue = !!(doc.meta && doc.meta.technicalRefRequired === true);
      if (needs && !alreadyTrue) {
        doc.meta = doc.meta || {};
        doc.meta.technicalRefRequired = true;
        doc.events = doc.events || [];
        doc.events.push({ type: 'technical_ref_required_set', message: 'Référence technique requise (rétroactif)', at: new Date() });
        await doc.save();
        updated++;
      }
    }
    res.json({ success: true, scanned, updated });
  } catch (e) {
    console.error('[orders:rebuild-techref] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Test d'alerte SLA 24h sur un ticket spécifique (ADMIN uniquement)
app.post('/api/admin/test/sla-alert/:ticketId([0-9a-fA-F]{24})', authenticateAdmin, ensureAdmin, async (req, res) => {
  const routeTag = '[POST /api/admin/test/sla-alert/:ticketId]';
  try {
    const { ticketId } = req.params;
    console.log(`${routeTag} Reçu pour ticketId=${ticketId}`);

    // Charger le ticket avec l'agent assigné pour obtenir l'email
    const ticket = await Ticket.findById(ticketId)
      .populate('assignedTo', 'firstName lastName email role isActive')
      .exec();

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    // Ne pas envoyer pour les tickets fermés
    if (['clôturé', 'refusé'].includes(ticket.currentStatus)) {
      return res.status(400).json({ success: false, message: 'Le ticket est fermé; aucune alerte SLA' });
    }

    // Envoyer un email d'alerte de test en simulant 24h de retard
    try {
      const info = await sendSlaReminderEmail(ticket, ticket.assignedTo, 24);
      if (info) {
        console.log(`${routeTag} Email de test SLA envoyé`, { messageId: info.messageId, to: (ticket.assignedTo && ticket.assignedTo.email) });
        return res.json({ success: true, message: 'Alerte SLA (24h) envoyée pour test', messageId: info.messageId });
      }
      return res.status(500).json({ success: false, message: 'Échec de l\'envoi de l\'email (voir logs serveur)' });
    } catch (emailErr) {
      console.error(`${routeTag} Erreur d\'envoi:`, emailErr);
      return res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email', details: emailErr && emailErr.message });
    }
  } catch (error) {
    console.error(`${routeTag} Erreur inattendue:`, error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', details: error && error.message });
  }
});

// Gestion des utilisateurs SAV (CRUD)
// Lister les utilisateurs
app.get('/api/admin/users', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Erreur lors de la liste des utilisateurs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un utilisateur SAV
app.post('/api/admin/users', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { firstName = '', lastName = '', email, password, role = 'agent', isActive = true } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Un utilisateur avec cet email existe déjà' });
    }
    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ firstName, lastName, email: normalizedEmail, passwordHash, role, isActive: !!isActive });
    const { passwordHash: _, ...safe } = user.toObject();
    res.status(201).json({ success: true, user: safe });
  } catch (error) {
    console.error('Erreur lors de la création utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour un utilisateur SAV
app.put('/api/admin/users/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['firstName', 'lastName', 'role', 'isActive'];
    allowed.forEach(k => {
      if (k in req.body) updates[k] = req.body[k];
    });
    if ('role' in updates && !['admin', 'agent'].includes(updates.role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    }
    if (req.body.email) {
      const normalizedEmail = String(req.body.email).toLowerCase().trim();
      const exists = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Email déjà utilisé par un autre compte' });
      }
      updates.email = normalizedEmail;
    }
    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true, fields: { passwordHash: 0 } });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Erreur lors de la mise à jour utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur SAV
app.delete('/api/admin/users/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // ...
    if (req.auth && req.auth.id === id) {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer votre propre compte' });
    }
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Gestion des modèles de réponse (CRUD) ---
// Lister les modèles
app.get('/api/admin/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const filter = {};
    if (String(req.query.active || '').trim() === '1') filter.isActive = true;
    const templates = await ResponseTemplate.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Erreur lors de la liste des modèles:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un modèle
app.post('/api/admin/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { key, label, content, isActive = true } = req.body || {};
    if (!key || !label || !content) {
      return res.status(400).json({ success: false, message: 'Champs requis: key, label, content' });
    }
    const doc = await ResponseTemplate.create({ key: String(key).toLowerCase().trim(), label: String(label).trim(), content: String(content).trim(), isActive: !!isActive });
    res.status(201).json({ success: true, template: doc });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Cette clé existe déjà' });
    }
    console.error('Erreur lors de la création du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour un modèle
app.put('/api/admin/templates/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    ['key','label','content','isActive'].forEach(k => {
      if (k in req.body) updates[k] = req.body[k];
    });
    if ('key' in updates) updates.key = String(updates.key).toLowerCase().trim();
    if ('label' in updates) updates.label = String(updates.label).trim();
    if ('content' in updates) updates.content = String(updates.content).trim();
    const doc = await ResponseTemplate.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true, template: doc });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Cette clé existe déjà' });
    }
    console.error('Erreur lors de la mise à jour du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un modèle
app.delete('/api/admin/templates/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ResponseTemplate.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Édition de la documentation Markdown (admin/docs) ---
// Sécurisation: accès Admin uniquement, restriction au répertoire admin/docs, extensions .md uniquement
const docsBaseDir = path.join(__dirname, '../admin/docs');
const DOCS_STORAGE = (process.env.DOCS_STORAGE || 'db').toLowerCase();

function isSubPath(parent, child) {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function safeDocAbsolutePath(relPath = '') {
  const cleaned = path.normalize(String(relPath).replace(/^\/+/, ''));
  const abs = path.join(docsBaseDir, cleaned);
  if (!abs.startsWith(docsBaseDir)) {
    throw new Error('Chemin en dehors du répertoire docs');
  }
  if (!cleaned.endsWith('.md')) {
    throw new Error('Seuls les fichiers .md sont autorisés');
  }
  return abs;
}

// Normaliser et sécuriser un chemin relatif de documentation pour stockage en base
function sanitizeDocRelPath(relPath = '') {
  const raw = String(relPath || '').trim();
  if (!raw) throw new Error('Paramètre path requis');
  // retirer les slashes initiaux
  const noLead = raw.replace(/^\/+/, '');
  // normaliser et utiliser des slashes POSIX
  const normalizedFS = path.normalize(noLead);
  const normalized = normalizedFS.replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('Chemin invalide');
  }
  if (!normalized.toLowerCase().endsWith('.md')) {
    throw new Error('Seuls les fichiers .md sont autorisés');
  }
  return normalized;
}

// Lister récursivement les fichiers .md (fallback FS)
async function listMarkdownFilesRecursive(dir, basePrefix = '') {
  const out = [];
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.join(basePrefix, ent.name);
    if (ent.isDirectory()) {
      const nested = await listMarkdownFilesRecursive(abs, rel);
      out.push(...nested);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
      try {
        const st = await fs.promises.stat(abs);
        out.push({
          path: rel.replace(/\\/g, '/'),
          name: ent.name,
          size: st.size,
          mtime: st.mtimeMs
        });
      } catch {}
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

// Import automatique des docs FS vers DB si collection vide et stockage DB activé
async function autoImportDocsFromFSIfEmpty() {
  try {
    if (DOCS_STORAGE !== 'db') return;
    const count = await Documentation.estimatedDocumentCount();
    if (count > 0) return;
    const list = await listMarkdownFilesRecursive(docsBaseDir, '');
    if (!list || list.length === 0) return;
    let imported = 0;
    for (const f of list) {
      const abs = safeDocAbsolutePath(f.path);
      let content = '';
      try { content = await fs.promises.readFile(abs, 'utf8'); } catch {}
      const size = Buffer.byteLength(String(content || ''), 'utf8');
      const name = path.basename(f.path);
      try {
        await Documentation.updateOne(
          { path: f.path },
          { $set: { path: f.path, name, content, size } },
          { upsert: true }
        );
        imported++;
      } catch (e) {
        // Ignorer les doublons éventuels en cas de concurrence de démarrage
        if (e && e.code === 11000) {
          continue;
        }
        throw e;
      }
    }
    console.log(`[docs] Import automatique terminé: ${imported} documents importés depuis admin/docs vers la DB`);
  } catch (e) {
    console.error('[docs] Échec import automatique FS->DB:', e && e.message ? e.message : e);
  }
}

// Lister les fichiers .md sous admin/docs
app.get('/api/admin/docs', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    let files = [];
    if (DOCS_STORAGE === 'db') {
      const docs = await Documentation.find({}, 'path name size updatedAt content').sort({ path: 1 }).lean();
      files = docs.map(d => ({
        path: d.path,
        name: d.name,
        size: typeof d.size === 'number' ? d.size : Buffer.byteLength(String(d.content || ''), 'utf8'),
        mtime: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now()
      }));
      // Fallback: si la DB est vide, retourner le listing FS pour ne rien casser le premier chargement
      if (!files || files.length === 0) {
        files = await listMarkdownFilesRecursive(docsBaseDir, '');
      }
    } else {
      files = await listMarkdownFilesRecursive(docsBaseDir, '');
    }
    res.json({ success: true, files });
  } catch (error) {
    console.error('Erreur listage docs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Version publique (lecture seule) pour la page #docs
app.get('/api/docs', async (req, res) => {
  try {
    let files = [];
    if (DOCS_STORAGE === 'db') {
      const docs = await Documentation.find({}, 'path name size updatedAt content').sort({ path: 1 }).lean();
      files = docs.map(d => ({
        path: d.path,
        name: d.name,
        size: typeof d.size === 'number' ? d.size : Buffer.byteLength(String(d.content || ''), 'utf8'),
        mtime: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now()
      }));
    } else {
      files = await listMarkdownFilesRecursive(docsBaseDir, '');
    }
    res.json({ success: true, files });
  } catch (error) {
    console.error('Erreur listage docs (public):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lire le contenu d'un fichier .md
app.get('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = sanitizeDocRelPath(req.query.path || '');
    if (DOCS_STORAGE === 'db') {
      let doc = await Documentation.findOne({ path: rel }).lean();
      if (!doc) {
        // Fallback: tenter de lire depuis le FS puis insérer en DB pour ne pas casser l'UX
        try {
          const abs = safeDocAbsolutePath(rel);
          const content = await fs.promises.readFile(abs, 'utf8');
          const size = Buffer.byteLength(content, 'utf8');
          const name = path.basename(rel);
          await Documentation.updateOne(
            { path: rel },
            { $set: { path: rel, name, content, size } },
            { upsert: true }
          );
          return res.json({ success: true, path: rel, content });
        } catch (_) {
          return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
        }
      }
      return res.json({ success: true, path: rel, content: String(doc.content || '') });
    } else {
      const abs = safeDocAbsolutePath(rel);
      const content = await fs.promises.readFile(abs, 'utf8');
      return res.json({ success: true, path: rel, content });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
    console.error('Erreur lecture doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Écrire (créer/mettre à jour) un fichier .md
app.put('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = sanitizeDocRelPath((req.body && req.body.path) || '');
    const content = String((req.body && req.body.content) || '');
    const name = path.basename(rel);
    if (DOCS_STORAGE === 'db') {
      const size = Buffer.byteLength(content, 'utf8');
      const now = new Date();
      const updated = await Documentation.findOneAndUpdate(
        { path: rel },
        { $set: { path: rel, name, content, size, updatedAt: now } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json({ success: true, path: rel, size: updated.size || size, mtime: updated.updatedAt ? updated.updatedAt.getTime() : now.getTime() });
    } else {
      const abs = safeDocAbsolutePath(rel);
      // Créer le répertoire parent si nécessaire
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, content, 'utf8');
      const st = await fs.promises.stat(abs);
      return res.json({ success: true, path: rel, size: st.size, mtime: st.mtimeMs });
    }
  } catch (error) {
    console.error('Erreur écriture doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Supprimer un fichier .md
app.delete('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = sanitizeDocRelPath(req.query.path || '');
    if (DOCS_STORAGE === 'db') {
      const doc = await Documentation.findOneAndDelete({ name: rel });
      return res.json({ success: true, deleted: !!doc });
    }
    const abs = path.join(adminDocsDir, rel);
    await fs.promises.unlink(abs);
    res.json({ success: true });
  } catch (e) {
    console.error('[docs] delete error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

 
app.get('/api/admin/quotes', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10) || 20, 1), 200);

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'customer.name': re },
        { 'customer.email': re },
        { message: re },
        { providerReferenceId: re }
      ];
    }

    const total = await Quote.countDocuments(filter);
    const quotes = await Quote.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({ success: true, total, page, pageSize, quotes });
  } catch (e) {
    console.error('[quotes:list] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.post('/api/admin/quotes/:id/reply', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.message || req.body?.body || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'ID requis' });
    if (!subject || !body) return res.status(400).json({ success: false, message: 'Sujet et message requis' });

    const quote = await Quote.findById(id);
    if (!quote) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    const to = String(quote.customer?.email || '').trim();
    if (!to) return res.status(400).json({ success: false, message: 'Email client manquant' });

    const html = body.replace(/\n/g, '<br/>');
    await sendGenericEmail({ to, subject, html, text: body });

    const byUserRaw = req.auth?._id || req.auth?.id;
    const byUserId = (byUserRaw && mongoose.Types.ObjectId.isValid(byUserRaw)) ? byUserRaw : undefined;
    quote.conversation = Array.isArray(quote.conversation) ? quote.conversation : [];
    quote.conversation.push({ direction: 'out', channel: 'email', subject, body, byUserId: byUserId || null, at: new Date() });
    quote.status = 'responded';
    await quote.save();

    res.json({ success: true });
  } catch (e) {
    console.error('[quotes:reply] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

 

 
app.post('/api/webhooks/quotes/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const expected = String(process.env.QUOTE_WEBHOOK_TOKEN || '').trim();
    if (!expected || token !== expected) {
      return res.status(401).json({ success: false, message: 'Non autorisé' });
    }

    const b = req.body || {};
    const src = String(b.source || 'wordpress');
    const pluginName = String(b.plugin || 'carparts-devis');

    const firstName = String((b.customer && b.customer.firstName) || b.prenom || '').trim();
    const lastName = String((b.customer && b.customer.lastName) || b.nom || '').trim();
    const name = String((b.customer && b.customer.name) || `${firstName} ${lastName}`.trim()).trim();
    const email = String((b.customer && b.customer.email) || b.email || '').trim();
    const phone = String((b.customer && b.customer.phone) || b.telephone || b.phone || '').trim();

    const vehicle = {
      immatriculation: String(b.immatriculation || (b.vehicle && b.vehicle.immatriculation) || '').trim(),
      vin: String(b.vin || (b.vehicle && b.vehicle.vin) || '').trim()
    };

    let items = [];
    if (Array.isArray(b.items)) {
      items = b.items.map(it => ({
        name: String((it && it.name) || '').trim(),
        sku: String((it && it.sku) || '').trim(),
        qty: Number((it && it.qty) || 1),
        productId: String((it && (it.product_id || it.productId)) || '').trim()
      }));
    }

    let attachments = [];
    if (Array.isArray(b.attachments)) {
      attachments = b.attachments.map(f => ({
        url: String((f && f.url) || '').trim(),
        filename: String((f && (f.filename || f.name)) || '').trim(),
        mimeType: String((f && (f.mimeType || f.type)) || '').trim()
      }));
    }

    const providerReferenceId = String(b.referenceId || b.ref || b.reference || '').trim();
    const msg = String(b.message || b.comment || b.description || '').trim();

    const q = new Quote({
      source: src,
      plugin: pluginName,
      providerReferenceId,
      customer: { firstName, lastName, name, email, phone },
      vehicle,
      items,
      message: msg,
      attachments,
      status: 'new',
      conversation: msg ? [{ direction: 'in', channel: 'system', subject: 'Demande de devis', body: msg, at: new Date() }] : []
    });

    await q.save();
    return res.json({ success: true, id: String(q._id) });
  } catch (e) {
    console.error('[webhook:quotes] erreur', e);
    // On renvoie 200 pour éviter des retries agressifs côté site si petite erreur temporaire
    return res.json({ success: true });
  }
});

// Lister les tickets (pagination + filtres)
app.get('/api/admin/tickets', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const status = String(req.query.status || '').trim();
    const partType = String(req.query.partType || '').trim();
    const ticketNumber = String(req.query.ticketNumber || '').trim();
    const orderNumber = String(req.query.orderNumber || '').trim();
    const clientFirstName = String(req.query.clientFirstName || '').trim();
    const clientName = String(req.query.clientName || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const priority = String(req.query.priority || '').trim();
    const search = String(req.query.search || '').trim();
    const sort = String(req.query.sort || 'newest').trim(); // oldest|newest|priority_asc|priority_desc

    const filter = {};
    if (status) filter.currentStatus = status;
    if (priority) filter.priority = priority;
    if (partType) filter['partInfo.partType'] = partType;
    if (ticketNumber) filter.ticketNumber = ticketNumber;
    if (orderNumber) filter['orderInfo.orderNumber'] = orderNumber;
    if (clientFirstName) filter['clientInfo.firstName'] = new RegExp(clientFirstName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
    if (clientName) filter['clientInfo.lastName'] = new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
    if (dateFrom || dateTo) {
      const range = {};
      if (dateFrom) { const d = new Date(dateFrom); if (!isNaN(d)) range.$gte = d; }
      if (dateTo) { const d = new Date(dateTo); if (!isNaN(d)) range.$lte = new Date(new Date(dateTo).getTime() + 24*60*60*1000 - 1); }
      if (Object.keys(range).length) filter.createdAt = range;
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
      filter.$or = [
        { ticketNumber: re },
        { 'clientInfo.firstName': re },
        { 'clientInfo.lastName': re },
        { 'clientInfo.email': re },
        { 'orderInfo.orderNumber': re }
      ];
    }

    const sortSpec = (() => {
      switch (sort) {
        case 'oldest': return { createdAt: 1 };
        case 'priority_asc': return { priority: 1, createdAt: -1 };
        case 'priority_desc': return { priority: -1, createdAt: -1 };
        case 'newest':
        default: return { createdAt: -1 };
      }
    })();

    const total = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean();

    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({ success: true, tickets, pagination: { page, limit, pages, total } });
  } catch (e) {
    console.error('[tickets:list] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Détail d'un ticket
app.get('/api/admin/tickets/:ticketId', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const ticketId = String(req.params.ticketId || '').trim();
    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await Ticket.findById(ticketId).lean();
    }
    if (!ticket && ticketId) {
      ticket = await Ticket.findOne({ ticketNumber: ticketId }).lean();
    }
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    // Charger aussi l'historique des statuts pour la timeline/conversation
    const statusHistory = await StatusUpdate.find({ ticketId: ticket._id })
      .sort({ updatedAt: 1, _id: 1 })
      .lean();
    return res.json({ success: true, ticket, statusHistory });
  } catch (e) {
    console.error('[tickets:detail] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'un ticket (avec historique) et option d'email au client
app.post('/api/admin/tickets/:ticketId/status', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const ticketIdParam = String(req.params.ticketId || '').trim();
    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(ticketIdParam)) {
      ticket = await Ticket.findById(ticketIdParam);
    }
    if (!ticket && ticketIdParam) {
      ticket = await Ticket.findOne({ ticketNumber: ticketIdParam });
    }
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket non trouvé' });

    const body = req.body || {};
    const status = String(body.status || '').trim();
    const allowed = ['nouveau','en_analyse','info_complementaire','validé','refusé','en_cours_traitement','expédié','clôturé'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }

    const comment = typeof body.comment === 'string' ? body.comment : '';
    const additionalInfoRequested = typeof body.additionalInfoRequested === 'string' ? body.additionalInfoRequested : '';
    const clientNotified = !!body.clientNotified;
    const priority = body.priority ? String(body.priority).trim() : '';

    // Enregistrer l'historique
    const updatedBy = (req.auth && (req.auth.email || req.auth.username)) ? (req.auth.email || req.auth.username) : 'admin';
    const hist = new StatusUpdate({
      ticketId: ticket._id,
      status,
      comment,
      updatedBy,
      clientNotified: clientNotified === true,
      additionalInfoRequested: additionalInfoRequested || undefined
    });
    await hist.save();

    // Mettre à jour le ticket
    ticket.currentStatus = status;
    if (priority) ticket.priority = priority;
    await ticket.save();

    // Envoyer l'email si demandé
    if (clientNotified) {
      try {
        const plainTicket = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
        await sendStatusUpdateEmail(plainTicket, status, comment);
      } catch (mailErr) {
        console.warn('[tickets:status] échec envoi email:', mailErr && mailErr.message ? mailErr.message : mailErr);
      }
    }

    const statusHistory = await StatusUpdate.find({ ticketId: ticket._id })
      .sort({ updatedAt: 1, _id: 1 })
      .lean();
    return res.json({ success: true, ticket, statusHistory });
  } catch (e) {
    console.error('[tickets:status] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Tickets en attente de réponse agent (endpoint minimal pour éviter 404)
app.get('/api/admin/tickets/awaiting-agent-response', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    // Implémentation simple: retourner 0 par défaut pour éviter 404 côté admin.
    // Une implémentation avancée pourrait s'appuyer sur un journal d'événements ou messages entrants.
    return res.json({ success: true, count: 0, tickets: [] });
  } catch (e) {
    console.error('[tickets:awaiting] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Polling minimal des mises à jour côté client (stub)
app.get('/api/admin/tickets/client-updates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const sinceIso = String(req.query.since || '').trim();
    // Version minimale: pas d'agrégation complexe, renvoyer une liste vide pour supprimer les 404
    return res.json({ success: true, updates: [], since: sinceIso || new Date().toISOString() });
  } catch (e) {
    console.error('[tickets:client-updates] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Notifications (liste paginée minimale)
app.get('/api/admin/notifications', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.auth && req.auth.id) filter.userId = req.auth.id;
    let total = 0; let notifications = [];
    try { total = await Notification.countDocuments(filter); } catch(_) { total = 0; }
    try {
      notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } catch(_) { notifications = []; }
    const pages = Math.max(1, Math.ceil((total || 0) / limit));
    return res.json({ success: true, notifications, pagination: { page, limit, pages, total } });
  } catch (e) {
    console.error('[notifications:list] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour supprimer un ticket (admin uniquement)
app.delete('/api/admin/tickets/:ticketId', authenticateAdmin, async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    console.log('Tentative de suppression du ticket avec ID:', ticketId);
    console.log('URL de la requête:', req.originalUrl);
    console.log('Méthode de la requête:', req.method);
    console.log('Headers de la requête:', req.headers);
    
    // Vérifier si l'ID est un ObjectId MongoDB valide
    const isValidObjectId = mongoose.Types.ObjectId.isValid(ticketId);
    console.log('L\'ID est-il un ObjectId MongoDB valide ?', isValidObjectId);
    
    let ticket;
    
    if (isValidObjectId) {
      // Recherche par ID MongoDB
      console.log('Recherche du ticket par ID MongoDB...');
      ticket = await Ticket.findById(ticketId);
    } else {
      // Si l'ID n'est pas un ObjectId valide, essayer de chercher par numéro de ticket
      console.log('ID non valide, tentative de recherche par numéro de ticket...');
      if (ticketId.startsWith('CPF-')) {
        ticket = await Ticket.findOne({ ticketNumber: ticketId });
      } else {
        console.error('Format d\'identifiant non reconnu:', ticketId);
        return res.status(400).json({
          success: false,
          message: 'Format d\'identifiant non reconnu'
        });
      }
    }
    
    // Afficher quelques tickets pour débogage
    const allTickets = await Ticket.find({}).limit(5);
    console.log('Exemple de tickets disponibles:', allTickets.map(t => ({ 
      id: t._id.toString(), 
      number: t.ticketNumber 
    })));
    
    if (!ticket) {
      console.log('Ticket non trouvé avec identifiant:', ticketId);
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }
    
    console.log('Ticket trouvé:', ticket.ticketNumber, 'avec ID:', ticket._id.toString());
    
    console.log('Ticket trouvé, suppression de l\'historique des statuts...');
    // Supprimer également l'historique des statuts associé au ticket
    await StatusUpdate.deleteMany({ ticketId: ticketId });
    
    console.log('Suppression du ticket...');
    // Supprimer le ticket
    await Ticket.findByIdAndDelete(ticketId);
    
    console.log('Ticket supprimé avec succès');
    res.status(200).json({
      success: true,
      message: 'Ticket supprimé avec succès'
    });
    
  } catch (error) {
    console.error('Erreur lors de la suppression du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression du ticket'
    });
  }
});

// --- Routes API Tâches (Todolist) ---
// Liste des tâches avec filtres
app.get('/api/admin/tasks', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    const status = String(req.query.status || '').trim();
    const priority = String(req.query.priority || '').trim();
    const assignedTo = String(req.query.assignedTo || '').trim();
    const q = String(req.query.q || '').trim();
    const overdue = String(req.query.overdue || '').trim() === '1';
    const dueToday = String(req.query.dueToday || '').trim() === '1';
    const urgentOnly = String(req.query.urgentOnly || '').trim() === '1';
    const unassigned = String(req.query.unassigned || '').trim() === '1';

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo && assignedTo !== 'all' && assignedTo !== 'unassigned') filter.assignedTo = assignedTo;
    if (unassigned || assignedTo === 'unassigned') filter.assignedTo = { $in: [null, undefined] };
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ];
    }

    // Filtres d'échéance
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (overdue) {
      filter.status = filter.status || { $ne: 'done' };
      filter.dueDate = { $lte: now };
    }
    if (dueToday) {
      filter.dueDate = { $gte: startOfToday, $lte: endOfToday };
    }
    if (urgentOnly) {
      filter.priority = { $in: ['high', 'urgent'] };
      if (!filter.status) filter.status = { $ne: 'done' };
    }

    const tasks = await Task.find(filter)
      .sort({ priority: -1, dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Task.countDocuments(filter);

    // Résumé rapide pour KPIs
    const summary = {
      open: await Task.countDocuments({ status: { $ne: 'done' } }),
      inProgress: await Task.countDocuments({ status: 'in_progress' }),
      urgent: await Task.countDocuments({ status: { $ne: 'done' }, priority: { $in: ['high','urgent'] } }),
      done30: await Task.countDocuments({ status: 'done', completedAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } })
    };

    res.json({ success: true, tasks, total, page, limit, summary });
  } catch (e) {
    console.error('[tasks:list] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une tâche
app.post('/api/admin/tasks', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Titre requis' });

    const createdByRaw = req.auth?._id || req.auth?.id;
    const createdBy = (createdByRaw && mongoose.Types.ObjectId.isValid(createdByRaw)) ? createdByRaw : undefined;
    const createdByName = req.auth?.firstName ? `${req.auth.firstName} ${req.auth.lastName || ''}`.trim() : (req.auth?.email || 'Admin');

    const taskPayload = {
      title,
      description: String(body.description || '').trim(),
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assignedTo: body.assignedTo || null,
      assignedToName: body.assignedToName || '',
      createdByName,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      tags: Array.isArray(body.tags) ? body.tags : []
    };
    if (createdBy) taskPayload.createdBy = createdBy;
    const task = new Task(taskPayload);
    
    // Debug léger
    // console.log('[tasks:create] payload', { title: task.title, createdBy: task.createdBy, createdByName: task.createdByName });

    await task.save();
    res.json({ success: true, task });
  } catch (e) {
    console.error('[tasks:create] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour une tâche
app.put('/api/admin/tasks/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });

    const body = req.body || {};
    if (body.title) task.title = String(body.title).trim();
    if (body.description !== undefined) task.description = String(body.description).trim();
    if (body.status) {
      task.status = body.status;
      if (body.status === 'done' && !task.completedAt) task.completedAt = new Date();
      if (body.status !== 'done') task.completedAt = null;
    }
    if (body.priority) task.priority = body.priority;
    if (body.assignedTo !== undefined) task.assignedTo = body.assignedTo || null;
    if (body.assignedToName !== undefined) task.assignedToName = body.assignedToName || '';
    if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (Array.isArray(body.tags)) task.tags = body.tags;

    await task.save();
    res.json({ success: true, task });
  } catch (e) {
    console.error('[tasks:update] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer une tâche
app.delete('/api/admin/tasks/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });
    await task.deleteOne();
    res.json({ success: true });
  } catch (e) {
    console.error('[tasks:delete] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Liste des membres SAV pour l'assignation des tâches
app.get('/api/admin/tasks/team', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName email role')
      .sort({ firstName: 1, lastName: 1 })
      .lean();
    const team = users.map(u => ({
      id: String(u._id),
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || (u.email || 'Utilisateur'),
      email: u.email || '',
      role: u.role || 'agent'
    }));
    res.json({ success: true, team });
  } catch (e) {
    console.error('[tasks:team] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Initialiser les routes de statistiques pour le dashboard
setupStatsRoutes(app, authenticateAdmin);

// ========= Rappels de tâches & Digest =========
(function startTasksSchedulers() {
  // Rappels J-1 et jour J (toutes les heures)
  async function runTaskReminders() {
    try {
      const now = new Date();
      const inOneHour = new Date(Date.now() + 60*60*1000);
      const in24hStart = new Date(Date.now() + 24*60*60*1000);
      const in24hEnd = new Date(Date.now() + 25*60*60*1000);
      // Jour J: due dans l'heure
      const dayOfTasks = await Task.find({ assignedTo: { $ne: null }, status: { $ne: 'done' }, dueDate: { $gte: now, $lte: inOneHour } }).lean();
      for (const t of dayOfTasks) {
        await maybeNotifyTaskReminder(t, 'Rappel échéance', `"${t.title}" arrive à échéance vers ${t.dueDate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      }
      // J-1: due entre 24h et 25h
      const dayMinusOne = await Task.find({ assignedTo: { $ne: null }, status: { $ne: 'done' }, dueDate: { $gte: in24hStart, $lte: in24hEnd } }).lean();
      for (const t of dayMinusOne) {
        await maybeNotifyTaskReminder(t, 'Rappel J-1', `"${t.title}" est prévu demain (${new Date(t.dueDate).toLocaleDateString('fr-FR')})`);
      }
    } catch (e) { console.warn('[tasks:reminders] erreur', e); }
  }

  async function maybeNotifyTaskReminder(task, title, message) {
    try {
      if (!task.assignedTo) return;
      const recent = await Notification.findOne({ userId: task.assignedTo, type: 'task_reminder', taskId: task._id, createdAt: { $gte: new Date(Date.now() - 12*60*60*1000) } });
      if (recent) return;
      await Notification.create({ userId: task.assignedTo, type: 'task_reminder', taskId: task._id, title, message });
    } catch (_) {}
  }

  let lastDigestDay = null;
  async function runMorningDigestIfNeeded() {
    const now = new Date();
    const hour = now.getHours();
    const dayKey = now.toISOString().slice(0,10);
    if (hour !== 8 || lastDigestDay === dayKey) return;
    try {
      // Par agent: urgences + échéances du jour
      const users = await User.find({ isActive: true }).select('_id').lean();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      for (const u of users) {
        const urgentCount = await Task.countDocuments({ assignedTo: u._id, status: { $ne: 'done' }, priority: { $in: ['high','urgent'] } });
        const dueTodayCount = await Task.countDocuments({ assignedTo: u._id, status: { $ne: 'done' }, dueDate: { $gte: startOfToday, $lte: endOfToday } });
        if (urgentCount + dueTodayCount > 0) {
          await Notification.create({ userId: u._id, type: 'task_digest', title: 'Digest du jour', message: `${urgentCount} urgent(es), ${dueTodayCount} échéance(s) aujourd'hui` });
        }
      }
      lastDigestDay = dayKey;
    } catch (e) { console.warn('[tasks:digest] erreur', e); }
  }

  setInterval(runTaskReminders, 60*60*1000);
  setInterval(runMorningDigestIfNeeded, 10*60*1000);
})();

// Gestionnaire global d'erreurs pour renvoyer un JSON propre (notamment pour Multer)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('MulterError:', err);
    // 413 Payload Too Large
    return res.status(413).json({
      success: false,
      message: `Fichier trop volumineux. Limite ${MAX_FILE_SIZE_MB}MB`,
      code: err.code
    });
  }
  if (err) {
    console.error('Erreur non gérée:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
  next();
});

// Démarrer le watcher SLA (rappels 20h / alertes 24h)
try {
  startSlaWatcher();
} catch (e) {
  console.error('[slaWatcher] non démarré:', e);
}

// Démarrer le watcher de livraison ParcelPanel
try {
  startDeliveryWatcher();
} catch (e) {
  console.error('[deliveryWatcher] non démarré:', e);
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
