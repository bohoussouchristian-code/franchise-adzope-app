import { MONTH_NAMES_FR, monthKey, fmtNum, escapeHtml } from './utils.js';
import { computeProductMonth, computeProductPeriod, getObjectiveEntry, addSubscription, resetState, listEvaluationRows, listOutletMetricRows, EVAL_CRITERIA } from './store.js';
import { findHeaderRow, buildColumnMap, parseSubscriptionRows } from './import-parser.js';
import { verifyPassword, changePassword, getIdentifier } from './auth.js';

let pendingImport = null;

export function renderExport(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Export / Sauvegarde</h1>
    <p class="page-sub">Toutes les données sont stockées dans ce navigateur. Exportez régulièrement une sauvegarde.</p>

    <div class="section">
      <h3 class="section-title">Informations franchise</h3>
      <div class="card">
        <div class="form-grid">
          <label class="field">Nom de la franchise
            <input type="text" id="franchiseName" value="${escapeHtml(state.meta.franchiseName)}">
          </label>
          <label class="field">Ville
            <input type="text" id="franchiseCity" value="${escapeHtml(state.meta.city)}">
          </label>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="section">
        <h3 class="section-title">Exporter</h3>
        <div class="card" style="display:flex; flex-direction:column; gap:10px; align-items:flex-start">
          <button class="btn btn-primary" id="btnExportXlsx">Exporter en Excel (.xlsx)</button>
          <button class="btn" id="btnExportJson">Exporter une sauvegarde (.json)</button>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">Restaurer une sauvegarde (.json)</h3>
        <div class="card">
          <input type="file" id="fileJson" accept="application/json">
          <p class="small muted">Remplace entièrement les données actuelles par celles du fichier.</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Importer des abonnements 4G Home depuis un fichier Excel</h3>
      <div class="card">
        <p class="small muted">Sélectionnez un fichier Excel (comme vos anciens fichiers mensuels de suivi). L'application détecte automatiquement les colonnes usuelles (date, client, type TDD/FDD, facture...).</p>
        <input type="file" id="fileXlsx" accept=".xlsx,.xls,.csv">
        <div id="sheetPickerHost"></div>
        <div id="importPreview"></div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Sécurité</h3>
      <div class="card">
        <p class="small muted">Identifiant de connexion : <b>${escapeHtml(getIdentifier() || '—')}</b></p>
        <form id="pwForm" class="form-grid" style="max-width:420px">
          <label class="field">Mot de passe actuel
            <input type="password" id="pwCurrent" autocomplete="current-password" required>
          </label>
          <div></div>
          <label class="field">Nouveau mot de passe
            <input type="password" id="pwNew" autocomplete="new-password" required minlength="4">
          </label>
          <label class="field">Confirmer
            <input type="password" id="pwNew2" autocomplete="new-password" required minlength="4">
          </label>
          <div id="pwMsg" class="full small" hidden></div>
          <div class="full">
            <button type="submit" class="btn btn-primary btn-sm">Changer le mot de passe</button>
          </div>
        </form>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">Zone sensible</h3>
      <div class="card">
        <button class="btn btn-danger" id="btnReset">Réinitialiser toutes les données</button>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  wrap.querySelector('#franchiseName').addEventListener('change', (e) => {
    actions.commit((s) => { s.meta.franchiseName = e.target.value.trim() || 'FRANCHISE'; });
  });
  wrap.querySelector('#franchiseCity').addEventListener('change', (e) => {
    actions.commit((s) => { s.meta.city = e.target.value.trim(); });
  });
  wrap.querySelector('#btnExportXlsx').addEventListener('click', () => exportXlsx(state));
  wrap.querySelector('#btnExportJson').addEventListener('click', () => exportJson(state));
  wrap.querySelector('#fileJson').addEventListener('change', (e) => importJson(e, actions));
  wrap.querySelector('#fileXlsx').addEventListener('change', (e) => handleXlsxSelect(e, wrap, actions));
  wrap.querySelector('#btnReset').addEventListener('click', () => {
    if (confirm('Cette action supprime définitivement toutes les données (objectifs, abonnements, équipe). Continuer ?')) {
      resetState();
      actions.rerender();
    }
  });
  wrap.querySelector('#pwForm').addEventListener('submit', handlePasswordChange(wrap));
}

function handlePasswordChange(wrap) {
  return async (e) => {
    e.preventDefault();
    const msg = wrap.querySelector('#pwMsg');
    const show = (text, isError) => {
      msg.textContent = text;
      msg.hidden = false;
      msg.style.color = isError ? 'var(--bad)' : 'var(--good)';
    };
    const current = wrap.querySelector('#pwCurrent').value;
    const next = wrap.querySelector('#pwNew').value;
    const next2 = wrap.querySelector('#pwNew2').value;

    const ok = await verifyPassword(current);
    if (!ok) { show('Mot de passe actuel incorrect.', true); return; }
    if (next !== next2) { show('Les deux nouveaux mots de passe ne correspondent pas.', true); return; }
    if (next.length < 4) { show('Le nouveau mot de passe doit contenir au moins 4 caractères.', true); return; }

    await changePassword(next);
    wrap.querySelector('#pwForm').reset();
    show('Mot de passe modifié avec succès.', false);
  };
}

// ---------- Export Excel ----------

function exportXlsx(state) {
  const wb = XLSX.utils.book_new();

  // Feuille Objectifs
  const objRows = [];
  state.agents.forEach((agent) => {
    state.products.forEach((product) => {
      for (let mi = 0; mi < 12; mi++) {
        const mKey = monthKey(state.meta.year, mi);
        const r = computeProductMonth(state, agent.id, product.id, mKey);
        const entry = getObjectiveEntry(state, agent.id, product.id, mKey, false);
        if (r.objective === 0 && r.realized === 0 && !(entry && entry.comment)) continue;
        objRows.push({
          Vendeur: agent.name,
          Produit: product.name,
          Mois: MONTH_NAMES_FR[mi],
          'Objectif': r.objective,
          'Semaine 1': r.weeks[0],
          'Semaine 2': r.weeks[1],
          'Semaine 3': r.weeks[2],
          'Semaine 4': r.weeks[3],
          'Total réalisé': r.realized,
          GAP: r.gap,
          '%': r.pct === null ? '' : Math.round(r.pct * 100) + '%',
          Commentaire: entry ? (entry.comment || '') : '',
        });
      }
    });
  });
  const wsObj = XLSX.utils.json_to_sheet(objRows);
  XLSX.utils.book_append_sheet(wb, wsObj, 'Objectifs');

  // Feuille Récap annuel par produit (équipe)
  const recapRows = state.products.map((p) => {
    const r = computeProductPeriod(state, 'ALL', p.id, { type: 'year', year: state.meta.year });
    return {
      Produit: p.name,
      'Objectif annuel': r.objective,
      'Réalisé': r.realized,
      GAP: r.gap,
      '%': r.pct === null ? '' : Math.round(r.pct * 100) + '%',
    };
  });
  const wsRecap = XLSX.utils.json_to_sheet(recapRows);
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Récap annuel');

  // Feuille Abonnements 4G Home
  const agentById = Object.fromEntries(state.agents.map((a) => [a.id, a.name]));
  const outletById = Object.fromEntries(state.outlets.map((o) => [o.id, o.name]));
  const subRows = state.subscriptions4gHome
    .slice()
    .sort((a, b) => (a.dateCreation || '').localeCompare(b.dateCreation || ''))
    .map((s) => ({
      'Date de création': s.dateCreation || '',
      'Type': s.type,
      'Nom client': s.infoClient,
      'N° client': s.numeroClient,
      'Numéro fixe': s.numeroFixe,
      'Référence facture': s.referenceFacture,
      'Coût facture initiale': s.coutFactureInitiale,
      'Vendeur': s.agentId ? (agentById[s.agentId] || '') : '',
      'Point de vente': s.outletId ? (outletById[s.outletId] || '') : '',
      'Login saisie': s.loginSaisie,
      'Login paiement': s.loginPaiement,
      'Date dépôt avantages': s.dateDepotAvantages || '',
      'Mode paiement': s.modePaiement,
    }));
  const wsSubs = XLSX.utils.json_to_sheet(subRows);
  XLSX.utils.book_append_sheet(wb, wsSubs, 'Abonnements 4G Home');

  // Feuille Évaluations (Notation, par vendeur)
  const evalRows = listEvaluationRows(state, { year: state.meta.year }).map((r) => {
    const row = {
      Vendeur: r.agentName,
      Mois: MONTH_NAMES_FR[r.monthIndex0],
    };
    EVAL_CRITERIA.forEach((label, i) => { row[label] = r.criteria[i]; });
    row.Total = r.total;
    row.Objectif = r.objective;
    row.GAP = r.gap;
    row['%'] = r.pct === null ? '' : Math.round(r.pct * 100) + '%';
    row.Commentaire = r.comment;
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evalRows), 'Évaluations');

  // Feuille Fréquentation & Client mystère (Notation, par point de vente)
  const freqByKey = new Map(listOutletMetricRows(state, 'frequentation', { year: state.meta.year }).map((r) => [`${r.outletId}|${r.mKey}`, r]));
  const cmByKey = new Map(listOutletMetricRows(state, 'clientMystere', { year: state.meta.year }).map((r) => [`${r.outletId}|${r.mKey}`, r]));
  const outletKeys = new Set([...freqByKey.keys(), ...cmByKey.keys()]);
  const outletRows = [...outletKeys].map((key) => {
    const f = freqByKey.get(key);
    const c = cmByKey.get(key);
    const ref = f || c;
    return {
      'Point de vente': ref.outletName,
      Mois: MONTH_NAMES_FR[ref.monthIndex0],
      'Fréq. objectif': f ? f.objective : '',
      'Fréq. réalisé': f ? f.realized : '',
      'Client mystère objectif': c ? c.objective : '',
      'Client mystère réalisé': c ? c.realized : '',
      Commentaire: (f && f.comment) || (c && c.comment) || '',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outletRows), 'Notation points de vente');

  XLSX.writeFile(wb, `Suivi_${state.meta.franchiseName.replace(/\s+/g, '_')}_${state.meta.year}.xlsx`);
}

// ---------- Export / Import JSON ----------

function exportJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sauvegarde_${state.meta.franchiseName.replace(/\s+/g, '_')}_${state.meta.year}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(e, actions) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
        alert('Ce fichier ne ressemble pas à une sauvegarde valide.');
        return;
      }
      if (confirm('Remplacer toutes les données actuelles par ce fichier de sauvegarde ?')) {
        actions.commit((s) => {
          Object.keys(s).forEach((k) => delete s[k]);
          Object.assign(s, data);
        });
      }
    } catch (err) {
      alert('Fichier JSON invalide.');
    }
  };
  reader.readAsText(file);
}

// ---------- Import Excel (abonnements) ----------

function handleXlsxSelect(e, wrap, actions) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = new Uint8Array(reader.result);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const pickerHost = wrap.querySelector('#sheetPickerHost');
    pickerHost.innerHTML = `
      <label class="field" style="margin-top:10px">Feuille à importer
        <select id="sheetPicker">
          ${workbook.SheetNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
        </select>
      </label>
    `;
    const sheetPicker = pickerHost.querySelector('#sheetPicker');
    const doPreview = () => previewSheet(workbook, sheetPicker.value, wrap, actions);
    sheetPicker.addEventListener('change', doPreview);
    doPreview();
  };
  reader.readAsArrayBuffer(file);
}

function previewSheet(workbook, sheetName, wrap, actions) {
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: undefined });
  const headerRowIndex = findHeaderRow(rows);
  const previewHost = wrap.querySelector('#importPreview');

  if (headerRowIndex === -1) {
    previewHost.innerHTML = `<p class="small" style="color:var(--bad)">Impossible de détecter automatiquement l'en-tête de ce tableau dans « ${escapeHtml(sheetName)} ».</p>`;
    pendingImport = null;
    return;
  }

  const colMap = buildColumnMap(rows, headerRowIndex);
  const parsed = parseSubscriptionRows(rows, headerRowIndex, colMap);
  pendingImport = parsed;

  previewHost.innerHTML = `
    <p class="small">${parsed.length} ligne(s) détectée(s) dans « ${escapeHtml(sheetName)} ».</p>
    <div class="table-wrap" style="max-height:260px; overflow:auto">
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Facture</th><th>Coût</th></tr></thead>
        <tbody>
          ${parsed.slice(0, 8).map((r) => `<tr><td>${r.dateCreation || ''}</td><td>${escapeHtml(r.infoClient)}</td><td>${r.type}</td><td>${escapeHtml(r.referenceFacture)}</td><td>${fmtNum(r.coutFactureInitiale)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${parsed.length ? '<button class="btn btn-primary" id="btnConfirmImport" style="margin-top:10px">Importer ces lignes</button>' : ''}
  `;

  const btn = previewHost.querySelector('#btnConfirmImport');
  if (btn) {
    btn.addEventListener('click', () => {
      if (pendingImport) {
        const count = pendingImport.length;
        actions.commit((s) => {
          pendingImport.forEach((row) => addSubscription(s, row));
        });
        pendingImport = null;
        alert(`${count} abonnement(s) importé(s) avec succès.`);
      }
    });
  }
}
