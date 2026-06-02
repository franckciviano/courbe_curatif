import React, { useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { buildSeries } from '../lib/calc.js';

const KM_MIN_DEFAULT = 2000;
const KM_MAX_DEFAULT = 15000;
const STEPS = 200;

const fmtEur = (v) =>
  v == null || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';

const fmtKm = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

function CustomTooltip({ active, payload, label, curves }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl shadow-black/40 text-sm max-w-xs">
      <div className="text-slate-400 text-xs mb-2">
        {fmtKm(label)} km/mois
      </div>
      <div className="space-y-1.5">
        {payload.map((p) => {
          const curve = curves.find((c) => c.id === p.dataKey);
          if (!curve) return null;
          return (
            <div key={p.dataKey} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-slate-200 truncate">{curve.name}</span>
                </div>
                <span className="text-slate-100 font-medium whitespace-nowrap">{fmtEur(p.value)}</span>
              </div>
              <div className="text-[10px] text-slate-500 pl-4.5">
                {curve.gamme} · {curve.classification} · {curve.silhouette} · POC {curve.poc} · {curve.duree}m · PMT {curve.heuresPMT || 0}h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CurveChart({ curves, onToggleVisible }) {
  const [zoom, setZoom] = useState(null); // { x0, x1 } once committed
  const [drag, setDrag] = useState(null); // { x0, x1 } while dragging

  const xMin = zoom ? zoom.x0 : KM_MIN_DEFAULT;
  const xMax = zoom ? zoom.x1 : KM_MAX_DEFAULT;

  // Build per-curve series, then merge into chart data keyed by km
  const { data, visibleCurves } = useMemo(() => {
    const visibleCurves = curves.filter((c) => c.visible);
    const seriesByCurve = new Map();
    for (const c of visibleCurves) {
      seriesByCurve.set(c.id, buildSeries(c, xMin, xMax, STEPS));
    }
    // Merge: all series share km values (same min/max/steps)
    const merged = [];
    const first = seriesByCurve.values().next().value || [];
    for (let i = 0; i < first.length; i++) {
      const row = { km: first[i].km };
      for (const c of visibleCurves) {
        const s = seriesByCurve.get(c.id);
        const pt = s && s[i];
        row[c.id] = pt && pt.value != null ? pt.value : null;
      }
      merged.push(row);
    }
    return { data: merged, visibleCurves };
  }, [curves, xMin, xMax]);

  // Y domain auto, +/- 5% margin
  const yDomain = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of data) {
      for (const c of visibleCurves) {
        const v = row[c.id];
        if (v == null || Number.isNaN(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
    const margin = (hi - lo) * 0.05 || hi * 0.05 || 1;
    return [Math.floor(lo - margin), Math.ceil(hi + margin)];
  }, [data, visibleCurves]);

  // Show point markers roughly every 1000 km — STEPS points span (xMax-xMin),
  // so interval index ≈ STEPS * 1000 / (xMax-xMin)
  const dotInterval = useMemo(() => {
    const span = xMax - xMin;
    return Math.max(1, Math.round((STEPS - 1) * 1000 / span));
  }, [xMin, xMax]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85; // wheel up = zoom in
      const center = (xMin + xMax) / 2;
      const half = ((xMax - xMin) * factor) / 2;
      let newMin = Math.max(KM_MIN_DEFAULT, Math.round(center - half));
      let newMax = Math.min(KM_MAX_DEFAULT, Math.round(center + half));
      if (newMax - newMin < 500) return;
      if (newMin === KM_MIN_DEFAULT && newMax === KM_MAX_DEFAULT) {
        setZoom(null);
      } else {
        setZoom({ x0: newMin, x1: newMax });
      }
    },
    [xMin, xMax]
  );

  const renderDot = (interval, color) => (props) => {
    const { cx, cy, index, value } = props;
    if (value == null || Number.isNaN(value)) return null;
    if (index % interval !== 0) return null;
    return <circle cx={cx} cy={cy} r={3} fill={color} stroke="#0f172a" strokeWidth={1} />;
  };

  return (
    <div className="relative h-full w-full" onWheel={handleWheel}>
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-200 transition-all duration-200"
          >
            Réinitialiser le zoom
          </button>
        )}
      </div>

      {visibleCurves.length === 0 ? (
        <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
          Aucune courbe visible — ajoutez ou cochez une courbe pour commencer.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 30, right: 30, bottom: 40, left: 70 }}
            onMouseDown={(s) => s && s.activeLabel != null && setDrag({ x0: s.activeLabel, x1: s.activeLabel })}
            onMouseMove={(s) => drag && s && s.activeLabel != null && setDrag({ ...drag, x1: s.activeLabel })}
            onMouseUp={() => {
              if (drag && drag.x0 != null && drag.x1 != null && Math.abs(drag.x1 - drag.x0) > 200) {
                const x0 = Math.min(drag.x0, drag.x1);
                const x1 = Math.max(drag.x0, drag.x1);
                setZoom({ x0, x1 });
              }
              setDrag(null);
            }}
          >
            <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
            <XAxis
              dataKey="km"
              type="number"
              domain={[xMin, xMax]}
              allowDataOverflow
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={fmtKm}
              stroke="#475569"
              label={{
                value: 'Km / mois',
                position: 'insideBottom',
                offset: -20,
                fill: '#94a3b8',
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              domain={yDomain}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => fmtEur(v)}
              stroke="#475569"
              width={80}
            />
            <Tooltip
              content={<CustomTooltip curves={curves} />}
              cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 18, fontSize: 12 }}
              formatter={(value, entry) => {
                const curve = curves.find((c) => c.id === entry.dataKey);
                return (
                  <span style={{ color: '#cbd5e1', cursor: 'pointer' }}>
                    {curve ? curve.name : value}
                  </span>
                );
              }}
              onClick={(o) => onToggleVisible(o.dataKey)}
            />
            {visibleCurves.map((c) => (
              <Line
                key={c.id}
                type="monotone"
                dataKey={c.id}
                name={c.name}
                stroke={c.color}
                strokeWidth={2}
                dot={renderDot(dotInterval, c.color)}
                activeDot={{ r: 5, stroke: '#0f172a', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
