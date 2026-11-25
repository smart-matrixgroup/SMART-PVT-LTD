// ─────────────────────────────────────────────────────────────────
//  SMART ERP — Official Canonical Staff Roster & Normalization
//  Guarantees ONLY the 7 official staff members appear in the ERP,
//  deduplicates any spelling variants / full name variants,
//  and eliminates non-staff / test accounts.
// ─────────────────────────────────────────────────────────────────
import { OFFICIAL_STAFF_MEMBERS } from '../erp/data/officialAttendance.js';
import { sameStaffName } from './staffUtils.js';

// Canonical list of the 7 official SMART staff members with known variants
export const CANONICAL_STAFF_DEFINITIONS = [
  {
    canonicalId: 'stf-lukshika',
    staffId: 'SMART-002',
    name: 'Lukshika',
    role: 'Digital Marketing Associate II',
    department: 'Marketing',
    joinedDate: '2026-10-01',
    status: 'active',
    email: 'lukshika@smart.com',
    aliases: ['lukshika', 'luksikka', 'stf-lukshika', 'smart-002']
  },
  {
    canonicalId: 'stf-thishalini',
    staffId: 'SMART-003',
    name: 'Thishalini',
    role: 'Digital Marketing Associate I',
    department: 'Marketing',
    joinedDate: '2026-10-12',
    status: 'active',
    email: 'thishalini@smart.com',
    aliases: ['thishalini', 'stf-thishalini', 'smart-003']
  },
  {
    canonicalId: 'stf-ameen-isath',
    staffId: 'SMART-004',
    name: 'Ameen Isath',
    role: 'Digital Marketing Associate I',
    department: 'Marketing',
    joinedDate: '2026-10-26',
    status: 'active',
    email: 'ameen@smart.com',
    aliases: ['ameen isath', 'ameen', 'isath', 'stf-ameen-isath', 'smart-004']
  },
  {
    canonicalId: 'stf-a-pirashalini',
    staffId: 'SMART-005',
    name: 'A. Pirashalini',
    role: 'Software Developer Associate II',
    department: 'Engineering',
    joinedDate: '2026-11-02',
    status: 'active',
    email: 'pirashalini@smart.com',
    aliases: ['a. pirashalini', 'arinchan pirashaliny', 'pirashaliny', 'pirashalini', 'stf-a-pirashalini', 'smart-005']
  },
  {
    canonicalId: 'stf-asra',
    staffId: 'SMART-006',
    name: 'Asra',
    role: 'Software Developer Associate II',
    department: 'Engineering',
    joinedDate: '2026-09-28',
    status: 'active',
    email: 'asra@smart.com',
    aliases: ['asra', 'paththima asra', 'fathima asra', 'stf-asra', 'smart-006']
  },
  {
    canonicalId: 'stf-n-kavitharan',
    staffId: 'SMART-007',
    name: 'N. Kavitharan',
    role: 'Junior Software Developer Associate I',
    department: 'Engineering',
    joinedDate: '2026-10-26',
    status: 'active',
    email: 'kavitharan@smart.com',
    aliases: ['n. kavitharan', 'kavitharan', 'n kavitharan', 'stf-n-kavitharan', 'smart-007']
  },
  {
    canonicalId: 'stf-a-sathurshika',
    staffId: 'SMART-008',
    name: 'A. Sathurshika',
    role: 'Admin, Software Developer Associate I',
    department: 'Engineering',
    joinedDate: '2026-09-28',
    status: 'active',
    email: 'sathurshika@smart.com',
    aliases: ['a. sathurshika', 'sathurshika', 'a sathurshika', 'stf-a-sathurshika', 'smart-008']
  }
];

/**
 * Normalizes raw staff list from Firestore into the 7 official staff members only.
 * Deduplicates any spelling / name variations into one entry, and filters out non-staff test accounts.
 */
export function normalizeOfficialStaff(rawFirestoreStaff = []) {
  return CANONICAL_STAFF_DEFINITIONS.map(canon => {
    // Find all matching docs from Firestore
    const matchingDocs = (rawFirestoreStaff || []).filter(raw => {
      if (!raw || raw.deleted) return false;
      const rawName = String(raw.name || '').toLowerCase().trim();
      const rawId = String(raw.id || '').toLowerCase().trim();
      const rawStaffId = String(raw.staffId || '').toLowerCase().trim();
      const rawEmail = String(raw.email || '').toLowerCase().trim();

      return canon.aliases.some(alias =>
        rawName === alias ||
        rawName.includes(alias) ||
        alias.includes(rawName) ||
        rawId === alias ||
        rawStaffId === alias ||
        (canon.email && rawEmail === canon.email.toLowerCase())
      ) || sameStaffName(raw.name, canon.name);
    });

    const primaryDoc = matchingDocs[0] || {};
    const liveDocIds = matchingDocs.map(d => d.id).filter(Boolean);
    const liveAuthUids = matchingDocs.map(d => d.authUid || d.id).filter(Boolean);

    return {
      ...canon,
      id: primaryDoc.id || canon.canonicalId,
      canonicalId: canon.canonicalId,
      authUid: primaryDoc.authUid || canon.canonicalId,
      name: canon.name, // Always show the clean official name
      role: primaryDoc.role || primaryDoc.position || canon.role,
      department: primaryDoc.department || canon.department,
      joinedDate: primaryDoc.joinedDate || canon.joinedDate,
      liveDocIds: Array.from(new Set([canon.canonicalId, ...liveDocIds])),
      liveAuthUids: Array.from(new Set([canon.canonicalId, ...liveAuthUids])),
    };
  });
}

/**
 * Checks whether an attendance punch or work update belongs to a selected staff member.
 */
export function matchesStaffFilter(record, selectedStaffId, staffList = CANONICAL_STAFF_DEFINITIONS) {
  if (!selectedStaffId || selectedStaffId === 'All') return true;
  if (!record) return false;

  const selLower = String(selectedStaffId).toLowerCase().trim();
  const targetStaff = (staffList || []).find(s =>
    s.id === selectedStaffId ||
    s.canonicalId === selectedStaffId ||
    s.staffId === selectedStaffId ||
    (s.liveDocIds && s.liveDocIds.includes(selectedStaffId)) ||
    // Also match when the dropdown stores the canonical name as value
    s.name.toLowerCase() === selLower ||
    (s.aliases && s.aliases.some(a => a === selLower))
  );

  const rStaffId = String(record.staffId || '').toLowerCase().trim();
  const rAuthUid = String(record.authUid || '').toLowerCase().trim();
  const rName = String(record.staffName || record.name || '').toLowerCase().trim();

  if (targetStaff) {
    // 1. Direct ID match
    if (rStaffId && (
      rStaffId === targetStaff.id.toLowerCase() ||
      rStaffId === (targetStaff.canonicalId || '').toLowerCase() ||
      rStaffId === targetStaff.staffId.toLowerCase()
    )) {
      return true;
    }
    // 2. Live Firestore doc IDs match
    if (targetStaff.liveDocIds && targetStaff.liveDocIds.some(lid => lid.toLowerCase() === rStaffId || lid.toLowerCase() === rAuthUid)) {
      return true;
    }
    // 3. Name or alias match
    if (targetStaff.aliases && targetStaff.aliases.some(alias => rName === alias || rName.includes(alias) || alias.includes(rName))) {
      return true;
    }
    // 4. Fuzzy name score
    if (sameStaffName(record.staffName || record.name, targetStaff.name)) {
      return true;
    }
  }

  return rStaffId === String(selectedStaffId).toLowerCase() || rAuthUid === String(selectedStaffId).toLowerCase();
}
