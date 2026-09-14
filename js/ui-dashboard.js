// Page d'accueil : lanceur de modules (au lieu d'un tableau brut façon
// tableur). Les indicateurs chiffrés vivent désormais dans « Bilan des
// activités ».

import { tabAllowedForScope } from './permissions.js';

const ICONS = {
  chart: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6Zm0-9a3 3 0 1 0 3 3 3 3 0 0 0-3-3Z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M4 8a8 8 0 0 1 16 0h-2a6 6 0 0 0-12 0Zm3 0a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0Zm2 0a3 3 0 0 1 6 0h-2a1 1 0 0 0-2 0Z"/><circle cx="12" cy="17" r="2"/></svg>',
  fibre: '<svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5Zm0 7.5L4 5.7v9.6l8 4 8-4V5.7Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 3v13h10V5Zm5 14.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>',
  export: '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5Zm7-16-5.5 5.5 1.4 1.4L11 8.8V17h2V8.8l3.1 3.1 1.4-1.4Z"/></svg>',
};

const MODULES = [
  {
    code: 'OBJ', title: 'Objectifs', icon: 'target', tab: 'objectifs-suivi',
    links: [
      { label: 'Suivi du mois', tab: 'objectifs-suivi' },
      { label: 'Historique des objectifs', tab: 'objectifs-historique' },
      { label: 'Évaluation des vendeurs', tab: 'objectifs-evaluation' },
    ],
  },
  {
    code: 'FRQ', title: 'Fréquentation & Client mystère', icon: 'target', tab: 'objectifs-outlets',
    links: [
      { label: 'Voir la saisie', tab: 'objectifs-outlets' },
    ],
  },
  {
    code: 'ABO', title: 'Abonnements 4G Home', icon: 'wifi', tab: 'abonnements-nouveau',
    links: [
      { label: 'Nouvel abonnement', tab: 'abonnements-nouveau' },
      { label: 'Historique des abonnements', tab: 'abonnements-historique' },
    ],
  },
  {
    code: 'FIB', title: 'Fibre', icon: 'fibre', tab: 'fibre-nouveau',
    links: [
      { label: 'Nouvel abonnement', tab: 'fibre-nouveau' },
      { label: 'Historique des abonnements', tab: 'fibre-historique' },
    ],
  },
  {
    code: 'SMP', title: 'Smartphones', icon: 'phone', tab: 'smartphones-nouveau',
    links: [
      { label: 'Nouvelle vente', tab: 'smartphones-nouveau' },
      { label: 'Historique des ventes', tab: 'smartphones-historique' },
    ],
  },
  {
    code: 'EXP', title: 'Export / Sauvegarde', icon: 'export', tab: 'export',
    links: [
      { label: 'Exporter, sauvegarder, importer', tab: 'export' },
    ],
  },
  {
    code: 'BIL', title: 'Bilan des activités', icon: 'chart', tab: 'bilan',
    links: [
      { label: 'Voir le bilan', tab: 'bilan' },
    ],
  },
];

export function renderDashboard(root, state, actions) {
  const scope = actions.scope;
  const modules = MODULES
    .map((mod) => ({ ...mod, links: mod.links.filter((l) => tabAllowedForScope(l.tab, scope)) }))
    .filter((mod) => mod.links.length);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>
    <p class="page-sub">Vos modules — ${state.agents.length} vendeur(s) · ${state.outlets.length} point(s) de vente</p>
    <div id="moduleGrid" class="module-grid"></div>
  `;
  root.appendChild(wrap);

  const grid = wrap.querySelector('#moduleGrid');
  modules.forEach((mod) => grid.appendChild(buildModuleCard(mod)));

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) actions.goTo(btn.dataset.goto);
  });
}

function buildModuleCard(mod) {
  const card = document.createElement('div');
  card.className = 'module-card';
  const iconTarget = mod.links.some((l) => l.tab === mod.tab) ? mod.tab : mod.links[0].tab;
  card.innerHTML = `
    <button class="module-icon" data-goto="${iconTarget}">${ICONS[mod.icon]}</button>
    <div class="module-code">${mod.code}</div>
    <div class="module-title">${mod.title}</div>
    <div class="module-sep"></div>
    <div class="module-links">
      ${mod.links.map((l) => `<button class="module-link" data-goto="${l.tab}">${l.label}</button>`).join('')}
    </div>
  `;
  return card;
}
