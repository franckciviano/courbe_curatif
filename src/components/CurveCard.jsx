import React, { useMemo } from 'react';
import {
  getGammeNames,
  getOptions,
  getClassificationLabel,
  findEntry,
  autoCurveName,
  estimateFromAnnualKm,
} from '../lib/calc.js';

const fmtEur = (v) =>
  v == null || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';
const fmtKm = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

const selectClass =
  'w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const inputClass =
  'w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200';

const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

export default function CurveCard({ curve, onChange, onRemove, onDuplicate }) {
  const gammeNames = getGammeNames();
  const classificationLabel = getClassificationLabel(curve.gamme);

  const opts = useMemo(
    () =>
      getOptions(curve.gamme, {
        classification: curve.classification,
        silhouette: curve.silhouette,
        poc: curve.poc,
      }),
    [curve.gamme, curve.classification, curve.silhouette, curve.poc]
  );

  const entry = findEntry(curve.gamme, {
    classification: curve.classification,
    silhouette: curve.silhouette,
    poc: curve.poc,
    duree: curve.duree,
  });

  const isUnavailable =
    curve.gamme && curve.classification && curve.silhouette && curve.poc && curve.duree && !entry;

  const estimate = useMemo(
    () => (entry && curve.kmAnnuel ? estimateFromAnnualKm(curve, curve.kmAnnuel) : null),
    [curve, entry]
  );

  const update = (patch) => {
    const next = { ...curve, ...patch };
    // Cascade reset: if gamme changes, reset everything below
    if ('gamme' in patch) {
      next.classification = null;
      next.silhouette = null;
      next.poc = null;
      next.duree = null;
    } else if ('classification' in patch) {
      next.silhouette = null;
      next.poc = null;
      next.duree = null;
    } else if ('silhouette' in patch) {
      next.poc = null;
      next.duree = null;
    } else if ('poc' in patch) {
      next.duree = null;
    }
    // Refresh auto name if user has not overridden
    if (!next.nameTouched) {
      next.name = autoCurveName(next);
    }
    onChange(next);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-lg shadow-violet-500/10 transition-all duration-200">
      {/* Header: visibility + name + delete */}
      <div className="flex items-center gap-2 mb-3">
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={curve.visible}
            onChange={(e) => onChange({ ...curve, visible: e.target.checked })}
            className="w-4 h-4 accent-violet-500 cursor-pointer"
          />
          <span
            className="inline-block w-3 h-3 rounded-full border border-white/30"
            style={{ backgroundColor: curve.color }}
          />
        </label>
        <input
          type="text"
          value={curve.name}
          onChange={(e) => onChange({ ...curve, name: e.target.value, nameTouched: true })}
          className={`${inputClass} text-sm font-medium`}
        />
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Dupliquer la courbe"
          title="Dupliquer la courbe"
          className="shrink-0 p-1.5 text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-all duration-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer la courbe"
          title="Supprimer la courbe"
          className="shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={labelClass}>Gamme</label>
          <select
            className={selectClass}
            value={curve.gamme || ''}
            onChange={(e) => update({ gamme: e.target.value })}
          >
            <option value="">—</option>
            {gammeNames.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelClass}>{classificationLabel}</label>
          <select
            className={selectClass}
            value={curve.classification || ''}
            disabled={!curve.gamme || opts.classification.length === 0}
            onChange={(e) => update({ classification: e.target.value || null })}
          >
            <option value="">—</option>
            {opts.classification.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Silhouette</label>
          <select
            className={selectClass}
            value={curve.silhouette || ''}
            disabled={!curve.classification || opts.silhouette.length === 0}
            onChange={(e) => update({ silhouette: e.target.value || null })}
          >
            <option value="">—</option>
            {opts.silhouette.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>POC</label>
          <select
            className={selectClass}
            value={curve.poc || ''}
            disabled={!curve.silhouette || opts.poc.length === 0}
            onChange={(e) => update({ poc: e.target.value || null })}
          >
            <option value="">—</option>
            {opts.poc.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Durée (mois)</label>
          <select
            className={selectClass}
            value={curve.duree ?? ''}
            disabled={!curve.poc || opts.duree.length === 0}
            onChange={(e) => update({ duree: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">—</option>
            {opts.duree.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Heures PMT</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={curve.heuresPMT}
            onChange={(e) => onChange({ ...curve, heuresPMT: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {isUnavailable && (
        <p className="mt-2 text-xs text-amber-400/80">Combinaison indisponible</p>
      )}

      {/* Estimation directe à partir d'un km annuel */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass}>Km annuel → coût curatif</label>
            <input
              type="number"
              step="1000"
              min="0"
              placeholder="ex: 120000"
              value={curve.kmAnnuel ?? ''}
              onChange={(e) => onChange({ ...curve, kmAnnuel: e.target.value })}
              className={inputClass}
              disabled={!entry}
            />
          </div>
          <div className="shrink-0 min-w-[110px] text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Curatif</div>
            <div className={`text-base font-semibold ${estimate && estimate.over ? 'text-amber-300' : 'text-violet-200'}`}>
              {estimate ? fmtEur(estimate.value) : '—'}
            </div>
          </div>
        </div>
        {estimate && (
          <p className={`mt-1 text-[10px] ${estimate.over ? 'text-amber-400/80' : 'text-slate-500'}`}>
            {fmtKm(estimate.kmMensuel)} km/mois
            {estimate.over &&
              ` · dépasse le plafond de 800 000 km sur ${curve.duree}m (max ${fmtKm(estimate.cap)} km/mois)`}
          </p>
        )}
      </div>
    </div>
  );
}
