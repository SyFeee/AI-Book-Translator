import React, { useState, useCallback } from 'react';
import { 
  Box, 
  Card, 
  CardBody, 
  VStack, 
  Heading, 
  Text, 
  Button, 
  Center, 
  useToast,
  Icon,
  List,
  ListItem,
  ListIcon,
  Flex
} from '@chakra-ui/react';
import { useDropzone } from 'react-dropzone';
import { FaFileUpload, FaFilePdf, FaFileWord, FaFileAlt, FaCheckCircle } from 'react-icons/fa';
import axios from 'axios';

const DocumentUploader = ({ onDocumentUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();
  
  const onDrop = useCallback(async (acceptedFiles) => {
    // Only process the first file
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Check file type
    const acceptedTypes = ['.docx', '.pdf', '.epub', '.txt', '.md'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.'));
    
    if (!acceptedTypes.some(type => fileExt.toLowerCase() === type)) {
      toast({
        title: 'Unsupported file format',
        description: 'Please upload a document in DOCX, PDF, EPUB, TXT, or MD format.',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      return;
    }
    
    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'The maximum file size is 50MB.',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      return;
    }
    
    setIsUploading(true);
    
    // Create form data for file upload
    const formData = new FormData();
    formData.append('document', file);
    
    try {
      console.log('Uploading file:', file.name);
      
      // Upload the file to the server
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Upload response:', response.data);
      
      // Handle successful upload
      toast({
        title: 'Document uploaded successfully',
        description: `${file.name} is ready for translation.`,
        status: 'success',
        duration: 5000,
        isClosable: true
      });
      
      // Pass the document info to parent component
      onDocumentUploaded(response.data);
    } catch (error) {
      console.error('Upload error:', error);
      let errorMsg = 'Unknown error occurred';
      
      if (error.response) {
        // The request was made and the server responded with an error status
        console.error('Server response error:', error.response.data);
        errorMsg = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        errorMsg = 'No response from server. Please check if the server is running.';
      } else {
        // Something happened in setting up the request
        console.error('Request setup error:', error.message);
        errorMsg = `Request failed: ${error.message}`;
      }
      
      toast({
        title: 'Upload failed',
        description: errorMsg,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast, onDocumentUploaded]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: false
  });
  
  // Get appropriate icon for file type
  const getFileIcon = (extension) => {
    switch (extension.toLowerCase()) {
      case '.pdf':
        return FaFilePdf;
      case '.docx':
        return FaFileWord;
      default:
        return FaFileAlt;
    }
  };
  
  return (
    <VStack spacing={8} w="full">
      <Card 
        w="full" 
        variant="outline" 
        boxShadow="lg"
        borderRadius="xl"
        overflow="hidden"
        bg="white"
      >
        <CardBody>
          <VStack spacing={6} py={4}>
            <Heading as="h3" size="md" color="gray.700">
              Upload a Document
            </Heading>
            
            <Box 
              {...getRootProps()} 
              w="full"
              p={10}
              bg={isDragActive ? 'blue.50' : 'gray.50'}
              borderWidth={2}
              borderStyle="dashed"
              borderColor={isDragActive ? 'blue.300' : 'gray.300'}
              borderRadius="lg"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                borderColor: 'blue.300',
                bg: 'blue.50'
              }}
            >
              <input {...getInputProps()} />
              <Center flexDirection="column">
                <Icon as={FaFileUpload} w={12} h={12} color="brand.500" mb={4} />
                
                <Text fontWeight="medium" textAlign="center" mb={2}>
                  {isDragActive 
                    ? 'Drop your document here...' 
                    : 'Drag & drop your document here, or click to select'}
                </Text>
                
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Supported formats: DOCX, PDF, EPUB, TXT, MD (max 50MB)
                </Text>
              </Center>
            </Box>
            
            <Button 
              colorScheme="brand" 
              size="lg" 
              isLoading={isUploading}
              loadingText="Uploading..."
              leftIcon={<Icon as={isUploading ? undefined : FaFileUpload} />}
              px={8}
              isDisabled={true} // Disabled because we're using dropzone
              opacity={0.7}
            >
              Select File
            </Button>
          </VStack>
        </CardBody>
      </Card>
      
      <Card 
        w="full" 
        variant="outline"
        borderRadius="xl"
        overflow="hidden"
        bg="white"
      >
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading as="h3" size="md" color="gray.700" mb={2}>
              How It Works
            </Heading>
            
            <List spacing={3}>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={FaCheckCircle} color="green.500" mt={1} />
                <Text>
                  <strong>Document Processing:</strong> We extract text while preserving formatting and structure
                </Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={FaCheckCircle} color="green.500" mt={1} />
                <Text>
                  <strong>Smart Chunking:</strong> Large documents are broken into manageable segments at logical points
                </Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={FaCheckCircle} color="green.500" mt={1} />
                <Text>
                  <strong>Context Preservation:</strong> Our AI maintains narrative coherence across the entire document
                </Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={FaCheckCircle} color="green.500" mt={1} />
                <Text>
                  <strong>Terminology Consistency:</strong> Names, places, and key terms are translated uniformly
                </Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={FaCheckCircle} color="green.500" mt={1} />
                <Text>
                  <strong>Privacy Focused:</strong> All processing happens with your local LLM for enhanced security
                </Text>
              </ListItem>
            </List>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default DocumentUploader;
