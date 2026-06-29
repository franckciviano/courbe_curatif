import defaultCoeffs from '../data/coefficients.json';

const _stored = typeof localStorage !== 'undefined' ? localStorage.getItem('coefficients_data') : null;
export let DATA = _stored ? JSON.parse(_stored) : defaultCoeffs;

export function setData(newData) {
  DATA = newData;
  localStorage.setItem('coefficients_data', JSON.stringify(newData));
}

export function resetData() {
  localStorage.removeItem('coefficients_data');
  DATA = defaultCoeffs;
}

export function getGammeNames() {
  return Object.keys(DATA.gammes);
}

export function getGamme(gammeName) {
  return DATA.gammes[gammeName] || null;
}

export function getClassificationField(gammeName) {
  const g = getGamme(gammeName);
  return g ? g.classification_field : 'moteur';
}

export function getClassificationLabel(gammeName) {
  return getClassificationField(gammeName) === 'type' ? 'Type' : 'Moteur';
}

// Generic distinct values for a given key, with filter
function distinctValues(entries, key, filter = {}) {
  const filtered = entries.filter((e) =>
    Object.entries(filter).every(([k, v]) => v == null || e[k] === v)
  );
  const vals = Array.from(new Set(filtered.map((e) => e[key])));
  // Sort numbers numerically, strings alphabetically
  if (vals.every((v) => typeof v === 'number')) return vals.sort((a, b) => a - b);
  return vals.sort();
}

// Returns options for cascading dropdowns based on the partial selection
export function getOptions(gammeName, sel) {
  const g = getGamme(gammeName);
  if (!g) return { classification: [], silhouette: [], poc: [], duree: [] };
  const cf = g.classification_field;
  const entries = g.entries;

  const classification = distinctValues(entries, cf);
  const silhouette = sel.classification
    ? distinctValues(entries, 'silhouette', { [cf]: sel.classification })
    : [];
  const poc = sel.classification && sel.silhouette
    ? distinctValues(entries, 'poc', {
        [cf]: sel.classification,
        silhouette: sel.silhouette,
      })
    : [];
  const duree = sel.classification && sel.silhouette && sel.poc
    ? distinctValues(entries, 'duree', {
        [cf]: sel.classification,
        silhouette: sel.silhouette,
        poc: sel.poc,
      })
    : [];
  return { classification, silhouette, poc, duree };
}

export function findEntry(gammeName, sel) {
  const g = getGamme(gammeName);
  if (!g) return null;
  const cf = g.classification_field;
  if (!sel.classification || !sel.silhouette || !sel.poc || sel.duree == null) return null;
  return (
    g.entries.find(
      (e) =>
        e[cf] === sel.classification &&
        e.silhouette === sel.silhouette &&
        e.poc === sel.poc &&
        e.duree === Number(sel.duree)
    ) || null
  );
}

// Gammes classified by type (PORTEUR / TRACTEUR) or explicitly flagged linear
// use a linear formula with no quadratic km² term and no c coefficient.
export function isLinearGamme(gamme) {
  return gamme && (gamme.classification_field === 'type' || gamme.linear === true);
}

/**
 * Curatif total formula:
 *  - Default (quadratic):   (km² × a) + (km × b) + c + (PMT × 1.21) − (13 × durée)
 *    c = 0 if the gamme has no c coefficient.
 *  - Type-classified gammes (C 2.5, K 2.5), linear:
 *    (a × km) + b + (PMT × 1.21) − (13 × durée)
 */
export function computeCuratif(km, entry, gamme, heuresPMT, duree) {
  if (!entry) return null;
  const a = entry.a || 0;
  const b = entry.b || 0;
  const pmt = (Number(heuresPMT) || 0) * 1.21;
  const dureeTerm = 13 * Number(duree);
  if (isLinearGamme(gamme)) {
    return a * km + b + pmt - dureeTerm;
  }
  const c = gamme && gamme.has_c ? (entry.c || 0) : 0;
  return km * km * a + km * b + c + pmt - dureeTerm;
}

// Max total km over the whole contract for any vehicle
export const KM_MAX_CONTRACT = 800000;

// Per-curve max monthly km imposed by the 800 000 km contract ceiling
export function maxKmPerMonth(duree) {
  if (!duree || duree <= 0) return Infinity;
  return KM_MAX_CONTRACT / Number(duree);
}

export function buildSeries(curve, kmMin = 2000, kmMax = 15000, step = 200, entryOverride = null, ignoreCap = false) {
  const g = getGamme(curve.gamme);
  const entry = findEntry(curve.gamme, {
    classification: curve.classification,
    silhouette: curve.silhouette,
    poc: curve.poc,
    duree: curve.duree,
  });
  if (!entry || !g) return [];
  const effectiveEntry = entryOverride ? { ...entry, ...entryOverride } : entry;
  const cap = maxKmPerMonth(curve.duree);
  const out = [];
  for (let km = kmMin; km <= kmMax; km += step) {
    const value = (!ignoreCap && km > cap) ? null : computeCuratif(km, effectiveEntry, g, curve.heuresPMT, curve.duree);
    out.push({ km, value });
  }
  return out;
}

// Builds km axis (every `step` km) and merged data rows for all visible curves.
// Each curve's value is null past its own 800 000 km cap.
export function buildMergedSeries(curves, kmMin = 2000, step = 200, entryOverrides = {}, kmMaxOverride = null, ignoreCap = false) {
  const visible = curves.filter((c) => c.visible);
  if (visible.length === 0) return { kmAxis: [], rows: [] };
  let kmMax = kmMin;
  if (kmMaxOverride) {
    kmMax = kmMaxOverride;
  } else {
    for (const c of visible) {
      if (c.duree) kmMax = Math.max(kmMax, maxKmPerMonth(c.duree));
    }
  }
  // round kmMax up to next step
  kmMax = Math.ceil(kmMax / step) * step;
  const seriesByCurve = new Map();
  for (const c of visible) {
    seriesByCurve.set(c.id, buildSeries(c, kmMin, kmMax, step, entryOverrides[c.id] || null, ignoreCap));
  }
  const first = seriesByCurve.values().next().value || [];
  const rows = first.map((p, i) => {
    const row = { km: p.km };
    for (const c of visible) {
      const s = seriesByCurve.get(c.id);
      const pt = s && s[i];
      row[c.id] = pt && pt.value != null ? pt.value : null;
    }
    return row;
  });
  return { kmAxis: rows.map((r) => r.km), rows, visible };
}

// Direct cost estimation given an annual km input
export function estimateFromAnnualKm(curve, kmAnnuel) {
  const g = getGamme(curve.gamme);
  const entry = findEntry(curve.gamme, {
    classification: curve.classification,
    silhouette: curve.silhouette,
    poc: curve.poc,
    duree: curve.duree,
  });
  if (!entry || !g) return null;
  const km = Number(kmAnnuel) / 12;
  if (!isFinite(km) || km <= 0) return null;
  const cap = maxKmPerMonth(curve.duree);
  const over = km > cap;
  const value = computeCuratif(km, entry, g, curve.heuresPMT, curve.duree);
  return { value, kmMensuel: km, over, cap };
}

export function autoCurveName(curve) {
  const parts = [
    curve.gamme || '?',
    curve.classification || '?',
    curve.silhouette || '?',
    `POC ${curve.poc || '?'}`,
    curve.duree ? `${curve.duree}M` : '?M',
  ];
  return parts.join('_');
}
