import { Box, Container, HStack, Heading, Button, Menu, MenuButton, MenuList, MenuItem, Avatar } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from '@chakra-ui/icons';

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
      <Container maxW="container.xl">
        <HStack justify="space-between">
          <Heading
            size="lg"
            cursor="pointer"
            onClick={() => navigate('/projects')}
            bgGradient="linear(to-r, blue.500, purple.500)"
            bgClip="text"
          >
            🔬 EvidenceChain
          </Heading>

          <HStack spacing={4}>
            <Button variant="ghost" onClick={() => navigate('/projects')}>
              Projects
            </Button>
            <Button variant="ghost">Documentation</Button>

            <Menu>
              <MenuButton>
                <Avatar size="sm" name="Researcher" bg="blue.500" />
              </MenuButton>
              <MenuList>
                <MenuItem>Profile</MenuItem>
                <MenuItem>Settings</MenuItem>
                <MenuItem>Logout</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}
