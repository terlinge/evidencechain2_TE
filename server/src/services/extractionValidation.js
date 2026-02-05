/**
 * Extraction Validation & Auto-Calculation Service
 * Checks extraction data for completeness and calculates missing values
 * Now includes parsing notes for stuck values and comprehensive TE calculation
 */

/**
 * Parse notes field for numeric values that should be in data fields
 * Patterns: "X%", "X events", "mean X", "change X", etc.
 */
function parseNotesForValues(notes) {
  if (!notes || typeof notes !== 'string') return {};
  
  const extracted = {};
  
  // Pattern: "X%" for percentages (e.g., "15%", "33%")
  const percentMatch = notes.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    extracted.percentage = parseFloat(percentMatch[1]);
  }
  
  // Pattern: "X events" or "X deaths" for event counts
  const eventMatch = notes.match(/(\d+)\s*(?:events?|deaths?|cases?)/i);
  if (eventMatch) {
    extracted.events = parseInt(eventMatch[1]);
  }
  
  // Pattern: "n=X" or "N=X" for sample size
  const nMatch = notes.match(/n\s*[=:]\s*(\d+)/i);
  if (nMatch) {
    extracted.n = parseInt(nMatch[1]);
  }
  
  // Pattern: "X/Y" fraction (events/total)
  const fractionMatch = notes.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    extracted.events = parseInt(fractionMatch[1]);
    extracted.n = parseInt(fractionMatch[2]);
  }
  
  // Pattern: mean/change values like "mean -12.3" or "change: 5.2" or "-30.5±95.2"
  const meanMatch = notes.match(/(?:mean|change|difference)[:\s]*(-?\d+(?:\.\d+)?)/i);
  if (meanMatch) {
    extracted.mean = parseFloat(meanMatch[1]);
  }
  
  // Pattern: value with SD like "-30.5±95.2" or "-30.5 ± 95.2"
  const meanSdMatch = notes.match(/(-?\d+(?:\.\d+)?)\s*[±+\-]\s*(\d+(?:\.\d+)?)/);
  if (meanSdMatch && !notes.match(/CI|confidence/i)) {
    extracted.mean = parseFloat(meanSdMatch[1]);
    extracted.sd = parseFloat(meanSdMatch[2]);
  }
  
  // Pattern: "resolution" percentage like "25.9% resolution"
  const resolutionMatch = notes.match(/(\d+(?:\.\d+)?)\s*%\s*(?:resolution|response|improvement)/i);
  if (resolutionMatch) {
    extracted.rate = parseFloat(resolutionMatch[1]) / 100;
  }
  
  // Pattern: HR/OR/RR with CI like "HR 0.69 (95% CI 0.49-0.98)"
  const ratioMatch = notes.match(/(?:HR|OR|RR)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*\(?(?:95%?\s*CI)?[:\s]*(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (ratioMatch) {
    const estimate = parseFloat(ratioMatch[1]);
    const lower = parseFloat(ratioMatch[2]);
    const upper = parseFloat(ratioMatch[3]);
    extracted.te = Math.log(estimate);
    extracted.seTE = (Math.log(upper) - Math.log(lower)) / 3.92;
  }
  
  return extracted;
}

/**
 * Calculate log odds and SE for binary outcomes (events/n)
 */
function calculateBinaryTE(n, events) {
  if (!n || events === null || events === undefined) return null;
  if (events > n || events < 0) return null;
  
  n = Number(n);
  events = Number(events);
  
  const p = events / n;
  if (p === 0 || p === 1) {
    // Use continuity correction for 0 or 100%
    const correctedP = p === 0 ? 0.5 / n : (n - 0.5) / n;
    const odds = correctedP / (1 - correctedP);
    const te = Math.log(odds);
    const seTE = Math.sqrt(1 / (events + 0.5) + 1 / (n - events + 0.5));
    return {
      te: Number(te.toFixed(4)),
      seTE: Number(seTE.toFixed(4)),
      note: 'Continuity correction applied (0 or 100%)'
    };
  }
  
  const odds = p / (1 - p);
  const te = Math.log(odds);
  const seTE = Math.sqrt(1 / events + 1 / (n - events));
  
  return {
    te: Number(te.toFixed(4)),
    seTE: Number(seTE.toFixed(4))
  };
}

/**
 * Calculate log odds ratio (log OR) for comparative binary data
 * log OR = log((e1/(n1-e1)) / (e2/(n2-e2)))
 * seTE = sqrt(1/e1 + 1/(n1-e1) + 1/e2 + 1/(n2-e2))
 */
function calculateLogOddsRatio(n1, n2, event1, event2) {
  if (!n1 || !n2 || event1 === null || event1 === undefined || event2 === null || event2 === undefined) return null;
  if (event1 > n1 || event2 > n2 || event1 < 0 || event2 < 0) return null;
  
  n1 = Number(n1);
  n2 = Number(n2);
  event1 = Number(event1);
  event2 = Number(event2);
  
  // Apply continuity correction if any cell is 0
  const needsCorrection = event1 === 0 || event1 === n1 || event2 === 0 || event2 === n2;
  
  let e1 = event1, ne1 = n1 - event1, e2 = event2, ne2 = n2 - event2;
  
  if (needsCorrection) {
    e1 = event1 + 0.5;
    ne1 = n1 - event1 + 0.5;
    e2 = event2 + 0.5;
    ne2 = n2 - event2 + 0.5;
  }
  
  const odds1 = e1 / ne1;
  const odds2 = e2 / ne2;
  const logOR = Math.log(odds1 / odds2);
  const seTE = Math.sqrt(1/e1 + 1/ne1 + 1/e2 + 1/ne2);
  
  return {
    te: Number(logOR.toFixed(4)),
    seTE: Number(seTE.toFixed(4)),
    note: needsCorrection ? 'Continuity correction applied' : null
  };
}

/**
 * Calculate TE for continuous single-arm data
 * For change from baseline, the change IS the treatment effect
 */
function calculateContinuousTE(mean, sd, n) {
  if (mean === null || mean === undefined) return null;
  
  mean = Number(mean);
  
  // For single-arm continuous data, the mean change IS the TE
  // seTE = SD / sqrt(n) - standard error of the mean
  let seTE = null;
  if (sd && n) {
    seTE = Number(sd) / Math.sqrt(Number(n));
  }
  
  return {
    te: mean,
    seTE: seTE ? Number(seTE.toFixed(4)) : null
  };
}

/**
 * Calculate event count from percentage
 */
function calculateFromPercentage(percentage, n) {
  if (!percentage || !n) return null;
  const events = Math.round((percentage / 100) * Number(n));
  return events;
}

/**
 * Validate and enhance single-arm extraction data
 */
export function validateSingleArmData(data) {
  const warnings = [];
  const errors = [];
  const enhancements = [];
  
  const enhanced = data.map((row, index) => {
    const rowWarnings = [];
    const rowErrors = [];
    const enhanced = { ...row };
    
    // Required fields check
    if (!row.treatment) rowErrors.push(`Row ${index + 1}: Missing treatment`);
    if (!row.measureName) rowErrors.push(`Row ${index + 1}: Missing measureName`);
    if (!row.timePoint) rowWarnings.push(`Row ${index + 1}: Missing timePoint`);
    
    // Parse notes for values that should be in fields
    const parsedFromNotes = parseNotesForValues(row.notes);
    
    // Current values
    let hasEvents = row.event !== null && row.event !== undefined && row.event !== '';
    let hasMean = row.mean !== null && row.mean !== undefined && row.mean !== '';
    let hasTE = row.te !== null && row.te !== undefined && row.te !== '';
    let hasN = row.n !== null && row.n !== undefined && row.n !== '';
    let hasSD = row.sd !== null && row.sd !== undefined && row.sd !== '';
    
    // Auto-fill n from notes if missing
    if (!hasN && parsedFromNotes.n) {
      enhanced.n = parsedFromNotes.n;
      hasN = true;
      enhancements.push({
        row: index + 1,
        treatment: row.treatment,
        outcome: row.measureName,
        field: 'n',
        oldValue: null,
        newValue: parsedFromNotes.n,
        calculation: 'Extracted from notes'
      });
    }
    
    // Auto-fill events from notes if missing
    if (!hasEvents && parsedFromNotes.events) {
      enhanced.event = parsedFromNotes.events;
      hasEvents = true;
      enhancements.push({
        row: index + 1,
        treatment: row.treatment,
        outcome: row.measureName,
        field: 'event',
        oldValue: null,
        newValue: parsedFromNotes.events,
        calculation: 'Extracted from notes'
      });
    }
    
    // Calculate events from percentage if we have n and percentage
    if (!hasEvents && parsedFromNotes.percentage && hasN) {
      const calculatedEvents = calculateFromPercentage(parsedFromNotes.percentage, enhanced.n);
      if (calculatedEvents !== null) {
        enhanced.event = calculatedEvents;
        hasEvents = true;
        enhancements.push({
          row: index + 1,
          treatment: row.treatment,
          outcome: row.measureName,
          field: 'event',
          oldValue: null,
          newValue: calculatedEvents,
          calculation: `Calculated from ${parsedFromNotes.percentage}% of n=${enhanced.n}`
        });
      }
    }
    
    // Auto-fill mean from notes if missing
    if (!hasMean && parsedFromNotes.mean) {
      enhanced.mean = parsedFromNotes.mean;
      hasMean = true;
      enhancements.push({
        row: index + 1,
        treatment: row.treatment,
        outcome: row.measureName,
        field: 'mean',
        oldValue: null,
        newValue: parsedFromNotes.mean,
        calculation: 'Extracted from notes'
      });
    }
    
    // Auto-fill sd from notes if missing
    if (!hasSD && parsedFromNotes.sd) {
      enhanced.sd = parsedFromNotes.sd;
      hasSD = true;
      enhancements.push({
        row: index + 1,
        treatment: row.treatment,
        outcome: row.measureName,
        field: 'sd',
        oldValue: null,
        newValue: parsedFromNotes.sd,
        calculation: 'Extracted from notes'
      });
    }
    
    // Auto-fill TE from notes if parsed (HR/OR/RR)
    if (!hasTE && parsedFromNotes.te !== undefined) {
      enhanced.te = Number(parsedFromNotes.te.toFixed(4));
      enhanced.seTE = parsedFromNotes.seTE ? Number(parsedFromNotes.seTE.toFixed(4)) : null;
      hasTE = true;
      enhancements.push({
        row: index + 1,
        treatment: row.treatment,
        outcome: row.measureName,
        field: 'te/seTE',
        oldValue: null,
        newValue: `te=${enhanced.te}, seTE=${enhanced.seTE}`,
        calculation: 'Calculated from HR/OR/RR in notes'
      });
    }
    
    // Calculate TE/seTE for binary outcomes if not present
    if (hasEvents && hasN && !hasTE) {
      const calculated = calculateBinaryTE(enhanced.n, enhanced.event);
      if (calculated) {
        enhanced.te = calculated.te;
        enhanced.seTE = calculated.seTE;
        const note = calculated.note ? ` (${calculated.note})` : '';
        enhancements.push({
          row: index + 1,
          treatment: row.treatment,
          outcome: row.measureName,
          field: 'te/seTE',
          oldValue: null,
          newValue: `te=${calculated.te}, seTE=${calculated.seTE}${note}`,
          calculation: `log-odds: log(${enhanced.event}/(${enhanced.n}-${enhanced.event}))`
        });
      }
    }
    
    // Calculate TE/seTE for continuous outcomes if not present
    if (hasMean && !hasTE) {
      const calculated = calculateContinuousTE(
        enhanced.mean, 
        hasSD ? enhanced.sd : null,
        hasN ? enhanced.n : null
      );
      if (calculated) {
        enhanced.te = calculated.te;
        if (calculated.seTE) {
          enhanced.seTE = calculated.seTE;
        }
        enhancements.push({
          row: index + 1,
          treatment: row.treatment,
          outcome: row.measureName,
          field: 'te/seTE',
          oldValue: null,
          newValue: `te=${calculated.te}${calculated.seTE ? `, seTE=${calculated.seTE}` : ''}`,
          calculation: 'Mean change is the treatment effect; seTE = SD/sqrt(n)'
        });
      }
    }
    
    // Validation checks
    if (hasEvents && hasN) {
      if (Number(enhanced.event) > Number(enhanced.n)) {
        rowErrors.push(`Row ${index + 1}: Events (${enhanced.event}) > n (${enhanced.n})`);
      }
    }
    
    // Missing essential numerical data warning
    if (!hasEvents && !hasMean && !hasTE) {
      rowWarnings.push(`Row ${index + 1}: No outcome data (missing events, mean, and TE)`);
    }
    
    // Missing uncertainty measures
    if (enhanced.te !== null && enhanced.te !== undefined && !enhanced.seTE) {
      rowWarnings.push(`Row ${index + 1}: Has TE but missing seTE`);
    }
    
    // Source tracking validation
    if (!row.page) rowWarnings.push(`Row ${index + 1}: Missing page number`);
    if (!row.table) rowWarnings.push(`Row ${index + 1}: Missing table reference`);
    
    warnings.push(...rowWarnings);
    errors.push(...rowErrors);
    
    return enhanced;
  });
  
  return {
    data: enhanced,
    warnings,
    errors,
    enhancements,
    isValid: errors.length === 0,
    completenessScore: calculateCompletenessScore(enhanced)
  };
}

/**
 * Validate and enhance comparative extraction data
 */
export function validateComparativeData(data) {
  const warnings = [];
  const errors = [];
  const enhancements = [];
  
  const enhanced = data.map((row, index) => {
    const rowWarnings = [];
    const rowErrors = [];
    const enhanced = { ...row };
    
    // Parse notes for values
    const parsedFromNotes = parseNotesForValues(row.notes);
    
    // Required fields
    if (!row.treatment1) rowErrors.push(`Row ${index + 1}: Missing treatment1`);
    if (!row.treatment2) rowErrors.push(`Row ${index + 1}: Missing treatment2`);
    if (!row.measureName) rowErrors.push(`Row ${index + 1}: Missing measureName`);
    
    let hasTE = row.te !== null && row.te !== undefined && row.te !== '';
    const hasN1 = row.n1 !== null && row.n1 !== undefined && row.n1 !== '';
    const hasN2 = row.n2 !== null && row.n2 !== undefined && row.n2 !== '';
    
    // Extract TE/seTE from notes if not present
    if (!hasTE && parsedFromNotes.te !== undefined) {
      enhanced.te = Number(parsedFromNotes.te.toFixed(4));
      enhanced.seTE = parsedFromNotes.seTE ? Number(parsedFromNotes.seTE.toFixed(4)) : null;
      hasTE = true;
      enhancements.push({
        row: index + 1,
        treatment1: row.treatment1,
        treatment2: row.treatment2,
        outcome: row.measureName,
        field: 'te/seTE',
        oldValue: null,
        newValue: `te=${enhanced.te}, seTE=${enhanced.seTE}`,
        calculation: 'Calculated from HR/OR/RR in notes'
      });
    }
    
    // Calculate log OR from event1/event2 if we have binary data but no TE
    const hasEvent1 = row.event1 !== null && row.event1 !== undefined && row.event1 !== '';
    const hasEvent2 = row.event2 !== null && row.event2 !== undefined && row.event2 !== '';
    
    if (!hasTE && hasEvent1 && hasEvent2 && hasN1 && hasN2) {
      const logOR = calculateLogOddsRatio(row.n1, row.n2, row.event1, row.event2);
      if (logOR) {
        enhanced.te = logOR.te;
        enhanced.seTE = logOR.seTE;
        hasTE = true;
        enhancements.push({
          row: index + 1,
          treatment1: row.treatment1,
          treatment2: row.treatment2,
          outcome: row.measureName,
          field: 'te/seTE',
          oldValue: null,
          newValue: `te=${logOR.te}, seTE=${logOR.seTE}`,
          calculation: `Log OR from events: log((${row.event1}/${row.n1-row.event1})/(${row.event2}/${row.n2-row.event2}))${logOR.note ? ' - ' + logOR.note : ''}`
        });
      }
    }
    
    if (!hasTE) {
      rowWarnings.push(`Row ${index + 1}: Missing treatment effect (TE)`);
    }
    
    // Must have standard error
    if (hasTE && !enhanced.seTE) {
      rowErrors.push(`Row ${index + 1}: Has TE but missing seTE (required for meta-analysis)`);
    }
    
    // Sample sizes helpful
    if (!hasN1 || !hasN2) {
      rowWarnings.push(`Row ${index + 1}: Missing sample sizes (n1 and/or n2)`);
    }
    
    // Source tracking
    if (!row.page) rowWarnings.push(`Row ${index + 1}: Missing page number`);
    if (!row.table) rowWarnings.push(`Row ${index + 1}: Missing table reference`);
    
    warnings.push(...rowWarnings);
    errors.push(...rowErrors);
    
    return enhanced;
  });
  
  return {
    data: enhanced,
    warnings,
    errors,
    enhancements,
    isValid: errors.length === 0,
    completenessScore: calculateCompletenessScore(enhanced)
  };
}

/**
 * Calculate completeness score (0-100)
 */
function calculateCompletenessScore(data) {
  if (!data.length) return 0;
  
  let totalScore = 0;
  
  data.forEach(row => {
    let rowScore = 0;
    let maxScore = 7;
    
    // Critical fields
    if (row.treatment || row.treatment1) rowScore++;
    if (row.measureName) rowScore++;
    if (row.timePoint) rowScore++;
    if (row.n || row.n1) rowScore++;
    
    // Must have outcome data
    if (row.te !== null && row.te !== undefined && row.te !== '') rowScore += 2;
    else if (row.event !== null || row.mean !== null) rowScore++;
    
    // Must have uncertainty
    if (row.seTE || row.sd) rowScore++;
    
    totalScore += (rowScore / maxScore) * 100;
  });
  
  return Math.round(totalScore / data.length);
}

/**
 * Detect and fix common extraction issues
 */
export function refineSingleArmData(data) {
  const validation = validateSingleArmData(data);
  
  return {
    originalData: data,
    refinedData: validation.data,
    changes: validation.enhancements,
    warnings: validation.warnings,
    errors: validation.errors,
    completenessScore: validation.completenessScore,
    summary: {
      totalRows: data.length,
      rowsEnhanced: validation.enhancements.length,
      warningsCount: validation.warnings.length,
      errorsCount: validation.errors.length
    }
  };
}

export function refineComparativeData(data) {
  const validation = validateComparativeData(data);
  
  return {
    originalData: data,
    refinedData: validation.data,
    changes: validation.enhancements,
    warnings: validation.warnings,
    errors: validation.errors,
    completenessScore: validation.completenessScore,
    summary: {
      totalRows: data.length,
      rowsEnhanced: validation.enhancements.length,
      warningsCount: validation.warnings.length,
      errorsCount: validation.errors.length
    }
  };
}

/**
 * Comprehensive extraction refinement
 */
export function refineExtraction(extraction) {
  const singleArmResult = refineSingleArmData(extraction.singleArmData || []);
  const comparativeResult = refineComparativeData(extraction.comparativeData || []);
  
  return {
    extractionId: extraction.id,
    singleArm: singleArmResult,
    comparative: comparativeResult,
    overallCompleteness: Math.round(
      (singleArmResult.completenessScore + comparativeResult.completenessScore) / 2
    ),
    timestamp: new Date().toISOString()
  };
}
