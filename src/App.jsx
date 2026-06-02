import React, { useState, useCallback } from 'react';
import CurveCard from './components/CurveCard.jsx';
import CurveChart from './components/CurveChart.jsx';
import { CURVE_COLORS, pickColor } from './lib/colors.js';
import { autoCurveName } from './lib/calc.js';

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

  const toggleVisible = useCallback((id) => {
    setCurves((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-slate-100">
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-white/[0.02] backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/30">
            C
          </div>
          <div>
            <h1 className="text-base font-semibold">Clovis – Simulateur de coût curatif</h1>
            <p className="text-xs text-slate-400">Comparateur multi-courbes par gamme, motorisation et POC</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Mode local — aucune donnée transmise
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-[400px] shrink-0 border-r border-white/10 bg-black/20 flex flex-col">
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
              <p className="text-center text-slate-500 text-sm py-8">Aucune courbe. Cliquez sur « Ajouter une courbe ».</p>
            )}
            {curves.map((c) => (
              <CurveCard
                key={c.id}
                curve={c}
                onChange={updateCurve}
                onRemove={() => removeCurve(c.id)}
              />
            ))}
          </div>
        </aside>

        {/* Chart */}
        <main className="flex-1 min-w-0 p-4">
          <div className="h-full w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 shadow-xl shadow-violet-500/10">
            <CurveChart curves={curves} onToggleVisible={toggleVisible} />
          </div>
        </main>
      </div>
    </div>
  );
}
