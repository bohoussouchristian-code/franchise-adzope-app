// Verrou d'accès simple côté client (pas un vrai système de sécurité serveur :
// le code source reste consultable par un utilisateur déterminé). Son but est
// d'éviter qu'une personne tombant sur le lien n'accède directement aux données,
// pas de protéger des données hautement sensibles.
//
// Trois rôles de compte : admin (accès complet), vendeur (lié à un agent,
// accès restreint à ses propres données) et outlet (lié à un point de vente,
// accès restreint aux données de ce point de vente).

const AUTH_KEY = 'fa2026_auth_v3';
const SESSION_KEY = 'fa2026_session_v2';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

function loadAccounts() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.accounts)) return data.accounts;
    // Migration depuis l'ancien format { admins: [...] } (comptes admin uniquement).
    if (Array.isArray(data.admins)) {
      const accounts = data.admins.map((a) => ({ ...a, role: 'admin', linkId: null }));
      saveAccounts(accounts);
      return accounts;
    }
    return [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ accounts }));
}

function accountsByRole(role) {
  return loadAccounts().filter((a) => a.role === role);
}

export function hasAccount() {
  return loadAccounts().length > 0;
}

// ---------- Administrateurs ----------

export function listAdmins() {
  return accountsByRole('admin').map(({ id, name, identifier }) => ({ id, name, identifier }));
}

export async function createFirstAdmin(name, identifier, password) {
  const salt = randomToken();
  const hash = await sha256Hex(salt + password);
  const admin = { id: `adm_${randomToken(8)}`, role: 'admin', linkId: null, name: name.trim(), identifier: identifier.trim(), salt, hash };
  saveAccounts([admin]);
  return admin;
}

export async function addAdmin(name, identifier, password) {
  return addAccount('admin', null, name, identifier, password);
}

export async function updateAdmin(id, { name, identifier, password }) {
  return updateAccount(id, { name, identifier, password });
}

export function removeAdmin(id) {
  if (accountsByRole('admin').length <= 1) {
    throw new Error('Impossible de supprimer le dernier administrateur.');
  }
  removeAccount(id);
}

// ---------- Comptes Vendeurs (liés à un agent) ----------

export function listVendeurAccounts() {
  return accountsByRole('vendeur').map(({ id, name, identifier, linkId }) => ({ id, name, identifier, agentId: linkId }));
}

export function getVendeurAccountByAgent(agentId) {
  return listVendeurAccounts().find((a) => a.agentId === agentId) || null;
}

export async function addVendeurAccount(name, identifier, password, agentId, permissions) {
  return addAccount('vendeur', agentId, name, identifier, password, permissions);
}

export async function updateVendeurAccount(id, { name, identifier, password }) {
  return updateAccount(id, { name, identifier, password });
}

export function removeVendeurAccount(id) {
  removeAccount(id);
}

// ---------- Comptes Points de vente (liés à un outlet) ----------

export function listPointDeVenteAccounts() {
  return accountsByRole('outlet').map(({ id, name, identifier, linkId }) => ({ id, name, identifier, outletId: linkId }));
}

export function getPointDeVenteAccountByOutlet(outletId) {
  return listPointDeVenteAccounts().find((a) => a.outletId === outletId) || null;
}

export async function addPointDeVenteAccount(name, identifier, password, outletId, permissions) {
  return addAccount('outlet', outletId, name, identifier, password, permissions);
}

export async function updatePointDeVenteAccount(id, { name, identifier, password }) {
  return updateAccount(id, { name, identifier, password });
}

export function removePointDeVenteAccount(id) {
  removeAccount(id);
}

// ---------- Génériques (partagées par les 3 rôles) ----------

async function addAccount(role, linkId, name, identifier, password, permissions) {
  const accounts = loadAccounts();
  if (accounts.some((a) => normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier))) {
    throw new Error('Cet identifiant est déjà utilisé par un autre compte.');
  }
  const salt = randomToken();
  const hash = await sha256Hex(salt + password);
  const account = { id: `${role}_${randomToken(8)}`, role, linkId, name: name.trim(), identifier: identifier.trim(), salt, hash, permissions: permissions || {} };
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

// ---------- Permissions par module (comptes vendeur / point de vente) ----------

export function getAccountPermissions(id) {
  const account = loadAccounts().find((a) => a.id === id);
  return account ? { ...(account.permissions || {}) } : {};
}

export function setAccountPermissions(id, permissions) {
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return;
  account.permissions = { ...permissions };
  saveAccounts(accounts);
}

async function updateAccount(id, { name, identifier, password }) {
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return;
  if (identifier !== undefined && accounts.some((a) => a.id !== id && normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier))) {
    throw new Error('Cet identifiant est déjà utilisé par un autre compte.');
  }
  if (name !== undefined) account.name = name.trim();
  if (identifier !== undefined) account.identifier = identifier.trim();
  if (password) {
    account.salt = randomToken();
    account.hash = await sha256Hex(account.salt + password);
  }
  saveAccounts(accounts);
}

function removeAccount(id) {
  const accounts = loadAccounts();
  saveAccounts(accounts.filter((a) => a.id !== id));
  if (getSessionAccountId() === id) closeSession();
}

// ---------- Connexion / session ----------

export async function verifyCredentials(identifier, password) {
  const accounts = loadAccounts();
  const account = accounts.find((a) => normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier));
  if (!account) return null;
  const attempt = await sha256Hex(account.salt + password);
  return attempt === account.hash ? account.id : null;
}

// Compte connecté, avec son rôle et l'entité liée (agent ou point de vente).
export function getCurrentUser() {
  const id = getSessionAccountId();
  if (!id) return null;
  const account = loadAccounts().find((a) => a.id === id);
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    identifier: account.identifier,
    role: account.role,
    agentId: account.role === 'vendeur' ? account.linkId : null,
    outletId: account.role === 'outlet' ? account.linkId : null,
    permissions: account.permissions || {},
  };
}

// Conservé pour compatibilité : ne renvoie un résultat que pour un compte admin.
export function getCurrentAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin' ? { id: user.id, name: user.name, identifier: user.identifier } : null;
}

function getSessionAccountId() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || null;
}

export function isSessionActive() {
  return !!getSessionAccountId() && !!getCurrentUser();
}

export function openSession(accountId, remember) {
  if (remember) {
    localStorage.setItem(SESSION_KEY, accountId);
  } else {
    sessionStorage.setItem(SESSION_KEY, accountId);
  }
}

export function closeSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
