import React from 'react';
import { Box, Flex, Heading, IconButton, useColorMode, Button } from '@chakra-ui/react';
import { FaMoon, FaSun, FaGithub, FaBook } from 'react-icons/fa';

const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  
  return (
    <Box as="header" bg="white" boxShadow="md" py={4}>
      <Flex 
        maxW="container.xl" 
        mx="auto" 
        px={4} 
        justify="space-between" 
        align="center"
      >
        <Heading 
          as="h1" 
          size="md" 
          color="brand.600" 
          className="flex items-center"
          display="flex"
          alignItems="center"
        >
          <Box as={FaBook} mr={2} size="24px" />
          AI Translator
        </Heading>
        
        <Flex align="center" gap={3}>
          <Button 
            size="sm" 
            variant="ghost" 
            colorScheme="brand"
            fontWeight="medium"
          >
            Documentation
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            colorScheme="brand"
            fontWeight="medium"
          >
            About
          </Button>
          
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <FaMoon /> : <FaSun />}
            onClick={toggleColorMode}
            size="sm"
            variant="ghost"
            colorScheme="brand"
          />
          
          <IconButton
            as="a"
            href="https://github.com/yourusername/ai-book-translator"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            icon={<FaGithub />}
            size="sm"
            variant="ghost"
            colorScheme="brand"
          />
        </Flex>
      </Flex>
    </Box>
  );
};

export default Header;
