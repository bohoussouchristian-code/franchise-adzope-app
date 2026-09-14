import { escapeHtml, generateTempPassword, isEmail } from './utils.js';
import {
  listAdmins, addAdmin, updateAdmin, removeAdmin, getCurrentAdmin,
  listVendeurAccounts, getVendeurAccountByAgent, addVendeurAccount, updateVendeurAccount, removeVendeurAccount,
  listPointDeVenteAccounts, getPointDeVenteAccountByOutlet, addPointDeVenteAccount, updatePointDeVenteAccount, removePointDeVenteAccount,
  getAccountPermissions, setAccountPermissions,
} from './auth.js';
import { addAgent, renameAgent, removeAgent, addOutlet, renameOutlet, removeOutlet } from './store.js';
import { openModal, closeModal } from './modal.js';
import { MODULE_TREE, defaultPermissionsFor } from './permissions.js';

export function renderParametres(root, state, actions) {
  if (actions.scope.role !== 'admin') {
    root.innerHTML = `<h1 class="page-title">Paramètres</h1><div class="empty-state">Accès réservé aux administrateurs.</div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Paramètres</h1>
    <p class="page-sub">Équipe, points de vente et comptes d'accès à cette application.</p>

    <div class="section">
      <div class="page-head-row">
        <h3 class="section-title">Administrateurs</h3>
        <button class="btn btn-primary" id="btnAddAdmin">+ Ajouter un administrateur</button>
      </div>
      <div id="adminList" class="list-manage"></div>
    </div>

    <div class="section">
      <div class="page-head-row">
        <h3 class="section-title">Vendeurs</h3>
      </div>
      <div id="agentList" class="list-manage"></div>
      <div class="toolbar" style="margin-top:12px">
        <input type="text" id="newAgentName" placeholder="Nom du vendeur">
        <button class="btn btn-primary" id="btnAddAgent">Ajouter un vendeur</button>
      </div>
    </div>

    <div class="section">
      <div class="page-head-row">
        <h3 class="section-title">Points de vente</h3>
      </div>
      <div id="outletList" class="list-manage"></div>
      <div class="toolbar" style="margin-top:12px">
        <input type="text" id="newOutletName" placeholder="Nom du point de vente">
        <button class="btn btn-primary" id="btnAddOutlet">Ajouter un point de vente</button>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  renderAdmins(wrap, actions);
  renderAgents(wrap, state, actions);
  renderOutletsList(wrap, state, actions);
}

// ---------- Administrateurs ----------

function renderAdmins(wrap, actions) {
  const list = wrap.querySelector('#adminList');
  const current = getCurrentAdmin();
  const admins = listAdmins();
  list.innerHTML = '';
  admins.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'list-manage-row admin-row';
    row.innerHTML = `
      <div class="admin-row-info">
        <div class="admin-row-name">${escapeHtml(a.name)}${current && current.id === a.id ? ' <span class="pill neutral">Vous</span>' : ''}</div>
        <div class="admin-row-id muted small">${escapeHtml(a.identifier)}</div>
      </div>
      <button class="btn btn-sm" data-edit="${a.id}">Modifier</button>
      <button class="btn btn-sm" data-reset="${a.id}">Réinitialiser le mot de passe</button>
      <button class="btn btn-sm btn-danger" data-remove="${a.id}" ${isSelfOrLast(a, admins, current) ? `disabled title="${admins.length <= 1 ? 'Impossible de supprimer le dernier administrateur' : 'Vous ne pouvez pas supprimer votre propre compte pendant que vous êtes connecté'}"` : ''}>Retirer</button>
    `;
    list.appendChild(row);
  });

  wrap.querySelector('#btnAddAdmin').addEventListener('click', () => {
    openAccountForm({
      title: 'Nouvel administrateur',
      onCreate: (name, identifier, password) => addAdmin(name, identifier, password),
      onDone: () => { renderAdmins(wrap, actions); },
    });
  });

  list.addEventListener('click', (e) => {
    const editId = e.target.dataset.edit;
    const resetId = e.target.dataset.reset;
    const removeId = e.target.dataset.remove;
    if (editId) {
      const admin = admins.find((a) => a.id === editId);
      openAccountForm({
        title: 'Modifier l’administrateur',
        existing: admin,
        onUpdate: (data) => updateAdmin(admin.id, data),
        onDone: () => { renderAdmins(wrap, actions); },
      });
    } else if (resetId) {
      const admin = admins.find((a) => a.id === resetId);
      openResetPasswordConfirm({
        name: admin.name,
        identifier: admin.identifier,
        onReset: (password) => updateAdmin(admin.id, { password }),
        onDone: () => renderAdmins(wrap, actions),
      });
    } else if (removeId) {
      if (confirm('Retirer cet administrateur ? Il ne pourra plus se connecter à l’application.')) {
        try {
          removeAdmin(removeId);
          renderAdmins(wrap, actions);
        } catch (err) {
          alert(err.message);
        }
      }
    }
  });
}

function isSelfOrLast(admin, admins, current) {
  return admins.length <= 1 || (current && current.id === admin.id);
}

// ---------- Vendeurs (fiche + accès) ----------

function renderAgents(wrap, state, actions) {
  const list = wrap.querySelector('#agentList');
  list.innerHTML = '';
  state.agents.forEach((a) => {
    const account = getVendeurAccountByAgent(a.id);
    const row = document.createElement('div');
    row.className = 'list-manage-row team-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(a.name)}" data-agent-id="${a.id}">
      <div class="team-row-access">
        ${account
          ? `<span class="pill neutral">${escapeHtml(account.identifier)}</span>
             <button class="btn btn-sm" data-permissions="${account.id}" data-permissions-name="${escapeHtml(a.name)}">Permissions</button>
             <button class="btn btn-sm" data-edit-access="${account.id}">Modifier l'accès</button>
             <button class="btn btn-sm" data-reset-access="${account.id}">Réinitialiser le mot de passe</button>
             <button class="btn btn-sm btn-danger" data-remove-access="${account.id}">Retirer l'accès</button>`
          : `<button class="btn btn-sm btn-primary" data-create-access="${a.id}">+ Créer un accès</button>`}
      </div>
      <button class="btn btn-sm btn-danger" data-remove-agent="${a.id}">Retirer</button>
    `;
    list.appendChild(row);
  });
  if (!state.agents.length) list.innerHTML = '<div class="muted small">Aucun vendeur pour le moment.</div>';

  list.addEventListener('change', (e) => {
    if (e.target.dataset.agentId) {
      actions.commit((s) => renameAgent(s, e.target.dataset.agentId, e.target.value));
    }
  });

  list.addEventListener('click', (e) => {
    const removeAgentId = e.target.dataset.removeAgent;
    const createAccessId = e.target.dataset.createAccess;
    const editAccessId = e.target.dataset.editAccess;
    const resetAccessId = e.target.dataset.resetAccess;
    const removeAccessId = e.target.dataset.removeAccess;
    const permissionsId = e.target.dataset.permissions;

    if (permissionsId) {
      openPermissionsPanel(permissionsId, e.target.dataset.permissionsName);
    } else if (resetAccessId) {
      const account = listVendeurAccounts().find((a) => a.id === resetAccessId);
      openResetPasswordConfirm({
        name: account.name,
        identifier: account.identifier,
        onReset: (password) => updateVendeurAccount(account.id, { password }),
        onDone: () => renderAgents(wrap, state, actions),
      });
    } else if (removeAgentId) {
      if (confirm('Retirer ce vendeur ? Ses abonnements seront conservés mais désaffectés, et son accès sera supprimé.')) {
        const account = getVendeurAccountByAgent(removeAgentId);
        if (account) removeVendeurAccount(account.id);
        actions.commit((s) => removeAgent(s, removeAgentId));
        renderAgents(wrap, state, actions);
      }
    } else if (createAccessId) {
      const agent = state.agents.find((a) => a.id === createAccessId);
      openAccountForm({
        title: `Créer l'accès de ${agent.name}`,
        onCreate: (name, identifier, password) => addVendeurAccount(name, identifier, password, createAccessId, defaultPermissionsFor('vendeur')),
        onDone: () => renderAgents(wrap, state, actions),
      });
    } else if (editAccessId) {
      const account = listVendeurAccounts().find((a) => a.id === editAccessId);
      openAccountForm({
        title: 'Modifier l’accès du vendeur',
        existing: account,
        onUpdate: (data) => updateVendeurAccount(account.id, data),
        onDone: () => renderAgents(wrap, state, actions),
      });
    } else if (removeAccessId) {
      if (confirm('Retirer cet accès ? Cette personne ne pourra plus se connecter.')) {
        removeVendeurAccount(removeAccessId);
        renderAgents(wrap, state, actions);
      }
    }
  });

  wrap.querySelector('#btnAddAgent').addEventListener('click', () => {
    const input = wrap.querySelector('#newAgentName');
    if (input.value.trim()) {
      actions.commit((s) => addAgent(s, input.value));
      input.value = '';
      renderAgents(wrap, state, actions);
    }
  });
}

// ---------- Points de vente (fiche + accès) ----------

function renderOutletsList(wrap, state, actions) {
  const list = wrap.querySelector('#outletList');
  list.innerHTML = '';
  state.outlets.forEach((o) => {
    const account = getPointDeVenteAccountByOutlet(o.id);
    const row = document.createElement('div');
    row.className = 'list-manage-row team-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(o.name)}" data-outlet-id="${o.id}">
      <div class="team-row-access">
        ${account
          ? `<span class="pill neutral">${escapeHtml(account.identifier)}</span>
             <button class="btn btn-sm" data-permissions="${account.id}" data-permissions-name="${escapeHtml(o.name)}">Permissions</button>
             <button class="btn btn-sm" data-edit-access="${account.id}">Modifier l'accès</button>
             <button class="btn btn-sm" data-reset-access="${account.id}">Réinitialiser le mot de passe</button>
             <button class="btn btn-sm btn-danger" data-remove-access="${account.id}">Retirer l'accès</button>`
          : `<button class="btn btn-sm btn-primary" data-create-access="${o.id}">+ Créer un accès</button>`}
      </div>
      <button class="btn btn-sm btn-danger" data-remove-outlet="${o.id}">Retirer</button>
    `;
    list.appendChild(row);
  });
  if (!state.outlets.length) list.innerHTML = '<div class="muted small">Aucun point de vente pour le moment.</div>';

  list.addEventListener('change', (e) => {
    if (e.target.dataset.outletId) {
      actions.commit((s) => renameOutlet(s, e.target.dataset.outletId, e.target.value));
    }
  });

  list.addEventListener('click', (e) => {
    const removeOutletId = e.target.dataset.removeOutlet;
    const createAccessId = e.target.dataset.createAccess;
    const editAccessId = e.target.dataset.editAccess;
    const resetAccessId = e.target.dataset.resetAccess;
    const removeAccessId = e.target.dataset.removeAccess;
    const permissionsId = e.target.dataset.permissions;

    if (permissionsId) {
      openPermissionsPanel(permissionsId, e.target.dataset.permissionsName);
    } else if (resetAccessId) {
      const account = listPointDeVenteAccounts().find((a) => a.id === resetAccessId);
      openResetPasswordConfirm({
        name: account.name,
        identifier: account.identifier,
        onReset: (password) => updatePointDeVenteAccount(account.id, { password }),
        onDone: () => renderOutletsList(wrap, state, actions),
      });
    } else if (removeOutletId) {
      if (confirm('Retirer ce point de vente ? Son accès sera également supprimé.')) {
        const account = getPointDeVenteAccountByOutlet(removeOutletId);
        if (account) removePointDeVenteAccount(account.id);
        actions.commit((s) => removeOutlet(s, removeOutletId));
        renderOutletsList(wrap, state, actions);
      }
    } else if (createAccessId) {
      const outlet = state.outlets.find((o) => o.id === createAccessId);
      openAccountForm({
        title: `Créer l'accès de ${outlet.name}`,
        onCreate: (name, identifier, password) => addPointDeVenteAccount(name, identifier, password, createAccessId, defaultPermissionsFor('outlet')),
        onDone: () => renderOutletsList(wrap, state, actions),
      });
    } else if (editAccessId) {
      const account = listPointDeVenteAccounts().find((a) => a.id === editAccessId);
      openAccountForm({
        title: 'Modifier l’accès du point de vente',
        existing: account,
        onUpdate: (data) => updatePointDeVenteAccount(account.id, data),
        onDone: () => renderOutletsList(wrap, state, actions),
      });
    } else if (removeAccessId) {
      if (confirm('Retirer cet accès ? Ce point de vente ne pourra plus se connecter.')) {
        removePointDeVenteAccount(removeAccessId);
        renderOutletsList(wrap, state, actions);
      }
    }
  });

  wrap.querySelector('#btnAddOutlet').addEventListener('click', () => {
    const input = wrap.querySelector('#newOutletName');
    if (input.value.trim()) {
      actions.commit((s) => addOutlet(s, input.value));
      input.value = '';
      renderOutletsList(wrap, state, actions);
    }
  });
}

// ---------- Permissions par module (vendeur / point de vente) ----------

function openPermissionsPanel(accountId, entityName) {
  const perms = getAccountPermissions(accountId);

  const rowHtml = (item, isChild, parentKey) => `
    <label class="perm-row ${isChild ? 'perm-child' : 'perm-parent'}" data-perm-label="${escapeHtml(item.label.toLowerCase())}">
      <span class="perm-row-label">${escapeHtml(item.label)}${!isChild && item.key === 'objectifs' ? ' <span class="muted small">— à activer avant ses sous-modules</span>' : ''}</span>
      <span class="switch">
        <input type="checkbox" data-perm="${item.key}" ${parentKey ? `data-parent="${parentKey}"` : ''} ${perms[item.key] ? 'checked' : ''} ${isChild && !perms[parentKey] ? 'disabled' : ''}>
        <span class="switch-slider"></span>
      </span>
    </label>
  `;

  const listHtml = MODULE_TREE.map((group) => [
    rowHtml(group, false, null),
    ...(group.children || []).map((child) => rowHtml(child, true, group.key)),
  ].join('')).join('');

  openModal(`
    <h2>Permissions — ${escapeHtml(entityName)}</h2>
    <p class="small muted" style="margin-top:-8px">Activez les modules et sous-modules accessibles à cette personne. Un sous-module nécessite que son module soit activé.</p>
    <input type="search" id="permSearch" class="perm-search" placeholder="Rechercher le module...">
    <div id="permList" class="perm-list">${listHtml}</div>
    <div class="modal-actions">
      <button type="button" class="btn" id="btnCancel">Annuler</button>
      <button type="button" class="btn btn-primary" id="btnSavePerms">Enregistrer</button>
    </div>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    const listEl = modalEl.querySelector('#permList');

    listEl.addEventListener('change', (e) => {
      const input = e.target;
      if (input.dataset.parent) return; // sous-module : rien à cascader
      const key = input.dataset.perm;
      if (!key) return;
      // Bascule d'un module parent : active/désactive ses sous-modules avec lui.
      listEl.querySelectorAll(`input[data-parent="${key}"]`).forEach((child) => {
        child.disabled = !input.checked;
        if (!input.checked) child.checked = false;
      });
    });

    modalEl.querySelector('#permSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      listEl.querySelectorAll('.perm-row').forEach((row) => {
        row.hidden = q && !row.dataset.permLabel.includes(q);
      });
    });

    modalEl.querySelector('#btnSavePerms').addEventListener('click', () => {
      const next = {};
      listEl.querySelectorAll('input[data-perm]').forEach((input) => {
        next[input.dataset.perm] = input.checked;
      });
      setAccountPermissions(accountId, next);
      closeModal();
    });
  });
}

// ---------- Réinitialisation de mot de passe (admin / vendeur / point de vente) ----------
// Génère un nouveau mot de passe temporaire et l'envoie par e-mail (repli : affiché si l'envoi échoue).

function openResetPasswordConfirm({ name, identifier, onReset, onDone }) {
  openModal(`
    <h2>Réinitialiser le mot de passe</h2>
    <p class="small muted" style="margin-top:-8px">Un nouveau mot de passe temporaire sera généré pour ${escapeHtml(name)} et envoyé à ${escapeHtml(identifier)}.</p>
    <div id="resetStatus" class="small" hidden></div>
    <div id="resetError" class="login-error" hidden></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="btnCancel">Annuler</button>
      <button type="button" class="btn btn-primary" id="btnConfirmReset">Réinitialiser et envoyer</button>
    </div>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    const errorBox = modalEl.querySelector('#resetError');
    const statusBox = modalEl.querySelector('#resetStatus');
    const btn = modalEl.querySelector('#btnConfirmReset');
    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const showStatus = (msg) => { statusBox.textContent = msg; statusBox.hidden = false; };

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      errorBox.hidden = true;
      const password = generateTempPassword();
      try {
        await onReset(password);
        showStatus('Mot de passe réinitialisé. Envoi de l’e-mail en cours...');

        const result = await sendInviteEmail({ to: identifier, name, password, appName: 'OSB GESTION PRO' });

        if (result.ok) {
          showStatus(`Mot de passe réinitialisé et envoyé à ${identifier}.`);
        } else {
          errorBox.hidden = false;
          errorBox.innerHTML = `Mot de passe réinitialisé, mais l'envoi de l'e-mail a échoué (${escapeHtml(result.error)}).<br>Communiquez ce nouveau mot de passe vous-même : <b>${escapeHtml(password)}</b>`;
          statusBox.hidden = true;
        }
        setTimeout(() => { closeModal(); onDone(); }, result.ok ? 1200 : 6000);
      } catch (err) {
        btn.disabled = false;
        showError(err.message);
      }
    });
  });
}

// ---------- Formulaire générique de compte (admin / vendeur / point de vente) ----------
// - Création : mot de passe temporaire généré et envoyé par e-mail (repli : affiché si l'envoi échoue).
// - Modification : mots de passe laissés vides = inchangés.

function openAccountForm({ title, existing, onCreate, onUpdate, onDone }) {
  const isEdit = !!existing;

  openModal(`
    <h2>${title}</h2>
    ${!isEdit ? `<p class="small muted" style="margin-top:-8px">Un mot de passe temporaire est généré automatiquement et envoyé par e-mail à la personne.</p>` : ''}
    <form id="accForm">
      <div class="form-grid">
        <label class="field full">Nom complet
          <input type="text" name="name" value="${isEdit ? escapeHtml(existing.name) : ''}" required>
        </label>
        <label class="field full">E-mail
          <input type="email" name="identifier" value="${isEdit ? escapeHtml(existing.identifier) : ''}" placeholder="ex. christian@email.com" required>
        </label>
        ${isEdit ? `
          <label class="field">Nouveau mot de passe
            <input type="password" name="password" autocomplete="new-password" minlength="4">
          </label>
          <label class="field">Confirmer
            <input type="password" name="password2" autocomplete="new-password" minlength="4">
          </label>
          <p class="small muted full">Laissez les mots de passe vides pour ne pas le changer.</p>
        ` : ''}
      </div>
      <div id="accFormStatus" class="small" hidden></div>
      <div id="accFormError" class="login-error" hidden></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary" id="btnSubmit">${isEdit ? 'Enregistrer' : 'Créer et envoyer par e-mail'}</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    const errorBox = modalEl.querySelector('#accFormError');
    const statusBox = modalEl.querySelector('#accFormStatus');
    const submitBtn = modalEl.querySelector('#btnSubmit');
    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const showStatus = (msg) => { statusBox.textContent = msg; statusBox.hidden = false; };

    modalEl.querySelector('#accForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      statusBox.hidden = true;
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      const identifier = fd.get('identifier').trim();

      if (!isEmail(identifier)) {
        showError(isEdit ? 'Indiquez un e-mail valide.' : 'Indiquez un e-mail valide : le mot de passe lui sera envoyé à cette adresse.');
        return;
      }

      if (isEdit) {
        const password = fd.get('password');
        const password2 = fd.get('password2');
        if (password || password2) {
          if (password !== password2) { showError('Les deux mots de passe ne correspondent pas.'); return; }
          if (password.length < 4) { showError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
        }
        try {
          await onUpdate({ name, identifier, password: password || undefined });
          closeModal();
          onDone();
        } catch (err) {
          showError(err.message);
        }
        return;
      }

      try {
        const password = generateTempPassword();
        await onCreate(name, identifier, password);
        submitBtn.disabled = true;
        showStatus('Compte créé. Envoi de l’e-mail en cours...');

        const result = await sendInviteEmail({ to: identifier, name, password, appName: 'OSB GESTION PRO' });

        if (result.ok) {
          showStatus(`Compte créé et mot de passe envoyé à ${identifier}.`);
        } else {
          errorBox.hidden = false;
          errorBox.innerHTML = `Compte créé, mais l'envoi de l'e-mail a échoué (${escapeHtml(result.error)}).<br>Communiquez ce mot de passe temporaire vous-même : <b>${escapeHtml(password)}</b>`;
          statusBox.hidden = true;
        }
        setTimeout(() => { closeModal(); onDone(); }, result.ok ? 1200 : 4000);
      } catch (err) {
        showError(err.message);
      }
    });
  });
}

async function sendInviteEmail(payload) {
  try {
    const res = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Erreur serveur (${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Service indisponible (hors ligne ou en développement local)' };
  }
}
