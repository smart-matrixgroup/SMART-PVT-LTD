# SMART Pvt Ltd — Corporate Website

Corporate website for SMART Pvt Ltd (software, ERP/POS, mobile apps, business
automation, accounting/tax/audit services), with a Firebase-backed client
portal and internal admin panel. Built with React + Vite, deployed to
Firebase Hosting.

See [`SMART_PVT_LTD_WEBSITE_MASTER_PLAN.md`](./SMART_PVT_LTD_WEBSITE_MASTER_PLAN.md)
for the full product/content blueprint.

## Tech stack

- **Frontend:** React 18, Vite, React Router, Tailwind CSS, Framer Motion
- **Backend:** Firebase Authentication (email/password) + Firestore
- **Hosting:** Firebase Hosting

## Prerequisites

- Node.js 18+ and npm
- Access to the SMART Pvt Ltd Firebase project (ask an admin for the config
  values below — they are not committed to this repo)

## Setup

```bash
git clone <this-repo-url>
cd SMART_PVT_LTD
npm install
```

Copy the env template and fill in the Firebase web app config:

```bash
cp .env.example .env
```

Get the actual values from Firebase Console → Project Settings → General →
Your apps → Web app → SDK setup and configuration, or ask an admin for them
directly. **Never commit `.env`** — it's already in `.gitignore`.

Run the dev server:

```bash
npm run dev
```

## Firebase project structure

- **Authentication:** email/password sign-in for both admin and client users
  (there's no separate "admin login" — the same `/client-login` form routes
  you based on which Firestore collection your account shows up in).
- **Firestore collections:**
  - `admins/{uid}` — presence of a document (any content) marks that UID as
    an admin. Create these manually in Firebase Console; nothing in the app
    can write to this collection.
  - `clients/{uid}` — client portal profile (projects, invoices, tickets).
    See the schema/example at the top of
    [`src/config/clients.js`](./src/config/clients.js).
  - `leads` — quote/enquiry submissions from the website's "Get a Quote"
    form. Visible under Admin Panel → Quote Requests.
- **Security rules:** [`firestore.rules`](./firestore.rules) — deploy
  changes via Firebase Console → Firestore → Rules, or `firebase deploy
  --only firestore:rules` if you have CLI access to the project.

### Onboarding a new client

1. Firebase Console → Authentication → Add user (email + password).
2. Copy the generated UID.
3. Firestore → `clients` collection → New document → Document ID = that UID.
   Fill it in using the shape documented in `src/config/clients.js`.
4. Admin Panel → Quote Requests → Accept the lead → send the email/password
   to the client via the WhatsApp button.

### Making someone an admin

Firestore → `admins` collection → New document → Document ID = their
Firebase Auth UID. Any field value works; only the document's existence is
checked (see `isAdmin()` in `firestore.rules`).

## Build & deploy

```bash
npm run build       # outputs to dist/ (not committed — see .gitignore)
firebase deploy --only hosting
```

## Content that still needs real data

A few files have unverified/placeholder values flagged with `⚠️ CONFIGURE`
comments — replace these with SMART's actual, verified information before
treating the site as launch-ready:

- `src/config/company.js` — contact phone/address
- `src/config/branches.js` — branch addresses/phone numbers
- `src/config/projects.js` — case-study result figures (must be real,
  client-approved numbers, not illustrative placeholders)

## Project structure

```
src/
  components/   Reusable UI (Navbar, Footer, QuoteModal, ProtectedRoute, ...)
  context/      ThemeContext (dark/light), AuthContext (Firebase auth/role)
  config/       Static content/config (company, services, pricing, SEO, ...)
  pages/        Route-level page components
  styles/       Tailwind entry point
```
