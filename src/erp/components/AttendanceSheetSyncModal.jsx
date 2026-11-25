import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet, Copy, Download, Check, Upload, AlertCircle,
  Calendar, Users, Clock, Sparkles, RefreshCw, Code, ArrowRight
} from 'lucide-react';
import { ERPModal, ERPBtn, ERPInput, ERPSelect, C } from './ERPui';
import {
  todayKey, thisMonthKey, monthLabel, fmtTime, fmtHours, minutesBetween,
  attendanceStatus, sheetDate, findStaffBySheetName, addDaysIso, getDayName, downloadCsv, sameStaffName
} from '../../staff/staffUtils';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { OFFICIAL_ATTENDANCE_RECORDS } from '../data/officialAttendance';

const SHEET_HEADERS = ['Date', 'Day', 'Staff Name', 'Staff ID', 'Check In', 'Check Out', 'Hours', 'Status', 'Movements', 'Selfie Verified'];

export default function AttendanceSheetSyncModal({
  isOpen,
  onClose,
  records = [],
  staff = [],
  live = false,
  onRecordsUpdated,
}) {
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import' | 'bulk'

  // ── Tab 1: Export / Push to Google Sheet State ──
  const [exportMonth, setExportMonth] = useState(() => thisMonthKey());
  const [exportStaff, setExportStaff] = useState('All');
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

  // Filter records for export
  const exportRecords = useMemo(() => {
    return records
      .filter(r => (exportMonth === 'all' ? true : String(r.date || '').startsWith(exportMonth)))
      .filter(r => (exportStaff === 'All' ? true : r.staffId === exportStaff))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.staffName || '').localeCompare(String(b.staffName || '')));
  }, [records, exportMonth, exportStaff]);

  // Build Tab-Separated string for Ctrl+V paste into Google Sheet
  const buildTsvForSheet = () => {
    const rows = exportRecords.map(r => {
      const staffDoc = staff.find(s => s.id === r.staffId);
      const staffCode = staffDoc?.staffId || '—';
      const day = r.date ? getDayName(r.date).slice(0, 3) : '—';
      const inTime = r.checkInMs ? fmtTime(r.checkInMs) : '—';
      const outTime = r.checkOutMs ? `${fmtTime(r.checkOutMs)}${r.autoClosed ? ' (auto)' : ''}` : '—';
      const hrs = fmtHours(minutesBetween(r.checkInMs, r.checkOutMs));
      const status = r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—';
      const movementText = (r.breaks || []).map(b => `${b.type === 'office' ? 'Official' : 'Personal'} (${b.reason} - ${b.durationMinutes || 0}m)`).join('; ') || 'None';
      const selfieText = r.checkInPhoto ? `Yes (${r.checkInPhotoKb || 'B&W'} KB)` : 'No';

      return [
        r.date || '',
        day,
        r.staffName || '',
        staffCode,
        inTime,
        outTime,
        hrs,
        status,
        movementText,
        selfieText,
      ].join('\t');
    });

    return [SHEET_HEADERS.join('\t'), ...rows].join('\n');
  };

  const handleCopyForSheet = () => {
    const tsv = buildTsvForSheet();
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadCsv = () => {
    const rows = exportRecords.map(r => {
      const staffDoc = staff.find(s => s.id === r.staffId);
      const staffCode = staffDoc?.staffId || '—';
      const day = r.date ? getDayName(r.date).slice(0, 3) : '—';
      const inTime = r.checkInMs ? fmtTime(r.checkInMs) : '—';
      const outTime = r.checkOutMs ? `${fmtTime(r.checkOutMs)}${r.autoClosed ? ' (auto)' : ''}` : '—';
      const hrs = fmtHours(minutesBetween(r.checkInMs, r.checkOutMs));
      const status = r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—';
      const movementText = (r.breaks || []).map(b => `${b.type === 'office' ? 'Official' : 'Personal'} (${b.reason} - ${b.durationMinutes || 0}m)`).join('; ') || 'None';
      const selfieText = r.checkInPhoto ? `Yes (${r.checkInPhotoKb || 'B&W'} KB)` : 'No';

      return [r.date || '', day, r.staffName || '', staffCode, inTime, outTime, hrs, status, movementText, selfieText];
    });

    downloadCsv(`SMART_ERP_ATTENDANCE_${exportMonth}_${exportStaff}.csv`, SHEET_HEADERS, rows);
  };

  // ── Tab 2: Import from Google Sheet State ──
  const [pasteData, setPasteData] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleImportParsedRows = async () => {
    if (!pasteData.trim()) return;
    setImportBusy(true);
    setImportResult(null);

    try {
      const lines = pasteData.trim().split(/\r?\n/).map(l => l.split(/\t|,/));
      if (lines.length === 0) throw new Error('No data found to import.');

      // Header scan
      const firstRow = lines[0].map(c => String(c || '').trim().toLowerCase());
      const hasHeader = firstRow.some(c => c.includes('date') || c.includes('staff') || c.includes('name'));
      const dataRows = hasHeader ? lines.slice(1) : lines;

      let dateIdx = firstRow.findIndex(c => c.includes('date'));
      let nameIdx = firstRow.findIndex(c => c.includes('staff') || c.includes('name'));
      let inIdx = firstRow.findIndex(c => c.includes('in') || c.includes('arrival'));
      let outIdx = firstRow.findIndex(c => c.includes('out') || c.includes('departure'));
      let statusIdx = firstRow.findIndex(c => c.includes('status'));

      if (dateIdx === -1) dateIdx = 0;
      if (nameIdx === -1) nameIdx = 1;
      if (inIdx === -1) inIdx = 2;
      if (outIdx === -1) outIdx = 3;
      if (statusIdx === -1) statusIdx = 4;

      let importedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        if (!row || row.length < 2) continue;
        const rawDate = row[dateIdx] ? String(row[dateIdx]).trim() : '';
        const rawName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
        if (!rawDate || !rawName) continue;

        const resolvedDate = sheetDate(rawDate);
        if (!resolvedDate || resolvedDate.length !== 10) {
          skippedCount++;
          continue;
        }

        const matchedStaff = findStaffBySheetName(staff, rawName);
        const staffId = matchedStaff?.id || `stf-${rawName.toLowerCase().replace(/\s+/g, '-')}`;
        const staffName = matchedStaff?.name || rawName;

        const rawIn = row[inIdx] ? String(row[inIdx]).trim() : '08:30';
        const rawOut = row[outIdx] ? String(row[outIdx]).trim() : '17:30';
        const rawStatus = row[statusIdx] ? String(row[statusIdx]).trim() : 'Present';

        // Parse in & out ms
        const [inH, inM] = rawIn.replace(/[^0-9:]/g, '').split(':').map(Number);
        const checkInMs = new Date(`${resolvedDate}T${String(inH || 8).padStart(2, '0')}:${String(inM || 30).padStart(2, '0')}:00`).getTime();

        const [outH, outM] = rawOut.replace(/[^0-9:]/g, '').split(':').map(Number);
        const checkOutMs = rawOut && rawOut !== '—'
          ? new Date(`${resolvedDate}T${String(outH || 17).padStart(2, '0')}:${String(outM || 30).padStart(2, '0')}:00`).getTime()
          : 0;

        const payload = {
          staffId,
          staffName,
          authUid: matchedStaff?.authUid || staffId,
          date: resolvedDate,
          checkInMs,
          checkOutMs,
          minutes: minutesBetween(checkInMs, checkOutMs),
          status: rawStatus || attendanceStatus(checkInMs, checkOutMs) || 'Present',
          autoClosed: false,
          source: 'google-sheet-sync',
          updatedAt: serverTimestamp(),
        };

        if (live) {
          // Check if record exists for this staff and date
          const existing = records.find(r => r.date === resolvedDate && (r.staffId === staffId || r.staffName === staffName));
          if (existing?.id) {
            await updateDoc(doc(db, 'attendance', existing.id), payload);
          } else {
            await addDoc(collection(db, 'attendance'), { ...payload, createdAt: serverTimestamp() });
          }
        }
        importedCount++;
      }

      setImportResult({ ok: true, msg: `Successfully synced ${importedCount} records from Google Sheet data! (${skippedCount} skipped)` });
      setPasteData('');
      onRecordsUpdated?.();
    } catch (err) {
      console.error(err);
      setImportResult({ ok: false, msg: 'Import failed: ' + err.message });
    } finally {
      setImportBusy(false);
    }
  };

  // ── Tab 3: Bulk Mark / Populate Dates State ──
  const [bulkFrom, setBulkFrom] = useState(() => todayKey());
  const [bulkTo, setBulkTo] = useState(() => todayKey());
  const [bulkStaffIds, setBulkStaffIds] = useState(() => staff.map(s => s.id));
  const [skipSundays, setSkipSundays] = useState(true);
  const [autoLeaveHolidayRule, setAutoLeaveHolidayRule] = useState(true);
  const [bulkInTime, setBulkInTime] = useState('08:30');
  const [bulkOutTime, setBulkOutTime] = useState('17:30');
  const [bulkStatus, setBulkStatus] = useState('Present');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Official PDF 7-Staff Sync
  const [syncPdfBusy, setSyncPdfBusy] = useState(false);
  const [syncPdfResult, setSyncPdfResult] = useState(null);

  const handleSyncOfficialRecords = async () => {
    setSyncPdfBusy(true);
    setSyncPdfResult(null);
    try {
      let count = 0;
      for (const rec of OFFICIAL_ATTENDANCE_RECORDS) {
        if (live) {
          const matchedStaff = findStaffBySheetName(staff, rec.staffName);
          const staffId = matchedStaff?.id || rec.staffId;
          const payload = {
            ...rec,
            staffId,
            authUid: matchedStaff?.authUid || staffId,
            updatedAt: serverTimestamp(),
          };
          const existing = records.find(r => r.date === rec.date && (r.staffId === staffId || sameStaffName(r.staffName, rec.staffName)));
          if (existing?.id) {
            await updateDoc(doc(db, 'attendance', existing.id), payload);
          } else {
            await addDoc(collection(db, 'attendance'), { ...payload, createdAt: serverTimestamp() });
          }
        }
        count++;
      }
      setSyncPdfResult({
        ok: true,
        msg: `Successfully synced ${count} official attendance records for all 7 staff members (2026-09-28 to 2026-11-23)!`,
      });
      onRecordsUpdated?.();
    } catch (err) {
      console.error(err);
      setSyncPdfResult({ ok: false, msg: 'Sync failed: ' + err.message });
    } finally {
      setSyncPdfBusy(false);
    }
  };

  const toggleSelectAllStaff = () => {
    if (bulkStaffIds.length === staff.length) {
      setBulkStaffIds([]);
    } else {
      setBulkStaffIds(staff.map(s => s.id));
    }
  };

  const handleBulkMarkAttendance = async () => {
    if (!bulkFrom || !bulkTo) return;
    if (bulkStaffIds.length === 0) {
      setBulkResult({ ok: false, msg: 'Please select at least one staff member.' });
      return;
    }

    setBulkBusy(true);
    setBulkResult(null);

    try {
      // Generate date array
      const dates = [];
      let cur = bulkFrom;
      while (cur <= bulkTo) {
        const d = new Date(`${cur}T12:00:00`);
        const dayOfWeek = d.getDay(); // 0 = Sunday
        if (!skipSundays || dayOfWeek !== 0) {
          dates.push(cur);
        }
        cur = addDaysIso(cur, 1);
        if (dates.length > 90) break; // guard
      }

      let count = 0;
      for (const d of dates) {
        // SMART rule: Did anyone check in that day?
        const isOfficeActiveThatDay = records.some(r => r.date === d && r.checkInMs && r.status !== 'Holiday' && r.status !== 'Leave');

        const [inH, inM] = bulkInTime.split(':').map(Number);
        const [outH, outM] = bulkOutTime.split(':').map(Number);
        const checkInMs = new Date(`${d}T${String(inH || 8).padStart(2, '0')}:${String(inM || 30).padStart(2, '0')}:00`).getTime();
        const checkOutMs = new Date(`${d}T${String(outH || 17).padStart(2, '0')}:${String(outM || 30).padStart(2, '0')}:00`).getTime();

        for (const sid of bulkStaffIds) {
          const s = staff.find(st => st.id === sid);
          if (!s) continue;

          // If auto rule is enabled: staff with no punch gets 'Leave' if office had attendees, or 'Holiday' if nobody attended.
          let resolvedStatus = bulkStatus || 'Present';
          let inStamp = checkInMs;
          let outStamp = checkOutMs;
          if (autoLeaveHolidayRule) {
            resolvedStatus = isOfficeActiveThatDay ? 'Leave' : 'Holiday';
            if (resolvedStatus === 'Leave' || resolvedStatus === 'Holiday') {
              inStamp = 0;
              outStamp = 0;
            }
          }

          const payload = {
            staffId: s.id,
            staffName: s.name,
            authUid: s.authUid || s.id,
            date: d,
            checkInMs: inStamp,
            checkOutMs: outStamp,
            minutes: inStamp && outStamp ? minutesBetween(inStamp, outStamp) : 0,
            status: resolvedStatus,
            autoClosed: false,
            source: 'admin-bulk-populate',
            updatedAt: serverTimestamp(),
          };

          if (live) {
            const existing = records.find(r => r.date === d && r.staffId === s.id);
            if (existing?.id) {
              await updateDoc(doc(db, 'attendance', existing.id), payload);
            } else {
              await addDoc(collection(db, 'attendance'), { ...payload, createdAt: serverTimestamp() });
            }
          }
          count++;
        }
      }

      setBulkResult({
        ok: true,
        msg: `Successfully marked attendance for ${bulkStaffIds.length} staff across ${dates.length} date(s) (${count} records populated)!`,
      });
      onRecordsUpdated?.();
    } catch (err) {
      console.error(err);
      setBulkResult({ ok: false, msg: 'Bulk marking failed: ' + err.message });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <ERPModal isOpen={isOpen} onClose={onClose} title="Attendance Google Sheet Sync & Date Marker" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex', borderBottom: `1px solid ${C.border}`,
          paddingBottom: 2, gap: 8,
        }}>
          {[
            { id: 'export', label: '1. Export / Sync to Google Sheet', icon: <FileSpreadsheet size={13} /> },
            { id: 'bulk', label: '2. Bulk Mark Missing Dates', icon: <Calendar size={13} /> },
            { id: 'import', label: '3. Import from Google Sheet', icon: <Upload size={13} /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: '10px 10px 0 0',
                border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                background: activeTab === t.id ? 'rgba(0,102,255,0.18)' : 'transparent',
                color: activeTab === t.id ? C.blue : C.muted,
                borderBottom: activeTab === t.id ? `2px solid ${C.blue}` : '2px solid transparent',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: EXPORT / SYNC TO GOOGLE SHEET ── */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
              Copy clean, structured attendance data ready to paste (<strong style={{ color: C.subtle }}>Ctrl+V</strong>) directly into your Attendance Google Sheet, or download as CSV. Includes Date, Staff Name, Staff ID, Punch Times, Total Hours, Status, and Selfie Verifications.
            </div>

            {/* Official 7-Staff PDF Attendance Sync Box */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(0,102,255,0.08)', border: `1px solid rgba(0,102,255,0.25)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <strong style={{ color: C.cyan, fontSize: 12 }}>Official 7-Staff Attendance PDF (Sep 28 – Nov 23, 2026)</strong>
                  <div style={{ color: C.muted, fontSize: 10.5 }}>291 exact daily records for Lukshika, Thishalini, Ameen, Pirashalini, Asra, Kavitharan & Sathurshika</div>
                </div>
                <ERPBtn
                  variant="primary"
                  disabled={syncPdfBusy}
                  onClick={handleSyncOfficialRecords}
                  style={{ padding: '6px 12px', fontSize: 11 }}
                >
                  <Sparkles size={13} /> {syncPdfBusy ? 'Synchronizing…' : 'Sync All Official Records to ERP'}
                </ERPBtn>
              </div>
              {syncPdfResult && (
                <div style={{ fontSize: 11, color: syncPdfResult.ok ? C.green : C.red }}>
                  {syncPdfResult.msg}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.subtle, marginBottom: 5 }}>Period / Month</label>
                <select
                  value={exportMonth}
                  onChange={e => setExportMonth(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                    borderRadius: 9, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none',
                  }}
                >
                  <option value={thisMonthKey()}>This Month ({monthLabel(thisMonthKey())})</option>
                  <option value="2026-10">October 2026</option>
                  <option value="2026-09">September 2026</option>
                  <option value="all">All Available Records</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.subtle, marginBottom: 5 }}>Staff Member</label>
                <select
                  value={exportStaff}
                  onChange={e => setExportStaff(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                    borderRadius: 9, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none',
                  }}
                >
                  <option value="All">All Staff ({staff.length} members)</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}30`, fontSize: 11, color: C.subtle,
            }}>
              <span>Found <strong style={{ color: C.cyan }}>{exportRecords.length}</strong> attendance records for this period</span>
              <span style={{ color: C.muted }}>Format: Google Sheet Grid (TSV)</span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ERPBtn
                variant="primary"
                onClick={handleCopyForSheet}
                disabled={exportRecords.length === 0}
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
              >
                {copied ? <Check size={14} style={{ color: C.green }} /> : <Copy size={14} />}
                {copied ? 'Copied to Clipboard! (Paste with Ctrl+V in Sheet)' : 'Copy Table for Google Sheet'}
              </ERPBtn>

              <ERPBtn
                variant="secondary"
                onClick={handleDownloadCsv}
                disabled={exportRecords.length === 0}
                style={{ padding: '12px 16px' }}
              >
                <Download size={14} /> Download CSV
              </ERPBtn>
            </div>

            {/* Apps Script toggle */}
            <div style={{ borderTop: `1px solid ${C.border}20`, paddingTop: 10 }}>
              <button
                onClick={() => setShowScript(!showScript)}
                style={{
                  background: 'none', border: 'none', color: C.blue, fontSize: 11,
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Code size={12} /> {showScript ? 'Hide Google Apps Script Automation Code' : 'Want automatic real-time sync into Google Sheet? Click for Apps Script'}
              </button>

              {showScript && (
                <div style={{ marginTop: 8, background: '#020612', padding: 12, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 6 }}>
                    In your Google Sheet: Go to <strong>Extensions → Apps Script</strong>, paste this snippet, and run it to pull attendance data anytime:
                  </div>
                  <pre style={{
                    fontSize: 10, color: '#A5B4FC', margin: 0, padding: 8,
                    overflowX: 'auto', background: 'rgba(0,0,0,0.5)', borderRadius: 6,
                  }}>
{`function syncSmartERPAttendance() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var apiUrl = "https://asia-south1-smart-pvt-ltd-website.cloudfunctions.net/api/v1/attendance";
  var options = {
    method: "get",
    headers: { "x-api-key": "YOUR_BOSS_API_KEY_HERE" },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(apiUrl, options);
  var json = JSON.parse(response.getContentText());
  if (json && json.data) {
    sheet.clear();
    sheet.appendRow(["Date", "Staff Name", "Check In", "Check Out", "Status", "Hours"]);
    json.data.forEach(function(r) {
      sheet.appendRow([r.date, r.staffName, r.checkInTime || "—", r.checkOutTime || "—", r.status, r.minutes ? (r.minutes/60).toFixed(1) + " hrs" : "0 hrs"]);
    });
  }
}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: BULK MARK MISSING DATES ── */}
        {activeTab === 'bulk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
              Missing attendance records for past or current dates in the Google Sheet?
              Select the date range and staff members below to automatically populate and mark them in SMART ERP. Once marked, you can copy or export them straight into your Google Sheet!
            </div>

            {/* Official 7-Staff PDF Attendance Sync Box */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(0,102,255,0.08)', border: `1px solid rgba(0,102,255,0.25)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <strong style={{ color: C.cyan, fontSize: 12 }}>Official 7-Staff Attendance PDF (Sep 28 – Nov 23, 2026)</strong>
                  <div style={{ color: C.muted, fontSize: 10.5 }}>291 exact daily records for Lukshika, Thishalini, Ameen, Pirashalini, Asra, Kavitharan & Sathurshika</div>
                </div>
                <ERPBtn
                  variant="primary"
                  disabled={syncPdfBusy}
                  onClick={handleSyncOfficialRecords}
                  style={{ padding: '6px 12px', fontSize: 11 }}
                >
                  <Sparkles size={13} /> {syncPdfBusy ? 'Synchronizing…' : 'Sync All Official Records to ERP'}
                </ERPBtn>
              </div>
              {syncPdfResult && (
                <div style={{ fontSize: 11, color: syncPdfResult.ok ? C.green : C.red }}>
                  {syncPdfResult.msg}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ERPInput label="From Date" type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)} />
              <ERPInput label="To Date" type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <ERPInput label="Standard In Time" type="text" value={bulkInTime} onChange={e => setBulkInTime(e.target.value)} placeholder="08:30" />
              <ERPInput label="Standard Out Time" type="text" value={bulkOutTime} onChange={e => setBulkOutTime(e.target.value)} placeholder="17:30" />
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.subtle, marginBottom: 5 }}>Default Status</label>
                <select
                  value={bulkStatus}
                  onChange={e => setBulkStatus(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                    borderRadius: 9, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none',
                  }}
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>
            </div>

            {/* Sunday filter & Auto Leave/Holiday option */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.subtle, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={skipSundays}
                  onChange={e => setSkipSundays(e.target.checked)}
                  style={{ accentColor: C.blue }}
                />
                <span>Skip Sundays (Office closed / Sunday holiday)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.cyan, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoLeaveHolidayRule}
                  onChange={e => setAutoLeaveHolidayRule(e.target.checked)}
                  style={{ accentColor: C.cyan }}
                />
                <span><strong>SMART Office Rule:</strong> If at least 1 staff checked in on that date, unpunched staff get marked as <em>Leave</em>. If nobody checked in, mark as <em>Holiday</em>.</span>
              </label>
            </div>

            {/* Staff Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.subtle }}>
                  Select Staff Members ({bulkStaffIds.length}/{staff.length} chosen)
                </label>
                <button
                  onClick={toggleSelectAllStaff}
                  style={{ background: 'none', border: 'none', color: C.blue, fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  {bulkStaffIds.length === staff.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                maxHeight: 120, overflowY: 'auto', background: 'rgba(4,13,31,0.5)',
                padding: 8, borderRadius: 9, border: `1px solid ${C.border}30`,
              }}>
                {staff.map(s => {
                  const isChecked = bulkStaffIds.includes(s.id);
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.subtle, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) setBulkStaffIds([...bulkStaffIds, s.id]);
                          else setBulkStaffIds(bulkStaffIds.filter(id => id !== s.id));
                        }}
                        style={{ accentColor: C.blue }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {bulkResult && (
              <div style={{
                padding: '9px 12px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.5,
                background: bulkResult.ok ? 'rgba(24,199,122,0.1)' : 'rgba(240,90,103,0.1)',
                border: `1px solid ${bulkResult.ok ? 'rgba(24,199,122,0.3)' : 'rgba(240,90,103,0.3)'}`,
                color: bulkResult.ok ? C.green : C.red,
              }}>
                {bulkResult.msg}
              </div>
            )}

            <ERPBtn
              variant="primary"
              disabled={bulkBusy}
              onClick={handleBulkMarkAttendance}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              <Check size={15} /> {bulkBusy ? 'Populating Attendance Records…' : 'Bulk Populate & Mark Attendance'}
            </ERPBtn>
          </div>
        )}

        {/* ── TAB 3: IMPORT FROM GOOGLE SHEET ── */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
              If you have an existing Attendance Google Sheet, select the cells in Google Sheets, press <strong style={{ color: C.subtle }}>Ctrl+C</strong>, and paste them here. The importer will match each staff member by name and save the attendance into the ERP!
            </div>

            <textarea
              rows={6}
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
              placeholder="Paste cells copied from Google Sheets (e.g. Date, Staff Name, Arrival Time, Departure Time)..."
              style={{
                width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)',
                border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px',
                color: '#fff', fontSize: 11, fontFamily: 'monospace', outline: 'none', resize: 'vertical',
              }}
            />

            {importResult && (
              <div style={{
                padding: '9px 12px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.5,
                background: importResult.ok ? 'rgba(24,199,122,0.1)' : 'rgba(240,90,103,0.1)',
                border: `1px solid ${importResult.ok ? 'rgba(24,199,122,0.3)' : 'rgba(240,90,103,0.3)'}`,
                color: importResult.ok ? C.green : C.red,
              }}>
                {importResult.msg}
              </div>
            )}

            <ERPBtn
              variant="success"
              disabled={importBusy || !pasteData.trim()}
              onClick={handleImportParsedRows}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              <Upload size={14} /> {importBusy ? 'Parsing & Syncing…' : 'Sync Pasted Rows into ERP'}
            </ERPBtn>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.border}20`, paddingTop: 10 }}>
          <ERPBtn variant="ghost" onClick={onClose}>Close</ERPBtn>
        </div>
      </div>
    </ERPModal>
  );
}
