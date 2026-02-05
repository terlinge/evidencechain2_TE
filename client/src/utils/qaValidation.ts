import { SingleArmExtraction, ComparativeExtraction } from '../types/extraction';

export interface QAIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  rowIndex: number;
  rowId: string;
}

export interface QAReport {
  passed: boolean;
  errors: QAIssue[];
  warnings: QAIssue[];
  info: QAIssue[];
  summary: string;
}

export function validateSingleArmData(data: SingleArmExtraction[]): QAReport {
  const errors: QAIssue[] = [];
  const warnings: QAIssue[] = [];
  const info: QAIssue[] = [];

  data.forEach((row, index) => {
    // REQUIRED FIELD CHECKS
    if (!row.study || row.study.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'study',
        message: 'Study name is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.treatment || row.treatment.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'treatment',
        message: 'Treatment is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.measureName || row.measureName.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'measureName',
        message: 'Measure name (outcome) is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.n || row.n <= 0) {
      errors.push({
        severity: 'error',
        field: 'n',
        message: 'Sample size (n) must be greater than 0',
        rowIndex: index,
        rowId: row.id
      });
    }

    // DATA CONSISTENCY CHECKS
    if (row.event && row.event > row.n) {
      errors.push({
        severity: 'error',
        field: 'event',
        message: `Events (${row.event}) cannot exceed sample size (${row.n})`,
        rowIndex: index,
        rowId: row.id
      });
    }

    if (row.sd && row.sd < 0) {
      errors.push({
        severity: 'error',
        field: 'sd',
        message: 'Standard deviation cannot be negative',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (row.seTE && row.seTE < 0) {
      errors.push({
        severity: 'error',
        field: 'seTE',
        message: 'Standard error cannot be negative',
        rowIndex: index,
        rowId: row.id
      });
    }

    // WARNING CHECKS
    if (!row.page || row.page.trim() === '') {
      warnings.push({
        severity: 'warning',
        field: 'page',
        message: 'Page number missing - source tracking recommended',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.timePoint || row.timePoint.trim() === '') {
      warnings.push({
        severity: 'warning',
        field: 'timePoint',
        message: 'Time point missing',
        rowIndex: index,
        rowId: row.id
      });
    }

    // Check if row has NO outcome data
    const hasOutcomeData = row.event !== null && row.event !== undefined ||
                          row.mean !== null && row.mean !== undefined ||
                          row.te !== null && row.te !== undefined;
    
    if (!hasOutcomeData) {
      warnings.push({
        severity: 'warning',
        field: 'outcomes',
        message: 'No outcome data (event/mean/te) - at least one should be present',
        rowIndex: index,
        rowId: row.id
      });
    }

    // INFO CHECKS
    if (row.manuallyEdited) {
      info.push({
        severity: 'info',
        field: 'manuallyEdited',
        message: 'This row has been manually edited',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.condition || row.condition.trim() === '') {
      info.push({
        severity: 'info',
        field: 'condition',
        message: 'PICOTS condition not specified',
        rowIndex: index,
        rowId: row.id
      });
    }
  });

  // Check for treatment-comparator pairing
  const outcomes = new Set<string>();
  const treatmentsByOutcome = new Map<string, Set<string>>();
  
  data.forEach(row => {
    const outcomeKey = `${row.measureName}|${row.timePoint}`;
    outcomes.add(outcomeKey);
    
    if (!treatmentsByOutcome.has(outcomeKey)) {
      treatmentsByOutcome.set(outcomeKey, new Set());
    }
    treatmentsByOutcome.get(outcomeKey)!.add(row.treatment);
  });

  // Warn if outcomes don't have comparator arms
  treatmentsByOutcome.forEach((treatments, outcomeKey) => {
    const [measureName, timePoint] = outcomeKey.split('|');
    if (treatments.size === 1) {
      warnings.push({
        severity: 'warning',
        field: 'treatment',
        message: `Outcome "${measureName}" at "${timePoint}" only has ONE arm - missing comparator data?`,
        rowIndex: -1,
        rowId: 'group-validation'
      });
    }
  });

  const passed = errors.length === 0;
  const summary = `QA: ${errors.length} errors, ${warnings.length} warnings, ${info.length} info`;

  return { passed, errors, warnings, info, summary };
}

export function validateComparativeData(data: ComparativeExtraction[]): QAReport {
  const errors: QAIssue[] = [];
  const warnings: QAIssue[] = [];
  const info: QAIssue[] = [];

  data.forEach((row, index) => {
    // REQUIRED FIELD CHECKS
    if (!row.study || row.study.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'study',
        message: 'Study name is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.treatment1 || row.treatment1.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'treatment1',
        message: 'Treatment 1 is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.treatment2 || row.treatment2.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'treatment2',
        message: 'Treatment 2 is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.measureName || row.measureName.trim() === '') {
      errors.push({
        severity: 'error',
        field: 'measureName',
        message: 'Measure name (outcome) is required',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.n1 || row.n1 <= 0) {
      errors.push({
        severity: 'error',
        field: 'n1',
        message: 'Sample size n1 must be greater than 0',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.n2 || row.n2 <= 0) {
      errors.push({
        severity: 'error',
        field: 'n2',
        message: 'Sample size n2 must be greater than 0',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (row.seTE <= 0) {
      errors.push({
        severity: 'error',
        field: 'seTE',
        message: 'Standard error (seTE) must be greater than 0',
        rowIndex: index,
        rowId: row.id
      });
    }

    // WARNING CHECKS
    if (!row.page || row.page.trim() === '') {
      warnings.push({
        severity: 'warning',
        field: 'page',
        message: 'Page number missing - source tracking recommended',
        rowIndex: index,
        rowId: row.id
      });
    }

    if (!row.timePoint || row.timePoint.trim() === '') {
      warnings.push({
        severity: 'warning',
        field: 'timePoint',
        message: 'Time point missing',
        rowIndex: index,
        rowId: row.id
      });
    }

    // INFO CHECKS
    if (row.manuallyEdited) {
      info.push({
        severity: 'info',
        field: 'manuallyEdited',
        message: 'This row has been manually edited',
        rowIndex: index,
        rowId: row.id
      });
    }
  });

  const passed = errors.length === 0;
  const summary = `QA: ${errors.length} errors, ${warnings.length} warnings, ${info.length} info`;

  return { passed, errors, warnings, info, summary };
}
