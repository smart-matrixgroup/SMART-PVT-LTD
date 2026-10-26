// Projects delivered by SMART Pvt Ltd.
// Includes real client projects and capability showcase projects.
export const projectCategories = [
  "All",
  "Websites",
  "Education Platforms",
  "ERP & POS",
  "Mobile Apps",
  "Automation",
  "Business Software",
  "AI Solutions"
];

export const projects = [
  // ── REAL CLIENT PROJECTS ──────────────────────────────────────────
  {
    id: "mehala-portfolio",
    slug: "mehala-portfolio-website",
    name: "Mehala — Individual Portfolio Website",
    category: "Websites",
    clientType: "Individual Professional Profile",
    status: "Live & Deployed",
    liveUrl: "https://www.mehala.me/",
    techStack: ["React", "Vite", "Tailwind CSS", "Firebase Hosting", "Custom Domain"],
    tagline: "A premium personal portfolio showcasing business development and operations expertise.",
    challenge: "The client needed a professional digital presence to showcase their business development experience, operations expertise, and career milestones to potential employers and collaborators worldwide.",
    solution: "Designed and developed a modern, fast-loading portfolio website with a clean layout highlighting professional experience, skills, education, and contact information. Built with responsive design for perfect display on all devices.",
    results: [
      "Live at mehala.me with custom domain",
      "Fast loading speed with optimized performance",
      "Professional digital presence for career growth",
      "Fully responsive across all devices"
    ],
    modules: ["Hero Section", "About & Experience", "Skills Showcase", "Education Timeline", "Contact Form", "Responsive Design"]
  },
  {
    id: "uncampus-academy",
    slug: "uncampus-academy-education-website",
    name: "UN Campus Academy — Education Platform",
    category: "Education Platforms",
    clientType: "Educational Institution",
    status: "Live & Deployed",
    liveUrl: "https://uncampusacademy.com/",
    techStack: ["WordPress", "Elementor", "LearnPress LMS", "Custom Theme", "Firebase"],
    tagline: "A full-featured online education platform offering courses for students across Sri Lanka.",
    challenge: "The institution needed a professional online platform to deliver courses, manage student enrollments, and provide a seamless learning experience for students across multiple campuses in Sri Lanka.",
    solution: "Built a comprehensive education website with course management, student registration, interactive learning modules, and a modern responsive design. Integrated LMS functionality for course delivery and student progress tracking.",
    results: [
      "Live at uncampusacademy.com with full course management",
      "Online course delivery for multiple campuses",
      "Student enrollment and progress tracking system",
      "Modern, mobile-friendly design for students"
    ],
    modules: ["Course Management", "Student Registration", "LearnPress LMS", "Course Categories", "Testimonials", "Responsive Design", "Contact & Support"]
  },

  {
    id: "scbc-matrix",
    slug: "scbc-business-consultants-website",
    name: "SCBC — Business Consultants Corporate Website",
    category: "Websites",
    clientType: "Corporate Business Consultancy",
    status: "Live & Deployed",
    liveUrl: "https://scbcmatrix.com/",
    techStack: ["React", "Vite", "Tailwind CSS", "Firebase Hosting", "Custom Domain"],
    tagline: "A professional corporate website for S&C Business Consultants showcasing their consultancy services and expertise.",
    challenge: "The consultancy firm needed a modern, credible online presence to attract corporate clients, showcase their service offerings, and establish trust as a professional business consulting partner.",
    solution: "Designed and developed a clean, professional business profile website with dedicated sections for services, about the company, and contact information. Built with responsive design and fast loading performance to make a strong first impression on potential corporate clients.",
    results: [
      "Live at scbcmatrix.com with custom domain",
      "Professional corporate digital presence",
      "Fast loading speed optimized for client engagement",
      "Fully responsive across all devices"
    ],
    modules: ["Hero Section", "Services Overview", "About Company", "Contact Form", "Responsive Design"]
  },

  // ── CAPABILITY SHOWCASE PROJECTS ──────────────────────────────────
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
