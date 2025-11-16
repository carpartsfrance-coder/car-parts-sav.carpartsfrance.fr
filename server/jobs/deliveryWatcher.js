const Order = require('../models/order');

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

  // Candidates: expédiées, Woo, tracking présent
  const candidates = await Order.find({
    status: 'fulfilled',
    provider: 'woocommerce',
    providerOrderId: { $exists: true, $ne: '' },
    'shipping.trackingNumber': { $exists: true, $ne: '' }
  }, { providerOrderId: 1, 'shipping.trackingNumber': 1 }).lean();

  if (!candidates.length) return { scanned: 0, delivered: 0 };

  const idToTracking = new Map(candidates.map(c => [String(c.providerOrderId), c.shipping?.trackingNumber || '']));
  let scanned = 0;
  let delivered = 0;

  for (const group of chunk(candidates.map(c => String(c.providerOrderId)), 40)) {
    try {
      const details = await fetchPPTrackingDetails(group, apiKey);
      scanned += group.length;
      for (const item of details) {
        const orderId = String(item.order_id || item.number || '').trim();
        const shipments = Array.isArray(item.shipments) ? item.shipments : [];
        const hasDelivered = shipments.some(isDeliveredFromPPShipment);
        if (hasDelivered) {
          const trackingNumber = idToTracking.get(orderId) || '';
          await Order.updateOne(
            { provider: 'woocommerce', providerOrderId: orderId },
            {
              $set: { status: 'delivered_awaiting_deposit' },
              $push: {
                events: {
                  $each: [
                    { type: 'order_delivered', message: 'Commande livrée (ParcelPanel)', at: new Date(), payloadSnippet: { provider: 'parcelpanel', trackingNumber } }
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

function startDeliveryWatcher() {
  const intervalMinutes = parseInt(process.env.PARCELPANEL_WATCHER_INTERVAL_MINUTES || '30', 10);
  let running = false;
  const safeRun = async () => {
    if (running) return;
    running = true;
    try {
      const out = await runDeliveryScanOnce();
      console.log(`[deliveryWatcher] Scan terminé: candidats=${out.scanned}, livrés=${out.delivered}`);
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

module.exports = { startDeliveryWatcher, runDeliveryReconciliationOnce };
