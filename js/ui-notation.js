import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass, escapeHtml } from './utils.js';
import {
  EVAL_CRITERIA, getEvaluationEntry, upsertEvaluation, removeEvaluationEntry, listEvaluationRows,
  getOutletMetricEntry, upsertOutletMetric, removeOutletMetricEntry, listOutletMetricRows,
} from './store.js';
import { openModal, closeModal } from './modal.js';

let ui = {
  view: 'evaluation', // 'evaluation' | 'outlets'
  year: null,
  month: new Date().getMonth(),
  agentId: 'ALL',
  outletId: 'ALL',
};

export function renderNotation(root, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <p class="page-sub" style="margin-top:-4px">Fréquentation, client mystère et évaluation individuelle, séparés des objectifs commerciaux.</p>
    <div class="subtabs">
      <button class="subtab-btn ${ui.view === 'evaluation' ? 'active' : ''}" data-view="evaluation">Évaluation des vendeurs</button>
      <button class="subtab-btn ${ui.view === 'outlets' ? 'active' : ''}" data-view="outlets">Fréquentation &amp; Client mystère</button>
    </div>
    <div id="notationHost"></div>
  `;
  root.appendChild(wrap);

  wrap.querySelectorAll('.subtab-btn').forEach((b) => {
    b.addEventListener('click', () => { ui.view = b.dataset.view; actions.rerender(); });
  });

  const host = wrap.querySelector('#notationHost');
  if (ui.view === 'outlets') renderOutlets(host, state, actions);
  else renderEvaluations(host, state, actions);
}

// ---------- Évaluation des vendeurs ----------

function renderEvaluations(host, state, actions) {
  if (!state.agents.length) {
    host.innerHTML = `<div class="empty-state">Ajoutez d'abord un vendeur dans l'onglet « Équipe &amp; Points de vente ».</div>`;
    return;
  }

  host.innerHTML = `
    <div class="page-head-row">
      <div class="toolbar" style="margin-bottom:0">
        <label class="field">Mois
          <select id="fMonth"></select>
        </label>
        <label class="field">Vendeur
          <select id="fAgent"><option value="ALL">Tous</option></select>
        </label>
      </div>
      <button class="btn btn-primary" id="btnNewEval">+ Nouvelle évaluation</button>
    </div>
    <div id="tableHost"></div>
  `;

  const monthSel = host.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, i === ui.month));
  const agentSel = host.querySelector('#fAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.agentId));

  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });
  agentSel.addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });

  host.querySelector('#btnNewEval').addEventListener('click', () => {
    openEvaluationForm(state, actions, { agentId: state.agents[0].id, monthIndex0: ui.month });
  });

  const mKey = monthKey(ui.year, ui.month);
  const rows = listEvaluationRows(state, { agentId: ui.agentId, year: ui.year }).filter((r) => r.mKey === mKey);
  renderEvalTable(host.querySelector('#tableHost'), rows, state, actions);
}

function renderEvalTable(host, rows, state, actions) {
  if (!rows.length) {
    host.innerHTML = `<div class="empty-state">Aucune évaluation pour ce mois. Cliquez sur « + Nouvelle évaluation » pour en créer une.</div>`;
    return;
  }
  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Vendeur</th>
        <th>Total</th>
        <th>Objectif</th>
        <th>GAP</th>
        <th>%</th>
        <th>Commentaire</th>
        <th></th>
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
      <td class="right"><b>${fmtNum(r.total)}</b></td>
      <td class="right">${fmtNum(r.objective)}</td>
      <td class="right">${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</td>
      <td><span class="pill ${cls}">${fmtPct(r.pct)}</span></td>
      <td class="muted">${escapeHtml(r.comment) || '—'}</td>
      <td>
        <button class="btn btn-sm" data-edit="${r.agentId}|${r.mKey}">Modifier</button>
        <button class="btn btn-sm btn-danger" data-del="${r.agentId}|${r.mKey}">Suppr.</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.addEventListener('click', (e) => {
    const editKey = e.target.dataset.edit;
    const delKey = e.target.dataset.del;
    if (editKey) {
      const [agentId, mKey] = editKey.split('|');
      const { monthIndex0 } = rows.find((r) => r.agentId === agentId && r.mKey === mKey);
      openEvaluationForm(state, actions, { agentId, monthIndex0 });
    } else if (delKey) {
      const [agentId, mKey] = delKey.split('|');
      if (confirm('Supprimer cette évaluation ?')) {
        actions.commit((s) => removeEvaluationEntry(s, agentId, mKey));
      }
    }
  });

  box.appendChild(table);
  host.innerHTML = '';
  host.appendChild(box);
}

function openEvaluationForm(state, actions, { agentId, monthIndex0 }) {
  const mKey = monthKey(ui.year, monthIndex0);
  const entry = getEvaluationEntry(state, agentId, mKey, false)
    || { criteria: EVAL_CRITERIA.map(() => 0), objective: EVAL_CRITERIA.length * 3, comment: '' };

  openModal(`
    <h2>Évaluation du vendeur</h2>
    <form id="evalForm">
      <div class="form-grid">
        <label class="field">Vendeur
          <select id="evAgent">${state.agents.map((a) => `<option value="${a.id}" ${a.id === agentId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>
        </label>
        <label class="field">Mois
          <select id="evMonth">${MONTH_NAMES_FR.map((m, i) => `<option value="${i}" ${i === monthIndex0 ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </label>
      </div>

      <div class="eval-criteria" id="evCriteria"></div>

      <div class="form-grid" style="margin-top:12px">
        <label class="field">Objectif (total sur ${EVAL_CRITERIA.length * 3})
          <input type="number" min="0" name="objective" value="${entry.objective}">
        </label>
      </div>
      <label class="field" style="margin-top:12px">Commentaire
        <textarea name="comment" rows="2" placeholder="Observation...">${escapeHtml(entry.comment)}</textarea>
      </label>

      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Valider l'évaluation</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);

    const agentSel = modalEl.querySelector('#evAgent');
    const monthSel = modalEl.querySelector('#evMonth');
    const criteriaHost = modalEl.querySelector('#evCriteria');

    const refresh = () => {
      const mk = monthKey(ui.year, Number(monthSel.value));
      const e = getEvaluationEntry(state, agentSel.value, mk, false) || { criteria: EVAL_CRITERIA.map(() => 0) };
      criteriaHost.innerHTML = EVAL_CRITERIA.map((label, i) => `
        <label class="eval-criterion">
          <span>${escapeHtml(label)}</span>
          <select name="crit_${i}">
            ${[0, 1, 2, 3].map((v) => `<option value="${v}" ${v === (e.criteria[i] || 0) ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
      `).join('');
    };
    agentSel.addEventListener('change', refresh);
    monthSel.addEventListener('change', refresh);
    refresh();

    modalEl.querySelector('#evalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fAgentId = agentSel.value;
      const fMKey = monthKey(ui.year, Number(monthSel.value));
      const criteria = EVAL_CRITERIA.map((_, i) => fd.get(`crit_${i}`) || 0);
      const objective = fd.get('objective');
      const comment = fd.get('comment') || '';

      actions.commit((s) => upsertEvaluation(s, fAgentId, fMKey, { criteria, objective, comment }));
      ui.month = Number(monthSel.value);
      closeModal();
    });
  });
}

// ---------- Fréquentation & Client mystère (par point de vente) ----------

function renderOutlets(host, state, actions) {
  if (!state.outlets.length) {
    host.innerHTML = `<div class="empty-state">Ajoutez d'abord un point de vente dans l'onglet « Équipe &amp; Points de vente ».</div>`;
    return;
  }

  host.innerHTML = `
    <div class="page-head-row">
      <div class="toolbar" style="margin-bottom:0">
        <label class="field">Mois
          <select id="fMonth"></select>
        </label>
        <label class="field">Point de vente
          <select id="fOutlet"><option value="ALL">Tous</option></select>
        </label>
      </div>
      <button class="btn btn-primary" id="btnNewOutlet">+ Nouvelle saisie</button>
    </div>
    <div id="tableHost"></div>
  `;

  const monthSel = host.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, i === ui.month));
  const outletSel = host.querySelector('#fOutlet');
  state.outlets.forEach((o) => addOption(outletSel, o.id, o.name, o.id === ui.outletId));

  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });
  outletSel.addEventListener('change', (e) => { ui.outletId = e.target.value; actions.rerender(); });

  host.querySelector('#btnNewOutlet').addEventListener('click', () => {
    openOutletForm(state, actions, { outletId: state.outlets[0].id, monthIndex0: ui.month });
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
  if (!rows.length) {
    host.innerHTML = `<div class="empty-state">Aucune saisie pour ce mois. Cliquez sur « + Nouvelle saisie » pour en créer une.</div>`;
    return;
  }
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
  const mKey = monthKey(ui.year, monthIndex0);
  const freq = getOutletMetricEntry(state, 'frequentation', outletId, mKey, false) || { objective: 0, realized: 0, comment: '' };
  const cm = getOutletMetricEntry(state, 'clientMystere', outletId, mKey, false) || { objective: 0, realized: 0, comment: '' };

  openModal(`
    <h2>Fréquentation &amp; Client mystère</h2>
    <form id="outletForm">
      <div class="form-grid">
        <label class="field">Point de vente
          <select id="ovOutlet">${state.outlets.map((o) => `<option value="${o.id}" ${o.id === outletId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select>
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
      const fOutletId = modalEl.querySelector('#ovOutlet').value;
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
