import { loadState, saveState } from './store.js';
import { renderDashboard } from './ui-dashboard.js';
import { renderObjectifs } from './ui-objectifs.js';
import { renderAbonnements } from './ui-abonnements.js';
import { renderEquipe } from './ui-equipe.js';
import { renderExport } from './ui-export.js';
import { renderLogin } from './ui-login.js';
import { isSessionActive, closeSession } from './auth.js';

const loginRoot = document.getElementById('loginRoot');
const appRoot = document.getElementById('appRoot');
const view = document.getElementById('view');
const brandTitle = document.getElementById('brandTitle');
const tabsEl = document.getElementById('tabs');
const logoutBtn = document.getElementById('btnLogout');

let state = loadState();
let currentTab = 'dashboard';

if (isSessionActive()) {
  startApp();
} else {
  showLogin();
}

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
  rerender();
}

logoutBtn.addEventListener('click', () => {
  closeSession();
  showLogin();
});

const pages = {
  dashboard: renderDashboard,
  objectifs: renderObjectifs,
  abonnements: renderAbonnements,
  equipe: renderEquipe,
  export: renderExport,
};

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

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  goTo(btn.dataset.tab);
});
