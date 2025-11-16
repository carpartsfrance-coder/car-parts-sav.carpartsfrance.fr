'use strict';

function extractVinOrPlateFromText(text) {
  try {
    const str = String(text ?? '').trim();
    if (!str) return null;
    const vinMatch = str.match(/([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      return { type: 'vin', value: vinMatch[1].toUpperCase() };
    }
    const plateMatch = str.match(/\b([A-Z]{2}-?\d{3}-?[A-Z]{2})\b/i);
    if (plateMatch && plateMatch[1]) {
      const raw = plateMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      return { type: 'plate', value: `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5, 7)}` };
    }
    return null;
  } catch {
    return null;
  }
}

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
      if (isUrl(val)) continue;

      const byExactKey = keywordKeys.some(k => keyN === normKey(k));
      const byKeyInclude = keyIncludes.some(k => keyL.includes(k));
      const foundInText = extractVinOrPlateFromText(val);
      const byVin = looksVin(val) || (foundInText?.type === 'vin');
      const byPlate = looksFrPlate(val) || (foundInText?.type === 'plate');
      if (!byVin && !byPlate) continue;

      let score = -1;
      if (byExactKey && (byVin || byPlate)) score = 110;
      else if (byExactKey) score = 100;
      else if (byKeyInclude && (byVin || byPlate)) score = 90;
      else if (byKeyInclude) score = 80;
      if (byVin) score = Math.max(score, 78);
      if (byPlate) score = Math.max(score, 68);
      if (score < 0) continue;

      if ((byExactKey || byKeyInclude) && val.length > 64) continue;

      let chosen = val;
      if (foundInText && foundInText.value) chosen = foundInText.value;
      if (score > bestScore) {
        bestScore = score;
        best = { key: rawKey || 'vin_or_plaque', id: m.id != null ? String(m.id) : undefined, value: chosen };
      }
    }
    return best;
  } catch {
    return null;
  }
}

function extractVinFromWooLineItems(lineItems) {
  try {
    if (!Array.isArray(lineItems)) return null;
    for (const li of lineItems) {
      const metas = Array.isArray(li?.meta_data) ? li.meta_data : [];
      const found = extractVinFromWooMeta(metas);
      if (found && found.value) return found;
      const fromName = extractVinOrPlateFromText(li?.name || '');
      if (fromName) return { key: 'line_item_name', value: fromName.value };
    }
    return null;
  } catch {
    return null;
  }
}

function extractVinFromWooOrder(payload) {
  try {
    const a = extractVinFromWooMeta(payload?.meta_data);
    if (a && a.value) return a;
    const b = extractVinFromWooLineItems(payload?.line_items);
    if (b && b.value) return b;
    const c0 = extractVinOrPlateFromText(payload?.customer_note || '');
    if (c0 && c0.value) return { key: 'customer_note', value: c0.value };
    const d0 = extractVinOrPlateFromText(payload?.billing?.company || '');
    if (d0 && d0.value) return { key: 'billing.company', value: d0.value };
    const d1 = extractVinOrPlateFromText(payload?.shipping?.company || '');
    if (d1 && d1.value) return { key: 'shipping.company', value: d1.value };
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  extractVinOrPlateFromText,
  extractVinFromWooMeta,
  extractVinFromWooLineItems,
  extractVinFromWooOrder
};
