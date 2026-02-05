import api from './api';

export const getStudyExtractions = async (projectId: string, studyId: string) => {
  const response = await api.get(`/projects/${projectId}/studies/${studyId}/extractions`);
  return response.data;
};
