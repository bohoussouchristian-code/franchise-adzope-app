// Analyse générique d'une feuille Excel de suivi d'abonnements 4G Home
// (structure du modèle "TEMPLATE ABO 4G HOME"), tolérante aux variations
// de mise en page d'un mois à l'autre.

function normalize(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

const FIELD_PATTERNS = [
  { field: 'dateCreation', patterns: [/date de creat/] },
  { field: 'loginSaisie', patterns: [/login de saisie/] },
  { field: 'loginPaiement', patterns: [/login paiement/] },
  { field: 'dateDepotAvantages', patterns: [/date.*depot.*avantage/] },
  { field: 'numeroClient', patterns: [/n.?cli/] },
  { field: 'numeroFixe', patterns: [/numero fixe/] },
  { field: 'infoClient', patterns: [/info client/] },
  { field: 'referenceFacture', patterns: [/reference facture/] },
  { field: 'coutFactureInitiale', patterns: [/cout.*facture/] },
  { field: 'modePaiement', patterns: [/mode.*paiement/, /mp om/] },
  { field: 'outletText', patterns: [/vente.*realis/, /point de vente/] },
];

const TDD_PATTERN = /tdd|flybox/;
const FDD_PATTERN = /fdd|easybox/;

export function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || [];
    if (row.some((c) => normalize(c) === 'ordre') || row.some((c) => /date de creat/.test(normalize(c)))) {
      return i;
    }
  }
  return -1;
}

export function buildColumnMap(rows, headerRowIndex) {
  const headerRow = rows[headerRowIndex] || [];
  const subHeaderRow = rows[headerRowIndex + 1] || [];
  const map = {};
  let tddCol = -1;
  let fddCol = -1;

  headerRow.forEach((cell, col) => {
    const n = normalize(cell);
    if (!n) return;
    for (const { field, patterns } of FIELD_PATTERNS) {
      if (patterns.some((re) => re.test(n))) map[field] = col;
    }
    if (/type.*abonnement/.test(n)) {
      // Les sous-colonnes TDD/FDD sont sur la ligne suivante.
      if (TDD_PATTERN.test(normalize(subHeaderRow[col]))) tddCol = col;
      if (FDD_PATTERN.test(normalize(subHeaderRow[col]))) fddCol = col;
      if (TDD_PATTERN.test(normalize(subHeaderRow[col + 1]))) tddCol = col + 1;
      if (FDD_PATTERN.test(normalize(subHeaderRow[col + 1]))) fddCol = col + 1;
    }
  });

  // repli : chercher directement TDD/FDD sur la ligne d'en-tête ou celle d'après,
  // n'importe où dans les 12 premières colonnes.
  if (tddCol === -1 || fddCol === -1) {
    for (let col = 0; col < 15; col++) {
      const h = normalize(headerRow[col]);
      const sh = normalize(subHeaderRow[col]);
      if (tddCol === -1 && (TDD_PATTERN.test(h) || TDD_PATTERN.test(sh))) tddCol = col;
      if (fddCol === -1 && (FDD_PATTERN.test(h) || FDD_PATTERN.test(sh))) fddCol = col;
    }
  }

  map.tddCol = tddCol;
  map.fddCol = fddCol;
  return map;
}

function cellToISODate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const utcDays = Math.floor(value - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseSubscriptionRows(rows, headerRowIndex, colMap) {
  const results = [];
  const dataStart = headerRowIndex + (colMap.tddCol >= 0 && rows[headerRowIndex + 1] && rows[headerRowIndex + 1][colMap.tddCol] !== undefined ? 2 : 1);

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === undefined || c === '')) continue;
    const firstCells = row.slice(0, 3).map((c) => normalize(c)).join(' ');
    if (firstCells.includes('total')) break;

    const infoClient = colMap.infoClient !== undefined ? row[colMap.infoClient] : undefined;
    const dateCreation = colMap.dateCreation !== undefined ? cellToISODate(row[colMap.dateCreation]) : null;
    if (!infoClient && !dateCreation) continue;

    const tddVal = colMap.tddCol >= 0 ? row[colMap.tddCol] : undefined;
    const fddVal = colMap.fddCol >= 0 ? row[colMap.fddCol] : undefined;
    const type = (fddVal !== undefined && fddVal !== '' && fddVal !== 0) ? 'FDD' : 'TDD';

    results.push({
      dateCreation,
      loginSaisie: colMap.loginSaisie !== undefined ? String(row[colMap.loginSaisie] ?? '').trim() : '',
      loginPaiement: colMap.loginPaiement !== undefined ? String(row[colMap.loginPaiement] ?? '').trim() : '',
      dateDepotAvantages: colMap.dateDepotAvantages !== undefined ? cellToISODate(row[colMap.dateDepotAvantages]) : dateCreation,
      type,
      numeroClient: colMap.numeroClient !== undefined ? String(row[colMap.numeroClient] ?? '').trim() : '',
      numeroFixe: colMap.numeroFixe !== undefined ? String(row[colMap.numeroFixe] ?? '').trim() : '',
      infoClient: String(infoClient ?? '').trim(),
      referenceFacture: colMap.referenceFacture !== undefined ? String(row[colMap.referenceFacture] ?? '').trim() : '',
      coutFactureInitiale: colMap.coutFactureInitiale !== undefined ? Number(row[colMap.coutFactureInitiale]) || 0 : 0,
      modePaiement: colMap.modePaiement !== undefined ? String(row[colMap.modePaiement] ?? '').trim() : '',
      outletText: colMap.outletText !== undefined ? String(row[colMap.outletText] ?? '').trim() : '',
    });
  }
  return results;
}
