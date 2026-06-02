import React, { useMemo, useState } from 'react';
import { DATA, getGammeNames, getClassificationLabel, isLinearGamme } from '../lib/calc.js';

const fmtCoef = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 6 }).format(v);

const ALL = '__ALL__';

const selectClass =
  'bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200';

export default function CoefficientsView() {
  const gammeNames = getGammeNames();
  const [gammeName, setGammeName] = useState(gammeNames[0]);
  const [fClassification, setFClassification] = useState(ALL);
  const [fSilhouette, setFSilhouette] = useState(ALL);
  const [fPoc, setFPoc] = useState(ALL);
  const [fDuree, setFDuree] = useState(ALL);

  const gamme = DATA.gammes[gammeName];
  const cf = gamme.classification_field;
  const classificationLabel = getClassificationLabel(gammeName);
  const linear = isLinearGamme(gamme);

  // Distinct values for filters
  const distinct = useMemo(() => {
    const u = (key) => {
      const v = Array.from(new Set(gamme.entries.map((e) => e[key])));
      return v.every((x) => typeof x === 'number') ? v.sort((a, b) => a - b) : v.sort();
    };
    return {
      classification: u(cf),
      silhouette: u('silhouette'),
      poc: u('poc'),
      duree: u('duree'),
    };
  }, [gamme, cf]);

  const filtered = useMemo(() => {
    return gamme.entries.filter(
      (e) =>
        (fClassification === ALL || e[cf] === fClassification) &&
        (fSilhouette === ALL || e.silhouette === fSilhouette) &&
        (fPoc === ALL || e.poc === fPoc) &&
        (fDuree === ALL || e.duree === Number(fDuree))
    );
  }, [gamme, cf, fClassification, fSilhouette, fPoc, fDuree]);

  // Reset filters when gamme changes
  const switchGamme = (name) => {
    setGammeName(name);
    setFClassification(ALL);
    setFSilhouette(ALL);
    setFPoc(ALL);
    setFDuree(ALL);
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 min-h-0">
      {/* Gamme picker pills */}
      <div className="shrink-0 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 shadow-lg shadow-violet-500/10">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Gamme</div>
        <div className="flex flex-wrap gap-2">
          {gammeNames.map((name) => {
            const g = DATA.gammes[name];
            const active = name === gammeName;
            return (
              <button
                key={name}
                type="button"
                onClick={() => switchGamme(name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-2 ${
                  active
                    ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>{name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-700/60 text-slate-300'
                }`}>
                  {g.entries.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Gamme meta */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700">
            Classification : <span className="text-slate-200 font-medium">{classificationLabel}</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700">
            {linear ? (
              <>Formule : <span className="text-violet-300 font-mono">a·km + b + 1,21·PMT − 13·durée</span></>
            ) : (
              <>Formule : <span className="text-violet-300 font-mono">a·km² + b·km {gamme.has_c ? '+ c ' : ''}+ 1,21·PMT − 13·durée</span></>
            )}
          </span>
          {!linear && !gamme.has_c && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Pas de coefficient c
            </span>
          )}
          {linear && (
            <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-300">
              Linéaire (pas de km², pas de c)
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 shadow-lg shadow-violet-500/10">
        <div className="flex flex-wrap items-end gap-3">
          <Filter label={classificationLabel} value={fClassification} onChange={setFClassification} options={distinct.classification} />
          <Filter label="Silhouette" value={fSilhouette} onChange={setFSilhouette} options={distinct.silhouette} />
          <Filter label="POC" value={fPoc} onChange={setFPoc} options={distinct.poc} />
          <Filter label="Durée" value={fDuree} onChange={setFDuree} options={distinct.duree} suffix="m" />
          <button
            type="button"
            onClick={() => {
              setFClassification(ALL);
              setFSilhouette(ALL);
              setFPoc(ALL);
              setFDuree(ALL);
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all duration-200"
          >
            Réinitialiser
          </button>
          <div className="ml-auto text-sm text-slate-400">
            <span className="text-slate-100 font-semibold">{filtered.length}</span> / {gamme.entries.length} ligne{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/10 rounded-2xl shadow-xl shadow-violet-500/10 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto scroll-area">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <tr>
                <Th>{classificationLabel}</Th>
                <Th>Silhouette</Th>
                <Th>POC</Th>
                <Th align="right">Durée</Th>
                <Th align="right" mono>a</Th>
                <Th align="right" mono>b</Th>
                <Th align="right" mono>c</Th>
                <Th>Code</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500 text-sm">
                    Aucune entrée pour ces filtres.
                  </td>
                </tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={e.code} className={i % 2 === 0 ? 'bg-white/[0.015]' : ''}>
                    <Td>{e[cf]}</Td>
                    <Td>{e.silhouette}</Td>
                    <Td>{e.poc}</Td>
                    <Td align="right">{e.duree} m</Td>
                    <Td align="right" mono>{fmtCoef(e.a)}</Td>
                    <Td align="right" mono>{fmtCoef(e.b)}</Td>
                    <Td align="right" mono>
                      {linear ? <span className="text-slate-600">n/a</span>
                        : gamme.has_c ? fmtCoef(e.c)
                        : <span className="text-slate-600">0</span>}
                    </Td>
                    <Td>
                      <span className="text-[11px] text-slate-400 font-mono">{e.code}</span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options, suffix = '' }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</label>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL}>Toutes</option>
        {options.map((v) => (
          <option key={v} value={v}>{v}{suffix}</option>
        ))}
      </select>
    </div>
  );
}

function Th({ children, align = 'left', mono = false }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-2 ${a} text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-white/10 ${mono ? 'font-mono' : ''}`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', mono = false }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`px-4 py-1.5 ${a} text-slate-100 border-b border-white/5 whitespace-nowrap ${mono ? 'font-mono' : ''}`}>
      {children}
    </td>
  );
}
