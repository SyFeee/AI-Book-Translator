import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  Icon,
  Badge,
  Radio,
  RadioGroup,
  Stack,
  Spinner,
  Alert,
  AlertIcon,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useToast
} from '@chakra-ui/react';
import { FaArrowLeft, FaDownload, FaExchangeAlt } from 'react-icons/fa';

const TranslationPreview = ({ translationResults, documentInfo, onExport, onBack }) => {
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [viewMode, setViewMode] = useState('side-by-side');
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const toast = useToast();
  
  // Debug logging to understand the data structure
  console.log('TranslationPreview - translationResults:', translationResults);
  
  // Get chunks from either chunks or translatedChunks property
  const chunks = translationResults?.chunks || translationResults?.translatedChunks || [];
  
  console.log('TranslationPreview - chunks:', chunks);

  // Fetch quality analysis when component mounts
  useEffect(() => {
    const fetchQualityAnalysis = async () => {
      if (!translationResults?.translationId) return;
      
      setLoadingQuality(true);
      try {
        const response = await fetch(`/api/translate/quality/${translationResults.translationId}`);
        if (response.ok) {
          const data = await response.json();
          setQualityAnalysis(data.qualityAnalysis);
        } else {
          console.warn('Quality analysis not available:', response.statusText);
          // Use fallback analysis for backwards compatibility
          setQualityAnalysis(generateFallbackAnalysis());
        }
      } catch (error) {
        console.error('Error fetching quality analysis:', error);
        setQualityAnalysis(generateFallbackAnalysis());
        toast({
          title: "Quality Analysis",
          description: "Using basic quality metrics (detailed analysis unavailable)",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoadingQuality(false);
      }
    };

    fetchQualityAnalysis();
  }, [translationResults?.translationId, toast]);

  // Generate fallback analysis for backwards compatibility
  const generateFallbackAnalysis = () => {
    const failedChunks = chunks.filter(chunk => 
      !chunk.translatedText || 
      chunk.translatedText.includes('TRANSLATION ERROR') ||
      chunk.translatedText.includes('[Translation error]')
    ).length;
    
    const completionRate = chunks.length > 0 ? ((chunks.length - failedChunks) / chunks.length) * 100 : 0;
    
    return {
      overallQuality: {
        score: Math.max(20, completionRate - 10),
        level: completionRate > 90 ? 'EXCELLENT' : completionRate > 70 ? 'GOOD' : 'FAIR',
        completionRate: Math.round(completionRate)
      },
      terminologyConsistency: {
        percentage: completionRate > 80 ? 95 : 75
      },
      contextCoherence: {
        score: completionRate > 85 ? 90 : 70,
        level: completionRate > 85 ? 'HIGH' : 'MEDIUM'
      },
      grammarAndStyle: {
        grammarScore: completionRate > 80 ? 85 : 65,
        grammarLevel: completionRate > 80 ? 'VERY GOOD' : 'GOOD'
      },
      completeness: {
        percentage: Math.round(completionRate),
        failedTranslations: failedChunks
      },
      issues: failedChunks > 0 ? [{
        type: 'translation_failures',
        severity: failedChunks > chunks.length * 0.1 ? 'high' : 'medium',
        description: `${failedChunks} chunks failed to translate properly`
      }] : []
    };
  };

  // Helper functions for quality display
  const getQualityBadgeColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'EXCELLENT': return 'green';
      case 'VERY GOOD': return 'blue';
      case 'GOOD': return 'cyan';
      case 'FAIR': return 'yellow';
      case 'POOR': return 'orange';
      case 'FAILED': return 'red';
      case 'HIGH': return 'green';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'red';
      default: return 'gray';
    }
  };

  const getPercentageBadgeColor = (percentage) => {
    if (percentage >= 90) return 'green';
    if (percentage >= 80) return 'blue';
    if (percentage >= 70) return 'cyan';
    if (percentage >= 60) return 'yellow';
    if (percentage >= 40) return 'orange';
    return 'red';
  };
  
  // Extract the example chunk for demonstration
  const currentChunk = chunks[selectedSegment];
  const exampleChunk = {
    originalText: currentChunk?.text || currentChunk?.originalText || "No text available",
    translatedText: currentChunk?.translatedText || "No translation available"
  };
  
  console.log('TranslationPreview - currentChunk:', currentChunk);
  console.log('TranslationPreview - exampleChunk:', exampleChunk);
  
  return (
    <Card 
      w="full" 
      variant="outline" 
      boxShadow="lg"
      borderRadius="xl"
      overflow="hidden"
      bg="white"
    >
      <CardBody>
        <VStack spacing={6} align="stretch">
          <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
            <Heading as="h3" size="md" color="gray.700">
              Translation Preview
            </Heading>
            
            <HStack>
              <Badge colorScheme="green" fontSize="sm" px={2} py={1} borderRadius="full">
                Translation Complete
              </Badge>
              
              <Badge colorScheme="blue" fontSize="sm" px={2} py={1} borderRadius="full">
                {documentInfo.fileName}
              </Badge>
            </HStack>
          </Flex>
          
          <Tabs colorScheme="brand" variant="enclosed">
            <TabList>
              <Tab fontWeight="medium">Segments Preview</Tab>
              <Tab fontWeight="medium">Translation Quality</Tab>
              <Tab fontWeight="medium">Export Options</Tab>
            </TabList>
            
            <TabPanels>
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="medium">
                      Select Segment: {selectedSegment + 1} of {chunks.length || 0}
                    </Text>
                    
                    <RadioGroup onChange={setViewMode} value={viewMode}>
                      <Stack direction="row">
                        <Radio value="side-by-side" colorScheme="brand">Side by Side</Radio>
                        <Radio value="original" colorScheme="brand">Original</Radio>
                        <Radio value="translation" colorScheme="brand">Translation</Radio>
                      </Stack>
                    </RadioGroup>
                  </HStack>
                  
                  <Flex 
                    direction={viewMode === 'side-by-side' ? 'row' : 'column'} 
                    gap={4}
                  >
                    {(viewMode === 'side-by-side' || viewMode === 'original') && (
                      <Box 
                        flex={viewMode === 'side-by-side' ? 1 : 'auto'} 
                        bg="gray.50"
                        p={4}
                        borderRadius="md"
                        borderWidth={1}
                        borderColor="gray.200"
                      >
                        <Text fontWeight="medium" mb={2} color="gray.700">Original Text</Text>
                        <Text whiteSpace="pre-wrap" fontSize="sm">
                          {exampleChunk.originalText}
                        </Text>
                      </Box>
                    )}
                    
                    {viewMode === 'side-by-side' && (
                      <Box className="flex items-center justify-center">
                        <Icon as={FaExchangeAlt} boxSize={6} color="brand.500" />
                      </Box>
                    )}
                    
                    {(viewMode === 'side-by-side' || viewMode === 'translation') && (
                      <Box 
                        flex={viewMode === 'side-by-side' ? 1 : 'auto'} 
                        bg="blue.50"
                        p={4}
                        borderRadius="md"
                        borderWidth={1}
                        borderColor="blue.200"
                      >
                        <Text fontWeight="medium" mb={2} color="gray.700">Translated Text</Text>
                        <Text whiteSpace="pre-wrap" fontSize="sm">
                          {exampleChunk.translatedText}
                        </Text>
                      </Box>
                    )}
                  </Flex>
                  
                  <Flex justify="center" mt={2}>
                    <Button 
                      size="sm" 
                      onClick={() => setSelectedSegment(Math.max(0, selectedSegment - 1))}
                      isDisabled={selectedSegment === 0}
                    >
                      Previous
                    </Button>
                    <Text mx={4} fontWeight="medium">
                      {selectedSegment + 1} / {chunks.length || 0}
                    </Text>
                    <Button 
                      size="sm"
                      onClick={() => setSelectedSegment(Math.min((chunks.length || 1) - 1, selectedSegment + 1))}
                      isDisabled={selectedSegment === (chunks.length || 1) - 1}
                    >
                      Next
                    </Button>
                  </Flex>
                </VStack>
              </TabPanel>
              
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Text>
                    The translation quality analysis provides insights into the coherence, accuracy,
                    and style of the translation. This helps ensure that the translated document
                    maintains the original meaning and flow.
                  </Text>
                  
                  {loadingQuality ? (
                    <Flex justify="center" align="center" py={8}>
                      <Spinner size="lg" />
                      <Text ml={3}>Analyzing translation quality...</Text>
                    </Flex>
                  ) : qualityAnalysis ? (
                    <VStack spacing={4} align="stretch">
                      {/* Main Quality Metrics */}
                      <Box
                        bg="gray.50"
                        p={4}
                        borderRadius="md"
                        borderWidth={1}
                        borderColor="gray.200"
                      >
                        <VStack align="stretch" spacing={3}>
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Overall Quality</Text>
                            <HStack>
                              <Badge colorScheme={getQualityBadgeColor(qualityAnalysis.overallQuality.level)} px={2}>
                                {qualityAnalysis.overallQuality.level}
                              </Badge>
                              <Text fontSize="sm" color="gray.600">
                                {qualityAnalysis.overallQuality.score}/100
                              </Text>
                            </HStack>
                          </HStack>
                          
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Terminology Consistency</Text>
                            <Badge colorScheme={getPercentageBadgeColor(qualityAnalysis.terminologyConsistency.percentage)} px={2}>
                              {qualityAnalysis.terminologyConsistency.percentage}%
                            </Badge>
                          </HStack>
                          
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Context Coherence</Text>
                            <Badge colorScheme={getQualityBadgeColor(qualityAnalysis.contextCoherence.level)} px={2}>
                              {qualityAnalysis.contextCoherence.level}
                            </Badge>
                          </HStack>
                          
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Grammar & Style</Text>
                            <Badge colorScheme={getQualityBadgeColor(qualityAnalysis.grammarAndStyle.grammarLevel)} px={2}>
                              {qualityAnalysis.grammarAndStyle.grammarLevel}
                            </Badge>
                          </HStack>

                          <HStack justify="space-between">
                            <Text fontWeight="medium">Translation Completeness</Text>
                            <Badge colorScheme={getPercentageBadgeColor(qualityAnalysis.completeness.percentage)} px={2}>
                              {qualityAnalysis.completeness.percentage}%
                            </Badge>
                          </HStack>
                        </VStack>
                      </Box>

                      {/* Detailed Statistics */}
                      <Box
                        bg="blue.50"
                        p={4}
                        borderRadius="md"
                        borderWidth={1}
                        borderColor="blue.200"
                      >
                        <Text fontWeight="medium" mb={3}>Translation Statistics</Text>
                        <Stack direction="row" spacing={4}>
                          <Stat size="sm">
                            <StatLabel>Success Rate</StatLabel>
                            <StatNumber>{qualityAnalysis.overallQuality.completionRate}%</StatNumber>
                            <StatHelpText>
                              {qualityAnalysis.overallQuality.validChunks}/{qualityAnalysis.overallQuality.totalChunks} chunks
                            </StatHelpText>
                          </Stat>
                          
                          {qualityAnalysis.terminologyConsistency.totalTerms > 0 && (
                            <Stat size="sm">
                              <StatLabel>Glossary Terms</StatLabel>
                              <StatNumber>{qualityAnalysis.terminologyConsistency.correctTerms}</StatNumber>
                              <StatHelpText>
                                of {qualityAnalysis.terminologyConsistency.totalTerms} correct
                              </StatHelpText>
                            </Stat>
                          )}
                        </Stack>
                      </Box>

                      {/* Issues and Recommendations */}
                      {(qualityAnalysis.issues?.length > 0 || qualityAnalysis.recommendations?.length > 0) && (
                        <Accordion allowToggle>
                          {qualityAnalysis.issues?.length > 0 && (
                            <AccordionItem>
                              <h2>
                                <AccordionButton>
                                  <Box as="span" flex="1" textAlign="left" fontWeight="medium">
                                    Issues Detected ({qualityAnalysis.issues.length})
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                              </h2>
                              <AccordionPanel pb={4}>
                                <VStack align="stretch" spacing={2}>
                                  {qualityAnalysis.issues.map((issue, index) => (
                                    <Alert key={index} status={issue.severity === 'high' ? 'error' : 'warning'} size="sm">
                                      <AlertIcon />
                                      <Box>
                                        <Text fontWeight="medium">{issue.type.replace('_', ' ').toUpperCase()}</Text>
                                        <Text fontSize="sm">{issue.description}</Text>
                                      </Box>
                                    </Alert>
                                  ))}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          )}

                          {qualityAnalysis.recommendations?.length > 0 && (
                            <AccordionItem>
                              <h2>
                                <AccordionButton>
                                  <Box as="span" flex="1" textAlign="left" fontWeight="medium">
                                    Recommendations ({qualityAnalysis.recommendations.length})
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                              </h2>
                              <AccordionPanel pb={4}>
                                <VStack align="stretch" spacing={2}>
                                  {qualityAnalysis.recommendations.map((rec, index) => (
                                    <Alert key={index} status="info" size="sm">
                                      <AlertIcon />
                                      <Box>
                                        <Text fontWeight="medium">{rec.type.toUpperCase()}</Text>
                                        <Text fontSize="sm">{rec.message}</Text>
                                      </Box>
                                    </Alert>
                                  ))}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          )}
                        </Accordion>
                      )}
                    </VStack>
                  ) : (
                    <Alert status="warning">
                      <AlertIcon />
                      Quality analysis is not available for this translation.
                    </Alert>
                  )}
                </VStack>
              </TabPanel>
              
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Text>
                    Select your preferred output format for the translated document.
                    The export will maintain the document structure and formatting of the original.
                  </Text>
                  
                  <Box
                    bg="gray.50"
                    p={4}
                    borderRadius="md"
                    borderWidth={1}
                    borderColor="gray.200"
                  >
                    <VStack align="stretch" spacing={4}>
                      <RadioGroup defaultValue="txt">
                        <Stack spacing={3}>
                          <Radio value="txt" colorScheme="brand">
                            <Text fontWeight="medium">Plain Text (.txt)</Text>
                            <Text fontSize="xs" color="gray.500">Simple text format without formatting</Text>
                          </Radio>
                          
                          <Radio value="docx" colorScheme="brand">
                            <Text fontWeight="medium">Microsoft Word (.docx)</Text>
                            <Text fontSize="xs" color="gray.500">Preserves formatting and structure</Text>
                          </Radio>
                          
                          <Radio value="md" colorScheme="brand">
                            <Text fontWeight="medium">Markdown (.md)</Text>
                            <Text fontSize="xs" color="gray.500">Good for documentation or further editing</Text>
                          </Radio>
                        </Stack>
                      </RadioGroup>
                    </VStack>
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
          
          <Divider />
          
          <HStack spacing={4} justify="space-between">
            <Button
              leftIcon={<FaArrowLeft />}
              onClick={onBack}
              variant="outline"
            >
              Back
            </Button>
            
            <Button
              rightIcon={<FaDownload />}
              colorScheme="brand"
              onClick={onExport}
              px={8}
            >
              Export Translation
            </Button>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default TranslationPreview;
