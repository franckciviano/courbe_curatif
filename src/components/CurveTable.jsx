import React, { useMemo } from 'react';
import { buildMergedSeries } from '../lib/calc.js';

const KM_MIN = 2000;
const KM_STEP = 200;

const fmtKm = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtEur = (v) =>
  v == null || Number.isNaN(v)
    ? ''
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';

function downloadCsv(filename, rows, visible) {
  // Excel-friendly: BOM UTF-8 + ; separator + decimal comma
  const header = ['Km/mois', ...visible.map((c) => c.name)];
  const lines = [header.join(';')];
  for (const r of rows) {
    const cells = [r.km, ...visible.map((c) => (r[c.id] == null ? '' : Math.round(r[c.id])))];
    lines.push(cells.join(';'));
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

  const handleExport = () => {
    if (visibleCurves.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`curatif_${today}.csv`, rows, visibleCurves);
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 shadow-lg shadow-violet-500/10">
        <div className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{visibleCurves.length}</span> courbe{visibleCurves.length > 1 ? 's' : ''} visible{visibleCurves.length > 1 ? 's' : ''} ·
          {' '}<span className="font-semibold text-slate-100">{rows.length}</span> lignes (pas de 200 km, jusqu'à 800 000 km / contrat)
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
                  {visibleCurves.map((c) => (
                    <th
                      key={c.id}
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
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.km} className={i % 2 === 0 ? 'bg-white/[0.015]' : ''}>
                    <td className="px-4 py-1.5 text-slate-300 font-mono border-b border-white/5">
                      {fmtKm(r.km)}
                    </td>
                    {visibleCurves.map((c) => (
                      <td
                        key={c.id}
                        className="px-4 py-1.5 text-right text-slate-100 font-mono border-b border-white/5 whitespace-nowrap"
                      >
                        {fmtEur(r[c.id])}
                      </td>
                    ))}
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
