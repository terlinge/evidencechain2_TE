import { SingleArmExtraction, ComparativeExtraction } from '../types/extraction';

export function exportSingleArmToCSV(data: SingleArmExtraction[], filename: string = 'single-arm-data.csv') {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Define ALL 23 single-arm fields in proper order
  const headers = [
    'ID', 'Study', 'Treatment', 'Measure Name', 'Time Point',
    'N', 'Events', 'Time', 'Mean', 'SD', 'TE', 'seTE',
    'Page', 'Table', 'Ref',
    'Condition', 'Age', 'Severity', 'Condition Genotype', 'Comorbidities', 
    'Treatment Experience', 'Mono/Adjunct',
    'Notes', 'Calculation Notes',
    'Sensitivity', 'Exclude', 'Reviewed', 'Manually Edited'
  ];

  const rows = data.map(row => [
    row.id,
    row.study,
    row.treatment,
    row.measureName,
    row.timePoint,
    row.n,
    row.event ?? '',
    row.time ?? '',
    row.mean ?? '',
    row.sd ?? '',
    row.te ?? '',
    row.seTE ?? '',
    row.page,
    row.table,
    row.ref,
    row.condition,
    row.age,
    row.severity,
    row.conditionGenotype,
    row.comorbidities,
    row.treatmentExperience,
    row.monoAdjunct,
    row.notes,
    row.calculationNotes,
    row.sensitivity,
    row.exclude,
    row.reviewed,
    row.manuallyEdited ?? false
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  downloadCSV(csvContent, filename);
}

export function exportComparativeToCSV(data: ComparativeExtraction[], filename: string = 'comparative-data.csv') {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Define ALL 22 comparative fields in proper order
  const headers = [
    'ID', 'Study', 'Treatment 1', 'Treatment 2', 'Measure Name', 'Time Point',
    'N1', 'N2', 'TE', 'seTE',
    'Page', 'Table', 'Ref',
    'Condition', 'Age', 'Severity', 'Condition Genotype', 'Comorbidities',
    'Treatment Experience', 'Mono/Adjunct',
    'Notes', 'Calculation Notes',
    'Sensitivity', 'Exclude', 'Reviewed', 'Manually Edited'
  ];

  const rows = data.map(row => [
    row.id,
    row.study,
    row.treatment1,
    row.treatment2,
    row.measureName,
    row.timePoint,
    row.n1,
    row.n2,
    row.te,
    row.seTE,
    row.page,
    row.table,
    row.ref,
    row.condition,
    row.age,
    row.severity,
    row.conditionGenotype,
    row.comorbidities,
    row.treatmentExperience,
    row.monoAdjunct,
    row.notes,
    row.calculationNotes,
    row.sensitivity,
    row.exclude,
    row.reviewed,
    row.manuallyEdited ?? false
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  downloadCSV(csvContent, filename);
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
