import React, { useMemo } from 'react';
import { buildMergedSeries } from '../lib/calc.js';

const KM_MIN = 2000;
const KM_STEP = 200;

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

// Per-row variation vs the first visible curve (reference) at the same km.
// Reference column is always null. Null also when ref or current value
// is missing, or the reference value is 0.
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

function downloadCsv(filename, rows, deltas, visible) {
  const ref = visible[0];
  const header = [
    'Km/mois',
    'Km/an',
    ...visible.map((c) => c.name),
    ...visible.map((c) =>
      c.id === ref.id ? `${c.name} (réf.)` : `${c.name} Δ % vs ${ref.name}`
    ),
  ];
  const lines = [header.join(';')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const d = deltas[i];
    const values = visible.map((c) => (r[c.id] == null ? '' : Math.round(r[c.id])));
    const pcts = visible.map((c) => {
      const v = d[c.id];
      // Excel FR: decimal comma
      return v == null || !isFinite(v) ? '' : v.toFixed(2).replace('.', ',');
    });
    lines.push([r.km, r.km * 12, ...values, ...pcts].join(';'));
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

export default function CurveTable({ curves }) {
  const { rows, visible } = useMemo(
    () => buildMergedSeries(curves, KM_MIN, KM_STEP),
    [curves]
  );

  const visibleCurves = visible || [];

  const deltas = useMemo(
    () => computeDeltas(rows, visibleCurves),
    [rows, visibleCurves]
  );

  const handleExport = () => {
    if (visibleCurves.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`curatif_${today}.csv`, rows, deltas, visibleCurves);
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 shadow-lg shadow-violet-500/10">
        <div className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{visibleCurves.length}</span> courbe{visibleCurves.length > 1 ? 's' : ''} visible{visibleCurves.length > 1 ? 's' : ''} ·
          {' '}<span className="font-semibold text-slate-100">{rows.length}</span> lignes (pas de 200 km, jusqu'à 800 000 km / contrat)
          {visibleCurves.length > 1 && (
            <>
              {' '}· Δ % calculé vs <span className="font-semibold text-slate-100">{visibleCurves[0].name}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={visibleCurves.length === 0}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-violet-500/30 transition-all duration-200 inline-flex items-center gap-2"
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
      <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/10 rounded-2xl shadow-xl shadow-violet-500/10 overflow-hidden flex flex-col">
        {visibleCurves.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Aucune courbe visible.
          </div>
        ) : (
          <div className="flex-1 overflow-auto scroll-area">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-white/10">
                    Km / mois
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-white/10">
                    Km / an
                  </th>
                  {visibleCurves.map((c) => (
                    <th
                      key={`v-${c.id}`}
                      className="px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-white/10 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-2 justify-end">
                        <span className="text-slate-200 normal-case tracking-normal font-medium">{c.name}</span>
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                      </div>
                    </th>
                  ))}
                  {visibleCurves.map((c, i) => {
                    const isRef = i === 0;
                    return (
                      <th
                        key={`p-${c.id}`}
                        className={`px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-white/10 whitespace-nowrap ${
                          i === 0 ? 'border-l border-white/10' : ''
                        }`}
                      >
                        <div className="inline-flex items-center gap-2 justify-end">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-slate-200 normal-case tracking-normal font-medium">
                            {isRef ? 'Réf.' : `Δ % vs ${visibleCurves[0].name}`}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.km} className={i % 2 === 0 ? 'bg-white/[0.015]' : ''}>
                    <td className="px-4 py-1.5 text-slate-300 font-mono border-b border-white/5">
                      {fmtKm(r.km)}
                    </td>
                    <td className="px-4 py-1.5 text-slate-400 font-mono border-b border-white/5">
                      {fmtKm(r.km * 12)}
                    </td>
                    {visibleCurves.map((c) => (
                      <td
                        key={`v-${c.id}`}
                        className="px-4 py-1.5 text-right text-slate-100 font-mono border-b border-white/5 whitespace-nowrap"
                      >
                        {fmtEur(r[c.id])}
                      </td>
                    ))}
                    {visibleCurves.map((c, j) => {
                      const v = deltas[i][c.id];
                      const cls =
                        v == null
                          ? 'text-slate-600'
                          : v > 0
                          ? 'text-rose-300'
                          : v < 0
                          ? 'text-emerald-300'
                          : 'text-slate-400';
                      return (
                        <td
                          key={`p-${c.id}`}
                          className={`px-4 py-1.5 text-right font-mono border-b border-white/5 whitespace-nowrap ${cls} ${
                            j === 0 ? 'border-l border-white/10' : ''
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
