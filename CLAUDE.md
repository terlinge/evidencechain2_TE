# CLAUDE.md — EvidenceChain

## Project Overview

EvidenceChain is an AI-powered systematic review platform for extracting clinical trial data to support Network Meta-Analysis (NMA). It automates extraction of arm-level and contrast-level outcome data from research PDFs while maintaining PICOTS (Population, Interventions, Comparators, Outcomes, Timing, Setting) consistency.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite 5, Chakra UI 2 |
| Backend | Node.js (ES modules) + Express 4 |
| Database | File-based JSON (`server/data/`) — not MongoDB |
| AI/LLM | OpenAI GPT-4o via `openai` SDK |
| PDF Processing | pdfjs-dist (JS), pdfplumber (Python) |
| HTTP Client | Axios with auth interceptor |
| State Mgmt | React useState/useEffect (no Redux) |
| Package Manager | npm (monorepo: root + client + server) |

## Quick Commands

```bash
# Install all dependencies (root + client + server)
npm run install:all

# Start dev (frontend on :5173, backend on :3000, concurrent)
npm run dev

# Frontend only
cd client && npm run dev

# Backend only
cd server && npm run dev

# Build both
npm run build

# Client build (includes tsc type-check)
cd client && npm run build

# Lint frontend
cd client && npm run lint
```

**No automated test suite exists yet.** Both `client` and `server` `test` scripts are placeholders.

## Repository Structure

```
/
├── client/                         # React frontend
│   ├── src/
│   │   ├── App.tsx                 # React Router routes
│   │   ├── main.tsx                # Entry point (Chakra provider)
│   │   ├── api/                    # Axios API modules
│   │   │   ├── api.ts              # Axios instance + auth interceptor
│   │   │   ├── projects.ts         # Project CRUD
│   │   │   ├── studies.ts          # Study CRUD
│   │   │   ├── aiExtraction.ts     # Upload & extraction
│   │   │   ├── extractions.ts      # Refinement APIs
│   │   │   └── metadata.ts         # Metadata extraction
│   │   ├── pages/
│   │   │   ├── Layout.tsx          # Shell layout with Navbar
│   │   │   ├── ProjectList.tsx     # Project listing
│   │   │   ├── ProjectDetail.tsx   # Project + study management
│   │   │   ├── NewProject.tsx      # Multi-step project wizard
│   │   │   └── DataExtraction.tsx  # Main extraction workflow UI
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   └── extraction/
│   │   │       ├── ExpandedSingleArmTable.tsx
│   │   │       └── ExpandedComparativeTable.tsx
│   │   ├── types/
│   │   │   ├── extraction.ts       # SOURCE OF TRUTH for data schemas
│   │   │   └── project.ts          # Project, Study, PICOTS types
│   │   └── utils/
│   │       ├── exportCSV.ts        # CSV export for NMA
│   │       └── qaValidation.ts     # Client-side QA checks
│   ├── tsconfig.json               # Strict mode, ES2020, react-jsx
│   └── vite.config.ts              # Port 5173, proxy /api → :3000
│
├── server/                         # Express backend
│   ├── src/
│   │   ├── index.js                # Express app + all route handlers
│   │   ├── db/
│   │   │   └── fileDB.js           # JSON file-based database class
│   │   ├── services/
│   │   │   ├── aiExtractionService.js  # GPT-4o extraction pipeline
│   │   │   └── extractionValidation.js # Auto-calculation & validation
│   │   └── scripts/
│   │       └── extract_tables.py   # Python PDF table extraction
│   ├── data/                       # JSON database files (gitignored)
│   ├── uploads/                    # Uploaded PDFs (gitignored)
│   └── nodemon.json                # Watches src/, ignores data/uploads
│
├── package.json                    # Root: concurrently runs client+server
├── PROJECT_SPEC.md                 # Full project specification
├── AI_SETUP.md                     # OpenAI API configuration
├── DEPLOYMENT_GUIDE.md             # Local deployment instructions
├── ERROR_HANDLING.md               # Error patterns & recovery
├── EXTRACTION_FLOW_TEST.md         # E2E test procedures
├── PICOTS_VALIDATION.md            # PICOTS matching logic
├── QA_TESTING_GUIDE.md             # Manual QA scenarios
├── SCHEMA_EXTENSION_GUIDE.md       # Adding extraction fields
└── .github/copilot-instructions.md # Architecture constraints
```

## Architecture

### Client Routes

```
/projects                                        → ProjectList
/projects/new                                    → NewProject
/projects/:projectId                             → ProjectDetail
/projects/:projectId/studies/:studyId/extract    → DataExtraction
/projects/:projectId/studies/:studyId/extract/:extractionId → DataExtraction
```

### API Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET/POST/PATCH/DELETE | `/projects[/:id]` | Project CRUD |
| GET/POST/PATCH/DELETE | `/projects/:pid/studies[/:sid]` | Study CRUD |
| POST | `/extract-metadata` | Extract metadata from uploaded file |
| POST | `/projects/:pid/studies/:sid/extract-ai` | Start AI extraction (async) |
| GET | `/projects/:pid/studies/:sid/extractions` | List extractions for study |
| GET | `/projects/:pid/extractions/:eid/ai-results` | Poll extraction results |
| PATCH | `/projects/:pid/extractions/:eid` | Update extraction data |
| POST | `/projects/:pid/extractions/:eid/submit` | Mark extraction reviewed |
| POST | `/projects/:pid/extractions/:eid/refine` | Run validation/auto-calc |

### AI Extraction Pipeline (7 stages)

1. **Document Upload** — file validation (PDF/Word/text, max 50MB via multer)
2. **Document Analysis** — detect native vs scanned PDF
3. **Text Extraction** — pdfjs-dist for text content
4. **Table Detection** — Python pdfplumber via child_process
5. **AI/LLM Processing** — GPT-4o with chunked prompting (30KB chunks)
6. **Cross-Validation** — `extractionValidation.js` auto-calculates TE/seTE, validates consistency
7. **Human Review** — inline editing UI with QA validation

### Async Processing Pattern

The extraction endpoint returns an `extractionId` immediately. The client polls `/ai-results` until `status === 'completed'` (120s timeout). Background processing updates the FileDB record.

### Database (FileDB)

File-based JSON storage in `server/data/`. Three collections:
- `projects.json` — projects with PICOTS criteria, team, stats
- `studies.json` — studies with screening status, documents
- `extractions.json` — extraction results with singleArmData/comparativeData arrays

Records auto-generate `_id`, `createdAt`, `updatedAt` timestamps.

## Critical Constraints

### DO NOT modify the extraction data schema

The 23-field single-arm and 22-field comparative structures in `client/src/types/extraction.ts` power `netmeta` R package imports. Changes break the entire NMA analysis pipeline.

**Single-arm fields**: study, treatment, measureName, timePoint, n, event, time, mean, sd, te, seTE, notes, calculationNotes, condition, age, severity, conditionGenotype, comorbidities, treatmentExperience, monoAdjunct, page, table, ref, sensitivity, exclude, reviewed

**Comparative fields**: study, treatment1, treatment2, measureName, timePoint, n1, n2, te, seTE, notes, calculationNotes, (same PICOTS + source + quality fields)

### PICOTS is optional

PICOTS criteria are optional at the project level. Never make features require PICOTS to be set. When present, they enable validation, auto-population, and batch matching.

### Source tracking fields are required

Every extraction record must include `page`, `table`, and `ref` for reproducibility and audit trails.

## Coding Conventions

### TypeScript (Frontend)
- **Strict mode** enabled — no implicit `any`
- Prefer `interface` over `type` for data structures
- Use optional chaining: `project?.picots?.conditionName`
- Factory functions for empty records: `getEmptySingleArmExtraction()`
- `noUnusedLocals` and `noUnusedParameters` enforced

### JavaScript (Backend)
- **ES modules** throughout (`import`/`export`, `"type": "module"`)
- All routes defined in `server/src/index.js` (single file, no separate route files)
- Console logging with emoji prefixes for status messages
- Express error handling middleware at bottom of index.js

### General
- No Redux — React local state + Axios for API calls
- Chakra UI `useToast()` for all user-facing notifications
- File uploads handled by multer (disk storage, `server/uploads/`)
- Vite proxies `/api` requests to Express backend in development

## Environment Variables

Required in `server/.env`:
```
OPENAI_API_KEY=sk-...       # Required for AI extraction
PORT=3000                   # Optional, defaults to 3000
NODE_ENV=development        # Optional
```

## Adding New Features — Checklist

### Adding a new extraction field (avoid if possible)
1. Update interfaces in `client/src/types/extraction.ts`
2. Update factory functions (`getEmptySingleArmExtraction` / `getEmptyComparativeExtraction`)
3. Update table components in `client/src/components/extraction/`
4. Update AI prompt in `server/src/services/aiExtractionService.js`
5. Update CSV export in `client/src/utils/exportCSV.ts`
6. Update validation in `server/src/services/extractionValidation.js`

### Adding a new API endpoint
1. Add route handler in `server/src/index.js`
2. Add corresponding API function in `client/src/api/`
3. Wire into page component

### Adding a new page
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add navigation link in `client/src/components/Navbar.tsx`

## Known Limitations

- No automated tests (scripts are placeholders)
- No authentication implemented (hardcoded `user-1` owner)
- Backend routes are all in a single file (`index.js`)
- File-based database — not suitable for concurrent multi-user production use
- Deployment guide references MongoDB but the app uses FileDB
- Python (pdfplumber) required for table extraction from PDFs
