import { hasAccount, setCredentials, verifyCredentials, openSession } from './auth.js';

// Affiche l'écran de connexion (ou de création du compte au premier
// lancement) et appelle onSuccess() une fois l'accès autorisé.
export function renderLogin(root, onSuccess) {
  const isSetup = !hasAccount();

  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-card">
      <img src="assets/logo.jpg" alt="OmnySyncBase" class="login-logo">
      <h1 class="login-title">${isSetup ? 'Créer votre accès' : 'Connexion'}</h1>
      <p class="login-sub">
        ${isSetup
          ? 'Première utilisation : choisissez un identifiant (e-mail ou téléphone) et un mot de passe pour protéger l’accès à cette application.'
          : 'Entrez votre e-mail (ou téléphone) et votre mot de passe pour accéder au suivi commercial.'}
      </p>
      <form id="loginForm" class="login-form">
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
      const pw2 = wrap.querySelector('#pw2').value;
      if (identifier.length < 3) { showError('Indiquez un e-mail ou un numéro de téléphone valide.'); return; }
      if (pw1.length < 4) { showError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
      if (pw1 !== pw2) { showError('Les deux mots de passe ne correspondent pas.'); return; }
      await setCredentials(identifier, pw1);
      openSession(true);
      onSuccess();
    } else {
      const ok = await verifyCredentials(identifier, pw1);
      if (!ok) { showError('Identifiant ou mot de passe incorrect.'); return; }
      const remember = wrap.querySelector('#remember').checked;
      openSession(remember);
      onSuccess();
    }
  });
}
