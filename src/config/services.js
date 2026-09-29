export const services = [
  {
    id: "erp-pos",
    slug: "erp-pos",
    title: "SMARTORIX ERP with POS",
    subtitle: "Unified Enterprise & Restaurant Management System",
    category: "Software & Cloud",
    shortDesc: "Cloud-connected business and restaurant ERP & POS system covering billing, table management, orders, inventory, expenses, staff controls, and real-time financial reporting.",
    icon: "LayoutGrid",
    badge: "Flagship Product",
    startingPrice: "Subscription & Custom Deployment",
    priceNote: "Tiered pricing based on modules and active terminal count",
    heroImage: "/images/erp-preview.png",
    overview: "SMARTORIX is an integrated business management platform engineered for retail, restaurants, and service enterprises. It eliminates operational friction by syncing point-of-sale terminals, inventory tracking, kitchen display workflows, staff permissions, and executive accounting in real-time.",
    features: [
      { name: "Fast POS Billing", desc: "Touch-optimized fast checkout with split billing, discounts, barcode scanning, and multi-payment gateways." },
      { name: "Table & Floor Management", desc: "Live restaurant floor maps, table status indicators, and dine-in reservation tracking." },
      { name: "Kitchen Display (KOT)", desc: "Instant order routing directly to kitchen screens or thermal ticket printers." },
      { name: "Live Inventory & Stock Alerts", desc: "Automated ingredient deduction, low stock alerts, supplier POs, and batch tracking." },
      { name: "Expense & Cash Register", desc: "Daily cash drawer audits, petty cash logs, and categorised expense management." },
      { name: "Staff & Role Controls", desc: "Granular access security, attendance logging, waiter commission, and shift reporting." },
      { name: "Executive Business Analytics", desc: "360-degree daily sales dashboards, margin reports, bestsellers, and tax summaries." },
      { name: "Cloud & Offline Sync", desc: "Continuous operation during internet interruptions with automatic cloud reconciliation." }
    ],
    deliverables: [
      "Full cloud or local server deployment",
      "POS terminal setup & thermal printer integration",
      "Custom role & permission configuration",
      "Initial item catalog & inventory bulk upload",
      "On-site / remote staff training sessions",
      "12-month dedicated technical support & maintenance"
    ],
    timeline: "1 - 3 Weeks depending on branch scale",
    faqs: [
      { q: "Can SMARTORIX work offline?", a: "Yes. SMARTORIX includes local caching so your billing and orders continue even if your internet connection drops, synchronizing automatically once restored." },
      { q: "Can it integrate with existing barcode scanners and receipt printers?", a: "Yes, it supports standard ESC/POS printers, USB/Bluetooth barcode scanners, and electronic cash drawers." },
      { q: "Is it suitable for multi-branch businesses?", a: "Absolutely. SMARTORIX features centralized multi-outlet management with synchronized pricing, warehouse stock transfers, and branch-level reporting." }
    ]
  },
  {
    id: "custom-software",
    slug: "custom-software",
    title: "Custom Business Software Development",
    subtitle: "Tailor-Made Systems Designed Around Your Exact Workflow",
    category: "Software & Cloud",
    shortDesc: "Purpose-built web and desktop software solutions engineered specifically for your company's unique operational procedures, approval hierarchies, and reporting needs.",
    icon: "Code2",
    badge: "Enterprise",
    startingPrice: "Custom Quotation",
    priceNote: "Determined by workflow complexity, user roles, and integrations",
    overview: "Generic off-the-shelf software often forces businesses to compromise their working methods. SMART Pvt Ltd builds robust, secure, and scalable custom business software designed strictly around how your organisation operates.",
    features: [
      { name: "Custom Workflow Engines", desc: "Multi-level approval chains, automated stage transitions, and custom business rules." },
      { name: "Role-Based Access Control", desc: "Enterprise-grade user management with granular permission sets and activity audit trails." },
      { name: "Relational Database Design", desc: "Optimised PostgreSQL/MySQL databases engineered for data integrity and rapid querying." },
      { name: "Interactive Business Dashboards", desc: "Custom KPI visualization widgets, data exports (Excel/PDF), and automated email reports." },
      { name: "Third-Party API Integrations", desc: "Seamless interconnectivity with ERPs, CRMs, payment gateways, SMS, and government portals." },
      { name: "Secure Cloud Architecture", desc: "Deployed on secure cloud infrastructure with SSL encryption, daily backups, and high uptime." }
    ],
    deliverables: [
      "Comprehensive Software Requirement Specification (SRS)",
      "Interactive UI/UX prototypes and wireframes",
      "Full stack development (Frontend + Backend + Database)",
      "Automated and manual QA testing documentation",
      "Production deployment & CI/CD pipeline setup",
      "Complete user manual and source code documentation"
    ],
    timeline: "4 - 12 Weeks depending on scope",
    faqs: [
      { q: "Who owns the software and intellectual property?", a: "You retain full ownership of the custom software and your proprietary business data." },
      { q: "Can the software be expanded in the future?", a: "Yes. We build using modular microservice-ready architectures so new features can be added seamlessly as your company grows." }
    ]
  },
  {
    id: "portfolio-website",
    slug: "portfolio-website",
    title: "Portfolio Website Development",
    subtitle: "High-Impact Personal & Professional Showcase",
    category: "Web & Mobile",
    shortDesc: "Modern, responsive personal portfolios for professionals, freelancers, executives, and students looking to build a high-credibility digital identity.",
    icon: "UserCheck",
    badge: "Fixed Starting Price",
    startingPrice: "LKR 15,000",
    priceNote: "Standard 1-page package starting price; custom multi-page scope quoted separately",
    overview: "Your digital portfolio is your 24/7 business card. We build fast, beautiful, and mobile-optimised portfolio websites that elevate your personal brand and convert visitors into clients and employers.",
    features: [
      { name: "Modern Responsive Layout", desc: "Fluid design that looks stunning across smartphones, tablets, laptops, and ultra-wide screens." },
      { name: "Interactive Project Showcase", desc: "Rich galleries with filtering, lightboxes, live project links, and case study modals." },
      { name: "WhatsApp & Contact Integration", desc: "Instant WhatsApp messaging buttons and interactive inquiry forms connected to your inbox." },
      { name: "SEO Foundation & Meta Tags", desc: "Structured OpenGraph tags, Google indexation setup, and lightning-fast load speeds." },
      { name: "Free Firebase / Cloud Hosting Setup", desc: "Zero-monthly-cost hosting assistance with custom domain configuration and free SSL." }
    ],
    deliverables: [
      "Custom responsive design matching your personal aesthetic",
      "About, Skills, Experience, Projects, and Contact sections",
      "Direct WhatsApp chat CTA & lead capture form",
      "Firebase hosting deployment with free HTTPS SSL certificate",
      "Domain DNS connection assistance"
    ],
    timeline: "3 - 5 Business Days",
    faqs: [
      { q: "What is included in the LKR 15,000 portfolio package?", a: "It includes a clean single-page responsive website with About, Experience, Projects gallery, Contact form, WhatsApp integration, basic SEO, and Firebase hosting deployment." },
      { q: "Do I need to buy domain and hosting separately?", a: "We deploy on Firebase Hosting (which has a generous free tier with zero recurring hosting fees for standard portfolios). You only need your custom domain name (e.g. yourname.com), which we assist you in purchasing and linking." }
    ]
  },
  {
    id: "business-website",
    slug: "business-website",
    title: "Professional Corporate Website",
    subtitle: "Premium Web Presence Engineered for Lead Generation",
    category: "Web & Mobile",
    shortDesc: "High-performance multi-page corporate websites designed to position your company as an industry leader and capture qualified business inquiries.",
    icon: "Globe",
    badge: "Popular",
    startingPrice: "Custom Quotation",
    priceNote: "Based on page count, interactive features, CMS needs, and integrations",
    overview: "A business website should not merely exist—it should actively generate leads, build trust, and reflect the quality of your services. We craft bespoke corporate websites with exceptional aesthetics, high speed, and conversion-focused UX.",
    features: [
      { name: "Tailored Brand Design", desc: "Custom UI crafted strictly according to your brand guidelines, typography, and color tokens." },
      { name: "Multi-Page Architecture", desc: "Dedicated SEO pages for every service, industry solution, company profile, and case study." },
      { name: "Dynamic Lead Capture", desc: "Multi-step quote calculators, contact forms, appointment booking, and WhatsApp chat." },
      { name: "Dark / Light Mode Support", desc: "Built-in theme toggle providing an optimal reading experience in any lighting environment." },
      { name: "Google Analytics & Search Console", desc: "Full tracking integration to measure traffic sources, user flows, and conversion metrics." }
    ],
    deliverables: [
      "Full multi-page responsive corporate website",
      "Services catalog with interactive detail views",
      "Interactive Google Maps and branch location cards",
      "Custom lead management form connected to email/CRM",
      "Full SEO optimization (Sitemap, Robots.txt, Schema markup)",
      "Cross-browser testing (Chrome, Safari, Firefox, Edge)"
    ],
    timeline: "2 - 4 Weeks",
    faqs: [
      { q: "Can we manage or edit content ourselves?", a: "Yes, we can build the website with easy-to-use CMS capabilities or structured JSON configurations that your team can update anytime." }
    ]
  },
  {
    id: "mobile-app",
    slug: "mobile-app",
    title: "Custom Mobile App Development",
    subtitle: "Native-Performance Android & iOS Applications",
    category: "Web & Mobile",
    shortDesc: "High-performance cross-platform mobile apps built with Flutter and React Native for customer-facing services, field staff, or internal operational workflows.",
    icon: "Smartphone",
    badge: "Cross-Platform",
    startingPrice: "Custom Quotation",
    priceNote: "Scoped based on platform targets, backend APIs, and hardware integrations",
    overview: "Expand your reach into the palms of your customers and team. We build intuitive, secure, and blazing-fast mobile apps for iOS and Android with offline-first capabilities and seamless backend synchronisation.",
    features: [
      { name: "Cross-Platform Flutter/React Native", desc: "One clean codebase deployed natively to Google Play Store and Apple App Store." },
      { name: "Secure Authentication", desc: "Biometric login (Fingerprint/FaceID), OTP verification, and JWT session handling." },
      { name: "Push Notifications", desc: "Targeted push messaging for order updates, promotions, reminders, and alerts via Firebase FCM." },
      { name: "Hardware & GPS Integration", desc: "Camera scanner, Bluetooth thermal printer, GPS live tracking, and offline data storage." },
      { name: "In-App Payment Gateways", desc: "Secure checkout integration with leading local and international payment processors." }
    ],
    deliverables: [
      "Complete mobile app source code for Android & iOS",
      "Admin backend panel for managing users, products, and notifications",
      "App Store & Google Play Store release submission assistance",
      "API backend setup on cloud servers",
      "6-month post-launch maintenance & bug fixing warranty"
    ],
    timeline: "6 - 12 Weeks",
    faqs: [
      { q: "Will the app work on both Android and iPhone?", a: "Yes! Using cross-platform engineering, we deliver identical high performance on both Android and iOS devices." }
    ]
  },
  {
    id: "business-automation",
    slug: "business-automation",
    title: "Business Process Automation",
    subtitle: "Streamline Repetitive Tasks & Eliminate Manual Errors",
    category: "Automation & AI",
    shortDesc: "Connect your disparate software, automate data entry, set up multi-channel approval pipelines, and trigger automated WhatsApp/Email workflows.",
    icon: "Cpu",
    badge: "Efficiency",
    startingPrice: "Custom Quotation",
    priceNote: "Priced per workflow complexity and system endpoints connected",
    overview: "Manual data copying and repetitive administrative tasks waste valuable hours and cause costly mistakes. We design automated workflows using tools like n8n, webhooks, and custom scripts to connect your databases, Google Workspace, and communication tools.",
    features: [
      { name: "Automated Lead Routing", desc: "Automatically sync incoming website inquiries into Google Sheets, CRM, and WhatsApp alerts for sales reps." },
      { name: "Document Generation", desc: "Auto-generate PDF invoices, quotation letters, and contracts upon trigger events." },
      { name: "WhatsApp Business Bots", desc: "Automate appointment confirmations, order receipts, and status inquiry answers 24/7." },
      { name: "Cross-System Synchronisation", desc: "Keep inventory, customer data, and accounting records synchronized across multiple platforms." }
    ],
    deliverables: [
      "Process audit and automation architecture map",
      "Workflow configuration on self-hosted n8n or cloud platforms",
      "API connector bridges between your software tools",
      "Error-handling alert triggers and fallback logging",
      "Staff orientation and operation runbook"
    ],
    timeline: "1 - 3 Weeks",
    faqs: [
      { q: "Do we need expensive enterprise software licenses?", a: "Not necessarily. We prioritize lightweight, cost-effective automation platforms and open-source engines that save money while maintaining peak reliability." }
    ]
  },
  {
    id: "ai-automation",
    slug: "ai-automation",
    title: "AI-Powered Business Solutions",
    subtitle: "Practical, Controlled AI Tools Delivering Tangible ROI",
    category: "Automation & AI",
    shortDesc: "Implement enterprise LLM assistants, automated document extraction, intelligent customer support bots, and internal company knowledge search.",
    icon: "Sparkles",
    badge: "Next-Gen",
    startingPrice: "Custom Quotation",
    priceNote: "Calculated based on training dataset, model API usage, and custom UI requirements",
    overview: "We deploy AI as a controlled, verifiable business multiplier—not a novelty. From reading incoming scanned receipts to training private AI chatbots on your company documentation, our AI solutions save real time.",
    features: [
      { name: "Internal Knowledge Assistant", desc: "Private AI assistant trained on your standard operating procedures, manuals, and policies." },
      { name: "Automated OCR & Data Extraction", desc: "Extract structured data from scanned invoices, receipts, and identity documents." },
      { name: "24/7 Smart Customer Chatbot", desc: "Context-aware conversational agents that answer customer queries and book appointments." },
      { name: "Human-in-the-Loop Safeguards", desc: "Review interfaces ensuring critical AI-generated outputs are approved by human staff before execution." }
    ],
    deliverables: [
      "Custom AI model prompt architecture & RAG vector pipeline",
      "Web interface or WhatsApp integration for staff/customers",
      "Data privacy protections ensuring company data remains private",
      "Logging and token usage monitoring dashboard"
    ],
    timeline: "2 - 6 Weeks",
    faqs: [
      { q: "Is our proprietary company data kept secure?", a: "Yes. We configure private enterprise API instances where your data is never used to train public models." }
    ]
  },
  {
    id: "accounting",
    slug: "accounting",
    title: "Accounting & Financial Systems",
    subtitle: "Robust Financial Recordkeeping & Accounting Software Setup",
    category: "Finance & Compliance",
    shortDesc: "Professional accounting setup, chart of accounts design, financial statement preparation, and management reporting for small and growing enterprises.",
    icon: "Calculator",
    badge: "Professional",
    startingPrice: "Custom Scope",
    priceNote: "Tailored to transaction volume and monthly reporting requirements",
    overview: "Accurate financial records are essential for sound business decisions, bank facilities, and regulatory peace of mind. We combine technology with financial expertise to give you absolute control over your numbers.",
    features: [
      { name: "Accounting Software Implementation", desc: "Setup and configuration of QuickBooks, Xero, or custom SMART ERP accounting modules." },
      { name: "Financial Statement Preparation", desc: "Preparation of balance sheets, profit & loss statements, and cash flow forecasts." },
      { name: "Chart of Accounts Structuring", desc: "Logical categorization of assets, liabilities, revenue streams, and operational expenses." },
      { name: "Management Reporting", desc: "Monthly executive summaries, departmental cost center analysis, and gross margin tracking." }
    ],
    deliverables: [
      "Properly configured digital accounting database",
      "Opening balance reconciliations",
      "Standardised invoicing and receipt templates",
      "Monthly / quarterly management financial pack"
    ],
    timeline: "Ongoing or 1 - 2 Weeks setup",
    faqs: [
      { q: "Can you help migrate from manual paper books to software?", a: "Yes, our team handles data entry, historical balance catch-up, and staff training to ensure a smooth transition." }
    ]
  },
  {
    id: "tax",
    slug: "tax",
    title: "Tax Planning & Compliance Support",
    subtitle: "Accurate Tax Computations, Schedules & Statutory Returns",
    category: "Finance & Compliance",
    shortDesc: "End-to-end assistance with TIN registration, Corporate Income Tax, Individual Income Tax, VAT, SSCL, and WHT/AIT filings.",
    icon: "FileCheck",
    badge: "Compliance",
    startingPrice: "Consultation-based",
    priceNote: "Based on business entity type and filing frequency",
    overview: "Stay 100% compliant with Inland Revenue regulations without stress. We assist in calculating your accurate tax liabilities, preparing statutory schedules, and submitting returns on time.",
    features: [
      { name: "TIN Registration & Profile Updates", desc: "Assistance with IRD taxpayer identification registration and portal access setup." },
      { name: "Corporate & Individual Income Tax", desc: "Preparation of annual tax computations, return forms, and allowable deduction schedules." },
      { name: "VAT & SSCL Return Support", desc: "Periodic VAT calculations, input tax schedules, and quarterly return submissions." },
      { name: "WHT & Advance Income Tax (AIT)", desc: "Withholding tax certificates verification, deduction schedules, and compliance monitoring." }
    ],
    deliverables: [
      "Tax liability computation workpapers",
      "Completed statutory return forms ready for submission",
      "Payment slip generation and installment reminders",
      "Tax correspondence and query response assistance"
    ],
    timeline: "Milestone based on IRD deadlines",
    faqs: [
      { q: "Do you handle both individual and corporate tax filings?", a: "Yes, we support sole proprietors, partnerships, and private limited companies." }
    ]
  },
  {
    id: "audit",
    slug: "audit",
    title: "Audit & Assurance Support",
    subtitle: "Internal Audit, External Audit Coordination & Assurance",
    category: "Finance & Compliance",
    shortDesc: "Internal control evaluations, audit schedule preparation, society audits, and liaison with independent external audit firms.",
    icon: "ShieldCheck",
    badge: "Assurance",
    startingPrice: "Engagement-based",
    priceNote: "Scoped based on organizational size and audit mandate",
    overview: "Ensure your financial records stand up to the closest scrutiny. We help organizations strengthen internal controls, identify operational leakage, and prepare complete audit files for independent auditors.",
    features: [
      { name: "External Audit File Preparation", desc: "Preparation of lead schedules, bank confirmations, fixed asset registers, and inventory reconciliations." },
      { name: "Internal Control Review", desc: "Evaluation of cash handling, procurement procedures, and stock management for fraud prevention." },
      { name: "Society & Club Audits", desc: "Specialized financial examination and certification for welfare societies, alumni, and associations." },
      { name: "Visa & Financial Standing Reports", desc: "Compilation of net worth statements and verified business financial summaries for official purposes." }
    ],
    deliverables: [
      "Organized audit working papers and documentation file",
      "Internal audit findings and recommendation report",
      "Auditor query resolution liaison",
      "Final signed/verified audit pack coordination"
    ],
    timeline: "2 - 4 Weeks per audit cycle",
    faqs: [
      { q: "How do you assist with external audits?", a: "We prepare all underlying supporting schedules, reconciliations, and trial balances so the external audit completes smoothly without delays or discrepancies." }
    ]
  }
];

