import React, { useMemo } from 'react';
import { buildMergedSeries } from '../lib/calc.js';

const KM_MIN = 500;
const KM_MAX = 20000;
const KM_STEP = 500;

const fmtKm = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtEur = (v) =>
  v == null || Number.isNaN(v)
    ? ''
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';
const fmtPct = (v) =>
  v == null || Number.isNaN(v) || !isFinite(v)
    ? ''
    : (v >= 0 ? '+' : '') +
      new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v) +
      ' %';

function computeDeltas(rows, visible) {
  const deltas = rows.map(() => ({}));
  if (visible.length === 0) return deltas;
  const ref = visible[0];
  for (let i = 0; i < rows.length; i++) {
    const refVal = rows[i][ref.id];
    for (const c of visible) {
      if (c.id === ref.id) {
        deltas[i][c.id] = null;
        continue;
      }
      const cur = rows[i][c.id];
      if (cur == null || refVal == null || refVal === 0) {
        deltas[i][c.id] = null;
      } else {
        deltas[i][c.id] = ((cur - refVal) / refVal) * 100;
      }
    }
  }
  return deltas;
}

function downloadCsv(filename, rows, deltas, visible, uniqueDurees) {
  const ref = visible[0];
  const nonRef = visible.slice(1);
  const totalHeaders = uniqueDurees.length > 1
    ? uniqueDurees.map((d) => `Km total (${d}m)`)
    : ['Km total'];
  const header = [
    'Km/mois',
    'Km/an',
    ...totalHeaders,
    ...visible.map((c) => c.name),
    ...nonRef.map((c) => `${c.name} Δ % vs ${ref.name}`),
  ];
  const lines = [header.join(';')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const d = deltas[i];
    const totals = uniqueDurees.map((duree) => Math.round(r.km * duree));
    const values = visible.map((c) => (r[c.id] == null ? '' : Math.round(r[c.id])));
    const pcts = nonRef.map((c) => {
      const v = d[c.id];
      return v == null || !isFinite(v) ? '' : v.toFixed(2).replace('.', ',');
    });
    lines.push([r.km, r.km * 12, ...totals, ...values, ...pcts].join(';'));
  }
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CurveTable({ curves, overrides = {}, onResetOverrides }) {
  const hasOverrides = Object.keys(overrides).length > 0;

  // Force rows up to KM_MAX, ignoring the 800 000 km contract cap
  const { rows, visible } = useMemo(
    () => buildMergedSeries(curves, KM_MIN, KM_STEP, overrides, KM_MAX, true),
    [curves, overrides]
  );

  const visibleCurves = visible || [];

  // Unique contract durations for KM TOTAL columns
  const uniqueDurees = useMemo(() => {
    const seen = new Set();
    return visibleCurves.map((c) => c.duree).filter((d) => d != null && !seen.has(d) && seen.add(d));
  }, [visibleCurves]);

  const deltas = useMemo(
    () => computeDeltas(rows, visibleCurves),
    [rows, visibleCurves]
  );

  const handleExport = () => {
    if (visibleCurves.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`curatif_${today}.csv`, rows, deltas, visibleCurves, uniqueDurees);
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 min-h-0">
      {/* Override banner */}
      {hasOverrides && (
        <div className="shrink-0 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <span className="font-semibold">⚠ Coefficients modifiés</span>
            <span className="text-amber-600 text-xs">— les prix affichés reflètent vos modifications de test</span>
          </div>
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors font-medium shrink-0"
          >
            ↩ Réinitialiser aux valeurs officielles
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{visibleCurves.length}</span> courbe{visibleCurves.length > 1 ? 's' : ''} visible{visibleCurves.length > 1 ? 's' : ''} ·
          {' '}<span className="font-semibold text-slate-800">{rows.length}</span> lignes (pas de {fmtKm(KM_STEP)} km, de {fmtKm(KM_MIN)} à {fmtKm(KM_MAX)} km/mois)
          {visibleCurves.length > 1 && (
            <>
              {' '}· Δ % calculé vs <span className="font-semibold text-slate-800">{visibleCurves[0].name}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={visibleCurves.length === 0}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-violet-500/20 transition-all duration-200 inline-flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV (Excel)
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {visibleCurves.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Aucune courbe visible.
          </div>
        ) : (
          <div className="flex-1 overflow-auto scroll-area">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                    Km / mois
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                    Km / an
                  </th>
                  {uniqueDurees.map((duree) => (
                    <th
                      key={`total-${duree}`}
                      className="px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap"
                    >
                      Km total{uniqueDurees.length > 1 ? ` (${duree}m)` : ''}
                    </th>
                  ))}
                  {visibleCurves.map((c) => (
                    <th
                      key={`v-${c.id}`}
                      className="px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-2 justify-end">
                        <span className="text-slate-700 normal-case tracking-normal font-medium">{c.name}</span>
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                      </div>
                    </th>
                  ))}
                  {visibleCurves.slice(1).map((c, idx) => (
                    <th
                      key={`p-${c.id}`}
                      className={`px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap ${
                        idx === 0 ? 'border-l border-slate-200' : ''
                      }`}
                    >
                      <div className="inline-flex items-center gap-2 justify-end">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-slate-700 normal-case tracking-normal font-medium">
                          Δ % vs {visibleCurves[0].name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.km} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-1.5 text-slate-600 font-mono border-b border-slate-100">
                      {fmtKm(r.km)}
                    </td>
                    <td className="px-4 py-1.5 text-slate-500 font-mono border-b border-slate-100">
                      {fmtKm(r.km * 12)}
                    </td>
                    {uniqueDurees.map((duree) => (
                      <td
                        key={`total-${duree}`}
                        className="px-4 py-1.5 text-right text-slate-700 font-mono font-medium border-b border-slate-100 whitespace-nowrap"
                      >
                        {fmtKm(r.km * duree)}
                      </td>
                    ))}
                    {visibleCurves.map((c) => (
                      <td
                        key={`v-${c.id}`}
                        className="px-4 py-1.5 text-right text-slate-800 font-mono border-b border-slate-100 whitespace-nowrap"
                      >
                        {fmtEur(r[c.id])}
                      </td>
                    ))}
                    {visibleCurves.slice(1).map((c, j) => {
                      const v = deltas[i][c.id];
                      const cls =
                        v == null
                          ? 'text-slate-300'
                          : v > 0
                          ? 'text-emerald-600'
                          : v < 0
                          ? 'text-rose-600'
                          : 'text-slate-400';
                      return (
                        <td
                          key={`p-${c.id}`}
                          className={`px-4 py-1.5 text-right font-mono border-b border-slate-100 whitespace-nowrap ${cls} ${
                            j === 0 ? 'border-l border-slate-200' : ''
                          }`}
                        >
                          {fmtPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
