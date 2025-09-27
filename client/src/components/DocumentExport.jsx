import React, { useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Icon,
  Divider,
  Alert,
  AlertIcon,
  Badge,
  Flex,
  SimpleGrid,
  useToast,
  Progress,
  useColorModeValue,
  ButtonGroup,
  Tooltip,
  StatGroup,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText
} from '@chakra-ui/react';
import { 
  FaArrowLeft, 
  FaDownload, 
  FaFilePdf, 
  FaFileWord, 
  FaFileAlt, 
  FaCheck, 
  FaFileCode,
  FaBook,
  FaClock,
  FaCheckCircle,
  FaStar
} from 'react-icons/fa';

const DocumentExport = ({ translationResults, documentInfo, onBack }) => {
  const [exportFormat, setExportFormat] = useState('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');
  
  // Available export formats with details
  const exportFormats = [
    { 
      value: 'txt', 
      label: 'Plain Text', 
      extension: '.txt',
      icon: FaFileAlt, 
      description: 'Simple text format, universally compatible',
      size: 'Small',
      compatibility: 'Universal',
      recommended: false
    },
    { 
      value: 'docx', 
      label: 'Microsoft Word', 
      extension: '.docx',
      icon: FaFileWord, 
      description: 'Formatted document with styles and structure',
      size: 'Medium',
      compatibility: 'Office, Google Docs',
      recommended: true
    },
    { 
      value: 'pdf', 
      label: 'PDF Document', 
      extension: '.pdf',
      icon: FaFilePdf, 
      description: 'Professional format with preserved formatting',
      size: 'Medium',
      compatibility: 'Universal readers',
      recommended: true
    },
    { 
      value: 'epub', 
      label: 'EPUB eBook', 
      extension: '.epub',
      icon: FaBook, 
      description: 'eBook format for digital reading devices',
      size: 'Small',
      compatibility: 'E-readers, tablets',
      recommended: false
    },
    { 
      value: 'html', 
      label: 'HTML Web Page', 
      extension: '.html',
      icon: FaFileCode, 
      description: 'Web-compatible format with CSS styling',
      size: 'Small',
      compatibility: 'Web browsers',
      recommended: false
    }
  ];
  
  const selectedFormat = exportFormats.find(f => f.value === exportFormat);
  
  // Handle export click
  const handleExport = async (format = exportFormat) => {
    setIsExporting(true);
    setExportSuccess(false);
    setDownloadProgress(0);
    
    try {
      // Get the translationId from translationResults
      const translationId = translationResults?.translationId;
      
      if (!translationId) {
        throw new Error('Translation ID not found. Please restart the translation process.');
      }

      // Simulate download progress for user feedback
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);
      
      // Generate download URL
      const downloadUrl = `/api/translation/download/${translationId}?format=${format}`;
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', ''); // Let server determine filename
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Complete progress
      clearInterval(progressInterval);
      setDownloadProgress(100);
      
      const formatInfo = exportFormats.find(f => f.value === format);
      
      // Show success notification
      toast({
        title: 'Export Successful!',
        description: `Your translated document has been downloaded as ${formatInfo?.label} (${formatInfo?.extension}).`,
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top'
      });
      
      setExportSuccess(true);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to download translation. Please try again.',
        status: 'error',
        duration: 7000,
        isClosable: true,
        position: 'top'
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setDownloadProgress(0), 3000);
    }
  };

  return (
    <Card 
      w="full" 
      variant="outline" 
      boxShadow="xl"
      borderRadius="xl"
      overflow="hidden"
      bg={bgColor}
      borderColor="green.200"
      borderWidth="2px"
    >
      <CardBody>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="center">
            <HStack>
              <Icon as={FaCheckCircle} color="green.500" boxSize={6} />
              <Heading as="h3" size="lg" color="gray.700">
                Translation Complete!
              </Heading>
            </HStack>
            
            <Badge colorScheme="green" fontSize="md" px={4} py={2} borderRadius="full" variant="solid">
              Ready to Export
            </Badge>
          </Flex>

          {/* Translation Summary */}
          <Card bg={cardBgColor} variant="outline">
            <CardBody>
              <StatGroup>
                <Stat>
                  <StatLabel>Document</StatLabel>
                  <StatNumber fontSize="lg">{documentInfo?.fileName}</StatNumber>
                  <StatHelpText>Successfully translated</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Segments</StatLabel>
                  <StatNumber fontSize="lg">{translationResults?.translatedChunks?.length || 0}</StatNumber>
                  <StatHelpText>Processed with context</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Quality</StatLabel>
                  <StatNumber fontSize="lg" color="green.500">Professional</StatNumber>
                  <StatHelpText>AI-powered translation</StatHelpText>
                </Stat>
              </StatGroup>
            </CardBody>
          </Card>
          
          {exportSuccess && (
            <Alert status="success" borderRadius="lg" variant="left-accent">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">Download Started!</Text>
                <Text fontSize="sm">Your translated document should appear in your downloads folder.</Text>
              </Box>
            </Alert>
          )}

          {/* Download Progress */}
          {isExporting && (
            <Box>
              <Text mb={2} fontWeight="medium">Preparing Download...</Text>
              <Progress 
                value={downloadProgress} 
                size="lg" 
                colorScheme="green"
                borderRadius="full"
                isAnimated
                hasStripe
              />
              <Text fontSize="sm" color="gray.600" mt={1}>
                Generating {selectedFormat?.label} file...
              </Text>
            </Box>
          )}
          
          {/* Quick Download Buttons */}
          <Box>
            <Text mb={4} fontSize="lg" fontWeight="semibold" color="gray.700">
              Quick Download (Recommended)
            </Text>
            <ButtonGroup spacing={4} variant="outline" size="lg">
              <Tooltip label="Best for editing and sharing" placement="top">
                <Button
                  leftIcon={<Icon as={FaFileWord} />}
                  colorScheme="blue"
                  variant="solid"
                  onClick={() => handleExport('docx')}
                  isLoading={isExporting && exportFormat === 'docx'}
                  loadingText="Downloading..."
                  size="lg"
                  rightIcon={<Icon as={FaStar} color="yellow.400" />}
                >
                  Word Document
                </Button>
              </Tooltip>
              
              <Tooltip label="Perfect for printing and sharing" placement="top">
                <Button
                  leftIcon={<Icon as={FaFilePdf} />}
                  colorScheme="red"
                  variant="solid"
                  onClick={() => handleExport('pdf')}
                  isLoading={isExporting && exportFormat === 'pdf'}
                  loadingText="Downloading..."
                  size="lg"
                  rightIcon={<Icon as={FaStar} color="yellow.400" />}
                >
                  PDF Document
                </Button>
              </Tooltip>
            </ButtonGroup>
          </Box>

          <Divider />
          
          {/* All Format Options */}
          <Box>
            <Text mb={4} fontSize="lg" fontWeight="semibold" color="gray.700">
              All Export Options
            </Text>
            
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {exportFormats.map((format) => (
                <Card 
                  key={format.value}
                  variant="outline"
                  cursor="pointer"
                  transition="all 0.2s"
                  borderColor={exportFormat === format.value ? 'blue.300' : 'gray.200'}
                  bg={exportFormat === format.value ? 'blue.50' : cardBgColor}
                  _hover={{ 
                    transform: 'translateY(-2px)', 
                    boxShadow: 'md',
                    borderColor: 'blue.300'
                  }}
                  onClick={() => setExportFormat(format.value)}
                >
                  <CardBody>
                    <VStack align="start" spacing={3}>
                      <HStack>
                        <Icon 
                          as={format.icon} 
                          boxSize={6} 
                          color={exportFormat === format.value ? 'blue.500' : 'gray.500'} 
                        />
                        <VStack align="start" spacing={0}>
                          <HStack>
                            <Text fontWeight="bold" color="gray.700">
                              {format.label}
                            </Text>
                            {format.recommended && (
                              <Badge colorScheme="orange" size="sm">
                                Recommended
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="sm" color="gray.500">
                            {format.extension}
                          </Text>
                        </VStack>
                      </HStack>
                      
                      <Text fontSize="sm" color="gray.600">
                        {format.description}
                      </Text>
                      
                      <HStack justify="space-between" w="full">
                        <Badge variant="outline" colorScheme="gray">
                          Size: {format.size}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">
                          {format.compatibility}
                        </Text>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </Box>

          {/* Selected Format Download */}
          {selectedFormat && (
            <Card bg="blue.50" borderColor="blue.200" borderWidth="2px">
              <CardBody>
                <VStack spacing={4}>
                  <HStack>
                    <Icon as={selectedFormat.icon} color="blue.500" boxSize={8} />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold" fontSize="lg">
                        {selectedFormat.label} {selectedFormat.extension}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {selectedFormat.description}
                      </Text>
                    </VStack>
                  </HStack>
                  
                  <Button
                    leftIcon={<Icon as={FaDownload} />}
                    colorScheme="blue"
                    size="lg"
                    onClick={() => handleExport()}
                    isLoading={isExporting}
                    loadingText="Preparing Download..."
                    w="full"
                    variant="solid"
                  >
                    Download {selectedFormat.label}
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          )}
          
          {/* Navigation */}
          <Divider />
          <HStack justify="space-between">
            <Button 
              leftIcon={<Icon as={FaArrowLeft} />} 
              variant="outline"
              onClick={onBack}
              size="lg"
            >
              Back to Preview
            </Button>
            
            <Text fontSize="sm" color="gray.500">
              Translation completed at {new Date().toLocaleString()}
            </Text>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default DocumentExport;
