// Page d'accueil : lanceur de modules (au lieu d'un tableau brut façon
// tableur). Les indicateurs chiffrés vivent désormais dans « Bilan des
// activités ».

const ICONS = {
  chart: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6Zm0-9a3 3 0 1 0 3 3 3 3 0 0 0-3-3Z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M4 8a8 8 0 0 1 16 0h-2a6 6 0 0 0-12 0Zm3 0a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0Zm2 0a3 3 0 0 1 6 0h-2a1 1 0 0 0-2 0Z"/><circle cx="12" cy="17" r="2"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-2.7 0-8 1.3-8 4v3h10v-3c0-1.2.5-2.2 1.3-3.1A13.4 13.4 0 0 0 8 13Zm8 0c-.6 0-1.3 0-2 .1.9.9 1.5 2 1.5 3.4v3.5h8.5v-3c0-2.7-5.3-4-8-4Z"/></svg>',
  export: '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5Zm7-16-5.5 5.5 1.4 1.4L11 8.8V17h2V8.8l3.1 3.1 1.4-1.4Z"/></svg>',
};

const MODULES = [
  {
    code: 'BIL', title: 'Bilan des activités', icon: 'chart', tab: 'bilan',
    links: [
      { label: 'Voir le bilan', tab: 'bilan' },
    ],
  },
  {
    code: 'OBJ', title: 'Objectifs', icon: 'target', tab: 'objectifs',
    links: [
      { label: 'Saisir les objectifs du mois', tab: 'objectifs' },
    ],
  },
  {
    code: 'ABO', title: 'Abonnements 4G Home', icon: 'wifi', tab: 'abonnements',
    links: [
      { label: 'Registre complet', tab: 'abonnements' },
    ],
  },
  {
    code: 'EQP', title: 'Équipe & Points de vente', icon: 'users', tab: 'equipe',
    links: [
      { label: 'Gérer les vendeurs et points de vente', tab: 'equipe' },
    ],
  },
  {
    code: 'EXP', title: 'Export / Sauvegarde', icon: 'export', tab: 'export',
    links: [
      { label: 'Exporter, sauvegarder, importer', tab: 'export' },
    ],
  },
];

export function renderDashboard(root, state, actions) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>
    <p class="page-sub">Vos modules — ${state.agents.length} vendeur(s) · ${state.outlets.length} point(s) de vente</p>
    <div id="moduleGrid" class="module-grid"></div>
  `;
  root.appendChild(wrap);

  const grid = wrap.querySelector('#moduleGrid');
  MODULES.forEach((mod) => grid.appendChild(buildModuleCard(mod)));

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) actions.goTo(btn.dataset.goto);
  });
}

function buildModuleCard(mod) {
  const card = document.createElement('div');
  card.className = 'module-card';
  card.innerHTML = `
    <button class="module-icon" data-goto="${mod.tab}">${ICONS[mod.icon]}</button>
    <div class="module-code">${mod.code}</div>
    <div class="module-title">${mod.title}</div>
    <div class="module-sep"></div>
    <div class="module-links">
      ${mod.links.map((l) => `<button class="module-link" data-goto="${l.tab}">${l.label}</button>`).join('')}
    </div>
  `;
  return card;
}
