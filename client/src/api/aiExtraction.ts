import api from './api';
import { AIExtractionResult } from '../types/extraction';

export const uploadAndExtract = async (
  projectId: string,
  studyId: string,
  formData: FormData
): Promise<{ extractionId: string; status: string }> => {
  const response = await api.post(
    `/projects/${projectId}/studies/${studyId}/extract-ai`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const getExtractionResults = async (
  projectId: string,
  extractionId: string
): Promise<AIExtractionResult> => {
  const response = await api.get(`/projects/${projectId}/extractions/${extractionId}/ai-results`);
  return response.data;
};

export const updateExtraction = async (
  projectId: string,
  extractionId: string,
  data: Partial<AIExtractionResult>
): Promise<AIExtractionResult> => {
  const response = await api.patch(`/projects/${projectId}/extractions/${extractionId}`, data);
  return response.data;
};

export const submitExtraction = async (
  projectId: string,
  extractionId: string
): Promise<void> => {
  await api.post(`/projects/${projectId}/extractions/${extractionId}/submit`);
};
