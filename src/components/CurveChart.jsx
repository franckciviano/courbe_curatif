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
    ? '-'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' €';

const fmtKm = (v) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

function CustomTooltip({ active, payload, label, curves }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl shadow-black/10 text-sm min-w-[220px]">
      <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-slate-100">
        <span className="text-slate-600 text-xs font-medium">{fmtKm(label)} km/mois</span>
      </div>
      <div className="space-y-2.5">
        {payload.map((p) => {
          const curve = curves.find((c) => c.id === p.dataKey);
          if (!curve) return null;
          const kmTotal = curve.duree ? label * curve.duree : null;
          return (
            <div key={p.dataKey} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-slate-700 text-xs font-mono truncate">{curve.name}</span>
              </div>
              <div className="pl-4 flex flex-col gap-0.5">
                {kmTotal != null && (
                  <div className="text-[11px] text-slate-400">
                    Total contrat : <span className="text-slate-600 font-medium">{fmtKm(kmTotal)} km</span>
                  </div>
                )}
                <div className="text-base font-bold" style={{ color: p.color }}>
                  {p.value != null ? fmtEur(p.value) : <span className="text-slate-300 text-sm font-normal">hors plafond</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomLegend({ payload, curves, onToggleVisible }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 pt-3 pb-1 px-4">
      {payload.map((entry) => {
        const curve = curves.find((c) => c.id === entry.dataKey);
        const name = curve?.name || entry.value;
        const hidden = curve && !curve.visible;
        return (
          <button
            key={entry.dataKey}
            type="button"
            onClick={() => onToggleVisible(entry.dataKey)}
            className={`flex items-center gap-2 text-xs transition-opacity ${hidden ? 'opacity-40' : 'opacity-100'} hover:opacity-70 cursor-pointer`}
          >
            <span
              className="inline-block shrink-0"
              style={{
                width: 20,
                height: 2,
                backgroundColor: entry.color,
                borderRadius: 1,
              }}
            />
            <span className="text-slate-600 font-mono">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CurveChart({ curves, onToggleVisible, overrides = {} }) {
  const { rows, visible } = useMemo(
    () => buildMergedSeries(curves, KM_MIN, KM_STEP, overrides),
    [curves, overrides]
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

  const dotInterval = Math.max(1, Math.round(1000 / KM_STEP));

  const renderDot = (interval, color) => (props) => {
    const { cx, cy, index, value } = props;
    if (value == null || Number.isNaN(value)) return null;
    if (index % interval !== 0) return null;
    return <circle cx={cx} cy={cy} r={3} fill={color} stroke="#ffffff" strokeWidth={1} />;
  };

  if (!visible || visible.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        Aucune courbe visible · ajoutez ou cochez une courbe pour commencer.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 20, right: 50, bottom: 30, left: 90 }}>
          <CartesianGrid stroke="rgba(100,116,139,0.15)" strokeDasharray="3 3" />
          <XAxis
            dataKey="km"
            type="number"
            domain={[KM_MIN, xMax]}
            allowDataOverflow
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={fmtKm}
            stroke="#cbd5e1"
            label={{
              value: 'Km / mois',
              position: 'insideBottomRight',
              offset: 0,
              fill: '#64748b',
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            domain={yDomain}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(v) => fmtEur(v)}
            stroke="#cbd5e1"
            width={90}
            label={{
              value: 'Somme repair',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: '#64748b',
              fontSize: 12,
            }}
          />
          <Tooltip
            content={<CustomTooltip curves={curves} />}
            cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Legend
            content={(props) => (
              <CustomLegend {...props} curves={curves} onToggleVisible={onToggleVisible} />
            )}
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
              activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
