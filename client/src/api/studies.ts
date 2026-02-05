import api from './api';
import { Study } from '../types/project';

export const getStudies = async (projectId: string): Promise<Study[]> => {
  const response = await api.get(`/projects/${projectId}/studies`);
  return response.data;
};

export const getStudy = async (projectId: string, studyId: string): Promise<Study> => {
  const response = await api.get(`/projects/${projectId}/studies/${studyId}`);
  return response.data;
};

export const createStudy = async (projectId: string, data: Partial<Study>): Promise<Study> => {
  const response = await api.post(`/projects/${projectId}/studies`, data);
  return response.data;
};

export const updateStudy = async (
  projectId: string,
  studyId: string,
  data: Partial<Study>
): Promise<Study> => {
  const response = await api.patch(`/projects/${projectId}/studies/${studyId}`, data);
  return response.data;
};

export const deleteStudy = async (projectId: string, studyId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}/studies/${studyId}`);
};
