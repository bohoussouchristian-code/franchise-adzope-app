// Arborescence des modules pouvant être activés/désactivés individuellement
// pour un compte Vendeur ou Point de vente (réglée par l'administrateur
// depuis Paramètres → Permissions). Un compte Administrateur a toujours
// accès à tout et n'est jamais concerné par cette grille.
//
// Un sous-module ne devient effectif que si son module parent est lui-même
// activé (cascade), comme dans le panneau de permissions.

export const MODULE_TREE = [
  {
    key: 'objectifs', label: 'Objectifs',
    children: [
      { key: 'objectifs-suivi', label: 'Suivi du mois' },
      { key: 'objectifs-historique', label: 'Historique des objectifs' },
      { key: 'objectifs-evaluation', label: 'Évaluation des vendeurs' },
    ],
  },
  {
    key: 'objectifs-outlets', label: 'Fréquentation & Client mystère',
    children: [],
  },
  {
    key: 'abonnements', label: 'Abonnements 4G Home',
    children: [
      { key: 'abonnements-nouveau', label: 'Nouvel abonnement' },
      { key: 'abonnements-historique', label: 'Historique des abonnements' },
    ],
  },
  {
    key: 'fibre', label: 'Fibre',
    children: [
      { key: 'fibre-nouveau', label: 'Nouvel abonnement' },
      { key: 'fibre-historique', label: 'Historique des abonnements' },
    ],
  },
  {
    key: 'smartphones', label: 'Smartphones',
    children: [
      { key: 'smartphones-nouveau', label: 'Nouvelle vente' },
      { key: 'smartphones-historique', label: 'Historique des ventes' },
    ],
  },
];

// Onglets toujours réservés à l'administrateur, quelle que soit la grille
// de permissions (jamais proposés dans le panneau de permissions).
export const ADMIN_ONLY_TABS = ['bilan', 'export', 'parametres'];

// tab -> clé du module parent (ou lui-même s'il n'a pas de parent).
export const PARENT_OF = (() => {
  const map = {};
  MODULE_TREE.forEach((group) => {
    map[group.key] = group.key;
    (group.children || []).forEach((child) => { map[child.key] = group.key; });
  });
  return map;
})();

function allKeys() {
  const keys = [];
  MODULE_TREE.forEach((group) => {
    keys.push(group.key);
    (group.children || []).forEach((child) => keys.push(child.key));
  });
  return keys;
}

function permsFrom(enabledKeys) {
  const perms = {};
  allKeys().forEach((k) => { perms[k] = enabledKeys.includes(k); });
  return perms;
}

// Permissions par défaut proposées à la création d'un nouveau compte,
// cohérentes avec le rôle (le vendeur suit ses ventes, le point de vente
// suit sa fréquentation) — l'administrateur peut ensuite tout ajuster.
export function defaultPermissionsFor(role) {
  if (role === 'vendeur') {
    return permsFrom([
      'objectifs', 'objectifs-suivi', 'objectifs-historique', 'objectifs-evaluation',
      'abonnements', 'abonnements-nouveau', 'abonnements-historique',
      'fibre', 'fibre-nouveau', 'fibre-historique',
      'smartphones', 'smartphones-nouveau', 'smartphones-historique',
    ]);
  }
  if (role === 'outlet') {
    return permsFrom([
      'objectifs-outlets',
      'abonnements', 'abonnements-nouveau', 'abonnements-historique',
      'fibre', 'fibre-nouveau', 'fibre-historique',
      'smartphones', 'smartphones-nouveau', 'smartphones-historique',
    ]);
  }
  return {};
}

// Un onglet est autorisé si : l'utilisateur est admin, ou l'onglet est
// public (dashboard), ou sa permission (et celle de son parent) est activée.
export function tabAllowedForScope(tab, scope) {
  if (!scope) return false;
  if (scope.role === 'admin') return true;
  if (ADMIN_ONLY_TABS.includes(tab)) return false;
  if (tab === 'dashboard') return true;
  const perms = scope.permissions || {};
  const parent = PARENT_OF[tab] || tab;
  return !!perms[tab] && (parent === tab || !!perms[parent]);
}
