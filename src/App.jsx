import React, { useState, useCallback, useMemo } from 'react';
import CurveCard from './components/CurveCard.jsx';
import CurveChart from './components/CurveChart.jsx';
import CurveTable from './components/CurveTable.jsx';
import CoefficientsView from './components/CoefficientsView.jsx';
import { CURVE_COLORS, pickColor } from './lib/colors.js';
import { autoCurveName, findEntry, getGamme, isLinearGamme } from './lib/calc.js';

const fmtCoef = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 6 }).format(v);

let _id = 0;
const nextId = () => `c${++_id}`;

function makeCurve(partial, usedColors) {
  const base = {
    id: nextId(),
    visible: true,
    color: pickColor(usedColors),
    gamme: null,
    classification: null,
    silhouette: null,
    poc: null,
    duree: null,
    heuresPMT: 0,
    kmAnnuel: '',
    nameTouched: false,
    ...partial,
  };
  base.name = autoCurveName(base);
  return base;
}

const INITIAL_CURVES = [
  makeCurve(
    {
      gamme: 'C 2.3',
      classification: 'DTI-11',
      silhouette: '4X2',
      poc: 'L',
      duree: 48,
      heuresPMT: 0,
    },
    []
  ),
  makeCurve(
    {
      gamme: 'T HIGH',
      classification: 'DTI-13',
      silhouette: 'TRACTEUR',
      poc: 'M',
      duree: 48,
      heuresPMT: 0,
    },
    [CURVE_COLORS[0]]
  ),
];

export default function App() {
  const [curves, setCurves] = useState(INITIAL_CURVES);
  const [tab, setTab] = useState('chart');

  const addCurve = useCallback(() => {
    setCurves((prev) => {
      const usedColors = prev.map((c) => c.color);
      return [
        ...prev,
        makeCurve(
          {
            gamme: 'C 2.3',
            classification: 'DTI-11',
            silhouette: '4X2',
            poc: 'L',
            duree: 48,
            heuresPMT: 0,
          },
          usedColors
        ),
      ];
    });
  }, []);

  const updateCurve = useCallback((next) => {
    setCurves((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }, []);

  const removeCurve = useCallback((id) => {
    setCurves((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const duplicateCurve = useCallback((id) => {
    setCurves((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const usedColors = prev.map((c) => c.color);
      const copy = {
        ...src,
        id: nextId(),
        color: pickColor(usedColors),
        name: src.nameTouched ? `${src.name} (copie)` : autoCurveName(src),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const toggleVisible = useCallback((id) => {
    setCurves((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-violet-50 text-slate-800">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/30 shrink-0">
            C
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate text-slate-800">Clovis – Simulateur de coût curatif</h1>
            <p className="text-xs text-slate-500 truncate">Comparateur multi-courbes par gamme, motorisation et POC</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
          {[
            { id: 'chart', label: 'Graphique' },
            { id: 'table', label: 'Tableau' },
            { id: 'coefs', label: 'Coefficients' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-violet-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Mode local — aucune donnée transmise
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar — hidden on the Coefficients tab */}
        <aside className={`${tab === 'coefs' ? 'hidden' : 'flex'} w-[400px] shrink-0 border-r border-slate-200 bg-slate-50 flex-col`}>
          <div className="p-4 shrink-0">
            <button
              type="button"
              onClick={addCurve}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-medium text-sm shadow-lg shadow-violet-500/30 transition-all duration-200"
            >
              + Ajouter une courbe
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-area px-4 pb-4 space-y-3">
            {curves.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8">Aucune courbe. Cliquez sur « Ajouter une courbe ».</p>
            )}
            {curves.map((c) => (
              <CurveCard
                key={c.id}
                curve={c}
                onChange={updateCurve}
                onRemove={() => removeCurve(c.id)}
                onDuplicate={() => duplicateCurve(c.id)}
              />
            ))}
          </div>
        </aside>

        {/* Main view */}
        <main className="flex-1 min-w-0 p-4 flex flex-col gap-3 min-h-0">
          {tab === 'chart' && <ChartTabContent curves={curves} onToggleVisible={toggleVisible} />}
          {tab === 'table' && <CurveTable curves={curves} />}
          {tab === 'coefs' && <CoefficientsView />}
        </main>
      </div>
    </div>
  );
}

function ChartTabContent({ curves, onToggleVisible }) {
  const [rawOverrides, setRawOverrides] = useState({});

  const setField = (curveId, field, value) => {
    setRawOverrides((prev) => ({
      ...prev,
      [curveId]: { ...(prev[curveId] || {}), [field]: value },
    }));
  };

  const resetCurve = (curveId) => {
    setRawOverrides((prev) => {
      const next = { ...prev };
      delete next[curveId];
      return next;
    });
  };

  const parsedOverrides = useMemo(() => {
    const result = {};
    for (const [id, fields] of Object.entries(rawOverrides)) {
      const parsed = {};
      for (const [k, v] of Object.entries(fields)) {
        const n = parseFloat(v);
        if (!isNaN(n)) parsed[k] = n;
      }
      if (Object.keys(parsed).length > 0) result[id] = parsed;
    }
    return result;
  }, [rawOverrides]);

  const visibleCurves = curves.filter((c) => c.visible);

  const coefInputClass =
    'w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-mono text-slate-800 ' +
    'focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all';

  return (
    <>
      {/* Editable coefficients */}
      <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2 gap-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
            Coefficients a / b / c
          </div>
          <span className="text-[11px] text-amber-600 italic">
            Modifiables pour test — ne change pas les coefficients officiels
          </span>
        </div>
        {visibleCurves.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune courbe visible.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 text-left">
                  <th className="font-medium pb-1 pr-4">Courbe</th>
                  <th className="font-medium pb-1 pr-2 text-right font-mono w-36">a</th>
                  <th className="font-medium pb-1 pr-2 text-right font-mono w-36">b</th>
                  <th className="font-medium pb-1 pr-2 text-right font-mono w-32">c</th>
                  <th className="font-medium pb-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {visibleCurves.map((c) => {
                  const g = getGamme(c.gamme);
                  const entry = findEntry(c.gamme, {
                    classification: c.classification,
                    silhouette: c.silhouette,
                    poc: c.poc,
                    duree: c.duree,
                  });
                  const hasC = g && g.has_c;
                  const linear = isLinearGamme(g);
                  const ovr = rawOverrides[c.id] || {};
                  const isModified = !!rawOverrides[c.id];

                  const aVal = ovr.a !== undefined ? ovr.a : (entry != null ? String(entry.a) : '');
                  const bVal = ovr.b !== undefined ? ovr.b : (entry != null ? String(entry.b) : '');
                  const cVal = ovr.c !== undefined ? ovr.c : (entry != null && hasC ? String(entry.c) : '0');

                  return (
                    <tr key={c.id} className={`border-t border-slate-100 ${isModified ? 'bg-amber-50' : ''}`}>
                      <td className="py-1.5 pr-4">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-slate-700 truncate text-xs">{c.name}</span>
                          {linear && (
                            <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                              linéaire
                            </span>
                          )}
                          {isModified && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                              modifié
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <input
                          type="number"
                          step="any"
                          value={aVal}
                          disabled={!entry}
                          onChange={(e) => setField(c.id, 'a', e.target.value)}
                          className={coefInputClass}
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <input
                          type="number"
                          step="any"
                          value={bVal}
                          disabled={!entry}
                          onChange={(e) => setField(c.id, 'b', e.target.value)}
                          className={coefInputClass}
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {linear ? (
                          <span className="text-xs text-slate-400 font-mono">n/a</span>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={cVal}
                            disabled={!entry}
                            onChange={(e) => setField(c.id, 'c', e.target.value)}
                            className={coefInputClass}
                          />
                        )}
                      </td>
                      <td className="py-1.5 text-center">
                        {isModified && (
                          <button
                            type="button"
                            title="Réinitialiser aux valeurs officielles"
                            onClick={() => resetCurve(c.id)}
                            className="text-slate-400 hover:text-slate-700 transition-colors text-base leading-none"
                          >
                            ↩
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <CurveChart curves={curves} onToggleVisible={onToggleVisible} overrides={parsedOverrides} />
      </div>
    </>
  );
}
