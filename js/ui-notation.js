import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass, escapeHtml } from './utils.js';
import {
  listAgentPerformanceRows,
  getOutletMetricEntry, upsertOutletMetric, removeOutletMetricEntry, listOutletMetricRows,
} from './store.js';
import { openModal, closeModal } from './modal.js';

const APPRECIATION_LABELS = { good: 'Excellent', warn: 'Satisfaisant', bad: 'Insuffisant', neutral: '—' };

let ui = {
  year: null,
  month: new Date().getMonth(),
  agentId: 'ALL',
  outletId: 'ALL',
};

// ---------- Évaluation des vendeurs (automatique : performance vs objectif) ----------

export function renderEvaluations(host, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;
  const isVendeur = actions.scope.role === 'vendeur';
  if (isVendeur) ui.agentId = actions.scope.agentId;

  if (!state.agents.length) {
    host.innerHTML = `
      <h1 class="page-title">Évaluation des vendeurs</h1>
      <div class="empty-state">Ajoutez d'abord un vendeur dans « Paramètres ».</div>
    `;
    return;
  }

  host.innerHTML = `
    <h1 class="page-title">Évaluation des vendeurs</h1>
    <p class="page-sub">Calculée automatiquement à partir des performances par rapport aux objectifs fixés (module Objectifs) — aucune saisie manuelle.</p>
    <div class="toolbar">
      <label class="field">Mois
        <select id="fMonth"></select>
      </label>
      ${isVendeur ? '' : `
      <label class="field">Vendeur
        <select id="fAgent"><option value="ALL">Tous</option></select>
      </label>`}
    </div>
    <div id="tableHost"></div>
  `;

  const monthSel = host.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, i === ui.month));
  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });

  if (!isVendeur) {
    const agentSel = host.querySelector('#fAgent');
    state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.agentId));
    agentSel.addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });
  }

  const mKey = monthKey(ui.year, ui.month);
  const rows = listAgentPerformanceRows(state, { agentId: ui.agentId, year: ui.year }).filter((r) => r.mKey === mKey);
  renderEvalTable(host.querySelector('#tableHost'), rows);
}

function renderEvalTable(host, rows) {
  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Vendeur</th>
        <th>Objectif</th>
        <th>Réalisé</th>
        <th>GAP</th>
        <th>%</th>
        <th>Appréciation</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  if (!rows.length) {
    const colCount = table.querySelectorAll('thead th').length;
    tbody.innerHTML = `<tr class="table-empty-row"><td colspan="${colCount}">Aucun objectif fixé pour ce mois : rien à évaluer.</td></tr>`;
    box.appendChild(table);
    host.innerHTML = '';
    host.appendChild(box);
    return;
  }

  rows.forEach((r) => {
    const cls = pctClass(r.pct);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-agent">${escapeHtml(r.agentName)}</span></td>
      <td class="right">${fmtNum(r.objective)}</td>
      <td class="right"><b>${fmtNum(r.realized)}</b></td>
      <td class="right">${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</td>
      <td><span class="pill ${cls}">${fmtPct(r.pct)}</span></td>
      <td><span class="pill ${cls}">${APPRECIATION_LABELS[cls]}</span></td>
    `;
    tbody.appendChild(tr);
  });

  box.appendChild(table);
  host.innerHTML = '';
  host.appendChild(box);
}

// ---------- Fréquentation & Client mystère (par point de vente) ----------

export function renderOutlets(host, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;
  const isOutlet = actions.scope.role === 'outlet';
  if (isOutlet) ui.outletId = actions.scope.outletId;

  if (!state.outlets.length || (isOutlet && !state.outlets.some((o) => o.id === ui.outletId))) {
    host.innerHTML = `
      <h1 class="page-title">Fréquentation &amp; Client mystère</h1>
      <div class="empty-state">Ajoutez d'abord un point de vente dans « Paramètres ».</div>
    `;
    return;
  }

  host.innerHTML = `
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Fréquentation &amp; Client mystère</h1>
        <p class="page-sub">Affluence et expérience client mesurées par point de vente, saisie manuelle.</p>
      </div>
      <button class="btn btn-primary" id="btnNewOutlet">+ Nouvelle saisie</button>
    </div>
    <div class="toolbar">
      <label class="field">Mois
        <select id="fMonth"></select>
      </label>
      ${isOutlet ? '' : `
      <label class="field">Point de vente
        <select id="fOutlet"><option value="ALL">Tous</option></select>
      </label>`}
    </div>
    <div id="tableHost"></div>
  `;

  const monthSel = host.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, i === ui.month));
  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });

  if (!isOutlet) {
    const outletSel = host.querySelector('#fOutlet');
    state.outlets.forEach((o) => addOption(outletSel, o.id, o.name, o.id === ui.outletId));
    outletSel.addEventListener('change', (e) => { ui.outletId = e.target.value; actions.rerender(); });
  }

  host.querySelector('#btnNewOutlet').addEventListener('click', () => {
    openOutletForm(state, actions, { outletId: isOutlet ? ui.outletId : state.outlets[0].id, monthIndex0: ui.month });
  });

  const mKey = monthKey(ui.year, ui.month);
  const freqRows = listOutletMetricRows(state, 'frequentation', { outletId: ui.outletId, year: ui.year }).filter((r) => r.mKey === mKey);
  const cmRows = listOutletMetricRows(state, 'clientMystere', { outletId: ui.outletId, year: ui.year }).filter((r) => r.mKey === mKey);

  const merged = mergeOutletRows(state, freqRows, cmRows, mKey);
  renderOutletTable(host.querySelector('#tableHost'), merged, state, actions);
}

function mergeOutletRows(state, freqRows, cmRows, mKey) {
  const byOutlet = new Map();
  freqRows.forEach((r) => {
    byOutlet.set(r.outletId, { outletId: r.outletId, outletName: r.outletName, mKey, freq: r });
  });
  cmRows.forEach((r) => {
    const existing = byOutlet.get(r.outletId) || { outletId: r.outletId, outletName: r.outletName, mKey };
    existing.cm = r;
    byOutlet.set(r.outletId, existing);
  });
  return [...byOutlet.values()].sort((a, b) => a.outletName.localeCompare(b.outletName));
}

function renderOutletTable(host, rows, state, actions) {
  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Point de vente</th>
        <th>Fréq. objectif</th>
        <th>Fréq. réalisé</th>
        <th>Fréq. %</th>
        <th>CM objectif</th>
        <th>CM réalisé</th>
        <th>CM %</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  if (!rows.length) {
    const colCount = table.querySelectorAll('thead th').length;
    tbody.innerHTML = `<tr class="table-empty-row"><td colspan="${colCount}">Aucune saisie pour ce mois. Cliquez sur « + Nouvelle saisie » pour en créer une.</td></tr>`;
    box.appendChild(table);
    host.innerHTML = '';
    host.appendChild(box);
    return;
  }

  rows.forEach((r) => {
    const f = r.freq || { objective: 0, realized: 0, pct: null };
    const c = r.cm || { objective: 0, realized: 0, pct: null };
    const fCls = pctClass(f.pct);
    const cCls = pctClass(c.pct);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.outletName)}</td>
      <td class="right">${fmtNum(f.objective)}</td>
      <td class="right">${fmtNum(f.realized)}</td>
      <td><span class="pill ${fCls}">${fmtPct(f.pct)}</span></td>
      <td class="right">${fmtNum(c.objective)}</td>
      <td class="right">${fmtNum(c.realized)}</td>
      <td><span class="pill ${cCls}">${fmtPct(c.pct)}</span></td>
      <td>
        <button class="btn btn-sm" data-edit="${r.outletId}|${r.mKey}">Modifier</button>
        <button class="btn btn-sm btn-danger" data-del="${r.outletId}|${r.mKey}">Suppr.</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.addEventListener('click', (e) => {
    const editKey = e.target.dataset.edit;
    const delKey = e.target.dataset.del;
    if (editKey) {
      const [outletId, mKey] = editKey.split('|');
      const row = rows.find((r) => r.outletId === outletId && r.mKey === mKey);
      openOutletForm(state, actions, { outletId, monthIndex0: row.freq ? row.freq.monthIndex0 : row.cm.monthIndex0 });
    } else if (delKey) {
      const [outletId, mKey] = delKey.split('|');
      if (confirm('Supprimer cette saisie (fréquentation et client mystère) ?')) {
        actions.commit((s) => {
          removeOutletMetricEntry(s, 'frequentation', outletId, mKey);
          removeOutletMetricEntry(s, 'clientMystere', outletId, mKey);
        });
      }
    }
  });

  box.appendChild(table);
  host.innerHTML = '';
  host.appendChild(box);
}

function openOutletForm(state, actions, { outletId, monthIndex0 }) {
  const isOutlet = actions.scope.role === 'outlet';
  const mKey = monthKey(ui.year, monthIndex0);
  const freq = getOutletMetricEntry(state, 'frequentation', outletId, mKey, false) || { objective: 0, realized: 0, comment: '' };
  const cm = getOutletMetricEntry(state, 'clientMystere', outletId, mKey, false) || { objective: 0, realized: 0, comment: '' };
  const outlet = state.outlets.find((o) => o.id === outletId);

  openModal(`
    <h2>Fréquentation &amp; Client mystère</h2>
    <form id="outletForm">
      <div class="form-grid">
        <label class="field">Point de vente
          ${isOutlet
            ? `<input type="text" value="${escapeHtml(outlet ? outlet.name : '')}" disabled>`
            : `<select id="ovOutlet">${state.outlets.map((o) => `<option value="${o.id}" ${o.id === outletId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select>`}
        </label>
        <label class="field">Mois
          <select id="ovMonth">${MONTH_NAMES_FR.map((m, i) => `<option value="${i}" ${i === monthIndex0 ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </label>
      </div>

      <h3 class="section-title" style="margin-top:16px">Fréquentation</h3>
      <div class="form-grid">
        <label class="field">Objectif (visites)
          <input type="number" min="0" name="freqObjective" value="${freq.objective}">
        </label>
        <label class="field">Réalisé (visites)
          <input type="number" min="0" name="freqRealized" value="${freq.realized}">
        </label>
      </div>

      <h3 class="section-title" style="margin-top:16px">Client mystère</h3>
      <div class="form-grid">
        <label class="field">Objectif (note/visites)
          <input type="number" min="0" name="cmObjective" value="${cm.objective}">
        </label>
        <label class="field">Réalisé (note/visites)
          <input type="number" min="0" name="cmRealized" value="${cm.realized}">
        </label>
      </div>

      <label class="field" style="margin-top:12px">Commentaire
        <textarea name="comment" rows="2" placeholder="Observation...">${escapeHtml(freq.comment || cm.comment)}</textarea>
      </label>

      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Valider la saisie</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);

    modalEl.querySelector('#outletForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ovOutlet = modalEl.querySelector('#ovOutlet');
      const fOutletId = ovOutlet ? ovOutlet.value : outletId;
      const fMonthIndex0 = Number(modalEl.querySelector('#ovMonth').value);
      const fMKey = monthKey(ui.year, fMonthIndex0);
      const comment = fd.get('comment') || '';

      actions.commit((s) => {
        upsertOutletMetric(s, 'frequentation', fOutletId, fMKey, { objective: fd.get('freqObjective'), realized: fd.get('freqRealized'), comment });
        upsertOutletMetric(s, 'clientMystere', fOutletId, fMKey, { objective: fd.get('cmObjective'), realized: fd.get('cmRealized'), comment });
      });
      ui.month = fMonthIndex0;
      closeModal();
    });
  });
}

function addOption(select, value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  select.appendChild(o);
}
