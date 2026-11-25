import fs from 'fs';
import path from 'path';

function toMs(date, timeStr) {
  if (!date || !timeStr || timeStr === '—') return 0;
  const m = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return new Date(`${date}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`).getTime();
}

function mins(inMs, outMs) {
  return inMs && outMs && outMs > inMs ? Math.round((outMs - inMs) / 60000) : 0;
}

// 7 Staff
const STAFF_LIST = [
  { id: 'stf-lukshika', staffId: 'SMART-002', name: 'Lukshika', role: 'Digital Marketing Associate II', department: 'Marketing', joinedDate: '2026-10-01', status: 'active', email: 'lukshika@smart.com' },
  { id: 'stf-thishalini', staffId: 'SMART-003', name: 'Thishalini', role: 'Digital Marketing Associate I', department: 'Marketing', joinedDate: '2026-10-12', status: 'active', email: 'thishalini@smart.com' },
  { id: 'stf-ameen-isath', staffId: 'SMART-004', name: 'Ameen Isath', role: 'Digital Marketing Associate I', department: 'Marketing', joinedDate: '2026-10-26', status: 'active', email: 'ameen@smart.com' },
  { id: 'stf-a-pirashalini', staffId: 'SMART-005', name: 'A. Pirashalini', role: 'Software Developer Associate II', department: 'Engineering', joinedDate: '2026-11-02', status: 'active', email: 'pirashalini@smart.com' },
  { id: 'stf-asra', staffId: 'SMART-006', name: 'Asra', role: 'Software Developer Associate II', department: 'Engineering', joinedDate: '2026-09-28', status: 'active', email: 'asra@smart.com' },
  { id: 'stf-n-kavitharan', staffId: 'SMART-007', name: 'N. Kavitharan', role: 'Junior Software Developer Associate I', department: 'Engineering', joinedDate: '2026-10-26', status: 'active', email: 'kavitharan@smart.com' },
  { id: 'stf-a-sathurshika', staffId: 'SMART-008', name: 'A. Sathurshika', role: 'Admin, Software Developer Associate I', department: 'Engineering', joinedDate: '2026-09-28', status: 'active', email: 'sathurshika@smart.com' },
];

const allRecords = [];

// Helper to push record
function addRec(staffId, staffName, date, inTime, outTime, status, workMode) {
  const inMs = toMs(date, inTime);
  const outMs = toMs(date, outTime);
  const m = mins(inMs, outMs);
  allRecords.push({
    id: `att-${staffId}-${date}`,
    staffId,
    staffName,
    authUid: staffId,
    date,
    checkInMs: inMs,
    checkOutMs: outMs,
    minutes: m,
    status,
    workMode: workMode || 'Onsite',
    autoClosed: false,
    source: 'official-attendance-sheet',
  });
}

// 1. Lukshika (2026-10-01 to 2026-11-23)
const s1 = 'stf-lukshika', n1 = 'Lukshika';
const lukshikaData = [
  ['2026-10-01', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-02', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-03', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-04', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-05', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-06', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-07', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-08', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-10', '—', '—', 'Leave', 'Leave'],
  ['2026-10-11', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-15', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-17', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-18', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-19', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-20', '08:30 AM', '04:00 PM', 'Leave', 'Leave'],
  ['2026-10-21', '08:30 AM', '04:00 PM', 'Leave', 'Leave'],
  ['2026-10-22', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-23', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-24', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-25', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-26', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-27', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-28', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-06', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '—', '—', 'Leave', 'Leave'],
  ['2026-11-10', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '11:00 AM', '04:00 PM', 'Half Day', 'Halfday'],
  ['2026-11-12', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
];
lukshikaData.forEach(([d, inT, outT, st, wm]) => addRec(s1, n1, d, inT, outT, st, wm));

// 2. Thishalini (2026-10-12 to 2026-11-23)
const s2 = 'stf-thishalini', n2 = 'Thishalini';
const thishaliniData = [
  ['2026-10-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-15', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-17', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-18', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-19', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-20', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-21', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-22', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-23', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-24', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-25', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-26', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-27', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-28', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-06', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '11:00 AM', '04:00 PM', 'Half Day', 'Onsite'],
  ['2026-11-12', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '11:30 AM', '04:00 PM', 'Half Day', 'Onsite'],
];
thishaliniData.forEach(([d, inT, outT, st, wm]) => addRec(s2, n2, d, inT, outT, st, wm));

// 3. Ameen Isath (2026-10-26 to 2026-11-23)
const s3 = 'stf-ameen-isath', n3 = 'Ameen Isath';
const ameenData = [
  ['2026-10-26', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-27', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-28', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-06', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-11', '11:00 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
];
ameenData.forEach(([d, inT, outT, st, wm]) => addRec(s3, n3, d, inT, outT, st, wm));

// 4. A. Pirashalini (2026-11-02 to 2026-11-23)
const s4 = 'stf-a-pirashalini', n4 = 'A. Pirashalini';
const pirashaliniData = [
  ['2026-11-02', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '12:00 PM', 'Half Day', 'Half Day'],
  ['2026-11-06', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '11:00 AM', '05:00 PM', 'Half Day', 'Half Day'],
  ['2026-11-12', '08:00 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
];
pirashaliniData.forEach(([d, inT, outT, st, wm]) => addRec(s4, n4, d, inT, outT, st, wm));

// 5. Asra (2026-09-28 to 2026-11-23)
const s5 = 'stf-asra', n5 = 'Asra';
const asraData = [
  ['2026-09-28', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-09-29', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-09-30', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-01', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-02', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-03', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-04', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-05', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-06', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-07', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-08', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-09', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-10', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-11', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-12', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-13', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-14', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-15', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-16', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-17', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-18', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-19', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-20', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-21', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-22', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-23', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-24', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-10-25', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-26', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-27', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-28', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-06', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-12', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '04:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '04:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '—', '—', 'Leave', 'Leave'],
];
asraData.forEach(([d, inT, outT, st, wm]) => addRec(s5, n5, d, inT, outT, st, wm));

// 6. N. Kavitharan (2026-10-26 to 2026-11-23)
const s6 = 'stf-n-kavitharan', n6 = 'N. Kavitharan';
const kavitharanData = [
  ['2026-10-26', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-27', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-28', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-04', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-06', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
];
kavitharanData.forEach(([d, inT, outT, st, wm]) => addRec(s6, n6, d, inT, outT, st, wm));

// 7. A. Sathurshika (2026-09-28 to 2026-11-23)
const s7 = 'stf-a-sathurshika', n7 = 'A. Sathurshika';
const sathuData = [
  ['2026-09-28', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-09-29', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-09-30', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-01', '08:30 AM', '05:30 PM', 'Present', 'Onsite'],
  ['2026-10-02', '09:00 AM', '05:30 PM', 'Present', 'Onsite'],
  ['2026-10-03', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-04', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-05', '09:15 AM', '05:45 PM', 'Present', 'Onsite'],
  ['2026-10-06', '09:00 AM', '05:30 PM', 'Present', 'Onsite'],
  ['2026-10-07', '09:00 AM', '05:30 PM', 'Present', 'Onsite'],
  ['2026-10-08', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-10', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-11', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-15', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-17', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-18', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-19', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-20', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-21', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-22', '—', '—', 'Leave', 'Leave'],
  ['2026-10-23', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-24', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-10-25', '—', '—', 'Holiday', 'Sunday'],
  ['2026-10-26', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-27', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-28', '08:30 AM', '06:00 PM', 'Present', 'Onsite'],
  ['2026-10-29', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-30', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-10-31', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-01', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-02', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-03', '—', '—', 'Leave', 'Leave'],
  ['2026-11-04', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-05', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-06', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-07', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-08', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-09', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-10', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-11', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-12', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-13', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-14', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-15', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-16', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-17', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-18', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-19', '08:30 AM', '05:00 PM', 'Present', 'Remote'],
  ['2026-11-20', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
  ['2026-11-21', '—', '—', 'Holiday', 'Holiday'],
  ['2026-11-22', '—', '—', 'Holiday', 'Sunday'],
  ['2026-11-23', '08:30 AM', '05:00 PM', 'Present', 'Onsite'],
];
sathuData.forEach(([d, inT, outT, st, wm]) => addRec(s7, n7, d, inT, outT, st, wm));

console.log(`Generated ${allRecords.length} records for ${STAFF_LIST.length} staff!`);

const fileContent = `// ─────────────────────────────────────────────────────────────────
//  Official SMART Pvt Ltd Staff Attendance Data (Extracted from 7-Page PDF)
//  Covers all 7 staff members across September, October, and November 2026.
// ─────────────────────────────────────────────────────────────────

export const OFFICIAL_STAFF_MEMBERS = ${JSON.stringify(STAFF_LIST, null, 2)};

export const OFFICIAL_ATTENDANCE_RECORDS = ${JSON.stringify(allRecords, null, 2)};
`;

fs.mkdirSync('src/erp/data', { recursive: true });
fs.writeFileSync('src/erp/data/officialAttendance.js', fileContent);
console.log('Saved src/erp/data/officialAttendance.js successfully!');
