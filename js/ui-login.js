import { hasPassword, setPassword, verifyPassword, openSession } from './auth.js';

// Affiche l'écran de connexion (ou de création du mot de passe au premier
// lancement) et appelle onSuccess() une fois l'accès autorisé.
export function renderLogin(root, onSuccess) {
  const isSetup = !hasPassword();

  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-card">
      <img src="assets/logo.jpg" alt="OmnySyncBase" class="login-logo">
      <h1 class="login-title">${isSetup ? 'Créer un mot de passe' : 'Connexion'}</h1>
      <p class="login-sub">
        ${isSetup
          ? 'Première utilisation : choisissez un mot de passe pour protéger l’accès à cette application.'
          : 'Entrez votre mot de passe pour accéder au suivi commercial.'}
      </p>
      <form id="loginForm" class="login-form">
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
    const pw1 = wrap.querySelector('#pw1').value;

    if (isSetup) {
      const pw2 = wrap.querySelector('#pw2').value;
      if (pw1.length < 4) { showError('Le mot de passe doit contenir au moins 4 caractères.'); return; }
      if (pw1 !== pw2) { showError('Les deux mots de passe ne correspondent pas.'); return; }
      await setPassword(pw1);
      openSession(true);
      onSuccess();
    } else {
      const ok = await verifyPassword(pw1);
      if (!ok) { showError('Mot de passe incorrect.'); return; }
      const remember = wrap.querySelector('#remember').checked;
      openSession(remember);
      onSuccess();
    }
  });
}
