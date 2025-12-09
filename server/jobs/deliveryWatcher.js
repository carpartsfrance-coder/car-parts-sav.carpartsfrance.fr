const Order = require('../models/order');
const { getCarrierTrackingEvents } = require('../services/carrierTracking');
const { sendGenericEmail } = require('../services/emailService');

let fetchFn = global.fetch;
if (!fetchFn) {
  try { fetchFn = require('undici').fetch; } catch (_) {}
}

// Réconciliation ponctuelle: si une commande est en 'delivered_awaiting_deposit' mais que ParcelPanel n'indique pas "delivered",
// on la repasse en 'fulfilled' (expédiée) pour éviter les faux positifs.
async function runDeliveryReconciliationOnce() {
  const apiKey = (process.env.PARCELPANEL_API_KEY || '').trim();
  if (!apiKey || !fetchFn) return { scanned: 0, reverted: 0 };

  const candidates = await Order.find({
    status: 'delivered_awaiting_deposit',
    provider: 'woocommerce',
    providerOrderId: { $exists: true, $ne: '' },
    'shipping.trackingNumber': { $exists: true, $ne: '' }
  }, { providerOrderId: 1, 'shipping.trackingNumber': 1 }).lean();

  if (!candidates.length) return { scanned: 0, reverted: 0 };

  let scanned = 0;
  let reverted = 0;
  for (const group of chunk(candidates.map(c => String(c.providerOrderId)), 40)) {
    try {
      const details = await fetchPPTrackingDetails(group, apiKey);
      scanned += group.length;
      // Indexer par order_id pour accès rapide
      const byId = new Map(details.map(it => [String(it.order_id || it.number || '').trim(), it]));
      for (const orderId of group) {
        const item = byId.get(String(orderId));
        if (!item) continue; // si aucun détail, ne pas toucher (conservateur)
        const shipments = Array.isArray(item.shipments) ? item.shipments : [];
        if (!shipments.length) continue; // sans shipments, on s'abstient
        const hasDelivered = shipments.some(isDeliveredFromPPShipment);
        if (!hasDelivered) {
          await Order.updateOne(
            { provider: 'woocommerce', providerOrderId: orderId },
            {
              $set: { status: 'fulfilled' },
              $push: {
                events: {
                  $each: [
                    { type: 'status_reconciled', message: 'Réconciliation: awaiting_deposit -> fulfilled (pas livré selon ParcelPanel)', at: new Date(), payloadSnippet: { provider: 'parcelpanel' } }
                  ]
                }
              }
            }
          );
          reverted += 1;
        }
      }
    } catch (e) {
      console.warn('[deliveryReconcile] PP batch error:', e && e.message ? e.message : e);
    }
  }
  return { scanned, reverted };
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isDeliveredFromPPShipment(shipment) {
  try {
    if (!shipment) return false;
    const st = String(shipment.status || '').toLowerCase();
    if (st === 'delivered') return true;
    const infos = Array.isArray(shipment.track_info) ? shipment.track_info : [];
    return infos.some(i => String(i.checkpoint_status || '').toLowerCase() === 'delivered');
  } catch (_) {
    return false;
  }
}

async function fetchPPTrackingDetails(orderIds, apiKey) {
  const url = 'https://wp-api.parcelpanel.com/api/v1/tracking/list';
  const body = { orders: orderIds.map(id => ({ order_id: id })) };
  const resp = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'PP-Api-Key': apiKey },
    body: JSON.stringify(body)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json && (json.msg || json.message) ? (json.msg || json.message) : `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  const data = json && json.data ? json.data : [];
  return Array.isArray(data) ? data : [];
}

async function runDeliveryScanOnce() {
  const apiKey = (process.env.PARCELPANEL_API_KEY || '').trim();
  if (!apiKey || !fetchFn) return { scanned: 0, delivered: 0 };

  // Normalisation préalable: toute commande avec tracking passe en "expédiée" si non finale
  const finals = ['delivered_awaiting_deposit','deposit_received','cancelled','refunded','delivered'];
  try {
    await Order.updateMany(
      {
        'shipping.trackingNumber': { $exists: true, $ne: '' },
        status: { $nin: finals }
      },
      { $set: { status: 'fulfilled' } }
    );
  } catch (_) {}

  // Candidates: Woo, tracking présent, statut non final
  const candidates = await Order.find({
    provider: 'woocommerce',
    providerOrderId: { $exists: true, $ne: '' },
    'shipping.trackingNumber': { $exists: true, $ne: '' },
    status: { $nin: finals }
  }, { providerOrderId: 1, 'shipping.trackingNumber': 1, 'shipping.carrier': 1 }).lean();

  if (!candidates.length) return { scanned: 0, delivered: 0 };

  const idToInfo = new Map(candidates.map(c => [String(c.providerOrderId), { tracking: c.shipping?.trackingNumber || '', carrier: c.shipping?.carrier || '' }]));
  let scanned = 0;
  let delivered = 0;

  for (const group of chunk(candidates.map(c => String(c.providerOrderId)), 40)) {
    try {
      const details = await fetchPPTrackingDetails(group, apiKey);
      scanned += group.length;
      for (const item of details) {
        const orderId = String(item.order_id || item.number || '').trim();
        const shipments = Array.isArray(item.shipments) ? item.shipments : [];
        let hasDelivered = shipments.some(isDeliveredFromPPShipment);
        let providerTag = 'parcelpanel';
        const info = idToInfo.get(orderId) || { tracking: '', carrier: '' };
        if (!hasDelivered && info.tracking) {
          // Fallback AfterShip si ParcelPanel ne remonte rien
          try {
            const as = await getCarrierTrackingEvents({ carrier: info.carrier, trackingNumber: info.tracking });
            if (as && Array.isArray(as.events)) {
              hasDelivered = as.events.some(ev => String(ev.status || '').toLowerCase() === 'delivered');
              if (hasDelivered) providerTag = as.provider || 'aftership';
            }
          } catch (_) {}
        }
        if (hasDelivered) {
          const trackingNumber = info.tracking || '';
          await Order.updateOne(
            { provider: 'woocommerce', providerOrderId: orderId, status: { $nin: ['delivered_awaiting_deposit','deposit_received','cancelled','refunded','delivered'] } },
            {
              $set: { status: 'delivered_awaiting_deposit' },
              $push: {
                events: {
                  $each: [
                    { type: 'order_delivered', message: 'Commande livrée (auto)', at: new Date(), payloadSnippet: { provider: providerTag, trackingNumber } }
                  ]
                }
              }
            }
          );
          delivered += 1;
        }
      }
    } catch (e) {
      // Ne pas bloquer les autres groupes sur erreur
      console.warn('[deliveryWatcher] PP batch error:', e && e.message ? e.message : e);
    }
  }
  return { scanned, delivered };
}

// Marquer en retard les commandes dont la date estimée est dépassée sans expédition, et prévenir le client (une seule fois)
async function runEstimatedOverdueScanOnce() {
  const now = new Date();
  const finals = ['delivered','delivered_awaiting_deposit','deposit_received','cancelled','refunded'];
  // 1) Réinitialiser les flags de retard si la commande est expédiée ou si la date a été repoussée
  try {
    await Order.updateMany({
      'meta.isOverdueEstimated': true,
      $or: [
        { status: { $in: ['fulfilled', ...finals] } },
        { 'shipping.trackingNumber': { $exists: true, $ne: '' } },
        { 'shipping.estimatedDeliveryAt': { $gt: now } }
      ]
    }, { $set: { 'meta.isOverdueEstimated': false } });
  } catch (_) {}

  // 2) Sélectionner les commandes à marquer en retard
  const candidates = await Order.find({
    'shipping.estimatedDeliveryAt': { $lte: now },
    status: { $nin: ['fulfilled', ...finals] },
    $or: [ { 'shipping.trackingNumber': { $exists: false } }, { 'shipping.trackingNumber': '' } ]
  }, { customer: 1, number: 1, provider: 1, providerOrderId: 1, 'shipping.estimatedDeliveryAt': 1, 'meta.estimatedOverdueNotifiedAt': 1 }).lean();

  if (!candidates.length) return { marked: 0, mailed: 0 };

  let marked = 0; let mailed = 0;
  const WEBSITE_URL = (process.env.WEBSITE_URL && process.env.WEBSITE_URL.trim()) || 'http://localhost:3001';
  const logoUrl = `${WEBSITE_URL.replace(/\/$/, '')}/assets/logo-v2.png`;

  for (const o of candidates) {
    try {
      // Marquer le retard
      await Order.updateOne({ _id: o._id }, {
        $set: { 'meta.isOverdueEstimated': true },
        $push: { events: { $each: [ { type: 'estimated_overdue', at: new Date(), message: 'Date estimée dépassée sans expédition' } ] } }
      });
      marked += 1;
      // Email d’excuse (une seule fois)
      if (!o?.meta?.estimatedOverdueNotifiedAt && o?.customer?.email) {
        const to = String(o.customer.email || '').trim();
        if (to) {
          const pretty = o.shipping?.estimatedDeliveryAt ? new Date(o.shipping.estimatedDeliveryAt).toLocaleDateString('fr-FR') : '';
          const subject = `Retard de livraison – Commande ${o.number || ''}`;
          const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style=\"background:#E30613;color:#ffffff;padding:16px 20px;display:flex;align-items:center;gap:12px;\">
              <img src=\"${logoUrl}\" alt=\"Car Parts France\" style=\"height:36px;width:auto;display:block;\"/>
              <div style=\"font-weight:700;font-size:16px;\">Information sur votre commande</div>
            </div>
            <div style=\"padding:20px;\">
              <p style=\"margin:0 0 10px 0;color:#1f2937;\">Bonjour${o.customer?.name ? ` ${o.customer.name}` : ''},</p>
              <p style=\"margin:8px 0;color:#1f2937;\">Nous sommes désolés, votre commande${o.number ? ` <strong>${o.number}</strong>` : ''} a subi un contretemps.</p>
              <p style=\"margin:8px 0;color:#1f2937;\">La date estimée du <strong>${pretty || '—'}</strong> est dépassée et elle n’a pas encore été expédiée. Nous allons rétablir une nouvelle date de livraison rapidement.</p>
              <p style=\"margin:8px 0;color:#1f2937;\">Merci pour votre patience.</p>
            </div>
            <div style=\"padding:14px 20px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;\">Ce message est automatique, merci de ne pas y répondre directement.</div>
          </div>`;
          const text = `Désolé, retard de livraison pour votre commande${o.number ? ` ${o.number}` : ''}. La date estimée ${pretty || ''} est dépassée. Nous revenons vers vous avec une nouvelle date.`;
          try { await sendGenericEmail({ to, subject, html, text }); mailed += 1; } catch(_) {}
          await Order.updateOne({ _id: o._id }, { $set: { 'meta.estimatedOverdueNotifiedAt': new Date() }, $push: { events: { $each: [ { type: 'estimated_overdue_mail_sent', at: new Date() } ] } } });
        }
      }
    } catch (e) {
      // continuer avec les autres
    }
  }
  return { marked, mailed };
}

function startDeliveryWatcher() {
  const intervalMinutes = parseInt(process.env.PARCELPANEL_WATCHER_INTERVAL_MINUTES || '30', 10);
  let running = false;
  const safeRun = async () => {
    if (running) return;
    running = true;
    try {
      const out = await runDeliveryScanOnce();
      const over = await runEstimatedOverdueScanOnce();
      console.log(`[deliveryWatcher] Scan terminé: candidats=${out.scanned}, livrés=${out.delivered}, retard marqués=${over.marked}, mails=${over.mailed}`);
    } catch (e) {
      console.error('[deliveryWatcher] Exécution échouée:', e && e.message ? e.message : e);
    } finally {
      running = false;
    }
  };
  // premier run après 45s
  setTimeout(safeRun, 45 * 1000);
  // exécution périodique
  setInterval(safeRun, Math.max(1, intervalMinutes) * 60 * 1000);
  console.log(`[deliveryWatcher] Démarré. Intervalle=${intervalMinutes} min`);
}

module.exports = { startDeliveryWatcher, runDeliveryReconciliationOnce, runDeliveryScanOnce, runEstimatedOverdueScanOnce };
