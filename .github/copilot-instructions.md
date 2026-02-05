# EvidenceChain Copilot Instructions

## Project Overview
EvidenceChain is an AI-powered systematic review platform for extracting clinical trial data to support Network Meta-Analysis (NMA). Built with React+TypeScript (Vite) frontend, Node.js+Express backend, MongoDB database, and AI extraction pipeline (OCR + LLM).

**Core Purpose**: Automate extraction of arm-level and contrast-level clinical trial outcome data from research documents while maintaining PICOTS (Population, Interventions, Comparators, Outcomes, Timing, Setting) consistency.

## Critical Architecture Constraints

### Data Structure Non-Negotiables
**NEVER modify the extraction data structure** - NMA analysis depends on this exact schema:

**Single-Arm Data (23 fields)**:
```typescript
// client/src/types/extraction.ts
interface SingleArmExtraction {
  id, study, treatment, measureName, timePoint,
  n, event?, time?, mean?, sd?, te?, seTE?,
  notes, calculationNotes,
  // PICOTS classification
  condition, age, severity, conditionGenotype, comorbidities, treatmentExperience, monoAdjunct,
  // Source tracking
  page, table, ref,
  // Quality flags
  sensitivity, exclude, reviewed
}
```

**Comparative Data (22 fields)**:
```typescript
interface ComparativeExtraction {
  id, study, treatment1, treatment2, measureName, timePoint,
  n1, n2, te, seTE,
  notes, calculationNotes,
  // Same PICOTS + source tracking + quality flags
}
```

These structures power `netmeta` R package imports - changes break the entire analysis pipeline.

### 7-Stage Extraction Pipeline
The extraction workflow is sequential and validated at each stage:

1. **Document Upload** → Validate file (PDF/Word/text, max 50MB)
2. **Document Analysis** → Detect native vs scanned PDF
3. **Text Extraction** → OCR (Tesseract/Vision) OR PDF parsing (PyMuPDF/pdfplumber)
4. **Table Detection** → Camelot/Tabula for structured data
5. **AI/LLM Processing** → GPT-4/Claude extracts to schema + calculates derived stats
6. **Cross-Validation** → Compare OCR/PDF/Table/AI results, flag discrepancies
7. **Human Review** → User accepts/rejects/edits with full provenance

See `EXTRACTION_ARCHITECTURE.md` for implementation details.

## PICOTS Integration Patterns

### Optional but Powerful
PICOTS criteria are **optional** at project level but enable critical features when present:
- **Validation**: AI checks if extracted data matches project PICOTS (warnings if mismatched)
- **Auto-population**: PICOTS fields (condition, age, severity) auto-fill in extraction forms
- **Batch processing**: Link supplementary files to main studies using PICOTS matching

### Key Files
- `client/src/types/picots.ts` - Enhanced PICOTS schema (motivation, population, interventions, outcomes, settings)
- `client/src/components/picots/` - Multi-section PICOTS form components
- `client/src/api/picotsTemplates.ts` - Example: ATTR Amyloidosis template

### Implementation Pattern
```typescript
// In extraction workflow (DataExtraction.tsx)
const projectPICOTS = {
  conditionName: project.picots.conditionName,
  drugs: project.picots.drugs || [],
  // ... pass to AI extraction
};

// AI returns picotsRelevance with warnings if mismatch detected
if (!picotsRelevance.isRelevant) {
  // Display warning to user
}
```

## File Organization Patterns

### Frontend Structure (client/src/)
```
components/
  extraction/        # Core extraction UI
    DocumentUpload.tsx          # File upload + progress + AI trigger
    ExtractionResultsView.tsx   # Review AI results
    SingleArmForm.tsx           # Editable single-arm table
    ComparativeForm.tsx         # Editable comparative table
  picots/            # PICOTS form sections
    EnhancedPICOTSForm.tsx      # Main orchestrator
    PopulationSection.tsx       # P: population criteria
    InterventionsSection.tsx    # I: drug interventions
    OutcomesSection.tsx         # O: efficacy/safety outcomes
pages/
  DataExtraction.tsx            # Main extraction workflow
  ExtractionReview.tsx          # Review/approve extractions
  ProjectDetail.tsx             # Project dashboard
  NewProject.tsx                # 3-step project creation wizard
api/
  aiExtraction.ts               # Upload/extract/update endpoints
  aiExtractionMock.ts           # Mock AI responses (dev mode)
types/
  extraction.ts                 # THE SOURCE OF TRUTH for data structures
  picots.ts                     # PICOTS schema
```

### Backend Structure (documented, not implemented)
```
server/
  routes/
    extractionRoutes.ts         # POST /extract-ai, GET /ai-results
  services/
    aiExtractionService.ts      # Orchestrates 7-stage pipeline
    ocrService.ts               # Tesseract/Vision API
    pdfService.ts               # PyMuPDF/pdfplumber
    tableService.ts             # Camelot/Tabula
    llmService.ts               # OpenAI/Anthropic
  models/
    Extraction.js               # MongoDB schema
    Project.js
    Study.js
```

## Development Conventions

### Mock Data Strategy
**Frontend is fully functional with mocks**. Backend implementation pending.

```typescript
// api/aiExtractionMock.ts - Generates realistic extraction results
export const generateMockExtraction = (fileName, projectPICOTS) => {
  // Creates SingleArmExtraction[] and ComparativeExtraction[]
  // Validates against PICOTS if provided
  // Returns picotsRelevance warnings
};
```

**When adding features**: Update mock first, test UI flow, then implement backend.

### TypeScript Patterns
1. **Strict types everywhere** - No `any` types
2. **Interface over type** - Use `interface` for data structures
3. **Factory functions** - `getEmptySingleArmExtraction()` for new records
4. **Optional chaining** - `project?.picots?.conditionName` throughout

### Component Patterns
```typescript
// Extraction components receive picotDefaults
interface ExtractionFormProps {
  data: SingleArmExtraction[];
  onChange: (data: SingleArmExtraction[]) => void;
  studyName: string;
  picotDefaults: {  // Auto-populated from project PICOTS
    condition: string;
    age: string;
    severity: string;
    // ...
  };
}
```

### State Management
- **No Redux** - React useState/useEffect
- **API calls** - Axios via `api/` modules
- **Toast notifications** - `useToast()` hook for all user feedback
- **Form state** - Local state → API call on save

## Key API Endpoints (Mock → Real)

### Extraction Flow
```typescript
// 1. Upload document
POST /api/projects/:projectId/studies/:studyId/extract-ai
FormData: { document: File }
Returns: { extractionId, status: 'processing' }

// 2. Poll for results (or use WebSocket in future)
GET /api/projects/:projectId/extractions/:extractionId/ai-results
Returns: { 
  extraction: {
    singleArmData: [...],
    comparativeData: [...],
    aiConfidence: { overall: 0.89, ... },
    warnings: [...],
    picotsRelevance?: { isRelevant, matchScore, mismatches }
  }
}

// 3. User edits & saves
PATCH /api/projects/:projectId/extractions/:extractionId
Body: { singleArmData: [...], comparativeData: [...] }

// 4. Submit for review
POST /api/projects/:projectId/extractions/:extractionId/submit
```

See `API.md` for full endpoint documentation.

## Batch Processing & File Linking (Requested Feature)

### Current Implementation
Single study → single document upload workflow

### Enhancement Required
1. **Batch upload UI** - Accept multiple PDFs in `DocumentUpload.tsx`
2. **File classification** - Use filename matching + AI to link supplementary materials to main studies
3. **PICOTS-based matching** - If study name or NCT number in PICOTS, use for linking

```typescript
// Proposed: api/batchExtraction.ts
interface BatchUploadFile {
  file: File;
  studyId?: string;  // Auto-linked or user-assigned
  fileType: 'main' | 'supplementary' | 'protocol';
}

POST /api/projects/:projectId/batch-extract
FormData: { files: File[], linkingStrategy: 'auto' | 'manual' }
Returns: { batchId, extractionIds: [...] }
```

## Common Tasks

### Add a new extraction field
**DON'T** unless absolutely necessary (breaks NMA). If required:
1. Update `types/extraction.ts` interfaces
2. Update `getEmptySingleArmExtraction()` and `getEmptyComparativeExtraction()`
3. Update `SingleArmForm.tsx` / `ComparativeForm.tsx` table columns
4. Update backend schema in `DATABASE.md`
5. Update R export format in `exports.ts`

### Add PICOTS validation logic
1. Modify `api/aiExtractionMock.ts → checkPICOTSRelevance()`
2. Add warning/suggestion to returned `AIExtractionResult`
3. Display in `ExtractionResultsView.tsx` warnings section

### Add a new document type support
1. Update `DocumentUpload.tsx` → `validTypes` array
2. Add backend parser in `services/pdfService.ts` or `ocrService.ts`
3. Update `EXTRACTION_ARCHITECTURE.md` supported formats

## Testing Strategy
- **Frontend**: Component testing with React Testing Library (not yet implemented)
- **Backend**: Jest for services, Supertest for API routes (not yet implemented)
- **Current validation**: Manual testing with mock data + console logging

## Database Schema Highlights

### Collections (MongoDB)
1. **users** - Auth, roles (admin/editor/viewer)
2. **projects** - PICOTS criteria, team, stats
3. **studies** - Title, authors, DOI, screening status
4. **extractions** - THE CORE: singleArmData[], comparativeData[], aiConfidence
5. **documents** - Uploaded files, OCR status, extracted text

See `DATABASE.md` for complete schema with indexes and relationships.

## Performance Considerations
- **Large PDFs**: 50MB limit, chunk processing for AI (not yet implemented)
- **Batch extraction**: Queue system needed for >10 files
- **MongoDB indexes**: Defined in `DATABASE.md` (projectId, studyId, extractionStatus)
- **File storage**: Currently local, plan for S3

## Security Notes
- **JWT auth** - Tokens in Authorization header
- **Role-based access** - Owner/editor can modify, viewer read-only
- **File validation** - Type/size checks before processing
- **API rate limiting** - Documented in `API.md` (not implemented)

## Future Enhancements (Roadmap)
- [ ] Real-time collaboration (WebSocket)
- [ ] R/Stata direct integration
- [ ] Multi-language document support
- [ ] Active learning from user corrections
- [ ] Automated deduplication
- [ ] RevMan format export

---

## Quick Reference Commands

```bash
# Start development
npm install                    # Root + client + server
npm run dev                    # Concurrent frontend + backend

# Frontend only
cd client && npm run dev       # http://localhost:5173

# Backend only  
cd server && npm run dev       # http://localhost:3000

# Build
npm run build                  # Both frontend + backend

# Database
mongod --dbpath /path/to/data  # Start MongoDB
```

## When Working on This Codebase
1. **Read EXTRACTION_ARCHITECTURE.md first** if touching extraction logic
2. **Preserve 23/22 field structure** at all costs
3. **PICOTS is optional** - don't make features require it
4. **Mock first, implement later** - frontend development continues independently
5. **Type everything** - TypeScript is enforced
6. **Document source tracking** - page, table, ref fields are critical for reproducibility
