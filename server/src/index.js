import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FileDB from './db/fileDB.js';
import { extractClinicalData, extractMetadata } from './services/aiExtractionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  }
});

// Initialize database collections
const projectsDB = new FileDB('projects');
const studiesDB = new FileDB('studies');
const extractionsDB = new FileDB('extractions');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('✅ Using file-based database (data persists in server/data/ folder)');

// Projects API
app.get('/api/projects', (req, res) => {
  const projects = projectsDB.findAll();
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = projectsDB.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const project = projectsDB.insert({
    ...req.body,
    owner: 'user-1',
    team: [{ userId: 'user-1', email: 'researcher@university.edu', role: 'owner' }],
    stats: {
      totalStudies: 0,
      totalExtractions: 0,
      completedExtractions: 0,
    },
  });
  res.json(project);
});

app.patch('/api/projects/:id', (req, res) => {
  const project = projectsDB.update(req.params.id, req.body);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.delete('/api/projects/:id', (req, res) => {
  const success = projectsDB.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Project not found' });
  }
  // Also delete related studies and extractions
  studiesDB.deleteMany({ projectId: req.params.id });
  extractionsDB.deleteMany({ projectId: req.params.id });
  res.json({ message: 'Project deleted successfully' });
});

// Studies API
app.get('/api/projects/:projectId/studies', (req, res) => {
  const studies = studiesDB.find({ projectId: req.params.projectId });
  res.json(studies);
});

app.get('/api/projects/:projectId/studies/:studyId', (req, res) => {
  const study = studiesDB.findById(req.params.studyId);
  if (!study || study.projectId !== req.params.projectId) {
    return res.status(404).json({ error: 'Study not found' });
  }
  res.json(study);
});

app.post('/api/projects/:projectId/studies', (req, res) => {
  const study = studiesDB.insert({
    ...req.body,
    projectId: req.params.projectId,
    screeningStatus: req.body.screeningStatus || 'pending',
    documents: [],
  });
  
  // Update project stats
  const project = projectsDB.findById(req.params.projectId);
  if (project) {
    projectsDB.update(req.params.projectId, {
      stats: {
        ...project.stats,
        totalStudies: project.stats.totalStudies + 1,
      },
    });
  }
  
  res.json(study);
});

app.patch('/api/projects/:projectId/studies/:studyId', (req, res) => {
  const study = studiesDB.update(req.params.studyId, req.body);
  if (!study) {
    return res.status(404).json({ error: 'Study not found' });
  }
  res.json(study);
});

app.delete('/api/projects/:projectId/studies/:studyId', (req, res) => {
  const success = studiesDB.delete(req.params.studyId);
  if (!success) {
    return res.status(404).json({ error: 'Study not found' });
  }
  // Also delete related extractions
  extractionsDB.deleteMany({ studyId: req.params.studyId });
  
  // Update project stats
  const project = projectsDB.findById(req.params.projectId);
  if (project) {
    projectsDB.update(req.params.projectId, {
      stats: {
        ...project.stats,
        totalStudies: Math.max(0, project.stats.totalStudies - 1),
      },
    });
  }
  
  res.json({ message: 'Study deleted successfully' });
});

// Metadata extraction endpoint
app.post('/api/extract-metadata', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('📄 Extracting metadata from:', req.file.originalname);

  try {
    const metadata = await extractMetadata(req.file.path, req.file.originalname);
    
    res.json({
      metadata,
      fileName: req.file.originalname,
      filePath: req.file.path,
      tempFileId: req.file.filename,
    });
  } catch (error) {
    console.error('❌ Metadata extraction error:', error);
    res.status(500).json({ error: 'Failed to extract metadata' });
  }
});

// Extractions API - REAL AI EXTRACTION
app.post('/api/projects/:projectId/studies/:studyId/extract-ai', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const extractionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  
  console.log('📄 File uploaded:', req.file.originalname);
  console.log('💾 Saved to:', req.file.path);
  console.log('🤖 Starting REAL AI extraction...');

  // Get project PICOTS for context
  const project = projectsDB.findById(req.params.projectId);
  const projectPICOTS = project?.picots || {};

  // Create placeholder extraction record immediately
  extractionsDB.insert({
    _id: extractionId,
    projectId: req.params.projectId,
    studyId: req.params.studyId,
    documentId: req.file.filename,
    documentPath: req.file.path,
    documentName: req.file.originalname,
    status: 'processing',
    singleArmData: [],
    comparativeData: [],
    aiConfidence: { overall: 0, fieldLevel: {} },
    warnings: [],
  });

  // Return extraction ID immediately, process in background
  res.json({ extractionId, status: 'processing' });

  // Process extraction asynchronously
  (async () => {
    try {
      console.log('🔄 Calling AI extraction service...');
      const extractedData = await extractClinicalData(
        req.file.path,
        req.file.originalname,
        projectPICOTS
      );

      console.log('💾 Updating extraction in database...');
      extractionsDB.update(extractionId, {
        status: 'completed',
        singleArmData: extractedData.singleArmData,
        comparativeData: extractedData.comparativeData,
        aiConfidence: extractedData.aiConfidence,
        warnings: extractedData.warnings,
      });
      
      console.log('✅ AI Extraction completed:', extractionId);
      console.log(`   - ${extractedData.singleArmData.length} single-arm records`);
      console.log(`   - ${extractedData.comparativeData.length} comparative records`);
      console.log(`   - Confidence: ${(extractedData.aiConfidence.overall * 100).toFixed(1)}%`);
      
      // Update project stats
      if (project) {
        projectsDB.update(req.params.projectId, {
          stats: {
            ...project.stats,
            totalExtractions: (project.stats.totalExtractions || 0) + 1,
          },
        });
      }
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      extractionsDB.update(extractionId, {
        status: 'error',
        error: error.message,
      });
    }
  })();
});

app.get('/api/projects/:projectId/studies/:studyId/extractions', (req, res) => {
  const extractions = extractionsDB.find({ studyId: req.params.studyId });
  res.json(extractions);
});

app.get('/api/projects/:projectId/extractions/:extractionId/ai-results', (req, res) => {
  console.log('🔍 GET extraction request:', {
    projectId: req.params.projectId,
    extractionId: req.params.extractionId
  });
  
  const extraction = extractionsDB.findById(req.params.extractionId);
  console.log('📦 Found extraction:', extraction ? 'YES' : 'NO');
  
  if (!extraction) {
    const allIds = extractionsDB.data ? extractionsDB.data.map(e => e._id) : [];
    console.log('❌ Extraction not found. Available IDs:', allIds);
    return res.status(404).json({ error: 'Extraction not found' });
  }
  
  console.log('✅ Returning extraction data - Status:', extraction.status);
  res.json({
    extractionId: extraction._id,
    documentId: extraction.documentId,
    documentName: extraction.documentName,
    singleArmData: extraction.singleArmData || [],
    comparativeData: extraction.comparativeData || [],
    aiConfidence: extraction.aiConfidence,
    warnings: extraction.warnings || [],
    status: extraction.status,
  });
});

app.patch('/api/projects/:projectId/extractions/:extractionId', (req, res) => {
  const extraction = extractionsDB.update(req.params.extractionId, {
    singleArmData: req.body.singleArmData,
    comparativeData: req.body.comparativeData,
    status: 'reviewed',
  });
  
  if (!extraction) {
    return res.status(404).json({ error: 'Extraction not found' });
  }
  
  res.json(extraction);
});

app.post('/api/projects/:projectId/extractions/:extractionId/submit', (req, res) => {
  const extraction = extractionsDB.update(req.params.extractionId, {
    status: 'completed',
    reviewed: true,
    reviewedAt: new Date().toISOString(),
  });
  
  if (!extraction) {
    return res.status(404).json({ error: 'Extraction not found' });
  }
  
  // Update project stats
  const project = projectsDB.findById(req.params.projectId);
  if (project) {
    projectsDB.update(req.params.projectId, {
      stats: {
        ...project.stats,
        completedExtractions: (project.stats.completedExtractions || 0) + 1,
      },
    });
  }
  
  res.json({ message: 'Extraction submitted successfully', extraction });
});

// Basic route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EvidenceChain API is running with file-based database',
    timestamp: new Date().toISOString(),
    database: 'File-based (JSON)',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'SERVER_ERROR', 
    message: err.message || 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database: File-based (JSON files in server/data/)`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
