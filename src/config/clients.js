// ============================================================
//  SMART PVT LTD — Client Portal: Firestore Document Reference
//
//  Client accounts now live in Firebase Auth + Firestore, not here.
//  This file is documentation only (nothing in it is imported).
//
//  HOW TO ONBOARD A NEW CLIENT:
//  1. Firebase Console → Authentication → Add user (email + password).
//  2. Copy the generated UID.
//  3. Firestore → "clients" collection → New document → Document ID = that UID.
//  4. Fill the document using the shape below.
//  5. Send the email + password to the client via WhatsApp
//     (Admin Panel → Quote Requests → Accept → "Send Login Details").
//
//  Example "clients/{uid}" document:
//  {
//    id:             "CLT-001",            // display ID shown in the dashboard
//    email:          "client@company.com",
//    name:           "Client Name",
//    company:        "Company Name",
//    phone:          "+94 77 000 0000",
//    clientSince:    "Month Year",
//    accountManager: "SMART Solutions Team",
//    projects: [
//      { id: "PRJ-0001", name: "...", status: "In Progress", completion: 40,
//        startDate: "...", expectedDelivery: "...", milestones: [{ title: "...", done: true }] }
//    ],
//    invoices: [
//      { id: "INV-0001", date: "...", description: "...", amount: "LKR 50,000", status: "Pending" }
//    ],
//    tickets: [
//      { id: "TCK-0001", subject: "...", status: "Open", priority: "Medium", date: "..." }
//    ],
//  }
//
//  To make a client an admin instead, add their UID as a document ID in
//  the "admins" collection (the document's content doesn't matter, only
//  its existence — see firestore.rules).
// ============================================================
