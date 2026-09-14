// Verrou d'accès simple côté client (pas un vrai système de sécurité serveur :
// le code source reste consultable par un utilisateur déterminé). Son but est
// d'éviter qu'une personne tombant sur le lien n'accède directement aux données,
// pas de protéger des données hautement sensibles.

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

function loadAdmins() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.admins) ? data.admins : [];
  } catch {
    return [];
  }
}

function saveAdmins(admins) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ admins }));
}

export function hasAccount() {
  return loadAdmins().length > 0;
}

export function listAdmins() {
  return loadAdmins().map(({ id, name, identifier }) => ({ id, name, identifier }));
}

export async function createFirstAdmin(name, identifier, password) {
  const salt = randomToken();
  const hash = await sha256Hex(salt + password);
  const admin = { id: `adm_${randomToken(8)}`, name: name.trim(), identifier: identifier.trim(), salt, hash };
  saveAdmins([admin]);
  return admin;
}

export async function addAdmin(name, identifier, password) {
  const admins = loadAdmins();
  if (admins.some((a) => normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier))) {
    throw new Error('Cet identifiant est déjà utilisé par un autre administrateur.');
  }
  const salt = randomToken();
  const hash = await sha256Hex(salt + password);
  const admin = { id: `adm_${randomToken(8)}`, name: name.trim(), identifier: identifier.trim(), salt, hash };
  admins.push(admin);
  saveAdmins(admins);
  return admin;
}

export async function updateAdmin(id, { name, identifier, password }) {
  const admins = loadAdmins();
  const admin = admins.find((a) => a.id === id);
  if (!admin) return;
  if (identifier !== undefined && admins.some((a) => a.id !== id && normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier))) {
    throw new Error('Cet identifiant est déjà utilisé par un autre administrateur.');
  }
  if (name !== undefined) admin.name = name.trim();
  if (identifier !== undefined) admin.identifier = identifier.trim();
  if (password) {
    admin.salt = randomToken();
    admin.hash = await sha256Hex(admin.salt + password);
  }
  saveAdmins(admins);
}

export function removeAdmin(id) {
  const admins = loadAdmins();
  if (admins.length <= 1) {
    throw new Error('Impossible de supprimer le dernier administrateur.');
  }
  saveAdmins(admins.filter((a) => a.id !== id));
  if (getSessionAdminId() === id) closeSession();
}

export async function verifyCredentials(identifier, password) {
  const admins = loadAdmins();
  const admin = admins.find((a) => normalizeIdentifier(a.identifier) === normalizeIdentifier(identifier));
  if (!admin) return null;
  const attempt = await sha256Hex(admin.salt + password);
  return attempt === admin.hash ? admin.id : null;
}

export function getCurrentAdmin() {
  const id = getSessionAdminId();
  if (!id) return null;
  const admin = loadAdmins().find((a) => a.id === id);
  return admin ? { id: admin.id, name: admin.name, identifier: admin.identifier } : null;
}

function getSessionAdminId() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || null;
}

export function isSessionActive() {
  return !!getSessionAdminId() && !!getCurrentAdmin();
}

export function openSession(adminId, remember) {
  if (remember) {
    localStorage.setItem(SESSION_KEY, adminId);
  } else {
    sessionStorage.setItem(SESSION_KEY, adminId);
  }
}

export function closeSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
