# QA Testing Guide

## Overview
This guide provides manual testing procedures for EvidenceChain. Automated tests are planned but not yet implemented.

## Pre-Testing Setup

### Mock Mode Testing (No Backend Required)

The frontend works fully with mocks - ideal for UI/UX testing:

```typescript
// client/.env
VITE_ENABLE_MOCK_API=true
```

With mocks enabled:
- All API calls return fake data
- No database or AI services needed
- Instant responses for rapid iteration

### Full Stack Testing

Requires:
- MongoDB running (`mongod`)
- Backend server running (`cd server && npm run dev`)
- Frontend running (`cd client && npm run dev`)
- AI API keys configured (for extraction testing)

## Test Scenarios

### 1. Authentication & User Management

#### Login Flow
- [ ] Navigate to http://localhost:5173
- [ ] Enter valid credentials (default: `admin@evidencechain.local` / `ChangeMe123!`)
- [ ] **Expected**: Redirect to projects dashboard
- [ ] **Verify**: User name displays in header
- [ ] Logout
- [ ] **Expected**: Redirect to login page

#### Invalid Login
- [ ] Enter incorrect password
- [ ] **Expected**: "Invalid credentials" error message
- [ ] **Verify**: No redirect, form stays on page

#### Session Persistence
- [ ] Login successfully
- [ ] Refresh page
- [ ] **Expected**: Still logged in, no redirect to login
- [ ] Clear browser storage (DevTools → Application → Local Storage)
- [ ] Refresh page
- [ ] **Expected**: Redirect to login

---

### 2. Project Management

#### Create New Project (3-Step Wizard)

**Step 1: Basic Info**
- [ ] Click "New Project" button
- [ ] Enter project name: "Test ATTR Amyloidosis NMA"
- [ ] Enter description: "Testing extraction workflow"
- [ ] Select research question: "Treatment efficacy comparison"
- [ ] **Verify**: Next button enabled
- [ ] Click Next

**Step 2: PICOTS (Optional)**
- [ ] Toggle "Enable PICOTS criteria" ON
- [ ] Enter condition: "ATTR Amyloidosis"
- [ ] Add drug: "tafamidis" (click Add Drug button)
- [ ] Add drug: "patisiran"
- [ ] Add efficacy outcome: "6-minute walk distance (meters)"
- [ ] **Verify**: Preview shows entered data
- [ ] Click Next

**Step 3: Team**
- [ ] Add team member email: "reviewer@test.com"
- [ ] Select role: "Editor"
- [ ] Click "Create Project"
- [ ] **Expected**: Redirect to project detail page
- [ ] **Verify**: Project appears in dashboard with correct name

#### View Project Dashboard
- [ ] From projects list, click on test project
- [ ] **Verify**: Shows 0 studies, 0 extractions initially
- [ ] **Verify**: PICOTS criteria displayed if enabled
- [ ] **Verify**: Team members list visible

---

### 3. Study Management

#### Add New Study
- [ ] In project detail, click "Add Study"
- [ ] Enter title: "Phase 3 RCT of Tafamidis in ATTR-CM"
- [ ] Enter authors: "Maurer MS, Schwartz JH, et al."
- [ ] Enter DOI: "10.1056/NEJMoa1805689"
- [ ] Enter year: "2018"
- [ ] Click "Add Study"
- [ ] **Expected**: Study appears in studies list
- [ ] **Verify**: Study count incremented

#### Edit Study
- [ ] Click edit icon on study
- [ ] Change title
- [ ] Save
- [ ] **Expected**: Title updated immediately
- [ ] **Verify**: No page reload

---

### 4. Single Document Extraction (Core Feature)

#### Upload Document

**Test File**: Use a sample clinical trial PDF (create test file if needed)

- [ ] Navigate to study detail page
- [ ] Click "Extract Data" button
- [ ] **Verify**: File upload modal opens
- [ ] Drag and drop a PDF file
- [ ] **Expected**: File name appears
- [ ] **Expected**: File size displayed (e.g., "2.4 MB")
- [ ] Click "Start Extraction"

#### Extraction Process (Mock Mode)
- [ ] **Verify**: Progress indicator shows stages:
  - [ ] Uploading... (progress bar)
  - [ ] Analyzing document...
  - [ ] Extracting text...
  - [ ] Processing with AI...
  - [ ] Complete!
- [ ] **Expected**: ~2-3 seconds in mock mode
- [ ] **Expected**: Results view automatically displays

#### Review Extraction Results

**Single-Arm Data Table**
- [ ] **Verify**: Table displays with columns: Study, Treatment, Measure, Time Point, n, Mean, SD, etc.
- [ ] **Verify**: At least 1 row of data present (mock returns 2-3 rows)
- [ ] **Verify**: PICOTS fields auto-populated (condition, age, severity) if PICOTS enabled
- [ ] Check "Confidence" badges (High/Medium/Low)
- [ ] **Verify**: Source tracking shows (Page #, Table #)

**Comparative Data Table**
- [ ] Switch to "Comparative Data" tab
- [ ] **Verify**: Shows Treatment1, Treatment2, Effect Size (TE), SE, etc.
- [ ] **Verify**: At least 1 comparison present

**AI Confidence Indicators**
- [ ] Check overall confidence score (e.g., "89% confident")
- [ ] **Verify**: Individual field confidence badges visible
- [ ] Hover over low-confidence field
- [ ] **Expected**: Tooltip explains uncertainty

**PICOTS Validation Warnings (if enabled)**
- [ ] **Verify**: PICOTS match score displayed (e.g., "PICOTS Match: 75%")
- [ ] **Verify**: Warning message if score < 70%
- [ ] Example warning: "⚠️ Age range partially outside PICOTS criteria"
- [ ] **Verify**: Suggestions provided (e.g., "Consider verifying age overlap")

#### Edit Extracted Data
- [ ] Click "Edit" button (or inline edit if enabled)
- [ ] Change a numeric value (e.g., mean from 350 to 360)
- [ ] Tab to next field
- [ ] **Expected**: Cell highlights to show edit
- [ ] Add a note: "Manually verified from supplementary table"
- [ ] Click "Save Changes"
- [ ] **Expected**: "Changes saved" toast notification
- [ ] Refresh page
- [ ] **Verify**: Edited value persists

#### Add New Row
- [ ] Click "Add Row" button in single-arm table
- [ ] **Expected**: Empty row appears at bottom
- [ ] Fill in required fields:
  - Treatment: "placebo"
  - Measure: "6MWT"
  - Time Point: "12 months"
  - n: "100"
  - Mean: "325"
  - SD: "85"
- [ ] Save
- [ ] **Verify**: New row saved and displayed

#### Delete Row
- [ ] Click delete icon on a row
- [ ] **Expected**: Confirmation dialog: "Are you sure?"
- [ ] Cancel
- [ ] **Verify**: Row still present
- [ ] Click delete again → Confirm
- [ ] **Expected**: Row removed immediately
- [ ] Save changes
- [ ] **Verify**: Deletion persists

#### Submit for Review
- [ ] Click "Submit for Review" button
- [ ] **Expected**: Status changes to "Pending Review"
- [ ] **Verify**: Edit buttons disabled (read-only mode)
- [ ] **Verify**: Reviewer can see in their review queue

---

### 5. Batch Document Upload (New Feature)

#### Access Batch Upload
- [ ] In project detail, click "Batch Upload" button
- [ ] **Verify**: Batch upload modal opens
- [ ] **Verify**: Shows instructions about file linking

#### Upload Multiple Files

**Test Setup**: Prepare 3 test files:
1. `attr_tafamidis_main_2018.pdf`
2. `attr_tafamidis_supplement.pdf`
3. `attr_patisiran_rct_2019.pdf`

- [ ] Drag all 3 files into upload area
- [ ] **Expected**: All files listed with progress bars
- [ ] **Verify**: Auto-linking suggestions appear:
  - [ ] File 1 → "Main document for Study X" (80% confidence)
  - [ ] File 2 → "Supplementary for Study X" (75% confidence)
  - [ ] File 3 → "Main document for Study Y" (65% confidence)

#### Review Auto-Linking
- [ ] **Verify**: Confidence scores displayed
- [ ] **Verify**: Color coding (green = high, yellow = medium, red = low)
- [ ] For file with wrong link:
  - [ ] Click dropdown to change study assignment
  - [ ] Select correct study from list
  - [ ] **Expected**: Confidence updates

#### Manual File Type Assignment
- [ ] For supplement file:
  - [ ] **Verify**: File type auto-detected as "Supplementary"
  - [ ] Click dropdown to change if needed
  - [ ] Options: Main | Supplementary | Protocol
- [ ] Click "Start Batch Extraction"

#### Batch Processing Progress
- [ ] **Verify**: Each file shows individual progress:
  - [ ] File 1: Processing... (spinner)
  - [ ] File 2: Queued
  - [ ] File 3: Queued
- [ ] **Expected**: Files process sequentially (or parallel if implemented)
- [ ] **Verify**: Status updates for each:
  - [ ] File 1: ✓ Complete (green checkmark)
  - [ ] File 2: Processing...
  - [ ] File 3: Queued
- [ ] **Expected**: Total progress bar shows 33%, 66%, 100%

#### Review Batch Results
- [ ] When all complete, click "Review All Extractions"
- [ ] **Expected**: List of all extracted data sets
- [ ] **Verify**: Can navigate between extractions
- [ ] **Verify**: Linked files show relationship (main + supplement)
- [ ] Accept/reject each extraction individually

---

### 6. PICOTS Validation Testing

#### Test High Match (>70%)

**Setup**: Project PICOTS condition = "ATTR Amyloidosis", drugs = ["tafamidis"]

- [ ] Upload document mentioning ATTR and tafamidis frequently
- [ ] **Expected**: High confidence (>70%)
- [ ] **Verify**: Green success message: "✓ Excellent PICOTS match (82%)"
- [ ] **Verify**: No warnings displayed

#### Test Moderate Match (40-70%)

**Setup**: Upload document about related condition (e.g., "AL Amyloidosis")

- [ ] Extract data
- [ ] **Expected**: Moderate confidence (40-70%)
- [ ] **Verify**: Yellow warning: "⚠️ Moderate PICOTS match (55%)"
- [ ] **Verify**: Warning details:
  - "✓ Drug 'tafamidis' mentioned"
  - "⚠️ Condition: Expected 'ATTR', found 'AL'"
- [ ] **Verify**: Suggestions provided:
  - "Consider verifying this is correct study"
- [ ] **Verify**: Can still proceed with extraction

#### Test Low Match (<40%)

**Setup**: Upload completely unrelated document (e.g., diabetes study)

- [ ] Attempt extraction
- [ ] **Expected**: Low confidence (<40%)
- [ ] **Verify**: Red error: "🚨 LOW PICOTS MATCH (28%)"
- [ ] **Verify**: Detailed mismatches listed
- [ ] **Verify**: Require explicit confirmation to proceed
- [ ] Check "I understand this doesn't match" → Proceed
- [ ] **Expected**: Extraction continues with warning flag

---

### 7. Data Export

#### Export to CSV
- [ ] From project detail, click "Export" dropdown
- [ ] Select "Export to CSV"
- [ ] **Expected**: File downloads: `project-name-extractions.csv`
- [ ] Open in Excel/spreadsheet
- [ ] **Verify**: 23 columns for single-arm data
- [ ] **Verify**: 22 columns for comparative data
- [ ] **Verify**: All rows present
- [ ] **Verify**: Special characters handled (commas, quotes)

#### Export to R Format
- [ ] Select "Export to R"
- [ ] **Expected**: Downloads `.R` file
- [ ] Open in text editor
- [ ] **Verify**: Valid R syntax
- [ ] **Verify**: Contains `single_arm_data` data frame
- [ ] **Verify**: Contains `comparative_data` data frame
- [ ] **Verify**: Comments include metadata (export date, version)

#### Export to Stata
- [ ] Select "Export to Stata"
- [ ] **Expected**: Downloads `.do` file
- [ ] **Verify**: Valid Stata syntax
- [ ] **Verify**: Variable labels included

---

### 8. Error Handling

#### Test File Size Limit
- [ ] Attempt to upload file > 50MB
- [ ] **Expected**: Immediate error before upload starts
- [ ] **Verify**: Toast notification: "File exceeds 50MB limit"
- [ ] **Verify**: Suggests compression or splitting

#### Test Invalid File Type
- [ ] Attempt to upload .txt or .jpg file
- [ ] **Expected**: Error: "Invalid file type"
- [ ] **Verify**: Lists supported formats (PDF, Word)

#### Test Network Error (Simulated)
- [ ] Disable network (or use browser DevTools → Network → Offline)
- [ ] Attempt extraction
- [ ] **Expected**: Error: "Connection lost"
- [ ] **Verify**: Offers retry button
- [ ] Re-enable network
- [ ] Click retry
- [ ] **Expected**: Extraction proceeds

#### Test Invalid Data Entry
- [ ] Edit extraction, enter text in numeric field (e.g., "abc" for sample size)
- [ ] Attempt to save
- [ ] **Expected**: Validation error: "Sample size must be a number"
- [ ] **Verify**: Field highlighted in red
- [ ] **Verify**: Cannot save until corrected

---

### 9. Cross-Browser Testing

Test in multiple browsers:

#### Chrome (Primary)
- [ ] All core features work
- [ ] File upload works
- [ ] Tables render correctly
- [ ] No console errors

#### Firefox
- [ ] All core features work
- [ ] File drag-and-drop works
- [ ] PDF preview works (if implemented)

#### Edge
- [ ] All core features work
- [ ] Authentication works
- [ ] Export downloads work

#### Safari (Mac only)
- [ ] All core features work
- [ ] File upload works

---

### 10. Performance Testing

#### Large Document Handling
- [ ] Upload 40MB PDF
- [ ] **Expected**: Upload completes within 2 minutes
- [ ] **Verify**: Progress updates smoothly
- [ ] **Expected**: Extraction completes within 5 minutes
- [ ] **Verify**: No browser freeze/crash

#### Many Extractions
- [ ] Create project with 50+ studies
- [ ] **Verify**: Study list loads quickly (<2 seconds)
- [ ] **Verify**: Pagination works if implemented
- [ ] **Verify**: Search/filter responsive

#### Concurrent Users (Multi-user setup)
- [ ] User A edits extraction
- [ ] User B views same extraction
- [ ] User A saves changes
- [ ] User B refreshes
- [ ] **Expected**: User B sees User A's changes
- [ ] **Verify**: No data conflicts

---

### 11. Mobile Responsiveness (Optional)

#### Tablet (iPad landscape)
- [ ] Dashboard layout adapts
- [ ] Tables scrollable horizontally
- [ ] Forms usable
- [ ] File upload works

#### Phone (iPhone)
- [ ] Navigation collapses to hamburger menu
- [ ] Tables stack vertically or scroll
- [ ] Essential features accessible
- [ ] File upload works (camera option if available)

---

## Automated Testing (Future)

### Unit Tests (Planned)
```powershell
# Frontend
cd client
npm run test

# Backend
cd server
npm run test
```

### Integration Tests (Planned)
```powershell
# Run all tests
npm run test:integration

# Test specific workflow
npm run test:integration -- extraction
```

### E2E Tests (Planned - Playwright/Cypress)
```powershell
npm run test:e2e
```

---

## Bug Reporting Template

When you find an issue:

```markdown
**Bug Title**: Brief description

**Steps to Reproduce**:
1. Go to...
2. Click on...
3. Enter...

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happened

**Environment**:
- Browser: Chrome 121
- OS: Windows 11
- App Version: 1.0.0
- Mock Mode: Yes/No

**Screenshots**: (if applicable)

**Console Errors**: (open DevTools → Console, copy errors)
```

---

## QA Checklist Summary

### Critical Path (Must Test Before Release)
- [ ] User can create account/login
- [ ] User can create project
- [ ] User can add study
- [ ] User can upload document
- [ ] Extraction returns valid data
- [ ] User can edit extracted data
- [ ] User can export data
- [ ] PICOTS validation works (if enabled)

### Important Features
- [ ] Batch upload works
- [ ] File auto-linking accurate
- [ ] Error messages helpful
- [ ] Data persists after refresh
- [ ] Team collaboration works

### Nice-to-Have
- [ ] Mobile responsive
- [ ] Works in all browsers
- [ ] Performance acceptable with large datasets

---

## Performance Benchmarks

### Target Response Times
- **Page load**: < 2 seconds
- **Single file upload**: < 10 seconds (depends on size)
- **AI extraction**: < 30 seconds (depends on document length)
- **Save changes**: < 1 second
- **Export data**: < 5 seconds

### Acceptable Limits
- **Max file size**: 50MB
- **Max document length**: 100 pages
- **Max concurrent users**: 50 (with single server)
- **Max studies per project**: 1000
- **Max extractions per study**: 50

---

## Test Data Sets

### Sample Documents Needed

1. **Clean PDF** - Native PDF with text layer
2. **Scanned PDF** - Requires OCR
3. **Large PDF** - 30-40MB, 100+ pages
4. **Protected PDF** - Password-protected (to test error)
5. **Corrupt PDF** - Intentionally broken file
6. **Word Document** - .docx format
7. **Supplementary Material** - Typical supplement PDF
8. **Protocol Document** - Clinical trial protocol

### Sample PICOTS Configurations

1. **Simple** - Only condition + 2 drugs
2. **Complex** - Full PICOTS with all fields
3. **No PICOTS** - Test without validation
4. **Broad Criteria** - Very permissive matching

---

## Daily QA Routine (Recommended)

### Smoke Test (5 minutes)
- [ ] App loads
- [ ] Login works
- [ ] Create test project
- [ ] Upload sample file
- [ ] View extraction results

### Weekly Full Test (30 minutes)
- [ ] Run through all critical path tests
- [ ] Test latest feature additions
- [ ] Check for console errors
- [ ] Verify exports work

### Pre-Release Test (2 hours)
- [ ] Complete all test scenarios
- [ ] Cross-browser testing
- [ ] Performance testing
- [ ] Security testing (try SQL injection, XSS)
- [ ] Backup/restore testing

---

**Pro Tips**:
- Keep browser DevTools open during testing (F12)
- Check Network tab for failed API calls
- Check Console tab for JavaScript errors
- Use React DevTools extension to inspect component state
- Take screenshots of any bugs immediately
