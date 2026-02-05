# EvidenceChain - Project Specification

## Executive Summary

**EvidenceChain** is an AI-powered systematic review platform designed to automate the extraction of clinical trial data from research documents to support Network Meta-Analysis (NMA). The platform combines OCR, natural language processing, and large language models to extract arm-level and contrast-level outcome data while maintaining PICOTS (Population, Interventions, Comparators, Outcomes, Timing, Setting) consistency.

**Primary Users**: Clinical researchers, systematic review teams, meta-analysis specialists, health technology assessment (HTA) agencies

**Core Value Proposition**: Reduce manual data extraction time from weeks to hours while maintaining research quality and reproducibility standards required for peer-reviewed publications.

---

## 1. Problem Statement

### Current Challenges in Systematic Reviews

1. **Time-Intensive Manual Extraction**: Researchers spend 40-80 hours per systematic review manually extracting data from tables, figures, and supplementary materials across dozens of studies.

2. **Human Error**: Manual transcription introduces calculation errors, missing data points, and inconsistent PICOTS classification across team members.

3. **Reproducibility Crisis**: Lack of standardized extraction formats and inadequate source tracking makes it difficult to verify and reproduce meta-analysis results.

4. **Complex Statistical Calculations**: Converting between different effect measures (odds ratios, risk ratios, hazard ratios) and calculating standard errors from confidence intervals requires statistical expertise.

5. **Multi-Document Navigation**: Clinical trials scatter data across main publications, supplementary appendices, protocols, and trial registries.

### EvidenceChain Solution

- **AI-Powered Extraction**: GPT-4/Claude models trained on clinical trial reporting standards automatically identify and extract outcome data
- **Source Tracking**: Every data point links back to page number, table ID, and reference for full transparency
- **Built-in Calculations**: Automatic derivation of standard errors, treatment effects, and variance measures
- **PICOTS Validation**: AI checks extracted data against project inclusion criteria with mismatch warnings
- **R/Stata Export**: One-click export to `netmeta` R package format for immediate analysis

---

## 2. Core Features

### 2.1 Project Management

**Purpose**: Organize systematic reviews with team collaboration and progress tracking

**Features**:
- **Project Creation Wizard**: 3-step setup (basic info → PICOTS criteria → team invitation)
- **PICOTS Definition**: Optional but powerful - define population, interventions, comparators, outcomes, timing, and setting criteria
- **Template Library**: Pre-built PICOTS templates (e.g., ATTR Amyloidosis, Type 2 Diabetes, Psoriasis)
- **Team Roles**: Owner (full access) → Editor (extract/edit) → Viewer (read-only)
- **Dashboard**: Project statistics, extraction progress, quality metrics

**User Story**:
> "As a principal investigator, I want to create a new systematic review project with predefined PICOTS criteria so my team extracts consistent data across all studies."

### 2.2 Study Screening & Management

**Purpose**: Track studies from identification through data extraction

**Features**:
- **Study Registry**: Add studies with metadata (title, authors, DOI, NCT number, year)
- **Screening Workflow**: Mark studies as included/excluded/pending with reasons
- **Study Linking**: Associate multiple documents (main publication, supplement, protocol) with single study
- **Search Integration**: Import from PubMed, Cochrane, ClinicalTrials.gov (future)

**User Story**:
> "As a research assistant, I want to link supplementary appendices to their main study publication so the AI can extract data from all relevant sources."

### 2.3 AI-Powered Document Extraction (CORE FEATURE)

**Purpose**: Automatically extract clinical trial outcome data using multi-stage AI pipeline

#### 7-Stage Extraction Pipeline

1. **Document Upload** (Max 50MB PDF/Word/TXT)
   - File validation and virus scanning
   - Multi-file batch upload support
   
2. **Document Analysis**
   - Detect native vs. scanned PDF
   - Identify document type (main publication, supplement, protocol)
   
3. **Text Extraction**
   - **Native PDFs**: PyMuPDF/pdfplumber for accurate text + layout
   - **Scanned PDFs**: Tesseract OCR or Google Cloud Vision API
   - **Word Documents**: python-docx parser
   
4. **Table Detection**
   - Camelot/Tabula for structured data extraction
   - Maintain row/column relationships
   - Extract table captions and footnotes
   
5. **AI/LLM Processing**
   - GPT-4/Claude Sonnet 4.5 with clinical trial domain prompts
   - Extract to standardized schema (23 fields for single-arm, 22 for comparative)
   - Calculate derived statistics (SE from CI, log transformations)
   - PICOTS relevance checking
   
6. **Cross-Validation**
   - Compare OCR vs. PDF text vs. table extraction
   - Flag discrepancies for human review
   - Confidence scoring (0-1) per field
   
7. **Human Review**
   - Accept/reject/edit AI suggestions
   - Add manual notes and calculation explanations
   - Mark as sensitivity analysis or exclude from main analysis

**Extracted Data Types**:

**Single-Arm Data** (23 fields):
```
Study metadata: study name, treatment arm, measure name, time point
Sample size: n (number of participants)
Event data: event count (for binary outcomes)
Time-to-event: time, event (for survival outcomes)
Continuous: mean, standard deviation
Effect estimates: treatment effect (te), standard error (seTE)
Source tracking: page number, table ID, reference
PICOTS: condition, age, severity, genotype, comorbidities, treatment experience, mono/adjunct therapy
Quality flags: sensitivity analysis, exclude, reviewed status
Notes: free text, calculation notes
```

**Comparative Data** (22 fields):
```
Study metadata: study name, treatment 1, treatment 2, measure name, time point
Sample sizes: n1, n2
Effect estimates: treatment effect (te), standard error (seTE)
[Same PICOTS, source tracking, quality flags, notes as above]
```

**User Story**:
> "As a systematic reviewer, I want to upload a 50-page clinical trial PDF and have the AI extract all efficacy outcomes with their standard errors so I don't have to manually transcribe tables."

#### AI Confidence Scoring

- **Overall confidence**: 0-1 score for entire extraction
- **Field-level confidence**: Individual scores for each data point
- **Warning system**: Flags for PICOTS mismatches, missing data, calculation uncertainties

### 2.4 Data Review & Editing

**Purpose**: Validate AI extractions with full manual override capabilities

**Features**:
- **Side-by-side View**: Original document PDF + extracted data tables
- **Inline Editing**: Click any cell to edit with auto-save
- **Bulk Operations**: Copy rows, batch update PICOTS fields, apply formulas
- **Validation Rules**: Prevent impossible values (negative SE, n > study total)
- **Audit Trail**: Track all changes with user/timestamp (future)
- **Conflict Resolution**: Compare extractions from multiple reviewers (future)

**User Story**:
> "As a senior researcher, I want to review AI-extracted data and correct any errors while maintaining a record of what was changed and why."

### 2.5 PICOTS Validation

**Purpose**: Ensure extracted data matches systematic review inclusion criteria

**Features**:
- **Auto-population**: Pre-fill PICOTS fields (condition, age, severity) from project defaults
- **Mismatch Detection**: AI warns when extracted study characteristics don't match project PICOTS
- **Relevance Scoring**: 0-100% match score with detailed mismatch explanations
- **Override Capability**: Mark as relevant despite mismatch with justification

**Example**:
```
Project PICOTS: Adults (≥18 years) with moderate-to-severe psoriasis
Extracted Study: Pediatric population (12-17 years)
Warning: "Age mismatch detected. Study may not meet inclusion criteria."
```

### 2.6 Export & Integration

**Purpose**: Seamless handoff to statistical analysis software

**Export Formats**:
- **netmeta (R)**: Direct CSV export compatible with `netmeta` package
- **Stata**: `.dta` format with labeled variables
- **RevMan**: Cochrane Review Manager XML format (future)
- **Excel**: Human-readable spreadsheet with formulas
- **JSON**: Programmatic API access

**Export Contents**:
- All extracted data with confidence scores
- PICOTS classifications
- Source tracking metadata
- Quality flags and notes
- Network diagram data (treatment nodes + edges)

---

## 3. User Roles & Permissions

| Role | Create Projects | Edit PICOTS | Extract Data | Review/Edit Extractions | Invite Users | Export Data | Delete |
|------|----------------|-------------|--------------|------------------------|--------------|-------------|--------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | View only | ❌ | ✅ | ❌ |

---

## 4. Technical Architecture

### 4.1 Technology Stack

**Frontend**:
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Library**: Chakra UI 2.8
- **State Management**: React hooks (useState, useEffect) - no Redux
- **Routing**: React Router 6
- **API Client**: Axios
- **Charts**: Recharts (for network diagrams, forest plots)

**Backend**:
- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Validation**: express-validator

**AI/ML Services** (Future Integration):
- **LLM APIs**: OpenAI GPT-4, Anthropic Claude Sonnet 4.5
- **OCR**: Tesseract.js (local) or Google Cloud Vision API
- **PDF Parsing**: PyMuPDF (pymupdf), pdfplumber (Python)
- **Table Extraction**: Camelot, Tabula (Python subprocess calls)

**Deployment**:
- **Frontend**: Vercel / Netlify
- **Backend**: Railway / Render / AWS ECS
- **Database**: MongoDB Atlas (managed)
- **File Storage**: AWS S3 / Cloudflare R2 (future)

### 4.2 Database Schema

**Collections**:

1. **users**
   - `_id`, `email`, `password` (bcrypt), `name`, `role`, `createdAt`

2. **projects**
   - `_id`, `name`, `description`, `owner`, `team[]`, `picots`, `createdAt`
   - `stats`: { totalStudies, totalExtractions, completedExtractions }

3. **studies**
   - `_id`, `projectId`, `title`, `authors[]`, `doi`, `nctNumber`, `year`
   - `screeningStatus`: 'pending' | 'included' | 'excluded'
   - `excludedReason`, `documents[]`

4. **extractions**
   - `_id`, `projectId`, `studyId`, `documentId`, `extractedBy`
   - `singleArmData[]`: Array of 23-field objects
   - `comparativeData[]`: Array of 22-field objects
   - `aiConfidence`: { overall, fieldLevel{} }
   - `warnings[]`, `picotsRelevance`, `status`, `createdAt`, `updatedAt`

5. **documents**
   - `_id`, `studyId`, `fileName`, `fileType`, `fileSize`, `uploadedBy`
   - `storageUrl`, `ocrStatus`, `extractedText`, `tableData[]`

**Indexes**:
- `projects.owner`, `projects.team`
- `studies.projectId`, `studies.screeningStatus`
- `extractions.projectId`, `extractions.studyId`, `extractions.status`

### 4.3 API Endpoints

**Authentication**:
```
POST   /api/auth/register          - Create account
POST   /api/auth/login             - Get JWT token
GET    /api/auth/me                - Current user info
```

**Projects**:
```
GET    /api/projects               - List user's projects
POST   /api/projects               - Create project
GET    /api/projects/:id           - Project details
PATCH  /api/projects/:id           - Update project
DELETE /api/projects/:id           - Delete project
POST   /api/projects/:id/team      - Add team member
```

**Studies**:
```
GET    /api/projects/:id/studies           - List studies
POST   /api/projects/:id/studies           - Add study
PATCH  /api/projects/:id/studies/:studyId - Update study
DELETE /api/projects/:id/studies/:studyId - Delete study
```

**Extractions (Core)**:
```
POST   /api/projects/:id/studies/:studyId/extract-ai
       - Upload document, trigger AI extraction
       - Returns: { extractionId, status: 'processing' }

GET    /api/projects/:id/extractions/:extractionId/ai-results
       - Poll for extraction results
       - Returns: { extraction: {...}, aiConfidence, warnings }

PATCH  /api/projects/:id/extractions/:extractionId
       - Update extracted data after review

POST   /api/projects/:id/extractions/:extractionId/submit
       - Mark extraction as reviewed/complete

GET    /api/projects/:id/extractions/:extractionId/export
       - Export to CSV/JSON/Excel
```

**Batch Processing**:
```
POST   /api/projects/:id/batch-extract
       - Upload multiple PDFs
       - Auto-link to studies or prompt for manual linking
```

### 4.4 Data Flow

```
User uploads PDF
     ↓
Document stored in MongoDB/S3
     ↓
Backend triggers extraction pipeline:
  1. PDF → Text (OCR or native parsing)
  2. Table detection → Structured data
  3. Text + Tables → LLM with PICOTS context
  4. LLM returns structured JSON (23/22 fields)
  5. Calculate derived stats (SE, log transforms)
  6. PICOTS validation → warnings
     ↓
Store in MongoDB with confidence scores
     ↓
Frontend polls /ai-results
     ↓
User reviews in UI (accept/edit/reject)
     ↓
Save final version → Mark as reviewed
     ↓
Export to R/Stata for NMA
```

---

## 5. Key Workflows

### 5.1 Create New Project Workflow

1. Click "New Project"
2. **Step 1: Basic Info**
   - Enter project name, description
   - Select systematic review type (NMA, pairwise MA, scoping review)
3. **Step 2: Define PICOTS** (optional)
   - Use template or create custom
   - Add eligible interventions list
   - Define primary/secondary outcomes
4. **Step 3: Team Setup**
   - Invite collaborators by email
   - Assign roles (Owner/Editor/Viewer)
5. Project dashboard created with empty studies list

### 5.2 Extract Data from Study Workflow

1. Navigate to project → Studies tab
2. Click "Add Study" → Enter metadata (title, DOI, NCT#)
3. Click "Upload Document" on study row
4. **Upload Phase**:
   - Drag-drop PDF or select file
   - Progress bar shows upload %
5. **AI Extraction Phase** (30-90 seconds):
   - "Analyzing document..." spinner
   - Real-time status: "Extracting text..." → "Detecting tables..." → "AI processing..."
6. **Review Phase**:
   - Split view: PDF (left) + Data tables (right)
   - Green highlights = high confidence (>0.9)
   - Yellow highlights = medium confidence (0.7-0.9)
   - Red highlights = low confidence (<0.7) or PICOTS mismatch
7. **Edit & Accept**:
   - Click any cell to edit
   - Click "Add Row" for missing data
   - Review warnings panel
   - Click "Accept & Save"
8. Extraction marked as "Reviewed" in project dashboard

### 5.3 Batch Extraction Workflow (Future)

1. Project dashboard → "Batch Upload"
2. Select multiple PDFs (up to 20)
3. **Auto-Linking Phase**:
   - AI analyzes filenames + first pages
   - Suggests links: "Smith_2023_main.pdf" → "Smith et al. 2023"
   - User confirms or manually reassigns
4. **Queue Processing**:
   - Extractions run sequentially
   - Email notification when batch complete
5. Review individual extractions as normal

---

## 6. Non-Functional Requirements

### 6.1 Performance

- **Upload**: <5s for 50MB PDF
- **AI Extraction**: 30-90s per document (depends on LLM API latency)
- **Page Load**: <2s initial load, <500ms navigation
- **Concurrent Users**: Support 50 simultaneous extractions
- **Database**: <100ms query response for dashboards

### 6.2 Security

- **Authentication**: JWT tokens, 24-hour expiry, refresh token flow
- **Authorization**: Row-level security - users only see their projects + invited projects
- **File Security**: Virus scanning on upload, private S3 buckets
- **API Rate Limiting**: 100 requests/minute per user
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **HIPAA Compliance**: De-identified data only, no PHI stored

### 6.3 Reliability

- **Uptime**: 99.5% SLA (monthly)
- **Backup**: Daily MongoDB snapshots, 30-day retention
- **Error Handling**: Graceful degradation - if AI fails, allow manual entry
- **Monitoring**: Sentry for error tracking, DataDog for performance

### 6.4 Scalability

- **Current Capacity**: 100 projects, 1000 studies, 5000 extractions
- **Growth Plan**: Horizontal scaling via load balancers, MongoDB sharding
- **File Storage**: Offload to S3 when >10GB total uploads

### 6.5 Usability

- **Learning Curve**: <30 minutes to complete first extraction
- **Mobile Support**: Responsive design, tablet-friendly (mobile view-only)
- **Accessibility**: WCAG 2.1 AA compliance (keyboard nav, screen readers)
- **Internationalization**: English (v1), Spanish/French/Chinese (future)

---

## 7. Data Structure Constraints (CRITICAL)

### 7.1 Immutable Schema

**The extraction data structure is the foundation of NMA compatibility and MUST NOT be modified without extreme caution.**

Any changes break:
- R `netmeta` package imports
- Stata `.dta` format compatibility
- Existing user projects and exports
- Statistical analysis pipelines

### 7.2 Single-Arm Extraction (23 Fields - LOCKED)

```typescript
interface SingleArmExtraction {
  // IDs
  id: string;                    // Unique row ID
  study: string;                 // Study name/identifier
  treatment: string;             // Intervention name
  measureName: string;           // Outcome measure
  timePoint: string;             // Follow-up duration
  
  // Sample data
  n: number;                     // Sample size
  event?: number;                // Event count (binary outcomes)
  time?: number;                 // Time (survival outcomes)
  mean?: number;                 // Mean (continuous outcomes)
  sd?: number;                   // Standard deviation
  te?: number;                   // Treatment effect
  seTE?: number;                 // Standard error of TE
  
  // Source tracking (reproducibility)
  page: string;                  // Page number in document
  table: string;                 // Table/figure ID
  ref: string;                   // Reference citation
  
  // PICOTS classification
  condition: string;             // Disease/condition
  age: string;                   // Age group
  severity: string;              // Disease severity
  conditionGenotype: string;     // Genetic subtype
  comorbidities: string;         // Comorbid conditions
  treatmentExperience: string;   // Treatment-naive/experienced
  monoAdjunct: string;           // Monotherapy/adjunct
  
  // Quality control
  sensitivity: boolean;          // Include in sensitivity analysis
  exclude: boolean;              // Exclude from main analysis
  reviewed: boolean;             // Human reviewer approved
  
  // Notes
  notes: string;                 // General notes
  calculationNotes: string;      // How derived stats calculated
}
```

### 7.3 Comparative Extraction (22 Fields - LOCKED)

Same structure but for head-to-head comparisons:
- `treatment1`, `treatment2` (instead of single treatment)
- `n1`, `n2` (sample sizes for both arms)
- `te`, `seTE` (comparative effect estimates)
- No `event`, `time`, `mean`, `sd` (derived into te/seTE)

### 7.4 Adding New Fields (Emergency Only)

If absolutely necessary:
1. Add as **optional field** at end of interface
2. Update `getEmptySingleArmExtraction()` factory function
3. Update all form components (SingleArmForm, ComparativeForm)
4. Update backend MongoDB schema
5. Update R/Stata export formatters
6. Migrate existing projects with default values
7. Document in `SCHEMA_EXTENSION_GUIDE.md`

---

## 8. Future Enhancements (Roadmap)

### Phase 2 (6-12 months)
- [ ] **Real-time Collaboration**: WebSocket-based concurrent editing
- [ ] **Active Learning**: AI learns from user corrections to improve accuracy
- [ ] **Automated Deduplication**: Detect identical studies across databases
- [ ] **Advanced Statistics**: Bayesian NMA, meta-regression, subgroup analysis
- [ ] **Integration APIs**: Direct import from Covidence, DistillerSR, Rayyan

### Phase 3 (12-24 months)
- [ ] **Multi-language Support**: Extract from Spanish, French, Chinese, German papers
- [ ] **Figure Extraction**: OCR survival curves, forest plots → digitize data points
- [ ] **Risk of Bias Assessment**: Automated Cochrane RoB 2.0 scoring
- [ ] **GRADE Evidence Profiles**: Auto-generate Summary of Findings tables
- [ ] **Publication**: Direct manuscript generation with APA/PRISMA formatting

### Phase 4 (Research Features)
- [ ] **Living Systematic Reviews**: Continuous monitoring + auto-update as new RCTs published
- [ ] **Individual Patient Data (IPD)**: Secure multi-party computation for IPD-NMA
- [ ] **Causal Inference**: Propensity score matching for observational studies
- [ ] **AI Peer Review**: Detect reporting biases, inconsistencies, statistical errors

---

## 9. Success Metrics

### User Adoption
- **Target**: 100 active projects in Year 1
- **Measure**: Weekly active users, projects created per month

### Efficiency Gains
- **Target**: 70% time reduction vs. manual extraction
- **Measure**: Hours saved per systematic review (survey)

### Quality & Accuracy
- **Target**: 95% agreement with expert manual extraction
- **Measure**: Inter-rater reliability (Cohen's kappa) on validation set

### Publications
- **Target**: 10 peer-reviewed papers using EvidenceChain in Year 1
- **Measure**: User-reported publications, citations in PROSPERO

---

## 10. Competitive Landscape

### Direct Competitors
- **Covidence**: Screening + full-text review (no AI extraction)
- **DistillerSR**: Customizable forms (manual entry only)
- **Rayyan**: Abstract screening (no data extraction)

### EvidenceChain Differentiators
1. **Only platform with AI extraction** to 23/22-field NMA-ready schema
2. **Built-in statistical calculations** (SE derivation, log transforms)
3. **Direct R/Stata export** - no manual reformatting
4. **PICOTS validation** ensures consistency across reviewers
5. **Open development roadmap** - community-driven features

---

## 11. Technical Debt & Known Limitations

### Current Implementation Gaps
- **Backend incomplete**: Frontend fully functional with mocks, API routes pending
- **No real AI integration**: Mock extraction results for development
- **No file storage**: Local filesystem only, needs S3 migration
- **No user authentication**: JWT structure defined but not enforced
- **No tests**: Unit/integration testing infrastructure missing

### Architectural Decisions to Revisit
- **MongoDB schema**: May need relational DB (PostgreSQL) for complex queries
- **Synchronous extraction**: Should use job queue (Bull/BullMQ) for >10 concurrent uploads
- **Monolithic backend**: Consider microservices (extraction service, API gateway)
- **Client-side state**: May need Redux/Zustand as app complexity grows

---

## 12. Glossary

- **NMA (Network Meta-Analysis)**: Statistical method comparing 3+ treatments using direct + indirect evidence
- **PICOTS**: Population, Interventions, Comparators, Outcomes, Timing, Setting - systematic review eligibility criteria
- **Arm-level data**: Outcomes for individual treatment groups within a study
- **Contrast-level data**: Head-to-head comparisons between two treatments
- **Effect measures**: Odds ratio (OR), risk ratio (RR), hazard ratio (HR), mean difference (MD)
- **Standard error (SE)**: Measure of uncertainty around effect estimate
- **netmeta**: R package for network meta-analysis (Rücker et al.)
- **PRISMA**: Preferred Reporting Items for Systematic Reviews and Meta-Analyses
- **Cochrane**: Global organization producing high-quality systematic reviews

---

## 13. References & Standards

- **Cochrane Handbook**: https://training.cochrane.org/handbook
- **PRISMA 2020**: http://www.prisma-statement.org/
- **netmeta R Package**: https://cran.r-project.org/package=netmeta
- **ClinicalTrials.gov**: https://clinicaltrials.gov/
- **PROSPERO Registry**: https://www.crd.york.ac.uk/prospero/

---

**Document Version**: 1.0  
**Last Updated**: February 4, 2026  
**Maintained By**: EvidenceChain Development Team
