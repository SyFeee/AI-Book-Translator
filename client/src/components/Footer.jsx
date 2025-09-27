import React from 'react';
import { Box, Container, Text, Link, Flex, Divider } from '@chakra-ui/react';

const Footer = () => {
  return (
    <Box as="footer" bg="white" py={8} mt="auto">
      <Container maxW="container.xl">
        <Divider mb={6} />
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align="center"
          textAlign={{ base: 'center', md: 'left' }}
        >
          <Box>
            <Text color="gray.600" fontSize="sm" fontWeight="medium">
              © {new Date().getFullYear()} AI Book Translator
            </Text>
            <Text color="gray.500" fontSize="xs" mt={1}>
              Powered by local language models
            </Text>
          </Box>
          
          <Flex gap={6} mt={{ base: 4, md: 0 }} flexWrap="wrap" justifyContent="center">
            <Link href="#" color="gray.600" fontSize="sm" fontWeight="medium">Privacy Policy</Link>
            <Link href="#" color="gray.600" fontSize="sm" fontWeight="medium">Terms of Service</Link>
            <Link href="#" color="gray.600" fontSize="sm" fontWeight="medium">Documentation</Link>
            <Link href="#" color="gray.600" fontSize="sm" fontWeight="medium">Contact Support</Link>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
