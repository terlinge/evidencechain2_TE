import api from './api';

export const getStudyExtractions = async (projectId: string, studyId: string) => {
  const response = await api.get(`/projects/${projectId}/studies/${studyId}/extractions`);
  return response.data;
};

export const refineExtraction = async (projectId: string, extractionId: string, autoApply: boolean = false) => {
  const response = await api.post(`/projects/${projectId}/extractions/${extractionId}/refine`, { autoApply });
  return response.data;
};
