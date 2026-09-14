import { escapeHtml, generateTempPassword, isEmail } from './utils.js';
import { listAdmins, addAdmin, updateAdmin, removeAdmin, getCurrentAdmin } from './auth.js';
import { openModal, closeModal } from './modal.js';

export function renderParametres(root, state, actions) {
  const wrap = document.createElement('div');
  const current = getCurrentAdmin();

  wrap.innerHTML = `
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Paramètres</h1>
        <p class="page-sub">Comptes administrateurs ayant accès à cette application.</p>
      </div>
      <button class="btn btn-primary" id="btnAddAdmin">+ Ajouter un administrateur</button>
    </div>
    <div id="adminList" class="list-manage"></div>
  `;
  root.appendChild(wrap);

  const list = wrap.querySelector('#adminList');
  const admins = listAdmins();
  admins.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'list-manage-row admin-row';
    row.innerHTML = `
      <div class="admin-row-info">
        <div class="admin-row-name">${escapeHtml(a.name)}${current && current.id === a.id ? ' <span class="pill neutral">Vous</span>' : ''}</div>
        <div class="admin-row-id muted small">${escapeHtml(a.identifier)}</div>
      </div>
      <button class="btn btn-sm" data-edit="${a.id}">Modifier</button>
      <button class="btn btn-sm btn-danger" data-remove="${a.id}" ${isSelfOrLast(a, admins, current) ? `disabled title="${admins.length <= 1 ? 'Impossible de supprimer le dernier administrateur' : 'Vous ne pouvez pas supprimer votre propre compte pendant que vous êtes connecté'}"` : ''}>Retirer</button>
    `;
    list.appendChild(row);
  });

  wrap.querySelector('#btnAddAdmin').addEventListener('click', () => openAddAdminForm(state, actions));

  list.addEventListener('click', (e) => {
    const editId = e.target.dataset.edit;
    const removeId = e.target.dataset.remove;
    if (editId) {
      const admin = admins.find((a) => a.id === editId);
      openEditAdminForm(actions, admin);
    } else if (removeId) {
      if (confirm('Retirer cet administrateur ? Il ne pourra plus se connecter à l’application.')) {
        try {
          removeAdmin(removeId);
          actions.rerender();
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

// ---------- Ajouter un administrateur : mot de passe généré et envoyé par e-mail ----------

function openAddAdminForm(state, actions) {
  openModal(`
    <h2>Nouvel administrateur</h2>
    <p class="small muted" style="margin-top:-8px">Un mot de passe temporaire est généré automatiquement et envoyé par e-mail à la personne.</p>
    <form id="adminForm">
      <div class="form-grid">
        <label class="field full">Nom complet
          <input type="text" name="name" required>
        </label>
        <label class="field full">E-mail
          <input type="email" name="identifier" placeholder="ex. christian@email.com" required>
        </label>
      </div>
      <div id="adminFormStatus" class="small" hidden></div>
      <div id="adminFormError" class="login-error" hidden></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary" id="btnSubmit">Créer et envoyer par e-mail</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    const errorBox = modalEl.querySelector('#adminFormError');
    const statusBox = modalEl.querySelector('#adminFormStatus');
    const submitBtn = modalEl.querySelector('#btnSubmit');
    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const showStatus = (msg) => { statusBox.textContent = msg; statusBox.hidden = false; };

    modalEl.querySelector('#adminForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      statusBox.hidden = true;
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      const identifier = fd.get('identifier').trim();

      if (!isEmail(identifier)) {
        showError('Indiquez un e-mail valide : le mot de passe lui sera envoyé à cette adresse.');
        return;
      }

      let admin;
      try {
        const password = generateTempPassword();
        admin = await addAdmin(name, identifier, password);
        submitBtn.disabled = true;
        showStatus('Compte créé. Envoi de l’e-mail en cours...');

        const result = await sendInviteEmail({
          to: identifier,
          name,
          password,
          appName: state.meta.franchiseName,
        });

        if (result.ok) {
          showStatus(`Compte créé et mot de passe envoyé à ${identifier}.`);
        } else {
          errorBox.hidden = false;
          errorBox.innerHTML = `Compte créé, mais l'envoi de l'e-mail a échoué (${escapeHtml(result.error)}).<br>Communiquez ce mot de passe temporaire vous-même : <b>${escapeHtml(password)}</b>`;
          statusBox.hidden = true;
        }
        setTimeout(() => { closeModal(); actions.rerender(); }, result.ok ? 1200 : 4000);
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

// ---------- Modifier un administrateur existant ----------

function openEditAdminForm(actions, existing) {
  openModal(`
    <h2>Modifier l’administrateur</h2>
    <form id="adminForm">
      <div class="form-grid">
        <label class="field full">Nom complet
          <input type="text" name="name" value="${escapeHtml(existing.name)}" required>
        </label>
        <label class="field full">E-mail ou téléphone
          <input type="text" name="identifier" value="${escapeHtml(existing.identifier)}" required>
        </label>
        <label class="field">Nouveau mot de passe
          <input type="password" name="password" autocomplete="new-password" minlength="4">
        </label>
        <label class="field">Confirmer
          <input type="password" name="password2" autocomplete="new-password" minlength="4">
        </label>
        <p class="small muted full">Laissez les mots de passe vides pour ne pas le changer.</p>
      </div>
      <div id="adminFormError" class="login-error" hidden></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);
    const errorBox = modalEl.querySelector('#adminFormError');
    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };

    modalEl.querySelector('#adminForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      const identifier = fd.get('identifier').trim();
      const password = fd.get('password');
      const password2 = fd.get('password2');

      if (password || password2) {
        if (password !== password2) { showError('Les deux mots de passe ne correspondent pas.'); return; }
        if (password.length < 4) { showError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
      }

      try {
        await updateAdmin(existing.id, { name, identifier, password: password || undefined });
        closeModal();
        actions.rerender();
      } catch (err) {
        showError(err.message);
      }
    });
  });
}
