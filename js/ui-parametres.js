import { escapeHtml } from './utils.js';
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

  wrap.querySelector('#btnAddAdmin').addEventListener('click', () => openAdminForm(actions, null));

  list.addEventListener('click', (e) => {
    const editId = e.target.dataset.edit;
    const removeId = e.target.dataset.remove;
    if (editId) {
      const admin = admins.find((a) => a.id === editId);
      openAdminForm(actions, admin);
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

function openAdminForm(actions, existing) {
  const isEdit = !!existing;

  openModal(`
    <h2>${isEdit ? 'Modifier l’administrateur' : 'Nouvel administrateur'}</h2>
    <form id="adminForm">
      <div class="form-grid">
        <label class="field full">Nom complet
          <input type="text" name="name" value="${isEdit ? escapeHtml(existing.name) : ''}" required>
        </label>
        <label class="field full">E-mail ou téléphone
          <input type="text" name="identifier" value="${isEdit ? escapeHtml(existing.identifier) : ''}" placeholder="ex. christian@email.com ou 07 00 00 00 00" required>
        </label>
        <label class="field">${isEdit ? 'Nouveau mot de passe' : 'Mot de passe'}
          <input type="password" name="password" autocomplete="new-password" ${isEdit ? '' : 'required'} minlength="4">
        </label>
        <label class="field">Confirmer
          <input type="password" name="password2" autocomplete="new-password" ${isEdit ? '' : 'required'} minlength="4">
        </label>
        ${isEdit ? '<p class="small muted full">Laissez les mots de passe vides pour ne pas le changer.</p>' : ''}
      </div>
      <div id="adminFormError" class="login-error" hidden></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
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
        if (isEdit) {
          await updateAdmin(existing.id, { name, identifier, password: password || undefined });
        } else {
          await addAdmin(name, identifier, password);
        }
        closeModal();
        actions.rerender();
      } catch (err) {
        showError(err.message);
      }
    });
  });
}
