import api from './api';

export const extractMetadata = async (file: File) => {
  const formData = new FormData();
  formData.append('document', file);
  
  const response = await api.post('/extract-metadata', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};
