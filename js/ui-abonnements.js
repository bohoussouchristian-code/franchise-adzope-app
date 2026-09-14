import { MONTH_NAMES_FR, fmtNum, fmtDate, fmtMoney, escapeHtml, todayISO } from './utils.js';
import { addSubscription, updateSubscription, removeSubscription } from './store.js';
import { openModal, closeModal } from './modal.js';

let ui = {
  year: 'ALL',
  month: 'ALL', // 'ALL' or 0..11
  type: 'ALL', // ALL | TDD | FDD
  agentId: 'ALL',
  outletId: 'ALL',
  search: '',
};

// ---------- Page : Nouvelle abonnement ----------

export function renderNouvelAbonnement(root, state, actions) {
  const agentOptions = state.agents.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  const outletOptions = state.outlets.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Nouvel abonnement 4G Home</h1>
    <p class="page-sub">Chaque abonnement enregistré ici alimente automatiquement les objectifs 4G Home et apparaît dans l'historique.</p>

    <div class="card">
      <form id="subForm">
        <div class="form-grid">
          <label class="field">Date de création
            <input type="date" name="dateCreation" value="${todayISO()}" required>
          </label>
          <label class="field">Type d'abonnement
            <select name="type">
              <option value="TDD">TDD (Flybox)</option>
              <option value="FDD">FDD (Easybox)</option>
            </select>
          </label>
          <label class="field">Vendeur
            <select name="agentId"><option value="">—</option>${agentOptions}</select>
          </label>
          <label class="field">Point de vente
            <select name="outletId"><option value="">—</option>${outletOptions}</select>
          </label>
          <label class="field full">Nom du client
            <input type="text" name="infoClient" placeholder="NOM, Prénoms" required>
          </label>
          <label class="field">N° client
            <input type="text" name="numeroClient">
          </label>
          <label class="field">Numéro fixe (ND)
            <input type="text" name="numeroFixe">
          </label>
          <label class="field">Référence facture
            <input type="text" name="referenceFacture">
          </label>
          <label class="field">Coût facture initiale (F CFA)
            <input type="number" min="0" name="coutFactureInitiale">
          </label>
          <label class="field">Login de saisie
            <input type="text" name="loginSaisie">
          </label>
          <label class="field">Login paiement
            <input type="text" name="loginPaiement">
          </label>
          <label class="field">Date dépôt des avantages
            <input type="date" name="dateDepotAvantages" value="${todayISO()}">
          </label>
          <label class="field">Mode de paiement
            <input type="text" name="modePaiement" placeholder="OM, Espèce, réf. mobile money...">
          </label>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" ${state.agents.length ? '' : 'disabled'}>Ajouter l'abonnement</button>
        </div>
      </form>
    </div>
  `;
  root.appendChild(wrap);

  if (!state.agents.length) {
    const note = document.createElement('p');
    note.className = 'small muted';
    note.textContent = "Ajoutez d'abord un vendeur dans « Équipe & Points de vente » pour pouvoir enregistrer un abonnement.";
    wrap.querySelector('#subForm').before(note);
  }

  wrap.querySelector('#subForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    actions.commit((s) => addSubscription(s, data));
    actions.goTo('abonnements-historique');
  });
}

// ---------- Page : Historique des abonnements ----------

export function renderHistoriqueAbonnements(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Historique des abonnements</h1>
    <p class="page-sub">Retrace tous les abonnements 4G Home enregistrés, filtrables par année, mois, type, vendeur et point de vente.</p>

    <div class="toolbar">
      <label class="field">Année
        <select id="fYear"><option value="ALL">Toutes</option></select>
      </label>
      <label class="field">Mois
        <select id="fMonth"><option value="ALL">Tous les mois</option></select>
      </label>
      <label class="field">Type
        <select id="fType">
          <option value="ALL">Tous types</option>
          <option value="TDD">TDD (Flybox)</option>
          <option value="FDD">FDD (Easybox)</option>
        </select>
      </label>
      <label class="field">Vendeur
        <select id="fAgent"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Point de vente
        <select id="fOutlet"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Recherche
        <input type="search" id="fSearch" placeholder="Nom, n° client, n° facture..." value="${escapeHtml(ui.search)}">
      </label>
    </div>

    <div id="recap" class="grid-cards"></div>
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  const years = new Set();
  state.subscriptions4gHome.forEach((s) => {
    if (s.dateCreation) years.add(Number(s.dateCreation.slice(0, 4)));
  });
  if (state.meta.year) years.add(state.meta.year);

  const yearSel = wrap.querySelector('#fYear');
  [...years].sort((a, b) => b - a).forEach((y) => addOption(yearSel, y, y, String(y) === String(ui.year)));

  const monthSel = wrap.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, String(ui.month) === String(i)));

  const agentSel = wrap.querySelector('#fAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.agentId));

  const outletSel = wrap.querySelector('#fOutlet');
  state.outlets.forEach((o) => addOption(outletSel, o.id, o.name, o.id === ui.outletId));

  wrap.querySelector('#fType').value = ui.type;

  wrap.querySelector('#fYear').addEventListener('change', (e) => { ui.year = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fMonth').addEventListener('change', (e) => { ui.month = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fType').addEventListener('change', (e) => { ui.type = e.target.value; actions.rerender(); });
  wrap.querySelector('#fAgent').addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });
  wrap.querySelector('#fOutlet').addEventListener('change', (e) => { ui.outletId = e.target.value; actions.rerender(); });
  wrap.querySelector('#fSearch').addEventListener('input', (e) => { ui.search = e.target.value; renderList(wrap, state, actions); });

  renderList(wrap, state, actions);
}

function addOption(select, value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  select.appendChild(o);
}

function filteredSubs(state) {
  const q = ui.search.trim().toLowerCase();
  return state.subscriptions4gHome.filter((s) => {
    if (ui.year !== 'ALL') {
      if (!s.dateCreation || !s.dateCreation.startsWith(String(ui.year))) return false;
    }
    if (ui.month !== 'ALL' && (!s.dateCreation || s.dateCreation.slice(5, 7) !== String(ui.month + 1).padStart(2, '0'))) return false;
    if (ui.type !== 'ALL' && s.type !== ui.type) return false;
    if (ui.agentId !== 'ALL' && s.agentId !== ui.agentId) return false;
    if (ui.outletId !== 'ALL' && s.outletId !== ui.outletId) return false;
    if (q) {
      const hay = [s.infoClient, s.numeroClient, s.numeroFixe, s.referenceFacture, s.loginSaisie, s.loginPaiement]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
}

function renderList(wrap, state, actions) {
  const subs = filteredSubs(state);
  const tdd = subs.filter((s) => s.type === 'TDD').length;
  const fdd = subs.filter((s) => s.type === 'FDD').length;
  const revenue = subs.reduce((sum, s) => sum + (s.coutFactureInitiale || 0), 0);

  const recap = wrap.querySelector('#recap');
  recap.innerHTML = '';
  [
    ['Résultats filtrés', fmtNum(subs.length)],
    ['TDD (Flybox)', fmtNum(tdd)],
    ['FDD (Easybox)', fmtNum(fdd)],
    ['Facturation cumulée', fmtMoney(revenue)],
  ].forEach(([label, value]) => {
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.innerHTML = `<div class="name">${label}</div><div class="nums"><b style="font-size:20px">${value}</b></div>`;
    recap.appendChild(el);
  });

  const host = wrap.querySelector('#tableHost');
  host.innerHTML = '';

  if (!subs.length) {
    host.innerHTML = `<div class="empty-state">Aucun abonnement pour ces filtres.</div>`;
    return;
  }

  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Client</th>
        <th>Type</th>
        <th>N° client</th>
        <th>N° fixe</th>
        <th>Réf. facture</th>
        <th>Coût facture</th>
        <th>Vendeur</th>
        <th>Point de vente</th>
        <th>Mode paiement</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  const agentById = Object.fromEntries(state.agents.map((a) => [a.id, a.name]));
  const outletById = Object.fromEntries(state.outlets.map((o) => [o.id, o.name]));

  subs.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(s.dateCreation)}</td>
      <td>${escapeHtml(s.infoClient)}</td>
      <td><span class="pill ${s.type === 'TDD' ? 'neutral' : 'warn'}">${s.type}</span></td>
      <td>${escapeHtml(s.numeroClient)}</td>
      <td>${escapeHtml(s.numeroFixe)}</td>
      <td>${escapeHtml(s.referenceFacture)}</td>
      <td class="right">${fmtMoney(s.coutFactureInitiale)}</td>
      <td>${s.agentId ? `<span class="badge-agent">${escapeHtml(agentById[s.agentId] || '—')}</span>` : '<span class="muted">—</span>'}</td>
      <td>${s.outletId ? escapeHtml(outletById[s.outletId] || '—') : '<span class="muted">—</span>'}</td>
      <td>${escapeHtml(s.modePaiement)}</td>
      <td>
        <button class="btn btn-sm" data-edit="${s.id}">Modifier</button>
        <button class="btn btn-sm btn-danger" data-del="${s.id}">Suppr.</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.addEventListener('click', (e) => {
    const editId = e.target.dataset.edit;
    const delId = e.target.dataset.del;
    if (editId) {
      const rec = state.subscriptions4gHome.find((r) => r.id === editId);
      openEditForm(state, actions, rec);
    } else if (delId) {
      if (confirm('Supprimer cet abonnement ? Cette action est irréversible.')) {
        actions.commit((s) => removeSubscription(s, delId));
      }
    }
  });

  box.appendChild(table);
  host.appendChild(box);
}

function openEditForm(state, actions, rec) {
  const agentOptions = state.agents.map((a) => `<option value="${a.id}" ${rec.agentId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  const outletOptions = state.outlets.map((o) => `<option value="${o.id}" ${rec.outletId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
  const v = rec;

  openModal(`
    <h2>Modifier l'abonnement</h2>
    <form id="subForm">
      <div class="form-grid">
        <label class="field">Date de création
          <input type="date" name="dateCreation" value="${v.dateCreation || ''}" required>
        </label>
        <label class="field">Type d'abonnement
          <select name="type">
            <option value="TDD" ${v.type === 'TDD' ? 'selected' : ''}>TDD (Flybox)</option>
            <option value="FDD" ${v.type === 'FDD' ? 'selected' : ''}>FDD (Easybox)</option>
          </select>
        </label>
        <label class="field">Vendeur
          <select name="agentId"><option value="">—</option>${agentOptions}</select>
        </label>
        <label class="field">Point de vente
          <select name="outletId"><option value="">—</option>${outletOptions}</select>
        </label>
        <label class="field full">Nom du client
          <input type="text" name="infoClient" value="${escapeHtml(v.infoClient)}" placeholder="NOM, Prénoms" required>
        </label>
        <label class="field">N° client
          <input type="text" name="numeroClient" value="${escapeHtml(v.numeroClient)}">
        </label>
        <label class="field">Numéro fixe (ND)
          <input type="text" name="numeroFixe" value="${escapeHtml(v.numeroFixe)}">
        </label>
        <label class="field">Référence facture
          <input type="text" name="referenceFacture" value="${escapeHtml(v.referenceFacture)}">
        </label>
        <label class="field">Coût facture initiale (F CFA)
          <input type="number" min="0" name="coutFactureInitiale" value="${v.coutFactureInitiale || ''}">
        </label>
        <label class="field">Login de saisie
          <input type="text" name="loginSaisie" value="${escapeHtml(v.loginSaisie)}">
        </label>
        <label class="field">Login paiement
          <input type="text" name="loginPaiement" value="${escapeHtml(v.loginPaiement)}">
        </label>
        <label class="field">Date dépôt des avantages
          <input type="date" name="dateDepotAvantages" value="${v.dateDepotAvantages || ''}">
        </label>
        <label class="field">Mode de paiement
          <input type="text" name="modePaiement" value="${escapeHtml(v.modePaiement)}" placeholder="OM, Espèce, réf. mobile money...">
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-danger" id="btnDelete">Supprimer</button>
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    modalEl.querySelector('#btnDelete').addEventListener('click', () => {
      if (confirm('Supprimer cet abonnement ?')) {
        actions.commit((s) => removeSubscription(s, rec.id));
        closeModal();
      }
    });
    modalEl.querySelector('#subForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      actions.commit((s) => updateSubscription(s, rec.id, data));
      closeModal();
    });
  });
}
