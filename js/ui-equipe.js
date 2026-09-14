import { escapeHtml } from './utils.js';
import { addAgent, renameAgent, removeAgent, addOutlet, renameOutlet, removeOutlet } from './store.js';

export function renderEquipeVendeurs(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Vendeurs</h1>
    <p class="page-sub">Gérez la liste des vendeurs utilisés dans les objectifs, la notation et le registre d'abonnements.</p>

    <div class="list-manage" id="agentList"></div>
    <div class="toolbar" style="margin-top:12px">
      <input type="text" id="newAgentName" placeholder="Nom du vendeur">
      <button class="btn btn-primary" id="btnAddAgent">Ajouter un vendeur</button>
    </div>
  `;
  root.appendChild(wrap);

  const agentList = wrap.querySelector('#agentList');
  state.agents.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'list-manage-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(a.name)}" data-agent-id="${a.id}">
      <button class="btn btn-sm btn-danger" data-remove-agent="${a.id}">Retirer</button>
    `;
    agentList.appendChild(row);
  });
  if (!state.agents.length) agentList.innerHTML = '<div class="muted small">Aucun vendeur pour le moment.</div>';

  wrap.addEventListener('change', (e) => {
    if (e.target.dataset.agentId) {
      actions.commit((s) => renameAgent(s, e.target.dataset.agentId, e.target.value));
    }
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.dataset.removeAgent) {
      if (confirm('Retirer ce vendeur ? Ses abonnements seront conservés mais désaffectés.')) {
        actions.commit((s) => removeAgent(s, e.target.dataset.removeAgent));
      }
    } else if (e.target.id === 'btnAddAgent') {
      const input = wrap.querySelector('#newAgentName');
      if (input.value.trim()) {
        actions.commit((s) => addAgent(s, input.value));
      }
    }
  });
}

export function renderEquipePointsDeVente(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Points de vente</h1>
    <p class="page-sub">Gérez la liste des points de vente utilisés dans le registre d'abonnements et la notation.</p>

    <div class="list-manage" id="outletList"></div>
    <div class="toolbar" style="margin-top:12px">
      <input type="text" id="newOutletName" placeholder="Nom du point de vente">
      <button class="btn btn-primary" id="btnAddOutlet">Ajouter un point de vente</button>
    </div>
  `;
  root.appendChild(wrap);

  const outletList = wrap.querySelector('#outletList');
  state.outlets.forEach((o) => {
    const row = document.createElement('div');
    row.className = 'list-manage-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(o.name)}" data-outlet-id="${o.id}">
      <button class="btn btn-sm btn-danger" data-remove-outlet="${o.id}">Retirer</button>
    `;
    outletList.appendChild(row);
  });
  if (!state.outlets.length) outletList.innerHTML = '<div class="muted small">Aucun point de vente pour le moment.</div>';

  wrap.addEventListener('change', (e) => {
    if (e.target.dataset.outletId) {
      actions.commit((s) => renameOutlet(s, e.target.dataset.outletId, e.target.value));
    }
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.dataset.removeOutlet) {
      if (confirm('Retirer ce point de vente ?')) {
        actions.commit((s) => removeOutlet(s, e.target.dataset.removeOutlet));
      }
    } else if (e.target.id === 'btnAddOutlet') {
      const input = wrap.querySelector('#newOutletName');
      if (input.value.trim()) {
        actions.commit((s) => addOutlet(s, input.value));
      }
    }
  });
}
