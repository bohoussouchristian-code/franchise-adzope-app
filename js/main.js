import { loadState, saveState } from './store.js';
import { renderDashboard } from './ui-dashboard.js';
import { renderBilan } from './ui-bilan.js';
import { renderObjectifsSuivi, renderObjectifsHistorique } from './ui-objectifs.js';
import { renderEvaluations, renderOutlets } from './ui-notation.js';
import { renderNouvelAbonnement, renderHistoriqueAbonnements } from './ui-abonnements.js';
import { renderNouvelleFibre, renderHistoriqueFibre } from './ui-fibre.js';
import { renderNouvelleVenteSmartphone, renderHistoriqueVentesSmartphones } from './ui-smartphones.js';
import { renderExport } from './ui-export.js';
import { renderParametres } from './ui-parametres.js';
import { renderLogin } from './ui-login.js';
import { isSessionActive, closeSession, getCurrentUser } from './auth.js';
import { tabAllowedForScope } from './permissions.js';

const loginRoot = document.getElementById('loginRoot');
const appRoot = document.getElementById('appRoot');
const view = document.getElementById('view');
const brandTitle = document.getElementById('brandTitle');
const tabsEl = document.getElementById('tabs');
const logoutBtn = document.getElementById('btnLogout');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const sidebarEl = document.querySelector('.sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const menuToggle = document.getElementById('btnMenuToggle');

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // déconnexion automatique après 30 min d'inactivité
let inactivityTimer = null;

let state = loadState();
let currentTab = 'dashboard';

const pages = {
  dashboard: renderDashboard,
  bilan: renderBilan,
  'objectifs-suivi': renderObjectifsSuivi,
  'objectifs-historique': renderObjectifsHistorique,
  'objectifs-evaluation': renderEvaluations,
  'objectifs-outlets': renderOutlets,
  'abonnements-nouveau': renderNouvelAbonnement,
  'abonnements-historique': renderHistoriqueAbonnements,
  'fibre-nouveau': renderNouvelleFibre,
  'fibre-historique': renderHistoriqueFibre,
  'smartphones-nouveau': renderNouvelleVenteSmartphone,
  'smartphones-historique': renderHistoriqueVentesSmartphones,
  export: renderExport,
  parametres: renderParametres,
};

const ROLE_LABELS = { admin: 'Administrateur', vendeur: 'Vendeur', outlet: 'Point de vente' };

function closeDrawer() {
  sidebarEl.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}

function toggleDrawer() {
  sidebarEl.classList.toggle('open');
  sidebarBackdrop.classList.toggle('open');
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

function resetInactivityTimer() {
  if (!isSessionActive()) return;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    closeSession();
    closeDrawer();
    showLogin();
  }, INACTIVITY_LIMIT_MS);
}

['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach((evt) => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

function showLogin() {
  stopInactivityTimer();
  appRoot.hidden = true;
  loginRoot.hidden = false;
  loginRoot.innerHTML = '';
  renderLogin(loginRoot, startApp);
}

function startApp() {
  loginRoot.hidden = true;
  loginRoot.innerHTML = '';
  appRoot.hidden = false;
  resetInactivityTimer();
  rerender();
}

function commit(mutator) {
  mutator(state);
  saveState(state);
  rerender();
}

function currentScope() {
  const user = getCurrentUser();
  if (!user) return { role: 'admin', agentId: null, outletId: null, permissions: {} };
  return { role: user.role, agentId: user.agentId, outletId: user.outletId, permissions: user.permissions };
}

function applyRoleVisibility(scope) {
  [...tabsEl.querySelectorAll('.tab[data-tab]')].forEach((el) => {
    el.hidden = !tabAllowedForScope(el.dataset.tab, scope);
  });
  [...tabsEl.querySelectorAll('.side-group')].forEach((g) => {
    const hasVisibleChild = !!g.querySelector('.side-sublink:not([hidden])');
    g.hidden = !hasVisibleChild;
  });
}

function rerender() {
  brandTitle.textContent = (state.meta.franchiseName || 'FRANCHISE').toUpperCase();
  const user = getCurrentUser();
  const scope = currentScope();
  if (user) {
    userAvatar.textContent = user.name.trim().charAt(0).toUpperCase();
    userName.textContent = user.name;
    userRole.textContent = ROLE_LABELS[user.role] || user.role;
  }
  applyRoleVisibility(scope);
  if (!tabAllowedForScope(currentTab, scope)) {
    currentTab = 'dashboard';
  }
  view.innerHTML = '';
  pages[currentTab](view, state, { commit, rerender, goTo, scope });
}

function goTo(tab) {
  if (!tabAllowedForScope(tab, currentScope())) return;
  currentTab = tab;
  [...tabsEl.querySelectorAll('.tab')].forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  [...tabsEl.querySelectorAll('.side-group')].forEach((g) => {
    const hasActive = !!g.querySelector(`.tab[data-tab="${tab}"]`);
    g.classList.toggle('has-active', hasActive);
    if (hasActive) g.classList.add('open');
  });
  closeDrawer();
  rerender();
}

logoutBtn.addEventListener('click', () => {
  closeSession();
  showLogin();
});

menuToggle.addEventListener('click', toggleDrawer);
sidebarBackdrop.addEventListener('click', closeDrawer);

tabsEl.addEventListener('click', (e) => {
  const groupToggle = e.target.closest('.side-group-toggle');
  if (groupToggle) {
    groupToggle.closest('.side-group').classList.toggle('open');
    return;
  }
  const btn = e.target.closest('.tab');
  if (!btn) return;
  goTo(btn.dataset.tab);
});

if (isSessionActive()) {
  startApp();
} else {
  showLogin();
}
