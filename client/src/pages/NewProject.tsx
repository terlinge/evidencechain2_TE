import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Card,
  CardBody,
  useToast,
  Progress,
  Badge,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { createProject } from '../api/projects';

export default function NewProject() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    conditionName: '',
    ageGroupMin: '',
    severity: '',
    drugs: '',
    primaryOutcomes: '',
    minFollowUp: '',
    studyDesigns: '',
  });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({
        title: 'Project name required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      setCreating(true);

      // Parse PICOTS data if provided
      const picots = formData.conditionName
        ? {
            conditionName: formData.conditionName,
            ageGroupMin: formData.ageGroupMin || undefined,
            severity: formData.severity || undefined,
            drugs: formData.drugs
              ? formData.drugs.split(',').map((d) => ({ name: d.trim() }))
              : undefined,
            primaryOutcomes: formData.primaryOutcomes
              ? formData.primaryOutcomes.split(',').map((o) => o.trim())
              : undefined,
            minFollowUp: formData.minFollowUp || undefined,
            studyDesigns: formData.studyDesigns
              ? formData.studyDesigns.split(',').map((s) => s.trim())
              : undefined,
          }
        : undefined;

      const project = await createProject({
        name: formData.name,
        description: formData.description,
        picots,
      });

      toast({
        title: 'Project created successfully!',
        status: 'success',
        duration: 3000,
      });

      navigate(`/projects/${project._id}`);
    } catch (error) {
      toast({
        title: 'Error creating project',
        description: 'Failed to create project',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.name.length > 0;
    return true;
  };

  return (
    <Box maxW="container.md" mx="auto">
      <Button
        leftIcon={<ArrowBackIcon />}
        variant="ghost"
        mb={4}
        onClick={() => navigate('/projects')}
      >
        Back to Projects
      </Button>

      <VStack align="start" spacing={6}>
        <Box w="full">
          <Heading size="xl">Create New Project</Heading>
          <Text color="gray.600" mt={2}>
            Set up your systematic review project
          </Text>
        </Box>

        <Box w="full">
          <HStack spacing={4} mb={2}>
            <Badge colorScheme={step >= 1 ? 'blue' : 'gray'}>1. Basic Info</Badge>
            <Badge colorScheme={step >= 2 ? 'blue' : 'gray'}>2. PICOTS (Optional)</Badge>
            <Badge colorScheme={step >= 3 ? 'blue' : 'gray'}>3. Review</Badge>
          </HStack>
          <Progress value={(step / 3) * 100} colorScheme="blue" size="sm" />
        </Box>

        <Card w="full">
          <CardBody>
            {step === 1 && (
              <VStack spacing={4} align="start">
                <Heading size="md">Basic Information</Heading>
                <FormControl isRequired>
                  <FormLabel>Project Name</FormLabel>
                  <Input
                    placeholder="e.g., ATTR Amyloidosis Network Meta-Analysis"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    placeholder="Brief description of your systematic review..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </FormControl>
              </VStack>
            )}

            {step === 2 && (
              <VStack spacing={4} align="start">
                <Box>
                  <Heading size="md">PICOTS Criteria (Optional)</Heading>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Define inclusion criteria to help validate extracted data
                  </Text>
                </Box>

                <FormControl>
                  <FormLabel>Condition/Population</FormLabel>
                  <Input
                    placeholder="e.g., Type 2 Diabetes Mellitus"
                    value={formData.conditionName}
                    onChange={(e) => setFormData({ ...formData, conditionName: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Age Group (minimum)</FormLabel>
                  <Input
                    placeholder="e.g., 18"
                    value={formData.ageGroupMin}
                    onChange={(e) => setFormData({ ...formData, ageGroupMin: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Disease Severity</FormLabel>
                  <Input
                    placeholder="e.g., Moderate to severe"
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Interventions (comma-separated)</FormLabel>
                  <Input
                    placeholder="e.g., Semaglutide, Dulaglutide, Empagliflozin"
                    value={formData.drugs}
                    onChange={(e) => setFormData({ ...formData, drugs: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Primary Outcomes (comma-separated)</FormLabel>
                  <Input
                    placeholder="e.g., HbA1c reduction, Weight change, Cardiovascular events"
                    value={formData.primaryOutcomes}
                    onChange={(e) =>
                      setFormData({ ...formData, primaryOutcomes: e.target.value })
                    }
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Minimum Follow-up</FormLabel>
                  <Input
                    placeholder="e.g., 6 months"
                    value={formData.minFollowUp}
                    onChange={(e) => setFormData({ ...formData, minFollowUp: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Study Designs (comma-separated)</FormLabel>
                  <Input
                    placeholder="e.g., Randomized Controlled Trial, Observational Study"
                    value={formData.studyDesigns}
                    onChange={(e) => setFormData({ ...formData, studyDesigns: e.target.value })}
                  />
                </FormControl>
              </VStack>
            )}

            {step === 3 && (
              <VStack spacing={4} align="start">
                <Heading size="md">Review & Create</Heading>

                <Box w="full" p={4} bg="gray.50" borderRadius="md">
                  <Text fontWeight="bold" mb={2}>
                    Project Name
                  </Text>
                  <Text>{formData.name || 'Not provided'}</Text>
                </Box>

                {formData.description && (
                  <Box w="full" p={4} bg="gray.50" borderRadius="md">
                    <Text fontWeight="bold" mb={2}>
                      Description
                    </Text>
                    <Text>{formData.description}</Text>
                  </Box>
                )}

                {formData.conditionName && (
                  <Box w="full" p={4} bg="gray.50" borderRadius="md">
                    <Text fontWeight="bold" mb={2}>
                      PICOTS Criteria
                    </Text>
                    <VStack align="start" spacing={1}>
                      <Text>• Condition: {formData.conditionName}</Text>
                      {formData.ageGroupMin && <Text>• Age: {formData.ageGroupMin}+ years</Text>}
                      {formData.severity && <Text>• Severity: {formData.severity}</Text>}
                      {formData.drugs && <Text>• Interventions: {formData.drugs}</Text>}
                      {formData.primaryOutcomes && (
                        <Text>• Outcomes: {formData.primaryOutcomes}</Text>
                      )}
                      {formData.minFollowUp && <Text>• Follow-up: {formData.minFollowUp}</Text>}
                      {formData.studyDesigns && <Text>• Designs: {formData.studyDesigns}</Text>}
                    </VStack>
                  </Box>
                )}

                {!formData.conditionName && (
                  <Text color="gray.500" fontSize="sm">
                    No PICOTS criteria defined (you can add this later)
                  </Text>
                )}
              </VStack>
            )}
          </CardBody>
        </Card>

        <HStack justify="space-between" w="full">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate('/projects'))}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 3 ? (
            <Button colorScheme="blue" onClick={() => setStep(step + 1)} isDisabled={!canProceed()}>
              Next
            </Button>
          ) : (
            <Button
              colorScheme="green"
              onClick={handleSubmit}
              isLoading={creating}
              loadingText="Creating..."
            >
              Create Project
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}
