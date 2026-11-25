// ─────────────────────────────────────────────────────────────────
//  SMART ERP — Boss & Manager Connection API (Executive Portal)
//  Allows Boss & Manager monitoring webpage to securely query:
//  - Staff Profiles
//  - Staff Attendance (live punches, selfies, break tracking, status)
//  - Staff Salary (months worked vs months paid summary, payslips)
//  - Daily Work Updates (morning briefing, voice notes, routine tasks)
//  - Assigned Work & Projects
//  - Executive 1-Click Approvals (Leave, Daily Reports, Project Stages)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_API_KEY = 'smart_live_sec_7a9f82d14b8e3c6a501e4d92bf7301c8';

// Fallback official staff list for development / offline sync
const OFFICIAL_STAFF_FALLBACK = [
  { id: 'stf-asra', staffId: 'SMART-006', name: 'Asra', role: 'Software Developer Associate II', department: 'Engineering', joinedDate: '2026-09-28', status: 'active', email: 'asra@smart.com' },
  { id: 'stf-a-sathurshika', staffId: 'SMART-008', name: 'A. Sathurshika', role: 'Admin, Software Developer Associate I', department: 'Engineering', joinedDate: '2026-09-28', status: 'active', email: 'sathurshika@smart.com' },
  { id: 'stf-lukshika', staffId: 'SMART-002', name: 'Lukshika', role: 'Digital Marketing Associate II', department: 'Marketing', joinedDate: '2026-10-01', status: 'active', email: 'lukshika@smart.com' },
  { id: 'stf-thishalini', staffId: 'SMART-003', name: 'Thishalini', role: 'Digital Marketing Associate I', department: 'Marketing', joinedDate: '2026-10-12', status: 'active', email: 'thishalini@smart.com' },
  { id: 'stf-ameen-isath', staffId: 'SMART-004', name: 'Ameen Isath', role: 'Digital Marketing Associate I', department: 'Marketing', joinedDate: '2026-10-26', status: 'active', email: 'ameen@smart.com' },
  { id: 'stf-n-kavitharan', staffId: 'SMART-007', name: 'N. Kavitharan', role: 'Junior Software Developer Associate I', department: 'Engineering', joinedDate: '2026-10-26', status: 'active', email: 'kavitharan@smart.com' },
  { id: 'stf-a-pirashalini', staffId: 'SMART-005', name: 'A. Pirashalini', role: 'Software Developer Associate II', department: 'Engineering', joinedDate: '2026-11-02', status: 'active', email: 'pirashalini@smart.com' }
];

function getMonthsBetween(startMonth, endMonth) {
  if (!startMonth) return [endMonth];
  const [sY, sM] = String(startMonth).slice(0, 7).split('-').map(Number);
  const [eY, eM] = String(endMonth).slice(0, 7).split('-').map(Number);
  if (!sY || !sM || !eY || !eM) return [endMonth];
  const list = [];
  let y = sY;
  let m = sM;
  while (y < eY || (y === eY && m <= eM)) {
    list.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return list.length ? list : [endMonth];
}

async function verifyApiKey(req, db) {
  const incomingKey = req.headers['x-api-key'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '')) ||
    req.query.api_key ||
    req.query.apiKey;

  if (!incomingKey) return false;
  if (incomingKey === DEFAULT_API_KEY) return true;

  try {
    const configSnap = await db.collection('settings').doc('apiConfig').get();
    if (configSnap.exists && configSnap.data()?.key === incomingKey) return true;

    const keySnap = await db.collection('apiKeys').doc('boss_manager_key').get();
    if (keySnap.exists && keySnap.data()?.key === incomingKey) return true;
  } catch (err) {
    // If DB check fails, default key is still valid
  }

  return false;
}

function sendCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
}

async function handleBossManagerApi(req, res, db) {
  sendCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Health check does not strictly require auth
  const urlPath = (req.path || '').replace(/^\/api\/v1/, '').replace(/\/$/, '') || '/health';

  if (urlPath === '/health' && req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'SMART-ERP-Boss-Manager-API',
      version: '1.0.0',
      time: new Date().toISOString(),
      status: 'online'
    });
  }

  // Auth verification
  const isAuthed = await verifyApiKey(req, db);
  if (!isAuthed) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Invalid or missing API key. Provide x-api-key header or ?api_key= query parameter.',
      tip: 'Get your Connection API Key from SMART ERP -> Settings -> Boss & Manager API Key.'
    });
  }

  try {
    // 1. Staff Profiles
    if (urlPath === '/staff' && req.method === 'GET') {
      const snap = await db.collection('staff').get();
      let staffList = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted);
      if (staffList.length === 0) {
        staffList = OFFICIAL_STAFF_FALLBACK;
      }
      return res.status(200).json({
        ok: true,
        count: staffList.length,
        data: staffList
      });
    }

    // 2. Attendance Records
    if (urlPath === '/attendance' && req.method === 'GET') {
      const { date, staffId, from, to } = req.query;
      let queryRef = db.collection('attendance');

      if (date && date !== 'today') {
        queryRef = queryRef.where('date', '==', date);
      } else if (date === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        queryRef = queryRef.where('date', '==', todayStr);
      }

      const snap = await queryRef.get();
      let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (from) records = records.filter(r => String(r.date) >= from);
      if (to) records = records.filter(r => String(r.date) <= to);
      if (staffId) records = records.filter(r => r.staffId === staffId || r.authUid === staffId);

      records.sort((a, b) => String(b.date).localeCompare(String(a.date)));

      return res.status(200).json({
        ok: true,
        count: records.length,
        data: records
      });
    }

    // 3. Mark / Update Attendance Punch
    if ((urlPath === '/attendance' || urlPath === '/attendance/punch') && req.method === 'POST') {
      const { staffId, staffName, date, checkInMs, checkOutMs, status, note, checkInPhoto, checkOutPhoto } = req.body || {};
      if (!staffId && !staffName) {
        return res.status(400).json({ ok: false, error: 'staffId or staffName is required' });
      }

      const attDate = date || new Date().toISOString().slice(0, 10);
      const docId = `att_${attDate}_${staffId || staffName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const payload = {
        staffId: staffId || '',
        staffName: staffName || '',
        date: attDate,
        checkInMs: checkInMs ? Number(checkInMs) : null,
        checkOutMs: checkOutMs ? Number(checkOutMs) : null,
        status: status || 'Present',
        note: note || '',
        updatedAt: new Date().toISOString(),
      };
      if (checkInPhoto) payload.checkInPhoto = checkInPhoto;
      if (checkOutPhoto) payload.checkOutPhoto = checkOutPhoto;

      await db.collection('attendance').doc(docId).set(payload, { merge: true });

      return res.status(200).json({
        ok: true,
        message: 'Attendance record saved successfully',
        id: docId,
        data: payload
      });
    }

    // 4. Salary Payments
    if (urlPath === '/salary' && req.method === 'GET') {
      const { month, staffId } = req.query;
      let queryRef = db.collection('salaryPayments');
      if (month) queryRef = queryRef.where('month', '==', month);

      const snap = await queryRef.get();
      let payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (staffId) payments = payments.filter(p => p.staffId === staffId || p.authUid === staffId);
      payments.sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')));

      return res.status(200).json({
        ok: true,
        count: payments.length,
        data: payments
      });
    }

    // 5. Salary Summary: Months Worked vs Months Paid per staff
    if (urlPath === '/salary-summary' && req.method === 'GET') {
      const staffSnap = await db.collection('staff').get();
      let staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted);
      if (staffList.length === 0) staffList = OFFICIAL_STAFF_FALLBACK;

      const paymentsSnap = await db.collection('salaryPayments').get();
      const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const currentMonth = req.query.currentMonth || new Date().toISOString().slice(0, 7);

      const summaries = staffList.map(member => {
        const joinDate = member.joinedDate || member.joinDate || '2026-10-01';
        const startMonth = joinDate.slice(0, 7);
        const workedMonths = getMonthsBetween(startMonth, currentMonth);

        const memberPayments = allPayments.filter(p =>
          p.staffId === member.id ||
          (p.staffName && member.name && p.staffName.trim().toLowerCase() === member.name.trim().toLowerCase())
        );

        const paidMonthsSet = new Set(memberPayments.map(p => p.month).filter(Boolean));
        const paidMonths = workedMonths.filter(m => paidMonthsSet.has(m));
        const pendingMonths = workedMonths.filter(m => !paidMonthsSet.has(m));
        const totalPaid = memberPayments.reduce((acc, p) => acc + (Number(p.net) || 0), 0);

        return {
          staffId: member.id,
          staffName: member.name,
          role: member.role || member.position || 'Staff',
          department: member.department || 'General',
          joinedDate: joinDate,
          monthsWorkedCount: workedMonths.length,
          workedMonths,
          monthsPaidCount: paidMonths.length,
          paidMonths,
          monthsPendingCount: pendingMonths.length,
          pendingMonths,
          totalPaid,
          status: pendingMonths.length === 0 ? 'Up to date' : `${pendingMonths.length} month(s) pending`,
        };
      });

      return res.status(200).json({
        ok: true,
        currentMonth,
        count: summaries.length,
        data: summaries
      });
    }

    // 6. Daily Work Updates (includes morning briefing & voice notes)
    if (urlPath === '/daily-updates' && req.method === 'GET') {
      const { date, staffId, from, to } = req.query;
      let queryRef = db.collection('dailyUpdates');
      if (date) queryRef = queryRef.where('date', '==', date);

      const snap = await queryRef.get();
      let reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (from) reports = reports.filter(r => String(r.date) >= from);
      if (to) reports = reports.filter(r => String(r.date) <= to);
      if (staffId) reports = reports.filter(r => r.staffId === staffId || r.authUid === staffId || r.name === staffId);

      reports.sort((a, b) => String(b.date).localeCompare(String(a.date)));

      return res.status(200).json({
        ok: true,
        count: reports.length,
        data: reports
      });
    }

    // 7. Assigned Work / Projects
    if ((urlPath === '/assigned-work' || urlPath === '/projects') && req.method === 'GET') {
      const snap = await db.collection('projects').get();
      const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return res.status(200).json({
        ok: true,
        count: projects.length,
        data: projects
      });
    }

    // 8. Leaves
    if (urlPath === '/leaves' && req.method === 'GET') {
      const snap = await db.collection('leaves').get();
      const leaves = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({
        ok: true,
        count: leaves.length,
        data: leaves
      });
    }

    // 9. Executive Approvals by Boss & Manager
    if (urlPath === '/approvals' && req.method === 'POST') {
      const { type, id, action = 'approve', approvedBy = 'Boss / Manager', notes = '' } = req.body || {};
      if (!type || !id) {
        return res.status(400).json({ ok: false, error: 'Approval type and document id are required.' });
      }

      const isApprove = action.toLowerCase() === 'approve';
      const timestamp = new Date().toISOString();

      if (type === 'leave') {
        const leaveRef = db.collection('leaves').doc(id);
        const leaveSnap = await leaveRef.get();
        if (!leaveSnap.exists) {
          return res.status(404).json({ ok: false, error: `Leave doc ${id} not found.` });
        }
        const hist = leaveSnap.data()?.history || [];
        await leaveRef.update({
          status: isApprove ? 'Approved' : 'Rejected',
          history: [...hist, { by: approvedBy, action: isApprove ? 'Approved' : 'Rejected', at: timestamp, notes }],
          updatedAt: timestamp,
        });
        return res.status(200).json({ ok: true, message: `Leave ${action}d successfully.`, id });
      }

      if (type === 'dailyUpdate') {
        const updateRef = db.collection('dailyUpdates').doc(id);
        await updateRef.update({
          approvalStatus: isApprove ? 'Approved' : 'Needs Review',
          approvedBy,
          approvedAt: timestamp,
          approvalNotes: notes,
          updatedAt: timestamp,
        });
        return res.status(200).json({ ok: true, message: `Daily update ${action}d successfully.`, id });
      }

      if (type === 'stage' || type === 'project') {
        const projRef = db.collection('projects').doc(id);
        await projRef.update({
          status: isApprove ? 'Approved' : 'Under Review',
          executiveApproval: { by: approvedBy, at: timestamp, notes, action },
          updatedAt: timestamp,
        });
        return res.status(200).json({ ok: true, message: `Project/Stage ${action}d successfully.`, id });
      }

      return res.status(400).json({ ok: false, error: `Unknown approval type: ${type}` });
    }

    // 404 for unknown endpoints
    return res.status(404).json({
      ok: false,
      error: `Endpoint '${urlPath}' not found on Boss & Manager API.`,
      availableEndpoints: [
        'GET /api/v1/health',
        'GET /api/v1/staff',
        'GET /api/v1/attendance',
        'POST /api/v1/attendance/punch',
        'GET /api/v1/salary',
        'GET /api/v1/salary-summary',
        'GET /api/v1/daily-updates',
        'GET /api/v1/assigned-work',
        'GET /api/v1/leaves',
        'POST /api/v1/approvals'
      ]
    });
  } catch (err) {
    console.error('Boss & Manager API error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Internal server error in Boss & Manager API.'
    });
  }
}

module.exports = {
  handleBossManagerApi,
  verifyApiKey,
  DEFAULT_API_KEY,
};
