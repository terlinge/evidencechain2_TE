import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  VStack,
  HStack,
  Spinner,
  useToast,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, SettingsIcon } from '@chakra-ui/icons';
import { getProjects, deleteProject } from '../api/projects';
import { Project } from '../types/project';
import { useRef } from 'react';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      toast({
        title: 'Error loading projects',
        description: 'Failed to fetch projects',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteProjectId(projectId);
    onOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProjectId) return;

    try {
      await deleteProject(deleteProjectId);
      setProjects(projects.filter(p => p._id !== deleteProjectId));
      toast({
        title: 'Project deleted',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error deleting project',
        description: 'Failed to delete project',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setDeleteProjectId(null);
      onClose();
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" color="blue.500" />
        <Text mt={4}>Loading projects...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={8}>
        <VStack align="start" spacing={1}>
          <Heading size="xl">My Projects</Heading>
          <Text color="gray.600">Manage your systematic review projects</Text>
        </VStack>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          size="lg"
          onClick={() => navigate('/projects/new')}
        >
          New Project
        </Button>
      </HStack>

      {projects.length === 0 ? (
        <Card textAlign="center" py={12}>
          <CardBody>
            <Text fontSize="lg" color="gray.500" mb={4}>
              No projects yet. Create your first systematic review project!
            </Text>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              onClick={() => navigate('/projects/new')}
            >
              Create Project
            </Button>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {projects.map((project) => (
            <Card
              key={project._id}
              cursor="pointer"
              _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
              onClick={() => navigate(`/projects/${project._id}`)}
              position="relative"
            >
              <CardHeader>
                <HStack justify="space-between" align="start">
                  <Heading size="md" noOfLines={2} flex="1">
                    {project.name}
                  </Heading>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<SettingsIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <MenuList>
                      <MenuItem
                        icon={<DeleteIcon />}
                        color="red.500"
                        onClick={(e) => handleDeleteClick(project._id, e)}
                      >
                        Delete Project
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>
                <HStack mt={2} spacing={2}>
                  {project.picots && (
                    <Badge colorScheme="purple">PICOTS Defined</Badge>
                  )}
                  <Badge colorScheme="gray">
                    {project.team.length} member{project.team.length !== 1 ? 's' : ''}
                  </Badge>
                </HStack>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" color="gray.600" noOfLines={3}>
                  {project.description || 'No description'}
                </Text>
              </CardBody>
              <CardFooter>
                <VStack align="start" w="full" spacing={2}>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" fontWeight="semibold">
                      {project.stats.totalStudies} studies

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Project
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this project? This will permanently delete all studies, extractions, and data associated with this project. This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {project.stats.completedExtractions}/{project.stats.totalExtractions} extracted
                    </Text>
                  </HStack>
                  {project.stats.totalExtractions > 0 && (
                    <Box w="full" bg="gray.200" h="2" borderRadius="full" overflow="hidden">
                      <Box
                        bg="green.400"
                        h="full"
                        w={`${(project.stats.completedExtractions / project.stats.totalExtractions) * 100}%`}
                        transition="width 0.3s"
                      />
                    </Box>
                  )}
                </VStack>
              </CardFooter>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
