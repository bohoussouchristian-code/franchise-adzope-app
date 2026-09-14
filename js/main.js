import { loadState, saveState } from './store.js';
import { renderDashboard } from './ui-dashboard.js';
import { renderBilan } from './ui-bilan.js';
import { renderObjectifs } from './ui-objectifs.js';
import { renderAbonnements } from './ui-abonnements.js';
import { renderEquipe } from './ui-equipe.js';
import { renderExport } from './ui-export.js';
import { renderLogin } from './ui-login.js';
import { isSessionActive, closeSession, getIdentifier } from './auth.js';

const loginRoot = document.getElementById('loginRoot');
const appRoot = document.getElementById('appRoot');
const view = document.getElementById('view');
const brandTitle = document.getElementById('brandTitle');
const tabsEl = document.getElementById('tabs');
const logoutBtn = document.getElementById('btnLogout');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

let state = loadState();
let currentTab = 'dashboard';

const pages = {
  dashboard: renderDashboard,
  bilan: renderBilan,
  objectifs: renderObjectifs,
  abonnements: renderAbonnements,
  equipe: renderEquipe,
  export: renderExport,
};

function showLogin() {
  appRoot.hidden = true;
  loginRoot.hidden = false;
  loginRoot.innerHTML = '';
  renderLogin(loginRoot, startApp);
}

function startApp() {
  loginRoot.hidden = true;
  loginRoot.innerHTML = '';
  appRoot.hidden = false;
  const identifier = getIdentifier() || 'Administrateur';
  userAvatar.textContent = identifier.trim().charAt(0).toUpperCase();
  userName.textContent = identifier;
  rerender();
}

function commit(mutator) {
  mutator(state);
  saveState(state);
  rerender();
}

function rerender() {
  brandTitle.textContent = (state.meta.franchiseName || 'FRANCHISE').toUpperCase();
  view.innerHTML = '';
  pages[currentTab](view, state, { commit, rerender, goTo });
}

function goTo(tab) {
  currentTab = tab;
  [...tabsEl.querySelectorAll('.tab')].forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  rerender();
}

logoutBtn.addEventListener('click', () => {
  closeSession();
  showLogin();
});

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  goTo(btn.dataset.tab);
});

if (isSessionActive()) {
  startApp();
} else {
  showLogin();
}
