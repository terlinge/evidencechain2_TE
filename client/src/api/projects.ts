import api from './api';
import { Project } from '../types/project';

export const getProjects = async (): Promise<Project[]> => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProject = async (projectId: string): Promise<Project> => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const updateProject = async (projectId: string, data: Partial<Project>): Promise<Project> => {
  const response = await api.patch(`/projects/${projectId}`, data);
  return response.data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}`);
};
