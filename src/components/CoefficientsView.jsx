import React, { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DATA, getGammeNames, getClassificationLabel, isLinearGamme, setData } from '../lib/calc.js';

function safeSheetName(name) {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Sheet';
}

function parseImportedExcel(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

      const summarySheet = wb.Sheets['Résumé'];
      if (!summarySheet) throw new Error('Feuille "Résumé" introuvable. Assurez-vous d\'utiliser un fichier exporté depuis cette application.');
      const summary = XLSX.utils.sheet_to_json(summarySheet);
      if (summary.length === 0) throw new Error('La feuille "Résumé" est vide.');

      const gammes = {};
      const errors = [];

      for (const row of summary) {
        const gammeName = String(row['Gamme'] || '').trim();
        if (!gammeName || gammeName === 'Gamme') continue;

        const classifStr = String(row['Classification'] || '').trim();
        const cf = classifStr === 'Type' ? 'type' : 'moteur';
        const cfLabel = cf === 'type' ? 'Type' : 'Moteur';
        const has_c = String(row['Coeff c'] || '').trim() === 'oui';

        const sheetName = safeSheetName(gammeName);
        const sheet = wb.Sheets[sheetName];
        if (!sheet) {
          errors.push(`Gamme "${gammeName}" : feuille "${sheetName}" introuvable.`);
          continue;
        }

        const sheetRows = XLSX.utils.sheet_to_json(sheet);
        const entries = [];
        for (const r of sheetRows) {
          const classification = String(r[cfLabel] || '').trim();
          const silhouette = String(r['Silhouette'] || '').trim();
          const poc = String(r['POC'] || '').trim();
          const duree = Number(r['Durée (mois)']);
          const a = Number(r['a']);
          const b = Number(r['b']);
          const cRaw = r['c'];
          const rawCode = String(r['Code'] || '').trim();
          // Auto-generate code if missing or placeholder
          const code = rawCode || `${classification}_${silhouette}_${poc}_${duree}`;

          if (!classification || !silhouette || !poc || isNaN(duree) || isNaN(a) || isNaN(b)) continue;

          const entry = { [cf]: classification, silhouette, poc, duree, a, b, code };
          if (has_c && cRaw !== 'n/a' && cRaw != null && String(cRaw).trim() !== '') {
            const cNum = Number(cRaw);
            if (!isNaN(cNum)) entry.c = cNum;
          }
          entries.push(entry);
        }

        if (entries.length === 0) {
          errors.push(`Gamme "${gammeName}" : aucune ligne valide trouvée.`);
          continue;
        }
        gammes[gammeName] = { classification_field: cf, has_c, entries };
      }

      if (Object.keys(gammes).length === 0) {
        throw new Error('Aucune gamme valide importée. ' + errors.join(' '));
      }

      onSuccess({ gammes }, errors);
    } catch (err) {
      onError(err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportAllCoefficients() {
  const wb = XLSX.utils.book_new();
  for (const name of getGammeNames()) {
    const g = DATA.gammes[name];
    const cf = g.classification_field;
    const linear = isLinearGamme(g);
    const cfLabel = cf === 'type' ? 'Type' : 'Moteur';
    const rows = g.entries.map((e) => ({
      [cfLabel]: e[cf],
      Silhouette: e.silhouette,
      POC: e.poc,
      'Durée (mois)': e.duree,
      a: e.a,
      b: e.b,
      c: linear ? 'n/a' : g.has_c ? e.c : 0,
      Code: e.code,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [cfLabel, 'Silhouette', 'POC', 'Durée (mois)', 'a', 'b', 'c', 'Code'],
    });
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 6 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
  }

  const summary = getGammeNames().map((name) => {
    const g = DATA.gammes[name];
    const linear = isLinearGamme(g);
    return {
      Gamme: name,
      Classification: g.classification_field === 'type' ? 'Type' : 'Moteur',
      'Coeff c': linear ? 'n/a' : g.has_c ? 'oui' : 'non',
      Formule: linear
        ? 'a·km + b + 1,21·PMT − 13·durée'
        : `a·km² + b·km ${g.has_c ? '+ c ' : ''}+ 1,21·PMT − 13·durée`,
      'Nb entrées': g.entries.length,
    };
  });
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 50 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé');
  wb.SheetNames.unshift(wb.SheetNames.pop());

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `coefficients_${today}.xlsx`);
}

const fmtCoef = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 6 }).format(v);

const ALL = '__ALL__';

const selectClass =
  'bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200';

const UPDATE_IDEAS = [
  {
    icon: '📄',
    title: 'Édition directe du JSON',
    badge: 'Simple',
    badgeColor: 'bg-blue-100 text-blue-700',
    desc: 'Ouvrez le fichier src/data/coefficients.json dans VS Code, modifiez les valeurs a, b, c, puis redéployez. Idéal pour des corrections ponctuelles.',
    pros: ['Aucun développement requis', 'Contrôle total'],
    cons: ['Risque d\'erreur de syntaxe JSON', 'Nécessite un redéploiement'],
  },
  {
    icon: '📥',
    title: 'Workflow Excel → Import JSON',
    badge: 'Recommandé',
    badgeColor: 'bg-green-100 text-green-700',
    desc: 'Exportez l\'Excel actuel (bouton ci-dessus), mettez à jour les valeurs a, b, c dans Excel, puis convertissez en JSON et remplacez le fichier. Le format Excel est déjà structuré pour ça.',
    pros: ['Format familier', 'Validation visuelle dans Excel', 'Adapté aux mises à jour annuelles'],
    cons: ['Étape de conversion Excel → JSON à automatiser'],
  },
  {
    icon: '✏️',
    title: 'Tableau éditable en ligne',
    badge: 'À développer',
    badgeColor: 'bg-violet-100 text-violet-700',
    desc: 'Rendre les cellules a, b, c de ce tableau directement éditables (double-clic), avec export du JSON mis à jour. Zéro fichier à manipuler.',
    pros: ['Interface directe dans l\'app', 'Export JSON immédiat', 'Idéal pour corrections rapides'],
    cons: ['Développement à prévoir (~1–2 jours)'],
  },
  {
    icon: '🔗',
    title: 'Synchronisation externe (Airtable, Sheets…)',
    badge: 'Avancé',
    badgeColor: 'bg-orange-100 text-orange-700',
    desc: 'Stocker les coefficients dans Airtable ou Google Sheets. L\'app les charge via API au démarrage. Mise à jour annuelle = modifier le tableur, sans toucher au code.',
    pros: ['Mise à jour sans redéploiement', 'Accès multi-utilisateurs', 'Historique des versions'],
    cons: ['Nécessite une API key et un backend léger', 'Complexité accrue'],
  },
];

export default function CoefficientsView() {
  const gammeNames = getGammeNames();
  const [gammeName, setGammeName] = useState(gammeNames[0]);
  const [fClassification, setFClassification] = useState(ALL);
  const [fSilhouette, setFSilhouette] = useState(ALL);
  const [fPoc, setFPoc] = useState(ALL);
  const [fDuree, setFDuree] = useState(ALL);
  const [showUpdateGuide, setShowUpdateGuide] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // null | { type: 'loading'|'success'|'error', msg, warnings? }
  const fileInputRef = useRef(null);
  const isCustomData = !!localStorage.getItem('coefficients_data');

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportStatus({ type: 'loading', msg: 'Lecture du fichier…' });
    parseImportedExcel(
      file,
      (newData, warnings) => {
        setData(newData);
        const total = Object.values(newData.gammes).reduce((s, g) => s + g.entries.length, 0);
        const gammeCount = Object.keys(newData.gammes).length;
        setImportStatus({
          type: 'success',
          msg: `✓ ${gammeCount} gamme${gammeCount > 1 ? 's' : ''} importée${gammeCount > 1 ? 's' : ''}, ${total} entrées. L'application va se recharger…`,
          warnings,
        });
        setTimeout(() => window.location.reload(), 2000);
      },
      (errMsg) => setImportStatus({ type: 'error', msg: errMsg })
    );
  };


  const gamme = DATA.gammes[gammeName];
  const cf = gamme.classification_field;
  const classificationLabel = getClassificationLabel(gammeName);
  const linear = isLinearGamme(gamme);

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
      <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Gamme</div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Import status */}
            {importStatus && (
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                importStatus.type === 'loading' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                importStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {importStatus.msg}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowUpdateGuide((v) => !v)}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 inline-flex items-center gap-2 ${
                showUpdateGuide
                  ? 'bg-amber-100 border border-amber-300 text-amber-700'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
              }`}
            >
              <span>💡</span>
              {showUpdateGuide ? 'Masquer' : 'Workflow mise à jour'}
            </button>
            <button
              type="button"
              onClick={exportAllCoefficients}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-medium text-xs shadow-lg shadow-violet-500/20 transition-all duration-200 inline-flex items-center gap-2"
              title="Génère un classeur Excel avec un onglet par gamme et un onglet Résumé"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exporter Excel
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importStatus?.type === 'loading' || importStatus?.type === 'success'}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-lg shadow-emerald-500/20 transition-all duration-200 inline-flex items-center gap-2"
              title="Importer un fichier Excel mis à jour (même format que l'export)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Importer Excel
            </button>
          </div>
        </div>
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
                    ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {g.entries.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Gamme meta */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
            Classification : <span className="text-slate-700 font-medium">{classificationLabel}</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
            {linear ? (
              <>Formule : <span className="text-violet-600 font-mono">a·km + b + 1,21·PMT − 13·durée</span></>
            ) : (
              <>Formule : <span className="text-violet-600 font-mono">a·km² + b·km {gamme.has_c ? '+ c ' : ''}+ 1,21·PMT − 13·durée</span></>
            )}
          </span>
          {!linear && !gamme.has_c && (
            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
              Pas de coefficient c
            </span>
          )}
          {linear && (
            <span className="px-2 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-600">
              Linéaire (pas de km², pas de c)
            </span>
          )}
        </div>
      </div>

      {/* Update guide */}
      {showUpdateGuide && (
        <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 shadow-sm">
          <div className="text-sm font-semibold text-amber-800 mb-3">
            💡 Workflow de mise à jour annuelle des coefficients
          </div>
          <div className="flex items-start gap-2 flex-wrap">
            {[
              { n: '1', label: 'Exporter', desc: 'Cliquez sur « Exporter Excel » pour télécharger le fichier avec toutes les gammes et coefficients actuels.' },
              { n: '2', label: 'Modifier dans Excel', desc: 'Ouvrez le fichier. Mettez à jour les valeurs a, b, c, ajoutez des lignes en respectant la même structure de colonnes. Mettez aussi à jour la feuille « Résumé » si vous ajoutez une gamme.' },
              { n: '3', label: 'Importer', desc: 'Cliquez sur « Importer Excel » et sélectionnez votre fichier mis à jour. L\'application valide et recharge avec les nouveaux coefficients.' },
              { n: '4', label: 'Vérifier', desc: 'Les courbes utilisent désormais vos nouveaux coefficients. Cliquez « ↩ Réinitialiser » à tout moment pour revenir aux valeurs d\'origine.' },
            ].map((step) => (
              <div key={step.n} className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{step.n}</span>
                  <span className="text-sm font-semibold text-slate-800">{step.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-[11px] text-amber-700 font-medium">Nomenclature des colonnes à respecter :</p>
            <div className="flex flex-wrap gap-1.5">
              {['Type / Moteur', 'Silhouette', 'POC', 'Durée (mois)', 'a', 'b', 'c', 'Code'].map(col => (
                <span key={col} className="text-[11px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded">{col}</span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Le code est auto-généré à l'import si la colonne est vide : <span className="font-mono bg-white border border-slate-200 px-1.5 rounded">Classification_Silhouette_POC_Durée</span></p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
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
            className="px-3 py-1.5 text-sm rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition-all duration-200"
          >
            Réinitialiser
          </button>
          <div className="ml-auto text-sm text-slate-500">
            <span className="text-slate-800 font-semibold">{filtered.length}</span> / {gamme.entries.length} ligne{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto scroll-area">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
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
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400 text-sm">
                    Aucune entrée pour ces filtres.
                  </td>
                </tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={e.code} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <Td>{e[cf]}</Td>
                    <Td>{e.silhouette}</Td>
                    <Td>{e.poc}</Td>
                    <Td align="right">{e.duree} m</Td>
                    <Td align="right" mono>{fmtCoef(e.a)}</Td>
                    <Td align="right" mono>{fmtCoef(e.b)}</Td>
                    <Td align="right" mono>
                      {linear ? <span className="text-slate-300">n/a</span>
                        : gamme.has_c ? fmtCoef(e.c)
                        : <span className="text-slate-300">0</span>}
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
      <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">{label}</label>
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
    <th className={`px-4 py-2 ${a} text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 ${mono ? 'font-mono' : ''}`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', mono = false }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`px-4 py-1.5 ${a} text-slate-700 border-b border-slate-100 whitespace-nowrap ${mono ? 'font-mono' : ''}`}>
      {children}
    </td>
  );
}
