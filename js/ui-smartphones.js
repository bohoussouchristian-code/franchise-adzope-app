import { MONTH_NAMES_FR, fmtNum, fmtDate, fmtMoney, escapeHtml, todayISO } from './utils.js';
import { addSmartphoneSale, updateSmartphoneSale, removeSmartphoneSale, smartphoneReste } from './store.js';
import { openModal, closeModal } from './modal.js';

let ui = {
  year: 'ALL',
  month: 'ALL',
  mode: 'ALL', // ALL | CASH | CREDIT
  agentId: 'ALL',
  outletId: 'ALL',
  search: '',
};

// ---------- Page : Nouvelle vente Smartphone ----------

export function renderNouvelleVenteSmartphone(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Nouvelle vente Smartphone</h1>
        <p class="page-sub">Les ventes ajoutées aujourd'hui (cash et crédit) apparaissent dans le tableau ci-dessous.</p>
      </div>
      <button class="btn btn-primary" id="btnAdd" ${state.agents.length ? '' : 'disabled'}>+ Nouvelle vente</button>
    </div>
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  if (!state.agents.length) {
    wrap.querySelector('#tableHost').innerHTML = `<div class="empty-state">Ajoutez d'abord un vendeur dans « Équipe &amp; Points de vente » pour pouvoir enregistrer une vente.</div>`;
    return;
  }

  wrap.querySelector('#btnAdd').addEventListener('click', () => openSaleForm(state, actions, null));

  const today = todayISO();
  const sales = state.salesSmartphones.filter((s) => s.dateCreation === today);
  renderSalesTable(wrap.querySelector('#tableHost'), sales, state, actions, { emptyText: "Aucune vente ajoutée aujourd'hui pour l'instant. Cliquez sur « + Nouvelle vente » pour en enregistrer une." });
}

// ---------- Page : Historique des ventes Smartphones ----------

export function renderHistoriqueVentesSmartphones(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Historique des ventes Smartphones</h1>
    <p class="page-sub">Retrace toutes les ventes de smartphones (cash et crédit), filtrables par année, mois, mode de vente, vendeur et point de vente.</p>

    <div class="toolbar">
      <label class="field">Année
        <select id="fYear"><option value="ALL">Toutes</option></select>
      </label>
      <label class="field">Mois
        <select id="fMonth"><option value="ALL">Tous les mois</option></select>
      </label>
      <label class="field">Mode de vente
        <select id="fMode">
          <option value="ALL">Tous</option>
          <option value="CASH">Cash</option>
          <option value="CREDIT">Crédit</option>
        </select>
      </label>
      <label class="field">Vendeur
        <select id="fAgent"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Point de vente
        <select id="fOutlet"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Recherche
        <input type="search" id="fSearch" placeholder="Nom, n° client, modèle, n° facture..." value="${escapeHtml(ui.search)}">
      </label>
    </div>

    <div id="recap" class="grid-cards"></div>
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  const years = new Set();
  state.salesSmartphones.forEach((s) => {
    if (s.dateCreation) years.add(Number(s.dateCreation.slice(0, 4)));
  });
  if (state.meta.year) years.add(state.meta.year);

  const yearSel = wrap.querySelector('#fYear');
  [...years].sort((a, b) => b - a).forEach((y) => addOption(yearSel, y, y, String(y) === String(ui.year)));

  const monthSel = wrap.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, String(ui.month) === String(i)));

  wrap.querySelector('#fMode').value = ui.mode;

  const agentSel = wrap.querySelector('#fAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.agentId));

  const outletSel = wrap.querySelector('#fOutlet');
  state.outlets.forEach((o) => addOption(outletSel, o.id, o.name, o.id === ui.outletId));

  wrap.querySelector('#fYear').addEventListener('change', (e) => { ui.year = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fMonth').addEventListener('change', (e) => { ui.month = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fMode').addEventListener('change', (e) => { ui.mode = e.target.value; actions.rerender(); });
  wrap.querySelector('#fAgent').addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });
  wrap.querySelector('#fOutlet').addEventListener('change', (e) => { ui.outletId = e.target.value; actions.rerender(); });
  wrap.querySelector('#fSearch').addEventListener('input', (e) => { ui.search = e.target.value; refreshHistorique(wrap, state, actions); });

  refreshHistorique(wrap, state, actions);
}

function refreshHistorique(wrap, state, actions) {
  const sales = filteredSales(state);
  const cash = sales.filter((s) => s.modeVente === 'CASH').length;
  const credit = sales.filter((s) => s.modeVente === 'CREDIT').length;
  const revenue = sales.reduce((sum, s) => sum + (s.prixTotal || 0), 0);
  const outstanding = sales.reduce((sum, s) => sum + smartphoneReste(s), 0);

  const recap = wrap.querySelector('#recap');
  recap.innerHTML = '';
  [
    ['Résultats filtrés', fmtNum(sales.length)],
    ['Ventes Cash', fmtNum(cash)],
    ['Ventes Crédit', fmtNum(credit)],
    ['Chiffre d\'affaires cumulé', fmtMoney(revenue)],
    ['Reste à recouvrer', fmtMoney(outstanding)],
  ].forEach(([label, value]) => {
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.innerHTML = `<div class="name">${label}</div><div class="nums"><b style="font-size:20px">${value}</b></div>`;
    recap.appendChild(el);
  });

  renderSalesTable(wrap.querySelector('#tableHost'), sales, state, actions, { emptyText: 'Aucune vente pour ces filtres.' });
}

function addOption(select, value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  select.appendChild(o);
}

function filteredSales(state) {
  const q = ui.search.trim().toLowerCase();
  return state.salesSmartphones.filter((s) => {
    if (ui.year !== 'ALL') {
      if (!s.dateCreation || !s.dateCreation.startsWith(String(ui.year))) return false;
    }
    if (ui.month !== 'ALL' && (!s.dateCreation || s.dateCreation.slice(5, 7) !== String(ui.month + 1).padStart(2, '0'))) return false;
    if (ui.mode !== 'ALL' && s.modeVente !== ui.mode) return false;
    if (ui.agentId !== 'ALL' && s.agentId !== ui.agentId) return false;
    if (ui.outletId !== 'ALL' && s.outletId !== ui.outletId) return false;
    if (q) {
      const hay = [s.infoClient, s.numeroClient, s.modele, s.referenceFacture]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
}

// ---------- Tableau partagé ----------

function renderSalesTable(host, sales, state, actions, { emptyText }) {
  host.innerHTML = '';

  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Client</th>
        <th>Modèle</th>
        <th>Mode</th>
        <th>Prix total</th>
        <th>Avance versée</th>
        <th>Reste à payer</th>
        <th>Vendeur</th>
        <th>Point de vente</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  if (!sales.length) {
    const colCount = table.querySelectorAll('thead th').length;
    tbody.innerHTML = `<tr class="table-empty-row"><td colspan="${colCount}">${emptyText}</td></tr>`;
    box.appendChild(table);
    host.appendChild(box);
    return;
  }

  const agentById = Object.fromEntries(state.agents.map((a) => [a.id, a.name]));
  const outletById = Object.fromEntries(state.outlets.map((o) => [o.id, o.name]));

  sales.forEach((s) => {
    const reste = smartphoneReste(s);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(s.dateCreation)}</td>
      <td>${escapeHtml(s.infoClient)}</td>
      <td>${escapeHtml(s.modele)}</td>
      <td><span class="pill ${s.modeVente === 'CASH' ? 'neutral' : 'warn'}">${s.modeVente === 'CASH' ? 'Cash' : 'Crédit'}</span></td>
      <td class="right">${fmtMoney(s.prixTotal)}</td>
      <td class="right">${fmtMoney(s.avanceVersee)}</td>
      <td class="right">${reste > 0 ? `<b>${fmtMoney(reste)}</b>` : fmtMoney(0)}</td>
      <td>${s.agentId ? `<span class="badge-agent">${escapeHtml(agentById[s.agentId] || '—')}</span>` : '<span class="muted">—</span>'}</td>
      <td>${s.outletId ? escapeHtml(outletById[s.outletId] || '—') : '<span class="muted">—</span>'}</td>
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
      const rec = state.salesSmartphones.find((r) => r.id === editId);
      openSaleForm(state, actions, rec);
    } else if (delId) {
      if (confirm('Supprimer cette vente ? Cette action est irréversible.')) {
        actions.commit((s) => removeSmartphoneSale(s, delId));
      }
    }
  });

  box.appendChild(table);
  host.appendChild(box);
}

// ---------- Formulaire "+ Nouvelle vente" / Modifier ----------

function openSaleForm(state, actions, rec) {
  const isEdit = !!rec;
  const agentOptions = state.agents.map((a) => `<option value="${a.id}" ${rec && rec.agentId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  const outletOptions = state.outlets.map((o) => `<option value="${o.id}" ${rec && rec.outletId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');

  const v = rec || {
    dateCreation: todayISO(), agentId: state.agents[0]?.id || '', outletId: state.outlets[0]?.id || '',
    infoClient: '', numeroClient: '', modele: '', modeVente: 'CASH', prixTotal: '', avanceVersee: '',
    referenceFacture: '', modePaiement: '',
  };

  openModal(`
    <h2>${isEdit ? 'Modifier la vente' : 'Nouvelle vente Smartphone'}</h2>
    <form id="saleForm">
      <div class="form-grid">
        <label class="field">Date de vente
          <input type="date" name="dateCreation" value="${v.dateCreation || ''}" required>
        </label>
        <label class="field">Vendeur
          <select name="agentId"><option value="">—</option>${agentOptions}</select>
        </label>
        <label class="field">Point de vente
          <select name="outletId"><option value="">—</option>${outletOptions}</select>
        </label>
        <label class="field">Modèle du smartphone
          <input type="text" name="modele" value="${escapeHtml(v.modele)}" placeholder="Ex : Samsung A15" required>
        </label>
        <label class="field full">Nom du client
          <input type="text" name="infoClient" value="${escapeHtml(v.infoClient)}" placeholder="NOM, Prénoms" required>
        </label>
        <label class="field">N° client
          <input type="text" name="numeroClient" value="${escapeHtml(v.numeroClient)}">
        </label>
        <label class="field">Mode de vente
          <select name="modeVente" id="modeVente">
            <option value="CASH" ${v.modeVente === 'CASH' ? 'selected' : ''}>Cash</option>
            <option value="CREDIT" ${v.modeVente === 'CREDIT' ? 'selected' : ''}>Crédit</option>
          </select>
        </label>
        <label class="field">Prix total (F CFA)
          <input type="number" min="0" name="prixTotal" id="prixTotal" value="${v.prixTotal || ''}" required>
        </label>
        <label class="field">Avance versée (F CFA)
          <input type="number" min="0" name="avanceVersee" id="avanceVersee" value="${v.avanceVersee || ''}">
        </label>
        <label class="field">Reste à payer
          <input type="text" id="resteDisplay" value="0 F" disabled>
        </label>
        <label class="field">Référence facture
          <input type="text" name="referenceFacture" value="${escapeHtml(v.referenceFacture)}">
        </label>
        <label class="field">Mode de paiement (avance)
          <input type="text" name="modePaiement" value="${escapeHtml(v.modePaiement)}" placeholder="OM, Espèce, réf. mobile money...">
        </label>
      </div>
      <div class="modal-actions">
        ${isEdit ? '<button type="button" class="btn btn-danger" id="btnDelete">Supprimer</button>' : ''}
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);

    const modeSel = modalEl.querySelector('#modeVente');
    const prixInput = modalEl.querySelector('#prixTotal');
    const avanceInput = modalEl.querySelector('#avanceVersee');
    const resteDisplay = modalEl.querySelector('#resteDisplay');

    const syncFields = () => {
      const prix = Number(prixInput.value) || 0;
      if (modeSel.value === 'CASH') {
        avanceInput.value = prix;
        avanceInput.disabled = true;
      } else {
        avanceInput.disabled = false;
      }
      const avance = Math.min(Number(avanceInput.value) || 0, prix);
      resteDisplay.value = `${Math.max(0, prix - avance).toLocaleString('fr-FR')} F`;
    };
    modeSel.addEventListener('change', syncFields);
    prixInput.addEventListener('input', syncFields);
    avanceInput.addEventListener('input', syncFields);
    syncFields();

    if (isEdit) {
      modalEl.querySelector('#btnDelete').addEventListener('click', () => {
        if (confirm('Supprimer cette vente ?')) {
          actions.commit((s) => removeSmartphoneSale(s, rec.id));
          closeModal();
        }
      });
    }
    modalEl.querySelector('#saleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (isEdit) {
        actions.commit((s) => updateSmartphoneSale(s, rec.id, data));
      } else {
        actions.commit((s) => addSmartphoneSale(s, data));
      }
      closeModal();
    });
  });
}
