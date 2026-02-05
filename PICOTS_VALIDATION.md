# PICOTS Validation & Matching Logic

## Overview
PICOTS validation ensures extracted data aligns with project inclusion/exclusion criteria. The system uses a multi-factor matching algorithm to assess relevance and generate actionable warnings.

## Matching Algorithm

### 1. Condition Matching (Weight: 0.4)

```typescript
// Check if document mentions the target condition
function checkConditionMatch(
  fileName: string,
  documentText: string,
  picots: { conditionName: string; conditionSynonyms?: string[] }
): { matches: boolean; score: number; details: string[] } {
  
  const searchTerms = [
    picots.conditionName,
    ...(picots.conditionSynonyms || [])
  ].map(t => t.toLowerCase());
  
  const fileName Lower = fileName.toLowerCase();
  const textLower = documentText.toLowerCase();
  
  let matchScore = 0;
  const matchDetails: string[] = [];
  
  searchTerms.forEach(term => {
    // Filename match is strongest signal
    if (fileNameLower.includes(term)) {
      matchScore += 0.4;
      matchDetails.push(`Condition "${term}" found in filename`);
    }
    // Abstract/title match is also strong
    else if (textLower.substring(0, 500).includes(term)) {
      matchScore += 0.3;
      matchDetails.push(`Condition "${term}" found in abstract`);
    }
    // Body text match is weaker
    else if (textLower.includes(term)) {
      matchScore += 0.1;
      matchDetails.push(`Condition "${term}" mentioned in text`);
    }
  });
  
  return {
    matches: matchScore >= 0.3,
    score: Math.min(matchScore, 0.4), // Cap at weight
    details: matchDetails
  };
}
```

### 2. Intervention/Drug Matching (Weight: 0.3)

```typescript
function checkInterventionMatch(
  documentText: string,
  picots: { drugs: Array<{ name: string; brandName?: string }> }
): { score: number; details: string[] } {
  
  const textLower = documentText.toLowerCase();
  let matchScore = 0;
  const matchDetails: string[] = [];
  
  picots.drugs.forEach(drug => {
    const searchTerms = [
      drug.name.toLowerCase(),
      drug.brandName?.toLowerCase()
    ].filter(Boolean);
    
    searchTerms.forEach(term => {
      if (textLower.includes(term)) {
        matchScore += 0.15; // Each drug match
        matchDetails.push(`Drug "${drug.name}" mentioned`);
      }
    });
  });
  
  return {
    score: Math.min(matchScore, 0.3), // Cap at weight
    details: matchDetails
  };
}
```

### 3. Outcome Matching (Weight: 0.15)

```typescript
function checkOutcomeMatch(
  documentText: string,
  picots: { efficacyOutcomes: Array<{ name: string }> }
): { score: number; details: string[] } {
  
  const textLower = documentText.toLowerCase();
  let matchScore = 0;
  const matchDetails: string[] = [];
  
  const outcomeMatches = picots.efficacyOutcomes.filter(outcome => {
    const outcomeLower = outcome.name.toLowerCase();
    return textLower.includes(outcomeLower);
  });
  
  if (outcomeMatches.length > 0) {
    matchScore = Math.min(outcomeMatches.length * 0.05, 0.15);
    matchDetails.push(`${outcomeMatches.length} outcome(s) mentioned`);
  }
  
  return { score: matchScore, details: matchDetails };
}
```

### 4. Population Matching (Weight: 0.15)

```typescript
function checkPopulationMatch(
  extractedData: { age?: string; severity?: string },
  picots: { ageGroupMin?: string; ageGroupMax?: string; severity?: string }
): { score: number; details: string[] } {
  
  let matchScore = 0;
  const matchDetails: string[] = [];
  
  // Age range matching
  if (extractedData.age && picots.ageGroupMin && picots.ageGroupMax) {
    // Parse age range from extracted data
    const ageMatch = extractedData.age.match(/(\d+)-(\d+)/);
    if (ageMatch) {
      const [_, minAge, maxAge] = ageMatch.map(Number);
      const picotsMin = parseInt(picots.ageGroupMin);
      const picotsMax = parseInt(picots.ageGroupMax);
      
      // Check overlap
      if (minAge >= picotsMin && maxAge <= picotsMax) {
        matchScore += 0.08;
        matchDetails.push('Age range matches PICOTS criteria');
      } else if (minAge < picotsMax && maxAge > picotsMin) {
        matchScore += 0.04;
        matchDetails.push('Age range partially overlaps PICOTS');
      }
    }
  }
  
  // Severity matching
  if (extractedData.severity && picots.severity) {
    const severityLevels = ['mild', 'moderate', 'severe'];
    const extractedLevel = severityLevels.indexOf(extractedData.severity.toLowerCase());
    const picotsLevel = severityLevels.indexOf(picots.severity.toLowerCase());
    
    if (extractedLevel === picotsLevel) {
      matchScore += 0.07;
      matchDetails.push('Severity level matches PICOTS');
    } else if (Math.abs(extractedLevel - picotsLevel) === 1) {
      matchScore += 0.03;
      matchDetails.push('Severity level close to PICOTS');
    }
  }
  
  return { score: matchScore, details: matchDetails };
}
```

## Match Score Interpretation

### Decision Tree

```
Calculate Total Score = Σ(all component scores)

IF score >= 0.7:
  ✅ HIGH RELEVANCE - Auto-approve with no warnings
  Action: Proceed with extraction
  
ELSE IF score >= 0.4 AND score < 0.7:
  ⚠️ MODERATE RELEVANCE - Flag for review
  Action: Show warnings, allow user to proceed or reject
  Warnings:
    - "Document relevance score: [score]%"
    - List specific mismatches
    - Suggest manual verification
    
ELSE IF score >= 0.2 AND score < 0.4:
  🚨 LOW RELEVANCE - Strong warning
  Action: Require explicit confirmation
  Warnings:
    - "⚠️ PICOTS MISMATCH: This document may not match criteria"
    - List all mismatches with severity
    - Highlight missing critical elements
    
ELSE (score < 0.2):
  ❌ NO RELEVANCE - Block extraction
  Action: Prevent extraction, suggest alternative
  Message:
    - "This document does not match project criteria"
    - Show comparison table
    - Suggest uploading correct document or adjusting PICOTS
```

## Warning Generation Examples

### Example 1: Moderate Match (score = 0.55)

```json
{
  "isRelevant": true,
  "matchScore": 0.55,
  "warnings": [
    "⚠️ Moderate PICOTS match (55%) - please verify:",
    "  ✓ Condition 'ATTR Amyloidosis' found in title",
    "  ✓ Drug 'tafamidis' mentioned 12 times",
    "  ⚠️ Age range (50-80) partially outside PICOTS (18-75)",
    "  ⚠️ Primary outcome '6MWT' not in PICOTS outcomes list"
  ],
  "suggestions": [
    "Consider verifying age range overlap",
    "Check if 6MWT is acceptable outcome"
  ]
}
```

### Example 2: Low Match (score = 0.28)

```json
{
  "isRelevant": false,
  "matchScore": 0.28,
  "warnings": [
    "🚨 LOW PICOTS MATCH (28%) - Review Required:",
    "  ❌ Condition: Expected 'ATTR Amyloidosis', found 'AL Amyloidosis'",
    "  ⚠️ Interventions: Only 1 of 3 expected drugs mentioned",
    "  ❌ Study design: Observational (RCT required)",
    "  ⚠️ Population severity: Mixed (moderate required)"
  ],
  "mismatches": [
    "Condition mismatch: AL vs ATTR amyloidosis",
    "Study design does not meet criteria",
    "Severity not specified"
  ],
  "suggestions": [
    "This may be wrong study - check file name",
    "If correct, consider broadening PICOTS criteria",
    "Verify this is not supplementary material for another study"
  ]
}
```

### Example 3: High Match (score = 0.82)

```json
{
  "isRelevant": true,
  "matchScore": 0.82,
  "warnings": [],
  "confirmations": [
    "✅ Excellent PICOTS match (82%)",
    "  ✓ Condition 'ATTR Amyloidosis' confirmed",
    "  ✓ All 3 interventions mentioned",
    "  ✓ Primary outcomes match",
    "  ✓ Age range 18-85 within PICOTS",
    "  ✓ RCT design as required"
  ]
}
```

## Validation Workflow Integration

```typescript
// In aiExtractionMock.ts or real AI service
export function validateAgainstPICOTS(
  extraction: AIExtractionResult,
  projectPICOTS: EnhancedPICOTS
): PICOTSValidationResult {
  
  // 1. Run all matching components
  const conditionMatch = checkConditionMatch(
    extraction.documentName,
    extraction.extractedText,
    projectPICOTS
  );
  
  const interventionMatch = checkInterventionMatch(
    extraction.extractedText,
    projectPICOTS
  );
  
  const outcomeMatch = checkOutcomeMatch(
    extraction.extractedText,
    projectPICOTS
  );
  
  const populationMatch = checkPopulationMatch(
    {
      age: extraction.singleArmData[0]?.age,
      severity: extraction.singleArmData[0]?.severity
    },
    projectPICOTS
  );
  
  // 2. Calculate total score
  const totalScore = 
    conditionMatch.score +
    interventionMatch.score +
    outcomeMatch.score +
    populationMatch.score;
  
  // 3. Generate warnings based on decision tree
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const mismatches: string[] = [];
  
  if (totalScore < 0.7) {
    warnings.push(
      `⚠️ PICOTS match score: ${Math.round(totalScore * 100)}%`
    );
    
    if (conditionMatch.score < 0.2) {
      mismatches.push('Condition not clearly identified');
      suggestions.push('Verify this is correct study for your condition');
    }
    
    if (interventionMatch.score < 0.15) {
      mismatches.push('Expected interventions not found');
      suggestions.push('Check if document discusses your interventions of interest');
    }
    
    // Add component-specific warnings
    [conditionMatch, interventionMatch, outcomeMatch, populationMatch]
      .forEach(match => warnings.push(...match.details));
  }
  
  // 4. Return validation result
  return {
    isRelevant: totalScore >= 0.4,
    matchScore: totalScore,
    warnings,
    suggestions,
    mismatches,
    componentScores: {
      condition: conditionMatch.score,
      intervention: interventionMatch.score,
      outcome: outcomeMatch.score,
      population: populationMatch.score
    }
  };
}
```

## UI Integration

```typescript
// In ExtractionResultsView.tsx
{picotsRelevance && (
  <Alert variant={picotsRelevance.isRelevant ? "warning" : "destructive"}>
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>
      PICOTS Match: {Math.round(picotsRelevance.matchScore * 100)}%
    </AlertTitle>
    <AlertDescription>
      <ul className="list-disc pl-4 space-y-1">
        {picotsRelevance.warnings.map((warning, i) => (
          <li key={i} className="text-sm">{warning}</li>
        ))}
      </ul>
      {picotsRelevance.suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold">Suggestions:</p>
          <ul className="list-disc pl-4">
            {picotsRelevance.suggestions.map((sug, i) => (
              <li key={i} className="text-sm">{sug}</li>
            ))}
          </ul>
        </div>
      )}
    </AlertDescription>
  </Alert>
)}
```

## Testing Match Algorithm

```typescript
// Example test cases
const testCases = [
  {
    name: "Perfect Match",
    fileName: "attr_amyloidosis_tafamidis_rct_2018.pdf",
    picots: {
      conditionName: "ATTR Amyloidosis",
      drugs: [{ name: "tafamidis" }]
    },
    expectedScore: "> 0.7"
  },
  {
    name: "Wrong Condition",
    fileName: "heart_failure_metoprolol_2020.pdf",
    picots: {
      conditionName: "ATTR Amyloidosis",
      drugs: [{ name: "tafamidis" }]
    },
    expectedScore: "< 0.3"
  },
  {
    name: "Supplementary File",
    fileName: "attr_amyloidosis_tafamidis_supplement.pdf",
    picots: {
      conditionName: "ATTR Amyloidosis",
      drugs: [{ name: "tafamidis" }]
    },
    expectedScore: "> 0.5",
    expectedFileType: "supplementary"
  }
];
```

## Key Takeaways

1. **Multi-factor scoring** - No single factor determines relevance
2. **Graduated warnings** - Different thresholds trigger different actions
3. **User empowerment** - Always allow override with explanation
4. **Transparency** - Show why score is what it is
5. **Continuous improvement** - Log user overrides to improve algorithm
