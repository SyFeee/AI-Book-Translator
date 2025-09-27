import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  VStack,
  Heading,
  Text,
  Progress,
  HStack,
  Badge,
  Flex,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Skeleton,
  Alert,
  AlertIcon,
  CircularProgress,
  CircularProgressLabel,
  useColorModeValue
} from '@chakra-ui/react';
import { FaFileAlt, FaLanguage, FaSyncAlt, FaServer, FaClock, FaCheckCircle } from 'react-icons/fa';

const TranslationProgress = ({ documentInfo, settings, isLoading, translationResults, translationId }) => {
  const [progressData, setProgressData] = useState({
    currentChunk: 0,
    totalChunks: documentInfo?.chunkCount || 0,
    percentage: 0,
    status: 'processing',
    errors: [],
    startTime: Date.now(),
    estimatedTimeRemaining: null
  });
  
  const [logEntries, setLogEntries] = useState([
    { type: 'info', message: 'Initializing translation pipeline...', timestamp: new Date() },
    { type: 'info', message: `Document loaded: ${documentInfo?.fileName}`, timestamp: new Date() },
    { type: 'info', message: `Processing strategy: ${settings?.chunkingStrategy || 'semantic'}`, timestamp: new Date() },
    { type: 'info', message: `Total segments to translate: ${documentInfo?.chunkCount || 0}`, timestamp: new Date() }
  ]);

  const [realTimeStats, setRealTimeStats] = useState({
    chunksPerMinute: 0,
    elapsedTime: 0,
    estimatedCompletion: null
  });

  const bgColor = useColorModeValue('white', 'gray.800');
  const statBgColor = useColorModeValue('gray.50', 'gray.700');

  // Polling for progress updates
  useEffect(() => {
    let progressInterval;
    
    if (translationId && progressData.status === 'processing') {
      progressInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/translate/progress/${translationId}`);
          if (response.ok) {
            const progress = await response.json();
            
            // Calculate real-time statistics
            const elapsed = (Date.now() - progressData.startTime) / 1000 / 60; // minutes
            const chunksPerMinute = progress.currentChunk / elapsed || 0;
            const remainingChunks = progress.totalChunks - progress.currentChunk;
            const estimatedMinutesLeft = remainingChunks / chunksPerMinute;
            
            setProgressData(prev => ({
              ...prev,
              ...progress,
              percentage: Math.round((progress.currentChunk / progress.totalChunks) * 100)
            }));

            setRealTimeStats({
              chunksPerMinute: Math.round(chunksPerMinute * 10) / 10,
              elapsedTime: Math.round(elapsed * 10) / 10,
              estimatedCompletion: isFinite(estimatedMinutesLeft) ? Math.round(estimatedMinutesLeft) : null
            });
            
            // Add progress log entries
            if (progress.currentChunk > (progressData.currentChunk || 0)) {
              const progressMessage = `Translated segment ${progress.currentChunk}/${progress.totalChunks} (${Math.round((progress.currentChunk / progress.totalChunks) * 100)}%)`;
              setLogEntries(prev => [
                ...prev.slice(-20), // Keep only last 20 entries
                { 
                  type: 'progress', 
                  message: progressMessage,
                  timestamp: new Date()
                }
              ]);
            }
            
            // Handle completion
            if (progress.status === 'completed') {
              setLogEntries(prev => [
                ...prev,
                { 
                  type: 'success', 
                  message: `Translation completed! Processed ${progress.totalChunks} segments in ${realTimeStats.elapsedTime} minutes.`,
                  timestamp: new Date()
                }
              ]);
              clearInterval(progressInterval);
            }
            
            // Handle errors
            if (progress.errors && progress.errors.length > (progressData.errors?.length || 0)) {
              const newErrors = progress.errors.slice(progressData.errors?.length || 0);
              newErrors.forEach(error => {
                setLogEntries(prev => [
                  ...prev,
                  { type: 'error', message: `Error: ${error}`, timestamp: new Date() }
                ]);
              });
            }
          } else if (response.status === 404) {
            // Translation not found - likely server restarted
            console.warn('Translation not found, stopping progress polling');
            setLogEntries(prev => [
              ...prev,
              { type: 'error', message: 'Translation session lost (server restarted). Please restart the translation.', timestamp: new Date() }
            ]);
            setProgressData(prev => ({
              ...prev,
              status: 'error'
            }));
            clearInterval(progressInterval);
          } else {
            // Other HTTP errors
            setLogEntries(prev => [
              ...prev,
              { type: 'error', message: `Server error: ${response.status} ${response.statusText}`, timestamp: new Date() }
            ]);
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error);
          setLogEntries(prev => [
            ...prev,
            { type: 'error', message: 'Connection lost - retrying...', timestamp: new Date() }
          ]);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [translationId, progressData.currentChunk, progressData.startTime, realTimeStats.elapsedTime]);

  // Format time display
  const formatTime = (minutes) => {
    if (!minutes || !isFinite(minutes)) return 'Calculating...';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get status color
  const getStatusColor = () => {
    switch (progressData.status) {
      case 'completed': return 'green';
      case 'error': return 'red';
      case 'processing': return 'blue';
      default: return 'gray';
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
      borderColor={getStatusColor() + '.200'}
      borderWidth="2px"
    >
      <CardBody>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="center">
            <HStack>
              <Icon as={FaSyncAlt} color={getStatusColor() + '.500'} />
              <Heading as="h3" size="md" color="gray.700">
                Translation Progress
              </Heading>
            </HStack>
            
            <HStack spacing={3}>
              <Badge colorScheme="blue" fontSize="sm" px={3} py={1} borderRadius="full">
                {documentInfo.fileName}
              </Badge>
              
              <Badge colorScheme="purple" fontSize="sm" px={3} py={1} borderRadius="full">
                {settings.sourceLanguage?.toUpperCase()} → {settings.targetLanguage?.toUpperCase()}
              </Badge>

              <Badge 
                colorScheme={getStatusColor()} 
                fontSize="sm" 
                px={3} 
                py={1} 
                borderRadius="full"
                variant="solid"
              >
                {progressData.status.toUpperCase()}
              </Badge>
            </HStack>
          </Flex>
          
          {/* Main Progress Display */}
          <Box>
            <Flex justify="space-between" mb={4}>
              <Text fontSize="lg" fontWeight="medium" color="gray.700">
                Overall Progress
              </Text>
              <HStack>
                <CircularProgress 
                  value={progressData.percentage || 0} 
                  size="60px" 
                  color={getStatusColor() + '.500'}
                  thickness="8px"
                >
                  <CircularProgressLabel fontSize="sm" fontWeight="bold">
                    {progressData.percentage || 0}%
                  </CircularProgressLabel>
                </CircularProgress>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" color="gray.600">
                    {progressData.currentChunk} / {progressData.totalChunks}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    segments
                  </Text>
                </VStack>
              </HStack>
            </Flex>
            
            <Progress 
              value={progressData.percentage || 0} 
              size="lg" 
              colorScheme={getStatusColor()} 
              borderRadius="full"
              isAnimated={progressData.status === 'processing'}
              hasStripe={progressData.status === 'processing'}
              bg="gray.100"
            />
            
            <Flex justify="space-between" mt={2} fontSize="sm" color="gray.600">
              <Text>Started: {new Date(progressData.startTime).toLocaleTimeString()}</Text>
              {progressData.status === 'completed' ? (
                <Text color="green.600" fontWeight="medium">
                  <Icon as={FaCheckCircle} mr={1} />
                  Completed Successfully!
                </Text>
              ) : (
                <Text>
                  ETA: {formatTime(realTimeStats.estimatedCompletion)}
                </Text>
              )}
            </Flex>
          </Box>
          
          {/* Real-time Statistics */}
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat 
              bg={statBgColor} 
              p={4} 
              borderRadius="lg" 
              border="1px solid" 
              borderColor="gray.200"
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            >
              <StatLabel display="flex" alignItems="center" mb={1}>
                <Icon as={FaFileAlt} mr={2} color="blue.500" /> Document
              </StatLabel>
              <StatNumber fontSize="xl" color="blue.600">
                <Skeleton isLoaded={!isLoading}>
                  {documentInfo.chunkCount} segments
                </Skeleton>
              </StatNumber>
              <StatHelpText>
                <Skeleton isLoaded={!isLoading}>
                  {documentInfo.metadata?.wordCount?.toLocaleString() || '~'} words
                </Skeleton>
              </StatHelpText>
            </Stat>
            
            <Stat 
              bg={statBgColor} 
              p={4} 
              borderRadius="lg" 
              border="1px solid" 
              borderColor="gray.200"
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            >
              <StatLabel display="flex" alignItems="center" mb={1}>
                <Icon as={FaClock} mr={2} color="orange.500" /> Speed
              </StatLabel>
              <StatNumber fontSize="xl" color="orange.600">
                {realTimeStats.chunksPerMinute || '--'}
              </StatNumber>
              <StatHelpText>
                segments/minute
              </StatHelpText>
            </Stat>
            
            <Stat 
              bg={statBgColor} 
              p={4} 
              borderRadius="lg" 
              border="1px solid" 
              borderColor="gray.200"
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            >
              <StatLabel display="flex" alignItems="center" mb={1}>
                <Icon as={FaSyncAlt} mr={2} color="green.500" /> Elapsed
              </StatLabel>
              <StatNumber fontSize="xl" color="green.600">
                {formatTime(realTimeStats.elapsedTime)}
              </StatNumber>
              <StatHelpText>
                processing time
              </StatHelpText>
            </Stat>
            
            <Stat 
              bg={statBgColor} 
              p={4} 
              borderRadius="lg" 
              border="1px solid" 
              borderColor="gray.200"
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            >
              <StatLabel display="flex" alignItems="center" mb={1}>
                <Icon as={FaServer} mr={2} color="purple.500" /> Model
              </StatLabel>
              <StatNumber fontSize="lg" color="purple.600">
                Local LLM
              </StatNumber>
              <StatHelpText>
                {settings.chunkingStrategy || 'semantic'}
              </StatHelpText>
            </Stat>
          </SimpleGrid>
          
          {/* Error Display */}
          {progressData.errors && progressData.errors.length > 0 && (
            <Alert status="error" borderRadius="lg" variant="left-accent">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="medium">Translation Errors ({progressData.errors.length})</Text>
                <Text fontSize="sm">{progressData.errors[progressData.errors.length - 1]}</Text>
              </VStack>
            </Alert>
          )}
            
          {/* Translation Log */}
          <Box 
            borderWidth={1} 
            borderColor="gray.200" 
            borderRadius="lg" 
            p={4} 
            bg={statBgColor}
            height="300px"
            overflowY="auto"
            css={{
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#CBD5E0',
                borderRadius: '3px',
              },
            }}
          >
            <Heading size="sm" mb={4} color="gray.700">
              <Icon as={FaFileAlt} mr={2} />
              Live Translation Log
            </Heading>
            
            <VStack align="stretch" spacing={2}>
              {logEntries.map((entry, index) => (
                <Box 
                  key={index} 
                  fontSize="sm" 
                  fontFamily="mono" 
                  color={
                    entry.type === 'error' ? 'red.600' : 
                    entry.type === 'success' ? 'green.600' : 
                    entry.type === 'progress' ? 'blue.600' :
                    'gray.600'
                  }
                  p={2}
                  borderRadius="md"
                  bg={
                    entry.type === 'error' ? 'red.50' : 
                    entry.type === 'success' ? 'green.50' : 
                    entry.type === 'progress' ? 'blue.50' :
                    'transparent'
                  }
                  borderLeft="3px solid"
                  borderLeftColor={
                    entry.type === 'error' ? 'red.400' : 
                    entry.type === 'success' ? 'green.400' : 
                    entry.type === 'progress' ? 'blue.400' :
                    'gray.400'
                  }
                  transition="all 0.2s"
                  opacity={index === logEntries.length - 1 ? 1 : 0.8}
                >
                  <Flex justify="space-between" align="center">
                    <Text>
                      [{entry.type.toUpperCase()}] {entry.message}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {entry.timestamp ? entry.timestamp.toLocaleTimeString() : ''}
                    </Text>
                  </Flex>
                </Box>
              ))}
              
              {/* Auto-scroll to bottom */}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'end' })} />
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default TranslationProgress;
