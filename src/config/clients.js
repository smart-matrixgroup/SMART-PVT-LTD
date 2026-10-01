// ============================================================
//  SMART PVT LTD — Client Accounts Configuration
//  Admin இங்க manually client add பண்ணணும்
//  ERP System ready ஆனா இந்த file Firebase-ஆல் replace ஆகும்
// ============================================================
//
//  HOW TO ADD A NEW CLIENT:
//  1. கீழே உள்ள array-ல் new object copy பண்ணு
//  2. id       → "CLT-XXX" format (unique)
//  3. email    → client-ரோட email
//  4. password → strong password (WhatsApp-ல் send பண்ணு)
//  5. projects, invoices, tickets → client-ரோட data add பண்ணு
//  6. File save பண்ணு → done!
//
// ============================================================

export const clients = [

  // ── ADD NEW CLIENT HERE ──────────────────────────────────────
  // Admin ஒவ்வொரு client-க்கும் இங்க add பண்ணணும்
  // WhatsApp-ல் email + password client-க்கு send பண்ணணும்
  //
  // {
  //   id:       'CLT-001',
  //   email:    'client@company.com',
  //   password: 'Smart@Client2024',
  //   name:     'Client Name',
  //   company:  'Company Name',
  //   phone:    '+94 77 000 0000',
  //   clientSince:    'Month Year',
  //   accountManager: 'SMART Solutions Team',
  //   projects: [],
  //   invoices: [],
  //   tickets:  [],
  // },

];

// ── Helper: find client by email + password ──────────────────
export function authenticateClient(email, password) {
  return clients.find(
    c => c.email.toLowerCase() === email.toLowerCase().trim() && c.password === password
  ) || null;
}

// ── Helper: get client by id ─────────────────────────────────
export function getClientById(id) {
  return clients.find(c => c.id === id) || null;
}
