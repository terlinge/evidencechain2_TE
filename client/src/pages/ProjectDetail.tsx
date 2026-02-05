import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  HStack,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardBody,
  Badge,
  Spinner,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useDisclosure,
  SimpleGrid,
  Progress,
} from '@chakra-ui/react';
import { ArrowBackIcon, AddIcon, ExternalLinkIcon, AttachmentIcon } from '@chakra-ui/icons';
import { getProject } from '../api/projects';
import { getStudies, createStudy } from '../api/studies';
import { uploadAndExtract } from '../api/aiExtraction';
import { extractMetadata } from '../api/metadata';
import { getStudyExtractions } from '../api/extractions';
import { Project, Study } from '../types/project';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedMetadata, setExtractedMetadata] = useState<any>(null);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, studiesData] = await Promise.all([
        getProject(projectId!),
        getStudies(projectId!),
      ]);
      setProject(projectData);
      setStudies(studiesData);
    } catch (error) {
      toast({
        title: 'Error loading project',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setExtracting(true);
    
    toast({
      title: 'Extracting metadata...',
      description: 'AI is reading your document',
      status: 'info',
      duration: 2000,
    });

    try {
      console.log('📤 Uploading file for metadata extraction:', file.name);
      const result = await extractMetadata(file);
      
      console.log('✅ Metadata extracted:', result.metadata);
      setExtractedMetadata(result.metadata);
      setExtracting(false);
      
      toast({
        title: 'Metadata extracted!',
        description: 'Review the information below',
        status: 'success',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('❌ Metadata extraction failed:', error);
      setExtracting(false);
      toast({
        title: 'Extraction failed',
        description: error.message || 'Could not extract metadata',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCreateStudy = async () => {
    if (!selectedFile || !extractedMetadata) {
      toast({
        title: 'Please upload a document first',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      setUploading(true);
      
      console.log('📝 Creating study with extracted metadata...');
      const study = await createStudy(projectId!, {
        title: extractedMetadata.title,
        authors: extractedMetadata.authors.split(',').map((a: string) => a.trim()),
        doi: extractedMetadata.doi || undefined,
        nctNumber: extractedMetadata.nctNumber || undefined,
        year: extractedMetadata.year ? parseInt(extractedMetadata.year) : undefined,
      });
      
      console.log('✅ Study created:', study._id);
      setStudies([...studies, study]);
      
      console.log('🚀 Starting outcome data extraction...');
      const formData = new FormData();
      formData.append('document', selectedFile);
      
      const { extractionId } = await uploadAndExtract(projectId!, study._id, formData);
      
      console.log('✅ Extraction started:', extractionId);
      
      toast({
        title: 'Study created!',
        description: 'Extracting outcome data now. Click "Extract Data" to view results.',
        status: 'success',
        duration: 5000,
      });
      
      setSelectedFile(null);
      setExtractedMetadata(null);
      setUploading(false);
      onClose();
      
      // Navigate to extraction view with extractionId
      setTimeout(() => {
        navigate(`/projects/${projectId}/studies/${study._id}/extract/${extractionId}`);
      }, 1000);
    } catch (error: any) {
      console.error('❌ Error:', error);
      toast({
        title: 'Error creating study',
        description: error.message || 'Failed to create study',
        status: 'error',
        duration: 5000,
      });
      setUploading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    setExtractedMetadata(null);
    setExtracting(false);
    onClose();
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading project...</Text>
      </Box>
    );
  }

  if (!project) {
    return <Text>Project not found</Text>;
  }

  return (
    <Box>
      <Button leftIcon={<ArrowBackIcon />} variant="ghost" mb={4} onClick={() => navigate('/projects')}>
        Back to Projects
      </Button>

      <VStack align="start" spacing={6} mb={8}>
        <Box>
          <Heading size="xl">{project.name}</Heading>
          <Text color="gray.600" mt={2}>{project.description}</Text>
          {project.picots && (
            <Badge colorScheme="purple" mt={2}>PICOTS: {project.picots.conditionName}</Badge>
          )}
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} w="full">
          <Card>
            <CardBody>
              <Text fontSize="sm" color="gray.600">Total Studies</Text>
              <Heading size="lg">{project.stats.totalStudies}</Heading>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Text fontSize="sm" color="gray.600">Completed Extractions</Text>
              <Heading size="lg">{project.stats.completedExtractions}/{project.stats.totalExtractions}</Heading>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Text fontSize="sm" color="gray.600">Team Members</Text>
              <Heading size="lg">{project.team.length}</Heading>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>

      <Tabs colorScheme="blue">
        <TabList>
          <Tab>Studies</Tab>
          <Tab>PICOTS</Tab>
          <Tab>Team</Tab>
          <Tab>Export</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <HStack justify="space-between" mb={4}>
              <Heading size="md">Studies ({studies.length})</Heading>
              <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={onOpen}>
                Add Study & Upload Document
              </Button>
            </HStack>

            {studies.length === 0 ? (
              <Card textAlign="center" py={8}>
                <CardBody>
                  <Text color="gray.500">No studies yet. Click "Add Study & Upload Document" to get started!</Text>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody p={0}>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Title</Th>
                        <Th>First Author</Th>
                        <Th>Year</Th>
                        <Th>Status</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {studies.map((study) => (
                        <Tr key={study._id}>
                          <Td maxW="300px">
                            <Text noOfLines={2} fontWeight="medium">{study.title}</Text>
                          </Td>
                          <Td>{study.authors[0] || 'N/A'}</Td>
                          <Td>{study.year || 'N/A'}</Td>
                          <Td>
                            <Badge colorScheme={study.screeningStatus === 'included' ? 'green' : 'gray'}>
                              {study.screeningStatus}
                            </Badge>
                          </Td>
                          <Td>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={async () => {
                                // Check if extraction exists for this study
                                try {
                                  const extractions = await getStudyExtractions(projectId!, study._id);
                                  if (extractions && extractions.length > 0) {
                                    // Navigate to most recent extraction
                                    navigate(`/projects/${projectId}/studies/${study._id}/extract/${extractions[0]._id}`);
                                  } else {
                                    // No extraction yet, go to upload page
                                    navigate(`/projects/${projectId}/studies/${study._id}/extract`);
                                  }
                                } catch (error) {
                                  console.error('Error checking extractions:', error);
                                  navigate(`/projects/${projectId}/studies/${study._id}/extract`);
                                }
                              }}
                            >
                              Extract Data
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4}>
              <Heading size="md">PICOTS Criteria</Heading>
              {project.picots ? (
                <Card w="full">
                  <CardBody>
                    <VStack align="start" spacing={4}>
                      <Box>
                        <Text fontWeight="bold" mb={1}>Population</Text>
                        <Text>Condition: {project.picots.conditionName}</Text>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              ) : (
                <Text color="gray.500">No PICOTS criteria defined</Text>
              )}
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4}>
              <Heading size="md">Team Members</Heading>
              <Card w="full">
                <CardBody>
                  {project.team.map((member, i) => (
                    <HStack key={i} justify="space-between" py={2}>
                      <Text>{member.email}</Text>
                      <Badge>{member.role}</Badge>
                    </HStack>
                  ))}
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4}>
              <Heading size="md">Export Data</Heading>
              <Card w="full">
                <CardBody>
                  <VStack spacing={3} align="start">
                    <Text color="gray.600">Export extracted data for analysis</Text>
                    <HStack>
                      <Button colorScheme="blue" leftIcon={<ExternalLinkIcon />}>Export to R</Button>
                      <Button leftIcon={<ExternalLinkIcon />}>Export to Stata</Button>
                      <Button leftIcon={<ExternalLinkIcon />}>Export to Excel</Button>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={isOpen} onClose={handleCloseModal} size="xl" closeOnOverlayClick={!extracting && !uploading}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Document & Extract Study Info</ModalHeader>
          <ModalCloseButton isDisabled={extracting || uploading} />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {!selectedFile && !extracting && (
                <VStack spacing={4} py={8} borderWidth={2} borderStyle="dashed" borderRadius="lg" borderColor="gray.300">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <AttachmentIcon boxSize={12} color="gray.400" />
                  <Text fontSize="lg" fontWeight="semibold">Upload Your Document</Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    AI will automatically extract study title, authors, DOI, year,<br />
                    and clinical trial outcome data
                  </Text>
                  <Button
                    leftIcon={<AttachmentIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    colorScheme="blue"
                    size="lg"
                  >
                    Choose PDF, Word, or Text File
                  </Button>
                  <Text fontSize="xs" color="gray.500">
                    Max 50MB • PDF, Word (.doc/.docx), Text files
                  </Text>
                </VStack>
              )}

              {extracting && (
                <VStack spacing={4} py={8}>
                  <Spinner size="xl" color="blue.500" thickness="4px" />
                  <Text fontSize="lg" fontWeight="semibold">Extracting Metadata...</Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    AI is reading your document to extract:<br />
                    Study title, authors, DOI, NCT number, year
                  </Text>
                  <Progress size="sm" isIndeterminate colorScheme="blue" w="full" />
                </VStack>
              )}

              {extractedMetadata && !extracting && (
                <VStack spacing={4} align="stretch">
                  <Card bg="green.50" borderWidth={1} borderColor="green.200">
                    <CardBody>
                      <HStack>
                        <Badge colorScheme="green" fontSize="sm">✓ Extracted from Document</Badge>
                        <Text fontSize="sm" color="gray.600">Review and edit if needed</Text>
                      </HStack>
                    </CardBody>
                  </Card>

                  <FormControl>
                    <FormLabel>Study Title</FormLabel>
                    <Input
                      value={extractedMetadata.title}
                      onChange={(e) => setExtractedMetadata({ ...extractedMetadata, title: e.target.value })}
                      size="lg"
                      fontWeight="medium"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Authors</FormLabel>
                    <Input
                      value={extractedMetadata.authors}
                      onChange={(e) => setExtractedMetadata({ ...extractedMetadata, authors: e.target.value })}
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>Comma-separated</Text>
                  </FormControl>
                  
                  <HStack spacing={4}>
                    <FormControl flex={2}>
                      <FormLabel>DOI</FormLabel>
                      <Input
                        value={extractedMetadata.doi}
                        onChange={(e) => setExtractedMetadata({ ...extractedMetadata, doi: e.target.value })}
                        placeholder="10.1056/NEJMoa..."
                      />
                    </FormControl>
                    
                    <FormControl flex={1}>
                      <FormLabel>Year</FormLabel>
                      <Input
                        type="number"
                        value={extractedMetadata.year}
                        onChange={(e) => setExtractedMetadata({ ...extractedMetadata, year: e.target.value })}
                        placeholder="2024"
                      />
                    </FormControl>
                  </HStack>

                  <FormControl>
                    <FormLabel>NCT Number (Optional)</FormLabel>
                    <Input
                      value={extractedMetadata.nctNumber}
                      onChange={(e) => setExtractedMetadata({ ...extractedMetadata, nctNumber: e.target.value })}
                      placeholder="NCT01234567"
                    />
                  </FormControl>

                  {uploading && (
                    <Box>
                      <Text fontSize="sm" mb={2} fontWeight="medium">Creating study and extracting data...</Text>
                      <Progress size="sm" isIndeterminate colorScheme="blue" />
                    </Box>
                  )}
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal} isDisabled={extracting || uploading}>
              Cancel
            </Button>
            {extractedMetadata && (
              <Button 
                colorScheme="blue" 
                onClick={handleCreateStudy} 
                isDisabled={!extractedMetadata.title || !extractedMetadata.authors || uploading}
                isLoading={uploading}
                size="lg"
              >
                Save Study & Extract Data
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
