import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import DataExtraction from './pages/DataExtraction';
import NewProject from './pages/NewProject';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/:projectId/studies/:studyId/extract" element={<DataExtraction />} />
          <Route path="projects/:projectId/studies/:studyId/extract/:extractionId" element={<DataExtraction />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
