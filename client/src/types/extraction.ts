// Core extraction data types
export interface SingleArmExtraction {
  id: string;
  study: string;
  treatment: string;
  measureName: string;
  timePoint: string;
  
  // Sample data
  n: number;
  event?: number;
  time?: number;
  mean?: number;
  sd?: number;
  te?: number;
  seTE?: number;
  
  // Source tracking
  page: string;
  table: string;
  ref: string;
  
  // PICOTS classification
  condition: string;
  age: string;
  severity: string;
  conditionGenotype: string;
  comorbidities: string;
  treatmentExperience: string;
  monoAdjunct: string;
  
  // Quality control
  sensitivity: boolean;
  exclude: boolean;
  reviewed: boolean;
  
  // Notes
  notes: string;
  calculationNotes: string;
  
  // Manual edit tracking
  manuallyEdited?: boolean;
}

export interface ComparativeExtraction {
  id: string;
  study: string;
  treatment1: string;
  treatment2: string;
  measureName: string;
  timePoint: string;
  
  // Sample sizes
  n1: number;
  n2: number;
  
  // Effect estimates
  te: number;
  seTE: number;
  
  // Source tracking
  page: string;
  table: string;
  ref: string;
  
  // PICOTS classification
  condition: string;
  age: string;
  severity: string;
  conditionGenotype: string;
  comorbidities: string;
  treatmentExperience: string;
  monoAdjunct: string;
  
  // Quality control
  sensitivity: boolean;
  exclude: boolean;
  reviewed: boolean;
  
  // Notes
  notes: string;
  calculationNotes: string;
  
  // Manual edit tracking
  manuallyEdited?: boolean;
}

export interface AIExtractionResult {
  extractionId: string;
  documentId: string;
  singleArmData: SingleArmExtraction[];
  comparativeData: ComparativeExtraction[];
  aiConfidence: {
    overall: number;
    fieldLevel: { [key: string]: number };
  };
  warnings: string[];
  picotsRelevance?: {
    isRelevant: boolean;
    matchScore: number;
    mismatches: string[];
  };
  status: 'processing' | 'completed' | 'error';
}

export function getEmptySingleArmExtraction(): SingleArmExtraction {
  return {
    id: `sa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    study: '',
    treatment: '',
    measureName: '',
    timePoint: '',
    n: 0,
    event: undefined,
    time: undefined,
    mean: undefined,
    sd: undefined,
    te: undefined,
    seTE: undefined,
    page: '',
    table: '',
    ref: '',
    condition: '',
    age: '',
    severity: '',
    conditionGenotype: '',
    comorbidities: '',
    treatmentExperience: '',
    monoAdjunct: '',
    sensitivity: false,
    exclude: false,
    reviewed: false,
    notes: '',
    calculationNotes: ''
  };
}

export function getEmptyComparativeExtraction(): ComparativeExtraction {
  return {
    id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    study: '',
    treatment1: '',
    treatment2: '',
    measureName: '',
    timePoint: '',
    n1: 0,
    n2: 0,
    te: 0,
    seTE: 0,
    page: '',
    table: '',
    ref: '',
    condition: '',
    age: '',
    severity: '',
    conditionGenotype: '',
    comorbidities: '',
    treatmentExperience: '',
    monoAdjunct: '',
    sensitivity: false,
    exclude: false,
    reviewed: false,
    notes: '',
    calculationNotes: ''
  };
}
