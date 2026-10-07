export const solutions = [
  {
    id: "restaurants",
    slug: "restaurants",
    title: "Restaurants, Cafes & Bakeries",
    headline: "End-to-End Restaurant Management & Kitchen Intelligence",
    icon: "Utensils",
    shortDesc: "Speed up table orders, streamline kitchen workflow, manage recipes, and track food waste in real-time.",
    keyChallenges: [
      "Order confusion and slow table turnover during peak hours",
      "Kitchen communication delays with handwritten KOT tickets",
      "Ingredient pilferage and uncalculated recipe costs"
    ],
    features: [
      { title: "Table-Side & Mobile Ordering", desc: "Waiters punch orders via mobile tablets straight to the bar and kitchen printers." },
      { title: "Kitchen Display System (KDS)", desc: "Color-coded digital tickets sorted by prep time with timer alerts." },
      { title: "Recipe-Level Inventory Tracking", desc: "Deducts exact grams of cheese, meat, and sauce automatically upon each dish sold." },
      { title: "Split-Bill & Dynamic Tax Support", desc: "Instantly split checks by item or seat with automated service charge and VAT calculations." }
    ],
    recommendedStack: ["SMART Restaurant ERP", "Thermal Printers", "Tablet Floor System", "WhatsApp Receipts"]
  },
  {
    id: "retail",
    slug: "retail",
    title: "Supermarkets & Retail Chains",
    headline: "Unified Multi-Store Barcode POS & Central Warehouse Sync",
    icon: "ShoppingBag",
    shortDesc: "Fast checkout barcode scanning, supplier purchase orders, customer loyalty, and multi-location inventory.",
    keyChallenges: [
      "Long checkout queues during rush periods",
      "Discrepancies in stock count between multiple outlets",
      "Manual price tag updates and promotional discounting errors"
    ],
    features: [
      { title: "High-Speed Barcode Checkout", desc: "Sub-second barcode scanning, electronic cash drawer sync, and custom price lookups." },
      { title: "Centralized Multi-Store Control", desc: "Update retail prices once and sync instantly across all branch registers." },
      { title: "Automated Reorder Thresholds", desc: "Generates supplier purchase orders automatically when stock drops below safety levels." },
      { title: "Customer Loyalty & WhatsApp Points", desc: "Track repeat customers with mobile-based loyalty points and digital promotions." }
    ],
    recommendedStack: ["SMART Retail POS", "Barcode Terminals", "Central Cloud Database", "Supplier Portal"]
  },
  {
    id: "sme",
    slug: "sme",
    title: "SMEs & Growing Enterprises",
    headline: "Scalable Digital Infrastructure, Websites & Business Automation",
    icon: "Building2",
    shortDesc: "Establish a high-credibility digital presence, automate repetitive customer inquiries, and digitize internal records.",
    keyChallenges: [
      "Reliance on scattered spreadsheets and paper notebooks",
      "Lack of a professional website to win institutional clients",
      "Inconsistent follow-ups with incoming sales leads"
    ],
    features: [
      { title: "Bespoke Corporate Website", desc: "Fast, responsive web presence with built-in quotation and lead capture funnels." },
      { title: "Inbound Lead Routing", desc: "Instant automated WhatsApp alerts to the team whenever an inquiry arrives." },
      { title: "Digital Invoicing & Receipts", desc: "Professional PDF quotation and invoice generation with payment link integration." },
      { title: "Cloud Accounting Setup", desc: "Transition from paper to structured digital bookkeeping with monthly margin reports." }
    ],
    recommendedStack: ["Corporate Web Platform", "n8n Workflow Automation", "Accounting System", "Google Workspace"]
  },
  {
    id: "professional-services",
    slug: "professional-services",
    title: "Professional Services & Accounting Firms",
    headline: "Client Document Portals, Tax Schedules & Audit Preparation",
    icon: "Briefcase",
    shortDesc: "Secure document management, client billing timers, statutory tax compliance schedules, and audit file coordination.",
    keyChallenges: [
      "Messy client document collection and misplaced receipts",
      "Tracking multiple statutory filing deadlines across numerous clients",
      "Time spent on manual trial balance and schedule reconciliation"
    ],
    features: [
      { title: "Secure Client Document Portal", desc: "Encrypted file sharing where clients upload bank statements and invoices safely." },
      { title: "Statutory Filing Calendar", desc: "Automated deadline tracking for VAT, CIT, APIT, and SSCL with client alert reminders." },
      { title: "Standardized Audit Working Papers", desc: "Pre-structured digital lead schedules matching International Standards on Auditing." },
      { title: "AI Document Data Extraction", desc: "Auto-extract line item details from scanned client documents directly to Excel." }
    ],
    recommendedStack: ["Custom Client Portal", "SmartOCR AI Engine", "Tax Management System", "Audit Working Papers"]
  }
];

