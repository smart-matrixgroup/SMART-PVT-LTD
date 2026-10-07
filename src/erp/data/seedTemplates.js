// ─────────────────────────────────────────────────────────────────
//  Seed templates for the ERP.
//  Quotation templates: one per SMART service (A) — auto-seeded into the
//  'quotationTemplates' collection the first time it is empty.
//  Requirement templates: per-service document checklists (F) — auto-seeded
//  into 'requirementTemplates'.
//  Fees: LKR 15,000 for Website Development matches the published starting
//  price on the website; all other fees default to 0 because pricing is
//  custom-quoted per engagement (admin updates the template once, reuses it).
//  NOTE: quotations / client requirements COPY these values, so later edits
//  here never change existing records.
// ─────────────────────────────────────────────────────────────────

export const QUOTATION_TEMPLATE_SEEDS = [
  {
    serviceName: 'Website Development',
    serviceCode: 'WD-01',
    description: 'Professional multi-page corporate or portfolio website with responsive design, SEO foundation and contact/lead-capture integration.',
    scope: '• Discovery call & requirements gathering\n• Custom responsive design (mobile/tablet/desktop)\n• Up to agreed number of pages with content integration\n• Contact / WhatsApp / lead-capture forms\n• Basic on-page SEO (meta tags, sitemap, robots.txt)\n• Hosting deployment & custom domain connection\n• Post-launch support period as per terms',
    professionalFee: 15000,
    otherCharges: 0,
    terms: 'Quotation valid for 30 days from date of issue.\nContent (text, images, logo) to be provided by the client before development begins.\nTwo rounds of design revisions included; further changes quoted separately.',
    paymentTerms: '50% advance with order confirmation, 50% on completion before go-live.',
  },
  {
    serviceName: 'ERP & POS System',
    serviceCode: 'ERP-01',
    description: 'SMARTORIX ERP with POS — billing, table management, inventory, KOT, staff roles, expenses and real-time reporting for retail & restaurants.',
    scope: '• Requirements analysis & module selection\n• Cloud or local server deployment\n• POS terminal & thermal printer setup\n• Role & permission configuration\n• Initial item catalog / inventory bulk upload\n• Staff training session\n• 12-month technical support & maintenance',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Pricing depends on modules enabled and active terminal count — confirm scope before signing.\nHardware (printers, scanners, drawers) quoted separately if procured through SMART.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '50% advance with order, 30% on deployment, 20% after staff training & go-live.',
  },
  {
    serviceName: 'Mobile App Development',
    serviceCode: 'MAD-01',
    description: 'Cross-platform Android & iOS mobile application with secure authentication, backend APIs and store release assistance.',
    scope: '• App concept & feature specification\n• UI/UX design screens\n• Flutter / React Native development (Android & iOS)\n• Backend / API setup on cloud\n• Play Store & App Store release submission assistance\n• 6-month post-launch bug-fix warranty',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Store developer accounts are owned & paid by the client.\nScope changes after sign-off are quoted separately.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '40% advance, 30% on UI/UX approval, 30% on store release.',
  },
  {
    serviceName: 'Custom Software Development',
    serviceCode: 'CSD-01',
    description: 'Tailor-made business software engineered around your workflow — approval chains, dashboards, integrations and secure cloud architecture.',
    scope: '• Software Requirement Specification (SRS)\n• UI/UX prototypes & wireframes\n• Full-stack development (frontend, backend, database)\n• Third-party API integrations\n• QA testing & documentation\n• Production deployment & handover with user manual',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Client retains full ownership of delivered source code and data.\nMaintenance beyond warranty is a separate agreement.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: 'Milestone-based billing as per agreed project plan.',
  },
  {
    serviceName: 'Income Tax',
    serviceCode: 'ITX-01',
    description: 'Preparation and filing of corporate or individual income tax returns — computations, deduction schedules and IRD correspondence.',
    scope: '• Review of income records & allowable deductions\n• Tax liability computation workpapers\n• Preparation of statutory return forms\n• IRD e-filing submission\n• Response assistance for IRD queries',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Fee assumes complete & accurate records provided by the client.\nLate-submission penalties and outstanding taxes are payable by the client.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '100% on completion of filing.',
  },
  {
    serviceName: 'Tax Registration (TIN / VAT / SSCL)',
    serviceCode: 'TRG-01',
    description: 'New taxpayer registration and profile services — TIN, VAT, SSCL and e-filing portal setup with the Inland Revenue Department.',
    scope: '• Document preparation & review\n• IRD application submission\n• e-filing portal registration & activation\n• Follow-up until registration certificate issued',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Government fees (if any) are payable by the client at actuals.\nApproval timelines depend on IRD processing.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '100% advance with document submission.',
  },
  {
    serviceName: 'Company Registration',
    serviceCode: 'CRG-01',
    description: 'End-to-end private company incorporation — name search, Form 01 filing, articles of association and registration certificate.',
    scope: '• Company name search & reservation\n• Preparation of incorporation forms\n• Articles of association drafting\n• Registrar of Companies submission\n• Registration certificate & company profile delivery',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Government registration fees are payable by the client at actuals (shown separately when confirmed).\nName approval is subject to Registrar availability.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '100% advance with document submission.',
  },
  {
    serviceName: 'Audit & Assurance',
    serviceCode: 'AUD-01',
    description: 'Internal audit support and external audit file preparation — schedules, reconciliations, control review and auditor liaison.',
    scope: '• Audit working paper preparation\n• Bank & ledger reconciliations\n• Fixed asset register verification\n• Internal control review & findings report\n• External auditor query resolution liaison',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Fee assumes client records are complete and provided on schedule.\nIndependent external auditor fees, if any, are separate.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '50% engagement advance, 50% on delivery of the final audit pack.',
  },
  {
    serviceName: 'Accounting & Bookkeeping',
    serviceCode: 'ACC-01',
    description: 'Ongoing bookkeeping and financial reporting — chart of accounts, monthly statements, management reports and software setup.',
    scope: '• Chart of accounts structuring\n• Transaction recording & reconciliations\n• Monthly / quarterly management reports\n• Financial statement preparation\n• Accounting software setup (optional)',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Monthly fee varies with transaction volume — confirm tier before engagement.\nHistorical catch-up bookkeeping quoted separately.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: 'Monthly billing, payable within 7 days of invoice.',
  },
  {
    serviceName: 'Business Process Automation',
    serviceCode: 'AUT-01',
    description: 'Workflow automation across your existing tools — lead routing, document generation, WhatsApp bots and cross-system synchronisation.',
    scope: '• Process audit & automation architecture map\n• Workflow configuration (n8n / scripts / webhooks)\n• API connector bridges between systems\n• Error-handling alerts & fallback logging\n• Staff orientation & operation runbook',
    professionalFee: 0,
    otherCharges: 0,
    terms: 'Third-party platform subscription costs are borne by the client.\nQuotation valid for 30 days from date of issue.',
    paymentTerms: '50% advance, 50% on workflow handover.',
  },
];

export const REQUIREMENT_TEMPLATE_SEEDS = [
  {
    serviceName: 'Website Development',
    serviceCode: 'WD-01',
    checklist: [
      'Client & company details (name, address, contacts)',
      'Logo file (vector/AI or high-res PNG preferred)',
      'Website content — text for each page',
      'Images / photos / brand media',
      'Domain name details (registrar & login, if owned)',
      'Hosting preferences or existing hosting access',
      'Reference websites you like (2–3 examples)',
      'Brand guidelines (colors, fonts) if available',
    ],
  },
  {
    serviceName: 'ERP & POS System',
    serviceCode: 'ERP-01',
    checklist: [
      'Business details & registration documents',
      'Branch count & POS terminal list',
      'Existing product / item catalog (Excel export)',
      'Supplier list & purchase workflow notes',
      'Staff list with roles & permissions needed',
      'Existing software data for migration (if any)',
      'Hardware inventory (printers, scanners, cash drawers)',
      'Bank account details for payment reconciliation',
    ],
  },
  {
    serviceName: 'Mobile App Development',
    serviceCode: 'MAD-01',
    checklist: [
      'App concept & feature list',
      'Brand assets (logo, colors, icons)',
      'Reference apps (2–3 examples)',
      'Backend / API details (existing or new)',
      'Google Play & App Store developer account access',
      'Test device list (phones/tablets for QA)',
    ],
  },
  {
    serviceName: 'Custom Software Development',
    serviceCode: 'CSD-01',
    checklist: [
      'Requirement specification / workflow documentation',
      'User roles & permission requirements',
      'Integration/API documentation of existing systems',
      'Sample data sets (anonymized if sensitive)',
      'Reporting & dashboard expectations',
    ],
  },
  {
    serviceName: 'Income Tax',
    serviceCode: 'ITX-01',
    checklist: [
      'TIN certificate / e-filing profile access',
      'Previous year tax return (if available)',
      'Bank statements for the relevant period',
      'Income records (salary statements / financials)',
      'WHT / AIT certificates received',
      'Expense & investment records for deductions',
    ],
  },
  {
    serviceName: 'Tax Registration (TIN / VAT / SSCL)',
    serviceCode: 'TRG-01',
    checklist: [
      'Business registration certificate',
      'Directors / proprietor NIC copies',
      'Business address proof (utility bill / lease)',
      'Bank account details of the business',
      'Board resolution (for companies)',
    ],
  },
  {
    serviceName: 'Company Registration',
    serviceCode: 'CRG-01',
    checklist: [
      'Three proposed company names (priority order)',
      'Director NIC copies (all directors)',
      'Shareholder details & share percentages',
      'Registered office address proof',
      'Signed consent / request forms',
    ],
  },
  {
    serviceName: 'Audit & Assurance',
    serviceCode: 'AUD-01',
    checklist: [
      'Trial balance for the audit period',
      'General ledger export',
      'Bank statements & reconciliation statements',
      'Fixed asset register with invoices',
      'Loan / borrowing confirmation letters',
      'Prior year audited financial statements',
    ],
  },
  {
    serviceName: 'Accounting & Bookkeeping',
    serviceCode: 'ACC-01',
    checklist: [
      'Bank statements (all accounts)',
      'Sales invoices / POS sales exports',
      'Purchase invoices & supplier bills',
      'Expense receipts',
      'Payroll records (if applicable)',
      'Prior accounting records / opening balances',
    ],
  },
  {
    serviceName: 'Business Process Automation',
    serviceCode: 'AUT-01',
    checklist: [
      'Process documentation (current manual steps)',
      'Access credentials / admin rights to tools involved',
      'Approximate volume & frequency per task',
      'Integration requirements (systems to connect)',
      'Approval / escalation rules',
    ],
  },
];

/** Deterministic Firestore doc ids so re-seeding is idempotent (never duplicates). */
export const seedId = (code) =>
  `seed-${String(code || 'svc').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
