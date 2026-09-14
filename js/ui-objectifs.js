import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass, escapeHtml } from './utils.js';
import { getObjectiveEntry, upsertObjective, removeObjectiveEntry, listObjectiveRows } from './store.js';
import { openModal, closeModal } from './modal.js';

let ui = {
  histAgentId: 'ALL',
  histYear: 'ALL',
  histMonth: 'ALL',
};

// ---------- Page : Suivi du mois ----------

export function renderObjectifsSuivi(root, state, actions) {
  const now = new Date();
  const year = state.meta.year || now.getFullYear();
  const monthIndex0 = now.getFullYear() === year ? now.getMonth() : 0;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Objectifs — Suivi du mois</h1>
        <p class="page-sub">${MONTH_NAMES_FR[monthIndex0]} ${year} — tous les vendeurs.</p>
      </div>
      <button class="btn btn-primary" id="btnNewObjective" ${state.agents.length ? '' : 'disabled'}>+ Nouvel objectif</button>
    </div>
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  if (!state.agents.length) {
    wrap.querySelector('#tableHost').innerHTML = `<div class="empty-state">Ajoutez d'abord un vendeur dans l'onglet « Équipe &amp; Points de vente ».</div>`;
    return;
  }

  wrap.querySelector('#btnNewObjective').addEventListener('click', () => {
    openObjectiveSheet(state, actions, {
      agentId: state.agents[0].id,
      year,
      monthIndex0,
    });
  });

  const mKey = monthKey(year, monthIndex0);
  const rows = listObjectiveRows(state, { agentId: 'ALL', year }).filter((r) => r.mKey === mKey);

  renderTable(wrap.querySelector('#tableHost'), rows, state, actions, { showActions: true, emptyText: 'Aucun objectif fixé pour ce mois. Cliquez sur « + Nouvel objectif » pour en créer un.' });
}

// ---------- Page : Historique des objectifs ----------

export function renderObjectifsHistorique(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Historique des objectifs</h1>
    <p class="page-sub">Retrace tous les objectifs assignés à chaque vendeur, tous mois confondus.</p>
    <div class="toolbar">
      <label class="field">Vendeur
        <select id="hAgent"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Mois
        <select id="hMonth"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Année
        <select id="hYear"><option value="ALL">Toutes</option></select>
      </label>
    </div>
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  const agentSel = wrap.querySelector('#hAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.histAgentId));

  const monthSel = wrap.querySelector('#hMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, String(i) === String(ui.histMonth)));

  const years = new Set();
  Object.values(state.objectives).forEach((byProduct) => {
    Object.values(byProduct).forEach((byMonth) => {
      Object.keys(byMonth).forEach((mKey) => years.add(Number(mKey.slice(0, 4))));
    });
  });
  const yearSel = wrap.querySelector('#hYear');
  [...years].sort((a, b) => b - a).forEach((y) => addOption(yearSel, y, y, String(y) === String(ui.histYear)));

  agentSel.addEventListener('change', (e) => { ui.histAgentId = e.target.value; actions.rerender(); });
  monthSel.addEventListener('change', (e) => { ui.histMonth = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });
  yearSel.addEventListener('change', (e) => { ui.histYear = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });

  let rows = listObjectiveRows(state, { agentId: ui.histAgentId, year: ui.histYear });
  if (ui.histMonth !== 'ALL') rows = rows.filter((r) => r.monthIndex0 === ui.histMonth);
  renderTable(wrap.querySelector('#tableHost'), rows, state, actions, { showActions: false, showPeriod: true, emptyText: 'Aucun objectif enregistré pour ces filtres.' });
}

// ---------- Tableau partagé ----------

function renderTable(host, rows, state, actions, { showActions, showPeriod, emptyText }) {
  if (!rows.length) {
    host.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Vendeur</th>
        <th>Produit</th>
        ${showPeriod ? '<th>Période</th>' : ''}
        <th>Objectif</th>
        <th>Sem.1</th><th>Sem.2</th><th>Sem.3</th><th>Sem.4</th>
        <th>Réalisé</th>
        <th>GAP</th>
        <th>%</th>
        <th>Commentaire</th>
        ${showActions ? '<th></th>' : ''}
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  rows.forEach((r) => {
    const cls = pctClass(r.pct);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-agent">${escapeHtml(r.agentName)}</span></td>
      <td>${escapeHtml(r.productName)}${r.autoFromRegistry ? ' <span class="small muted">(auto)</span>' : ''}</td>
      ${showPeriod ? `<td>${MONTH_NAMES_FR[r.monthIndex0]} ${r.year}</td>` : ''}
      <td class="right">${fmtNum(r.objective)}</td>
      <td class="right">${fmtNum(r.weeks[0])}</td>
      <td class="right">${fmtNum(r.weeks[1])}</td>
      <td class="right">${fmtNum(r.weeks[2])}</td>
      <td class="right">${fmtNum(r.weeks[3])}</td>
      <td class="right"><b>${fmtNum(r.realized)}</b></td>
      <td class="right">${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</td>
      <td><span class="pill ${cls}">${fmtPct(r.pct)}</span></td>
      <td class="muted">${escapeHtml(r.comment) || '—'}</td>
      ${showActions ? `
        <td>
          <button class="btn btn-sm" data-edit="${r.agentId}|${r.productId}|${r.mKey}" title="Modifier la fiche complète de ce vendeur pour ce mois">Modifier la fiche</button>
          <button class="btn btn-sm btn-danger" data-del="${r.agentId}|${r.productId}|${r.mKey}" title="Supprimer uniquement cette ligne (${escapeHtml(r.productName)})">Suppr. ce produit</button>
        </td>
      ` : ''}
    `;
    tbody.appendChild(tr);
  });

  if (showActions) {
    table.addEventListener('click', (e) => {
      const editKey = e.target.dataset.edit;
      const delKey = e.target.dataset.del;
      if (editKey) {
        const [agentId, , mKey] = editKey.split('|');
        const row = rows.find((r) => r.agentId === agentId && r.mKey === mKey);
        openObjectiveSheet(state, actions, { agentId, year: row.year, monthIndex0: row.monthIndex0 });
      } else if (delKey) {
        const [agentId, productId, mKey] = delKey.split('|');
        if (confirm('Supprimer cet objectif ?')) {
          actions.commit((s) => removeObjectiveEntry(s, agentId, productId, mKey));
        }
      }
    });
  }

  box.appendChild(table);
  host.innerHTML = '';
  host.appendChild(box);
}

// ---------- Formulaire "+ Nouvel objectif" : une fiche, tous les produits, un vendeur ----------

function openObjectiveSheet(state, actions, { agentId, year, monthIndex0 }) {
  const agent = state.agents.find((a) => a.id === agentId) || state.agents[0];

  openModal(`
    <h2>Fiche d'objectifs</h2>
    <p class="small muted" style="margin-top:-8px">Tous les produits pour un même vendeur et un même mois.</p>

    <div class="form-grid sheet-context">
      <label class="field">Vendeur
        <select id="sheetAgent">${state.agents.map((a) => `<option value="${a.id}" ${a.id === agent.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>
      </label>
      <label class="field">Mois
        <select id="sheetMonth">${MONTH_NAMES_FR.map((m, i) => `<option value="${i}" ${i === monthIndex0 ? 'selected' : ''}>${m}</option>`).join('')}</select>
      </label>
    </div>

    <form id="sheetForm">
      <div id="sheetProducts" class="sheet-products"></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Valider la fiche</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);

    const agentSel = modalEl.querySelector('#sheetAgent');
    const monthSel = modalEl.querySelector('#sheetMonth');

    const refresh = () => fillSheetProducts(modalEl.querySelector('#sheetProducts'), state, agentSel.value, year, Number(monthSel.value));
    agentSel.addEventListener('change', refresh);
    monthSel.addEventListener('change', refresh);
    refresh();

    modalEl.querySelector('#sheetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fAgentId = agentSel.value;
      const fMKey = monthKey(year, Number(monthSel.value));

      actions.commit((s) => {
        s.products.forEach((p) => {
          const objective = fd.get(`obj_${p.id}`) || 0;
          const weeks = [0, 1, 2, 3].map((i) => fd.get(`w${i}_${p.id}`) || 0);
          const comment = fd.get(`c_${p.id}`) || '';
          upsertObjective(s, fAgentId, p.id, fMKey, { objective, weeks, comment });
        });
      });
      closeModal();
    });
  });
}

function fillSheetProducts(host, state, agentId, year, monthIndex0) {
  const mKey = monthKey(year, monthIndex0);
  host.innerHTML = state.products.map((p) => {
    const entry = getObjectiveEntry(state, agentId, p.id, mKey, false) || { objective: 0, weeks: [0, 0, 0, 0], comment: '' };
    const isAuto = p.autoFromRegistry;
    return `
      <div class="sheet-product">
        <div class="sheet-product-head">
          <span class="sheet-product-name">${escapeHtml(p.name)}</span>
          ${isAuto ? '<span class="pill neutral">Auto (registre)</span>' : `<span class="small muted">${escapeHtml(p.unit)}</span>`}
        </div>
        <div class="sheet-product-fields">
          <label>Objectif<input type="number" min="0" name="obj_${p.id}" value="${entry.objective}"></label>
          <label>Sem.1<input type="number" min="0" name="w0_${p.id}" value="${entry.weeks[0]}" ${isAuto ? 'disabled' : ''}></label>
          <label>Sem.2<input type="number" min="0" name="w1_${p.id}" value="${entry.weeks[1]}" ${isAuto ? 'disabled' : ''}></label>
          <label>Sem.3<input type="number" min="0" name="w2_${p.id}" value="${entry.weeks[2]}" ${isAuto ? 'disabled' : ''}></label>
          <label>Sem.4<input type="number" min="0" name="w3_${p.id}" value="${entry.weeks[3]}" ${isAuto ? 'disabled' : ''}></label>
        </div>
        <label class="sheet-comment">Commentaire
          <textarea name="c_${p.id}" rows="1" placeholder="Observation, justification d'écart...">${escapeHtml(entry.comment)}</textarea>
        </label>
      </div>
    `;
  }).join('');
}

function addOption(select, value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  select.appendChild(o);
}
