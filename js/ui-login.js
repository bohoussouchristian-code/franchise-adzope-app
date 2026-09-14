import { hasAccount, createFirstAdmin, verifyCredentials, openSession } from './auth.js';

// Affiche l'écran de connexion (ou de création du premier compte admin au
// premier lancement) et appelle onSuccess() une fois l'accès autorisé.
export function renderLogin(root, onSuccess) {
  const isSetup = !hasAccount();

  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-card">
      <img src="assets/logo.jpg" alt="OmnySyncBase" class="login-logo">
      <h1 class="login-title">${isSetup ? 'Créer votre accès administrateur' : 'Connexion'}</h1>
      <p class="login-sub">
        ${isSetup
          ? 'Première utilisation : créez le premier compte administrateur pour protéger l’accès à cette application. D’autres administrateurs pourront être ajoutés ensuite depuis Paramètres.'
          : 'Entrez votre e-mail (ou téléphone) et votre mot de passe pour accéder au suivi commercial.'}
      </p>
      <form id="loginForm" class="login-form">
        ${isSetup ? `
          <label class="field">Nom complet
            <input type="text" id="name" autocomplete="name" placeholder="ex. Christian Bohoussou" required>
          </label>
        ` : ''}
        <label class="field">E-mail ou téléphone
          <input type="text" id="identifier" autocomplete="username" placeholder="ex. christian@email.com ou 07 00 00 00 00" required>
        </label>
        <label class="field">Mot de passe
          <input type="password" id="pw1" autocomplete="${isSetup ? 'new-password' : 'current-password'}" required>
        </label>
        ${isSetup ? `
          <label class="field">Confirmer le mot de passe
            <input type="password" id="pw2" autocomplete="new-password" required>
          </label>
        ` : ''}
        ${isSetup ? '' : `
          <label class="login-remember">
            <input type="checkbox" id="remember" checked>
            Rester connecté sur cet appareil
          </label>
        `}
        <div id="loginError" class="login-error" hidden></div>
        <button type="submit" class="btn btn-primary login-submit">${isSetup ? 'Créer et se connecter' : 'Se connecter'}</button>
      </form>
    </div>
  `;
  root.appendChild(wrap);

  const errorBox = wrap.querySelector('#loginError');
  const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };

  wrap.querySelector('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const identifier = wrap.querySelector('#identifier').value.trim();
    const pw1 = wrap.querySelector('#pw1').value;

    if (isSetup) {
      const name = wrap.querySelector('#name').value.trim();
      const pw2 = wrap.querySelector('#pw2').value;
      if (name.length < 2) { showError('Indiquez votre nom.'); return; }
      if (identifier.length < 3) { showError('Indiquez un e-mail ou un numéro de téléphone valide.'); return; }
      if (pw1.length < 4) { showError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
      if (pw1 !== pw2) { showError('Les deux mots de passe ne correspondent pas.'); return; }
      const admin = await createFirstAdmin(name, identifier, pw1);
      openSession(admin.id, true);
      onSuccess();
    } else {
      const adminId = await verifyCredentials(identifier, pw1);
      if (!adminId) { showError('Identifiant ou mot de passe incorrect.'); return; }
      const remember = wrap.querySelector('#remember').checked;
      openSession(adminId, remember);
      onSuccess();
    }
  });
}
