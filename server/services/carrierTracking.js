/*
  Service de suivi transporteur (temps réel) via AfterShip (optionnel)
  - Nécessite AFTERSHIP_API_KEY dans l'environnement pour les événements détaillés
  - Fournit un lien public de suivi pour les transporteurs courants en fallback
*/

let fetchFn = global.fetch;
if (!fetchFn) {
  try { fetchFn = require('undici').fetch; } catch (_) {}
}

function carrierSlugGuess(input = '') {
  const v = String(input || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('ups')) return 'ups';
  if (v.includes('chronopost')) return 'chronopost-fr';
  if (v.includes('colissimo') || v.includes('la poste') || v.includes('laposte')) return 'colissimo';
  if (v.includes('dhl')) return 'dhl';
  if (v.includes('dpd')) return 'dpd';
  if (v.includes('gls')) return 'gls';
  return '';
}

function getCarrierPublicLink(carrier = '', trackingNumber = '') {
  const num = encodeURIComponent(String(trackingNumber || '').trim());
  const v = String(carrier || '').trim().toLowerCase();
  if (v.includes('ups')) return `https://www.ups.com/track?tracknum=${num}`;
  if (v.includes('chronopost')) return `https://www.chronopost.fr/fr/suivi?listeNumeros=${num}`;
  if (v.includes('colissimo') || v.includes('laposte') || v.includes('la poste')) return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
  if (v.includes('dhl')) return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${num}`;
  if (v.includes('dpd')) return `https://www.dpd.com/fr/fr/suivi-colis/?parcelNumber=${num}`;
  if (v.includes('gls')) return `https://gls-group.com/FR/fr/suivi-colis?match=${num}`;
  // Fallback généraliste
  return `https://www.17track.net/fr/track?nums=${num}`;
}

async function detectAfterShipCarrier(apiKey, trackingNumber) {
  const url = 'https://api.aftership.com/v4/couriers/detect';
  const resp = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'aftership-api-key': apiKey
    },
    body: JSON.stringify({ tracking_number: String(trackingNumber || '').trim() })
  });
  const data = await resp.json().catch(() => ({}));
  const list = data && data.data && Array.isArray(data.data.couriers) ? data.data.couriers : [];
  return (list[0] && list[0].slug) ? String(list[0].slug) : '';
}

function normalizeAfterShipCheckpoint(cp) {
  // cp fields: checkpoint_time, location, city, state, country_name, message, tag
  if (!cp || typeof cp !== 'object') return null;
  const at = cp.checkpoint_time || cp.created_at || cp.time;
  const city = cp.city || '';
  const state = cp.state || cp.state_name || '';
  const country = cp.country_name || cp.country_iso2 || cp.country_iso3 || '';
  const pieces = [city, state, country].map(s => String(s || '').trim()).filter(Boolean);
  const location = pieces.join(', ');
  const status = cp.tag || '';
  const description = cp.message || cp.description || '';
  return {
    at: at ? new Date(at).toISOString() : null,
    status,
    description,
    location
  };
}

async function fetchAfterShipEvents({ apiKey, carrier, trackingNumber }) {
  const cleanNum = String(trackingNumber || '').trim();
  if (!cleanNum) return { success: false, events: [], provider: 'aftership' };
  // Détecter le slug si besoin
  let slug = carrierSlugGuess(carrier);
  if (!slug) {
    try { slug = await detectAfterShipCarrier(apiKey, cleanNum); } catch (_) {}
  }
  if (!slug) return { success: false, events: [], provider: 'aftership', reason: 'carrier_detect_failed' };
  const url = `https://api.aftership.com/v4/trackings/${encodeURIComponent(slug)}/${encodeURIComponent(cleanNum)}`;
  const resp = await fetchFn(url, { headers: { 'aftership-api-key': apiKey, 'accept': 'application/json' } });
  const data = await resp.json().catch(() => ({}));
  const tracking = data && data.data && data.data.tracking ? data.data.tracking : null;
  const cps = tracking && Array.isArray(tracking.checkpoints) ? tracking.checkpoints : [];
  const events = cps.map(normalizeAfterShipCheckpoint).filter(Boolean).sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
  return { success: true, events, provider: 'aftership' };
}

async function getCarrierTrackingEvents({ carrier = '', trackingNumber = '' } = {}) {
  const link = getCarrierPublicLink(carrier, trackingNumber);
  const apiKey = (process.env.AFTERSHIP_API_KEY || '').trim();
  if (!apiKey || !fetchFn) {
    return { success: false, provider: null, events: [], link, reason: 'no_api_key' };
  }
  try {
    const out = await fetchAfterShipEvents({ apiKey, carrier, trackingNumber });
    return { ...out, link };
  } catch (e) {
    return { success: false, provider: 'aftership', events: [], link, reason: e && e.message ? e.message : 'unknown_error' };
  }
}

module.exports = {
  getCarrierTrackingEvents,
  getCarrierPublicLink
};
