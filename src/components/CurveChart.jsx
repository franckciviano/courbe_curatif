import React, { useMemo } from 'react';
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
import { buildMergedSeries } from '../lib/calc.js';

const KM_MIN = 2000;
const KM_STEP = 200;

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
  const { rows, visible } = useMemo(
    () => buildMergedSeries(curves, KM_MIN, KM_STEP),
    [curves]
  );

  const xMax = rows.length ? rows[rows.length - 1].km : KM_MIN;

  const yDomain = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of rows) {
      for (const c of visible || []) {
        const v = row[c.id];
        if (v == null || Number.isNaN(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
    const margin = (hi - lo) * 0.05 || hi * 0.05 || 1;
    return [Math.floor(lo - margin), Math.ceil(hi + margin)];
  }, [rows, visible]);

  // Show dot markers roughly every 1000 km (step = 200 km → one in 5)
  const dotInterval = Math.max(1, Math.round(1000 / KM_STEP));

  const renderDot = (interval, color) => (props) => {
    const { cx, cy, index, value } = props;
    if (value == null || Number.isNaN(value)) return null;
    if (index % interval !== 0) return null;
    return <circle cx={cx} cy={cy} r={3} fill={color} stroke="#0f172a" strokeWidth={1} />;
  };

  if (!visible || visible.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
        Aucune courbe visible — ajoutez ou cochez une courbe pour commencer.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 20, right: 30, bottom: 40, left: 70 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
          <XAxis
            dataKey="km"
            type="number"
            domain={[KM_MIN, xMax]}
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
          {visible.map((c) => (
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
    </div>
  );
}
