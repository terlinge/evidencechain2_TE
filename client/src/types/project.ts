export interface PICOTS {
  // Population
  conditionName: string;
  ageGroupMin?: string;
  ageGroupMax?: string;
  severity?: string;
  conditionGenotype?: string;
  comorbidities?: string[];
  treatmentExperience?: string;
  
  // Interventions & Comparators
  drugs?: Array<{
    name: string;
    dose?: string;
    frequency?: string;
    route?: string;
  }>;
  
  // Outcomes
  primaryOutcomes?: string[];
  secondaryOutcomes?: string[];
  safetyOutcomes?: string[];
  
  // Timing
  minFollowUp?: string;
  maxFollowUp?: string;
  timePoints?: string[];
  
  // Setting
  studyDesigns?: string[];
  settings?: string[];
  countries?: string[];
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  owner: string;
  team: Array<{
    userId: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
  picots?: PICOTS;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalStudies: number;
    totalExtractions: number;
    completedExtractions: number;
  };
}

export interface Study {
  _id: string;
  projectId: string;
  title: string;
  authors: string[];
  doi?: string;
  nctNumber?: string;
  year?: number;
  screeningStatus: 'pending' | 'included' | 'excluded';
  excludedReason?: string;
  documents: Array<{
    _id: string;
    fileName: string;
    fileType: 'main' | 'supplementary' | 'protocol';
    uploadedAt: string;
  }>;
  createdAt: string;
}
