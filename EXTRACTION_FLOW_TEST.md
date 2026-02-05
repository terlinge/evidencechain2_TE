# Extraction Flow - QA Test Guide

## Complete End-to-End Flow

### 1. Create Project
- Navigate to `/projects`
- Click "Create New Project"
- Fill in project details (PICOTS optional)
- Click "Create Project"

### 2. Upload Document & Extract
- Open project detail page
- Click "Add Study & Upload Document"
- **File Upload**: Choose a PDF clinical trial document
- **AI Metadata Extraction** (2-5 seconds):
  - Extracts: Title, Authors, DOI, Year, NCT Number
  - Shows editable form with extracted data
- **Review & Edit**: Correct any errors in extracted metadata
- Click "Save Study & Extract Data"

### 3. Background Processing
- **Backend Process** (5-30 seconds):
  - Study created in database
  - Document uploaded to `server/uploads/`
  - AI extraction service called with GPT-4
  - Extracts ALL outcomes (23-field single-arm, 22-field comparative)
  - References PICOTS if available
  - Saves to `server/data/extractions.json`
- **User Experience**:
  - Toast: "Study created! Extracting outcome data now..."
  - Auto-navigates to `/projects/{projectId}/studies/{studyId}/extract/{extractionId}`

### 4. View Extraction Results
- **DataExtraction Page** loads with extractionId in URL
- `useEffect` automatically calls `getExtractionResults()`
- **Display**:
  - Tab 1: Single-Arm Data (n, events, means, SDs)
  - Tab 2: Comparative Data (treatment effects, CIs)
  - AI confidence scores
  - Warnings (PICOTS mismatches, etc.)
- **All fields editable** - click any cell to edit
- Click "Submit for Review" when done

### 5. Return to Study
- Click "Extract Data" button on study row
- **Smart Navigation**:
  - Checks for existing extractions
  - If exists → loads most recent extraction
  - If none → shows upload page

## API Endpoints Used

```
POST   /api/extract-metadata
       - Uploads file
       - Returns: title, authors, DOI, year

POST   /api/projects/{projectId}/studies
       - Creates study with metadata
       - Returns: study object with _id

POST   /api/projects/{projectId}/studies/{studyId}/extract-ai
       - Uploads document for extraction
       - Returns: extractionId immediately
       - Processes in background (async)

GET    /api/projects/{projectId}/extractions/{extractionId}/ai-results
       - Polls for extraction status
       - Returns: singleArmData[], comparativeData[], aiConfidence, warnings

GET    /api/projects/{projectId}/studies/{studyId}/extractions
       - Gets all extractions for a study
       - Used by "Extract Data" button to check if extraction exists

PATCH  /api/projects/{projectId}/extractions/{extractionId}
       - Saves edited extraction data
```

## Key Files Modified

### Frontend
- `App.tsx` - Added route with extractionId param
- `ProjectDetail.tsx` - Metadata extraction + auto-navigation
- `DataExtraction.tsx` - Added useEffect to load extraction on mount
- `api/metadata.ts` - NEW: Metadata extraction API
- `api/extractions.ts` - NEW: Get extractions by study

### Backend
- `services/aiExtractionService.js` - extractMetadata() function added
- `index.js` - POST /extract-metadata endpoint
- `index.js` - GET /studies/{studyId}/extractions endpoint

## What to Test

### ✅ Happy Path
1. Upload PDF → See metadata extracted
2. Edit metadata if needed → Click save
3. Wait for toast "Extracting outcome data..."
4. **CRITICAL**: Check that extraction results page loads automatically
5. Verify tables show data (single-arm + comparative)
6. Edit a cell → verify changes save
7. Navigate back → Click "Extract Data" → verify it loads saved extraction

### ⚠️ Edge Cases
1. **No API Key**: Should use mock data (check server logs)
2. **Invalid PDF**: Should show error toast
3. **File too large**: Should reject with error
4. **Metadata extraction fails**: Should use filename as title
5. **No PICOTS defined**: Should extract ALL outcomes (defaults)
6. **PICOTS mismatch**: Should show warnings

### 🐛 Previous Issues Fixed
- ❌ Browser crash (syntax errors) → ✅ Fixed corrupted toast calls
- ❌ Extraction not viewable → ✅ Added useEffect + extractionId in URL
- ❌ "Extract Data" button broken → ✅ Smart navigation with API check
- ❌ No loading state → ✅ Added loading spinner and progress
- ❌ Duplicated server code → ✅ Cleaned up index.js

## Console Logs to Watch

### Client
```
📤 Uploading file for metadata extraction: {filename}
✅ Metadata extracted: {title}
📝 Creating study with extracted metadata...
✅ Study created: {studyId}
🚀 Starting outcome data extraction...
✅ Extraction started: {extractionId}
Loading extraction: {extractionId}
Loaded extraction results: {data}
```

### Server
```
📄 Extracting metadata from: {filename}
✅ Metadata extracted: {title}
📄 File uploaded: {filename}
💾 Saved to: {path}
🤖 Starting REAL AI extraction...
🔄 Calling AI extraction service...
💾 Saving extraction to database...
✅ AI Extraction completed: {extractionId}
   - {count} single-arm records
   - {count} comparative records
   - Confidence: {percent}%
```

## Expected Behavior

1. **After upload**: Navigation happens automatically within 1-2 seconds
2. **Extraction page**: Loads data immediately if extractionId in URL
3. **"Extract Data" button**: Loads existing extraction if available
4. **No extraction yet**: Shows upload page instead

## If Still Broken

Check these in order:
1. Open browser DevTools → Console tab
2. Check for JavaScript errors (red text)
3. Open Network tab → Check API calls return 200
4. Server terminal → Verify extraction completed
5. Check `server/data/extractions.json` → Verify data saved
6. Verify extractionId in URL matches database
