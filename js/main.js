import { loadState, saveState } from './store.js';
import { renderDashboard } from './ui-dashboard.js';
import { renderBilan } from './ui-bilan.js';
import { renderObjectifsSuivi, renderObjectifsHistorique } from './ui-objectifs.js';
import { renderEvaluations, renderOutlets } from './ui-notation.js';
import { renderNouvelAbonnement, renderHistoriqueAbonnements } from './ui-abonnements.js';
import { renderNouvelleFibre, renderHistoriqueFibre } from './ui-fibre.js';
import { renderNouvelleVenteSmartphone, renderHistoriqueVentesSmartphones } from './ui-smartphones.js';
import { renderEquipeVendeurs, renderEquipePointsDeVente } from './ui-equipe.js';
import { renderExport } from './ui-export.js';
import { renderParametres } from './ui-parametres.js';
import { renderLogin } from './ui-login.js';
import { isSessionActive, closeSession, getCurrentAdmin } from './auth.js';

const loginRoot = document.getElementById('loginRoot');
const appRoot = document.getElementById('appRoot');
const view = document.getElementById('view');
const brandTitle = document.getElementById('brandTitle');
const tabsEl = document.getElementById('tabs');
const logoutBtn = document.getElementById('btnLogout');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');

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
  'equipe-vendeurs': renderEquipeVendeurs,
  'equipe-points': renderEquipePointsDeVente,
  export: renderExport,
  parametres: renderParametres,
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
  rerender();
}

function commit(mutator) {
  mutator(state);
  saveState(state);
  rerender();
}

function rerender() {
  brandTitle.textContent = (state.meta.franchiseName || 'FRANCHISE').toUpperCase();
  const admin = getCurrentAdmin();
  if (admin) {
    userAvatar.textContent = admin.name.trim().charAt(0).toUpperCase();
    userName.textContent = admin.name;
    userRole.textContent = admin.identifier;
  }
  view.innerHTML = '';
  pages[currentTab](view, state, { commit, rerender, goTo });
}

function goTo(tab) {
  currentTab = tab;
  [...tabsEl.querySelectorAll('.tab')].forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  [...tabsEl.querySelectorAll('.side-group')].forEach((g) => {
    const hasActive = !!g.querySelector(`.tab[data-tab="${tab}"]`);
    g.classList.toggle('has-active', hasActive);
    if (hasActive) g.classList.add('open');
  });
  rerender();
}

logoutBtn.addEventListener('click', () => {
  closeSession();
  showLogin();
});

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
