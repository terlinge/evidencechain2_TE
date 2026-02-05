import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  Progress,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { ArrowBackIcon, CheckCircleIcon, DownloadIcon, WarningIcon, AttachmentIcon } from '@chakra-ui/icons';
import { uploadAndExtract, getExtractionResults, updateExtraction, submitExtraction } from '../api/aiExtraction';
import { AIExtractionResult, SingleArmExtraction, ComparativeExtraction } from '../types/extraction';
import { exportSingleArmToCSV, exportComparativeToCSV } from '../utils/exportCSV';
import { validateSingleArmData, validateComparativeData, QAReport } from '../utils/qaValidation';
import ExpandedSingleArmTable from '../components/extraction/ExpandedSingleArmTable';
import ExpandedComparativeTable from '../components/extraction/ExpandedComparativeTable';

export default function DataExtraction() {
  const { projectId, studyId, extractionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extraction, setExtraction] = useState<AIExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [qaReport, setQaReport] = useState<{ singleArm?: QAReport; comparative?: QAReport } | null>(null);

  // Polling function that can be called from anywhere
  const startPolling = async (extractionId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 120 seconds max for large documents
    
    const pollResults = async (): Promise<void> => {
      try {
        console.log(`🔍 Polling for results (attempt ${attempts + 1}/${maxAttempts})...`);
        const results = await getExtractionResults(projectId!, extractionId);
        
        console.log('📊 Extraction status:', results.status);
        console.log('📊 Single-arm count:', results.singleArmData?.length || 0);
        console.log('📊 Comparative count:', results.comparativeData?.length || 0);
        
        if (results.status === 'completed') {
          console.log('✅ Extraction completed! Setting state...');
          setExtraction(results);
          setProcessing(false);
          
          // Run QA validation
          const singleArmQA = validateSingleArmData(results.singleArmData);
          const comparativeQA = validateComparativeData(results.comparativeData);
          setQaReport({ singleArm: singleArmQA, comparative: comparativeQA });
          
          toast({
            title: 'Extraction complete!',
            description: `Found ${results.singleArmData.length} single-arm and ${results.comparativeData.length} comparative outcomes`,
            status: 'success',
            duration: 5000,
          });
          
          console.log('✅ State updated - extraction:', extraction);
          console.log('✅ Processing flag:', processing);
        } else if (results.status === 'error') {
          throw new Error('Extraction failed on server');
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(pollResults, 1000);
          } else {
            throw new Error('Extraction timeout - please refresh and check results');
          }
        }
      } catch (error) {
        console.error('Error polling results:', error);
        setProcessing(false);
        toast({
          title: 'Polling error',
          description: error instanceof Error ? error.message : 'Failed to check extraction status',
          status: 'error',
          duration: 5000,
        });
      }
    };
    
    await pollResults();
  };

  // Load existing extraction if extractionId is provided in URL
  useEffect(() => {
    if (extractionId && projectId) {
      loadExistingExtraction();
    }
  }, [extractionId, projectId]);

  const loadExistingExtraction = async () => {
    if (!extractionId || !projectId) {
      console.log('Missing params - extractionId:', extractionId, 'projectId:', projectId);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Loading extraction:', {
        projectId,
        extractionId,
        url: `/projects/${projectId}/extractions/${extractionId}/ai-results`
      });
      
      const results = await getExtractionResults(projectId, extractionId);
      console.log('✅ LOADED EXTRACTION RESULTS:');
      console.log('  Status:', results.status);
      console.log('  Single-arm records:', results.singleArmData?.length || 0);
      console.log('  Comparative records:', results.comparativeData?.length || 0);
      console.log('  Full data:', JSON.stringify(results, null, 2));
      
      setExtraction(results);
      
      // If still processing, start polling
      if (results.status === 'processing') {
        console.log('🔄 Extraction still processing, starting poll loop...');
        setLoading(false);
        startPolling(extractionId);
      } else {
        // Run QA validation for completed extractions
        const singleArmQA = validateSingleArmData(results.singleArmData);
        const comparativeQA = validateComparativeData(results.comparativeData);
        setQaReport({ singleArm: singleArmQA, comparative: comparativeQA });
        
        setLoading(false);
        
        toast({
          title: 'Extraction loaded',
          description: `Status: ${results.status} - ${results.singleArmData?.length || 0} single-arm + ${results.comparativeData?.length || 0} comparative outcomes`,
          status: 'success',
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('Error loading extraction:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast({
        title: 'Error loading extraction',
        description: error.response?.data?.error || error.message || 'Could not load extraction data',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, Word document, or text file',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 50MB',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    const formData = new FormData();
    formData.append('document', file);

    try {
      setUploading(true);

      console.log('Uploading to:', `/api/projects/${projectId}/studies/${studyId}/extract-ai`);
      
      const { extractionId } = await uploadAndExtract(projectId!, studyId!, formData);
      
      console.log('Upload successful, extractionId:', extractionId);
      setUploading(false);
      setProcessing(true);

      toast({
        title: 'Document uploaded',
        description: 'AI extraction in progress...',
        status: 'info',
        duration: 3000,
      });

      // Poll for results (with timeout)
      let attempts = 0;
      const maxAttempts = 120; // 120 seconds max for large documents
      
      const pollResults = async (): Promise<void> => {
        try {
          console.log(`🔍 Polling for results (attempt ${attempts + 1}/${maxAttempts})...`);
          const results = await getExtractionResults(projectId!, extractionId);
          
          console.log('📊 Extraction status:', results.status);
          console.log('📊 Single-arm count:', results.singleArmData?.length || 0);
          console.log('📊 Comparative count:', results.comparativeData?.length || 0);
          
          if (results.status === 'completed') {
            console.log('✅ Extraction completed! Setting state...');
            setExtraction(results);
            setProcessing(false);
            
            // Run QA validation
            const singleArmQA = validateSingleArmData(results.singleArmData);
            const comparativeQA = validateComparativeData(results.comparativeData);
            setQaReport({ singleArm: singleArmQA, comparative: comparativeQA });
            
            toast({
              title: 'Extraction complete!',
              description: `Found ${results.singleArmData.length} single-arm and ${results.comparativeData.length} comparative outcomes`,
              status: 'success',
              duration: 5000,
            });
            
            console.log('✅ State updated - extraction:', extraction);
            console.log('✅ Processing flag:', processing);
          } else if (results.status === 'error') {
            throw new Error('Extraction failed on server');
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(pollResults, 1000);
            } else {
              throw new Error('Extraction timeout');
            }
          }
        } catch (error) {
          console.error('Error polling results:', error);
          throw error;
        }
      };
      
      await pollResults();

    } catch (error: any) {
      console.error('Extraction error:', error);
      toast({
        title: 'Extraction failed',
        description: error.message || 'Failed to extract data from document',
        status: 'error',
        duration: 5000,
      });
      setUploading(false);
      setProcessing(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveDraft = async () => {
    try {
      await updateExtraction(projectId!, extraction!.extractionId, {
        singleArmData: extraction!.singleArmData,
        comparativeData: extraction!.comparativeData,
      });
      toast({
        title: 'Draft saved',
        description: 'Your changes have been saved',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save draft',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSubmit = async () => {
    try {
      // CRITICAL: Save edited data BEFORE submitting
      await updateExtraction(projectId!, extraction!.extractionId, {
        singleArmData: extraction!.singleArmData,
        comparativeData: extraction!.comparativeData,
      });
      
      await submitExtraction(projectId!, extraction!.extractionId);
      toast({
        title: 'Extraction submitted',
        description: 'Data has been marked as reviewed and saved',
        status: 'success',
        duration: 3000,
      });
      // Don't navigate away - let user stay to view their work
      // navigate(`/projects/${projectId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit extraction',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const updateSingleArmData = (index: number, field: keyof SingleArmExtraction, value: any) => {
    if (!extraction) return;
    const updated = [...extraction.singleArmData];
    updated[index] = { 
      ...updated[index], 
      [field]: value,
      manuallyEdited: true // Track manual edits
    };
    setExtraction({ ...extraction, singleArmData: updated });
  };

  const updateComparativeData = (index: number, field: keyof ComparativeExtraction, value: any) => {
    if (!extraction) return;
    const updated = [...extraction.comparativeData];
    updated[index] = { 
      ...updated[index], 
      [field]: value,
      manuallyEdited: true // Track manual edits
    };
    setExtraction({ ...extraction, comparativeData: updated });
  };

  return (
    <Box>
      <Button
        leftIcon={<ArrowBackIcon />}
        variant="ghost"
        mb={4}
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        Back to Project
      </Button>

      <VStack align="start" spacing={6}>
        <Box>
          <Heading size="xl">Extract Data</Heading>
          <Text color="gray.600" mt={2}>
            {extraction ? 'Review and edit the extracted data below' : 'Upload a PDF document to automatically extract clinical trial outcome data'}
          </Text>
          
          {/* DEBUG INFO */}
          {extraction && (
            <Alert status="info" mt={2}>
              <AlertIcon />
              <Text fontSize="sm">
                <strong>Status:</strong> {extraction.status} | 
                <strong> Single-arm:</strong> {extraction.singleArmData?.length || 0} | 
                <strong> Comparative:</strong> {extraction.comparativeData?.length || 0}
              </Text>
            </Alert>
          )}
        </Box>

        {loading && (
          <Card w="full">
            <CardBody textAlign="center" py={10}>
              <VStack spacing={4}>
                <Progress size="xs" isIndeterminate colorScheme="blue" w="full" />
                <Text fontSize="lg" fontWeight="semibold">Loading extraction...</Text>
                <Text fontSize="sm" color="gray.600">Please wait while we load the extraction data</Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {!extraction && !loading && (
          <Card w="full">
            <CardBody>
              <VStack spacing={4}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {uploading || processing ? (
                  <VStack w="full" spacing={4} py={8}>
                    <Text fontWeight="semibold">
                      {uploading ? 'Uploading document...' : 'AI extraction in progress...'}
                    </Text>
                    <Progress w="full" size="lg" isIndeterminate colorScheme="blue" />
                    <Text fontSize="sm" color="gray.600">
                      {uploading
                        ? 'Your document is being uploaded'
                        : 'Analyzing document structure, detecting tables, and extracting data...'}
                    </Text>
                  </VStack>
                ) : (
                  <VStack spacing={4}>
                    <Button
                      size="lg"
                      colorScheme="blue"
                      leftIcon={<AttachmentIcon />}
                      onClick={() => {
                        console.log('Upload button clicked');
                        fileInputRef.current?.click();
                      }}
                    >
                      Upload Document
                    </Button>
                    
                    <Text fontSize="sm" color="gray.500">
                      Supported formats: PDF, Word, Text files (max 50MB)
                    </Text>
                  </VStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {extraction && extraction.status === 'processing' && (
          <Card w="full">
            <CardBody textAlign="center" py={10}>
              <VStack spacing={4}>
                <Progress size="lg" isIndeterminate colorScheme="blue" w="full" />
                <Text fontSize="lg" fontWeight="semibold">AI Extraction in Progress...</Text>
                <Text fontSize="sm" color="gray.600">
                  Analyzing document structure, detecting tables, and extracting clinical trial data.
                  This may take 30-60 seconds for large documents.
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {extraction && extraction.status === 'completed' && (
          <>
            {extraction.warnings.length > 0 && (
              <Alert status="warning">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <VStack align="start" spacing={1}>
                      {extraction.warnings.map((warning, i) => (
                        <Text key={i} fontSize="sm">
                          • {warning}
                        </Text>
                      ))}
                    </VStack>
                  </AlertDescription>
                </Box>
              </Alert>
            )}

            <Card w="full">
              <CardBody>
                <HStack justify="space-between">
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">AI Confidence Score</Text>
                    <Text fontSize="sm" color="gray.600">
                      Overall accuracy estimate
                    </Text>
                  </VStack>
                  <Badge
                    fontSize="lg"
                    px={3}
                    py={1}
                    colorScheme={
                      extraction.aiConfidence.overall >= 0.9
                        ? 'green'
                        : extraction.aiConfidence.overall >= 0.7
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {(extraction.aiConfidence.overall * 100).toFixed(0)}%
                  </Badge>
                </HStack>
              </CardBody>
            </Card>
            
            {/* QA VALIDATION REPORT */}
            {qaReport && (
              <Card w="full">
                <CardBody>
                  <VStack align="start" spacing={3}>
                    <HStack>
                      <WarningIcon color="blue.500" />
                      <Text fontWeight="semibold">Quality Assurance Report</Text>
                    </HStack>
                    
                    {/* Single-Arm QA */}
                    {qaReport.singleArm && qaReport.singleArm.errors.length > 0 && (
                      <Alert status="error" fontSize="sm">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Single-Arm Data Errors ({qaReport.singleArm.errors.length})</AlertTitle>
                          <AlertDescription>
                            <VStack align="start" spacing={1} mt={1}>
                              {qaReport.singleArm.errors.slice(0, 5).map((issue, i) => (
                                <Text key={i}>
                                  Row {issue.rowIndex + 1}: {issue.message}
                                </Text>
                              ))}
                              {qaReport.singleArm.errors.length > 5 && (
                                <Text fontStyle="italic">...and {qaReport.singleArm.errors.length - 5} more</Text>
                              )}
                            </VStack>
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}
                    
                    {qaReport.singleArm && qaReport.singleArm.warnings.length > 0 && (
                      <Alert status="warning" fontSize="sm">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Single-Arm Data Warnings ({qaReport.singleArm.warnings.length})</AlertTitle>
                          <AlertDescription>
                            <VStack align="start" spacing={1} mt={1}>
                              {qaReport.singleArm.warnings.slice(0, 3).map((issue, i) => (
                                <Text key={i}>
                                  {issue.rowIndex >= 0 ? `Row ${issue.rowIndex + 1}: ` : ''}{issue.message}
                                </Text>
                              ))}
                              {qaReport.singleArm.warnings.length > 3 && (
                                <Text fontStyle="italic">...and {qaReport.singleArm.warnings.length - 3} more</Text>
                              )}
                            </VStack>
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}
                    
                    {/* Comparative QA */}
                    {qaReport.comparative && qaReport.comparative.errors.length > 0 && (
                      <Alert status="error" fontSize="sm">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Comparative Data Errors ({qaReport.comparative.errors.length})</AlertTitle>
                          <AlertDescription>
                            <VStack align="start" spacing={1} mt={1}>
                              {qaReport.comparative.errors.slice(0, 5).map((issue, i) => (
                                <Text key={i}>
                                  Row {issue.rowIndex + 1}: {issue.message}
                                </Text>
                              ))}
                              {qaReport.comparative.errors.length > 5 && (
                                <Text fontStyle="italic">...and {qaReport.comparative.errors.length - 5} more</Text>
                              )}
                            </VStack>
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}
                    
                    {/* Success message if no errors */}
                    {qaReport.singleArm?.passed && qaReport.comparative?.passed && (
                      <Alert status="success" fontSize="sm">
                        <AlertIcon />
                        <Text>All quality checks passed! ✓</Text>
                      </Alert>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            )}

            <Tabs colorScheme="blue" w="full">
              <TabList>
                <Tab>Single-Arm Data ({extraction.singleArmData.length})</Tab>
                <Tab>Comparative Data ({extraction.comparativeData.length})</Tab>
                <Box flex="1" />
                <Button
                  size="sm"
                  leftIcon={<DownloadIcon />}
                  colorScheme="blue"
                  variant="outline"
                  onClick={() => exportSingleArmToCSV(extraction.singleArmData, `${extraction.documentId}-single-arm.csv`)}
                  mr={2}
                >
                  Export Single-Arm CSV
                </Button>
                <Button
                  size="sm"
                  leftIcon={<DownloadIcon />}
                  colorScheme="blue"
                  variant="outline"
                  onClick={() => exportComparativeToCSV(extraction.comparativeData, `${extraction.documentId}-comparative.csv`)}
                >
                  Export Comparative CSV
                </Button>
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <Card>
                    <CardBody p={0} overflowX="auto" maxH="600px">
                      <ExpandedSingleArmTable
                        data={extraction.singleArmData}
                        onUpdate={updateSingleArmData}
                      />
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel px={0}>
                  <Card>
                    <CardBody p={0} overflowX="auto" maxH="600px">
                      <ExpandedComparativeTable
                        data={extraction.comparativeData}
                        onUpdate={updateComparativeData}
                      />
                    </CardBody>
                  </Card>
                </TabPanel>
              </TabPanels>
            </Tabs>

            <HStack justify="space-between" w="full">
              <Button
                colorScheme="blue"
                variant="outline"
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>
              <HStack>
                <Button variant="outline" onClick={() => setExtraction(null)}>
                  Upload Another Document
                </Button>
                <Button colorScheme="green" leftIcon={<CheckCircleIcon />} onClick={handleSubmit}>
                  Accept & Submit
                </Button>
              </HStack>
            </HStack>
          </>
        )}
      </VStack>
    </Box>
  );
}
