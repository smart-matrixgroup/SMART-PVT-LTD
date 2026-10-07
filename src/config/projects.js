// ⚠️ CONTENT REVIEW NEEDED — the `results` figures in these case studies
// (e.g. "35% faster", "100/100 Lighthouse", specific lead/SKU counts) are
// illustrative placeholders, not verified client outcomes. Master plan
// section 39 ("Never invent company facts") and section 41/42 (only
// publish genuine, permission-cleared results) require these to be
// replaced with real, client-approved figures — or softened to
// non-quantitative language — before publishing live.
export const projectCategories = [
  "All",
  "ERP & POS",
  "Websites",
  "Mobile Apps",
  "Automation",
  "Business Software",
  "AI Solutions"
];

export const projects = [
  {
    id: "smart-fnb",
    slug: "smart-restaurant-pos",
    name: "SMART Restaurant POS & Cloud ERP",
    category: "ERP & POS",
    clientType: "Hospitality & Restaurant Chain",
    status: "Production Ready",
    techStack: ["React", "Node.js", "PostgreSQL", "Tailwind CSS", "ESC/POS Thermal Engine"],
    tagline: "High-speed table ordering, instant KOT, and central multi-outlet inventory management.",
    challenge: "Traditional handwritten orders caused delayed kitchen prep, billing discrepancies during peak dinner hours, and unchecked raw ingredient wastage.",
    solution: "Implemented SMART ERP with tablet-based floor ordering, automatic kitchen display routing, split billing, and real-time recipe-based ingredient depletion tracking.",
    results: [
      "Order-to-table delivery time reduced by 35%",
      "Eliminated billing mistakes and cash mismatch at shift close",
      "Real-time food cost and margin reports for owners"
    ],
    modules: ["Touch POS", "Floor Tables", "KOT System", "Live Stock Control", "Expense Register", "Staff Shifts", "Analytics"]
  },
  {
    id: "mehala-portfolio",
    slug: "mehala-personal-portfolio",
    name: "Mehala Professional Portfolio Website",
    category: "Websites",
    clientType: "Executive & Consultant Profile",
    status: "Live & Deployed",
    techStack: ["React", "Vite", "Tailwind CSS", "Framer Motion", "Firebase Hosting"],
    tagline: "Ultra-fast modern portfolio showcasing consulting milestones, publications, and direct booking.",
    challenge: "The client needed a high-credibility digital landing page to showcase professional achievements and receive international consulting leads.",
    solution: "Designed a clean, glassmorphic portfolio highlighting past keynotes, media mentions, client reviews, and direct WhatsApp / Calendly integration.",
    results: [
      "100/100 Google Lighthouse performance score",
      "Sub-second page load speeds globally",
      "Over 40+ inbound consulting inquiries in first 60 days"
    ],
    modules: ["Interactive Hero", "Case Study Gallery", "Credentials Timeline", "WhatsApp Lead Flow", "Automated Contact API"]
  },
  {
    id: "retail-flow-pos",
    slug: "retail-smart-pos-inventory",
    name: "SmartRetail Multistore Inventory & Barcode POS",
    category: "ERP & POS",
    clientType: "Multi-branch Supermarket & Retail",
    status: "Active Deployment",
    techStack: ["React", "Spring Boot", "MySQL", "Thermal SDK"],
    tagline: "Centralized multi-store barcode checkout, supplier purchase orders, and stock transfers.",
    challenge: "Managing stock sync and pricing changes manually across 3 physical branch locations led to stockouts and discrepancies.",
    solution: "Deployed a centralized cloud POS database with barcode scanning, batch expiry tracking, and inter-branch inventory transfer requests.",
    results: [
      "Instant synchronization of 12,000+ SKUs across all stores",
      "Inventory reconciliation time dropped from 3 days to 2 hours",
      "Low-stock automated alerts preventing out-of-stock items"
    ],
    modules: ["Barcode Scanning", "Multi-Warehouse Sync", "Cash Registers", "Customer Loyalty Points", "Supplier PO Workflow"]
  },
  {
    id: "auto-lead-n8n",
    slug: "omnichannel-business-automation",
    name: "Omnichannel Lead & Invoice Automation Engine",
    category: "Automation",
    clientType: "Professional Corporate Services",
    status: "Completed",
    techStack: ["n8n", "Node.js", "WhatsApp Cloud API", "Google Workspace", "PostgreSQL"],
    tagline: "Automated lead ingestion, instant WhatsApp confirmation, and auto-generated PDF quotation dispatch.",
    challenge: "Sales reps took an average of 14 hours to respond to online inquiries, leading to lost deals and redundant manual data entry.",
    solution: "Engineered an automated pipeline connecting website forms directly to CRM, triggering instant WhatsApp acknowledgements and alerting managers on Slack.",
    results: [
      "Lead response time improved from 14 hours to under 60 seconds",
      "Zero lost leads with automated CRM status logging",
      "Automated PDF quotation generation saving 20 hours/week"
    ],
    modules: ["Webhook Ingestion", "WhatsApp Auto-Reply", "PDF Generator", "Google Sheets Sync", "Staff Notification Bot"]
  },
  {
    id: "enterprise-doc-ai",
    slug: "smart-invoice-ocr-ai",
    name: "SmartOCR Intelligent Invoice & Document Extractor",
    category: "AI Solutions",
    clientType: "Accounting & Audit Firm",
    status: "Production Ready",
    techStack: ["Python", "FastAPI", "OpenAI Vision API", "React Dashboard"],
    tagline: "High-accuracy AI data extraction from scanned receipts, bills, and tax certificates with human approval.",
    challenge: "Accountants spent hundreds of hours every month manually keying in data from paper vendor invoices and bank slips.",
    solution: "Built a secure document ingestion portal where AI automatically extracts supplier name, TIN number, VAT breakdown, and line items, presenting them for 1-click verification.",
    results: [
      "85% reduction in manual data entry workload",
      "99.2% extraction accuracy on standard commercial invoices",
      "Direct export to Excel and ERP accounting formats"
    ],
    modules: ["Document Upload", "AI Vision Extraction", "Validation UI", "TIN/VAT Verifier", "Export to Accounting"]
  },
  {
    id: "field-service-app",
    slug: "mobile-field-operations-app",
    name: "SmartField Mobile Operations & Job Dispatch App",
    category: "Mobile Apps",
    clientType: "Logistics & Maintenance Services",
    status: "Completed",
    techStack: ["Flutter", "Firebase Firestore", "Google Maps API", "Cloud Functions"],
    tagline: "Cross-platform mobile app for field technicians with GPS check-in, offline job sheets, and signature capture.",
    challenge: "Dispatchers had no real-time visibility into field technician status, job progress, or customer sign-offs.",
    solution: "Developed a Flutter mobile application with live GPS location tracking, offline job photo uploads, digital customer signatures, and instant invoice triggers.",
    results: [
      "30% increase in daily completed job orders per technician",
      "Instant paperless digital sign-offs emailed to customers",
      "Full offline operational support in rural areas"
    ],
    modules: ["Task Dispatch", "GPS Check-in", "Photo & Signature Capture", "Offline Cache", "Customer Feedback"]
  }
];

