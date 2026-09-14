// Verrou d'accès simple côté client (pas un vrai système de sécurité serveur :
// le code source reste consultable par un utilisateur déterminé). Son but est
// d'éviter qu'une personne tombant sur le lien n'accède directement aux données,
// pas de protéger des données hautement sensibles.

const AUTH_KEY = 'fa2026_auth_v1';
const SESSION_KEY = 'fa2026_session_v1';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPassword() {
  return !!localStorage.getItem(AUTH_KEY);
}

export async function setPassword(password) {
  const salt = randomSalt();
  const hash = await sha256Hex(salt + password);
  localStorage.setItem(AUTH_KEY, JSON.stringify({ salt, hash }));
}

export async function verifyPassword(password) {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return false;
  const { salt, hash } = JSON.parse(raw);
  const attempt = await sha256Hex(salt + password);
  return attempt === hash;
}

export function isSessionActive() {
  return sessionStorage.getItem(SESSION_KEY) === '1' || localStorage.getItem(SESSION_KEY) === '1';
}

export function openSession(remember) {
  if (remember) {
    localStorage.setItem(SESSION_KEY, '1');
  } else {
    sessionStorage.setItem(SESSION_KEY, '1');
  }
}

export function closeSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
