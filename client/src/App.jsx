import { useState } from 'react'
import { 
  Box, 
  Container, 
  Heading, 
  useToast
} from '@chakra-ui/react'
import Header from './components/Header'
import Footer from './components/Footer'
import DocumentUploader from './components/DocumentUploader'
import TranslationSettings from './components/TranslationSettings'
import TranslationProgress from './components/TranslationProgress'
import TranslationPreview from './components/TranslationPreview'
import DocumentExport from './components/DocumentExport'

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [translationSettings, setTranslationSettings] = useState({
    sourceLanguage: 'en',
    targetLanguage: 'es',
    preserveFormatting: true,
    maintainConsistency: true,
    characterGlossary: []
  });
  const [translationResults, setTranslationResults] = useState(null);
  const [translationId, setTranslationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const toast = useToast();
  
  // Move to next step in the translation process
  const handleNextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  // Move to previous step
  const handlePreviousStep = () => {
    setCurrentStep(prev => prev - 1);
  };
  
  // Handle document upload completion
  const handleDocumentUploaded = (data) => {
    setDocumentInfo(data);
    handleNextStep();
  };
  
  // Handle translation settings submission
  const handleSettingsSubmit = (settings) => {
    setTranslationSettings(settings);
    startTranslation(settings);
  };
  
  // Start the translation process
  const startTranslation = async (settings) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunks: documentInfo.chunks,
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.targetLanguage,
          preserveFormatting: settings.preserveFormatting,
          contextWindow: settings.contextWindow || 3,
          chunkingStrategy: settings.chunkingStrategy || 'semantic'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start translation');
      }
      
      const data = await response.json();
      
      // Set the translation ID and start polling for progress
      const currentTranslationId = data.translationId;
      setTranslationId(currentTranslationId);
      
      // Move to progress step immediately
      handleNextStep();
      
      // Check progress every 2 seconds
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/translate/progress/${currentTranslationId}`);
          if (!progressResponse.ok) {
            clearInterval(progressInterval);
            throw new Error('Failed to check translation progress');
          }
          
          const progressData = await progressResponse.json();
          
          // Update progress in the UI
          setTranslationResults({
            ...translationResults,
            progress: progressData,
            translationId: currentTranslationId
          });
          
          // If translation is completed or has an error, stop polling and fetch results
          if (progressData.status === 'completed' || progressData.status === 'error') {
            clearInterval(progressInterval);
            
            if (progressData.status === 'error') {
              throw new Error('Translation failed: ' + progressData.errors.join(', '));
            }
            
            // Add a small delay to ensure user can see the completion
            setTimeout(async () => {
              // Get the final results
              const resultsResponse = await fetch(`/api/translate/result/${currentTranslationId}`);
              if (!resultsResponse.ok) {
                throw new Error('Failed to fetch translation results');
              }
              
              const resultsData = await resultsResponse.json();
              setTranslationResults({...resultsData, translationId: currentTranslationId});
              setIsLoading(false);
              handleNextStep();
            }, 2000); // 2 second delay to show completion
          }
        } catch (progressError) {
          console.error('Progress check error:', progressError);
          clearInterval(progressInterval);
          setIsLoading(false);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: 'Translation failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      setIsLoading(false);
    }
  };
  
  // Render the appropriate step component
  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return <DocumentUploader onDocumentUploaded={handleDocumentUploaded} />;
      case 2:
        return <TranslationSettings 
                 documentInfo={documentInfo} 
                 onSubmit={handleSettingsSubmit} 
                 onBack={handlePreviousStep}
               />;
      case 3:
        return <TranslationProgress 
                 documentInfo={documentInfo}
                 settings={translationSettings}
                 isLoading={isLoading}
                 translationResults={translationResults}
                 translationId={translationId}
               />;
      case 4:
        return <TranslationPreview 
                 translationResults={translationResults} 
                 documentInfo={documentInfo}
                 onExport={() => handleNextStep()}
                 onBack={handlePreviousStep}
               />;
      case 5:
        return <DocumentExport 
                 translationResults={translationResults}
                 documentInfo={documentInfo}
                 onBack={handlePreviousStep}
               />;
      default:
        return <DocumentUploader onDocumentUploaded={handleDocumentUploaded} />;
    }
  };
  
  return (
    <Box className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50">
      <Header />
      
      <Container maxW="container.xl" py={10} flex="1">
        <Box textAlign="center" mb={10}>
          <Heading 
            as="h1" 
            size="2xl" 
            bgGradient="linear(to-r, brand.600, purple.500)"
            bgClip="text"
            fontWeight="extrabold"
            mb={3}
            letterSpacing="tight"
          >
            AI Book Translator
          </Heading>
          <Heading as="h2" size="md" color="gray.600" fontWeight="medium">
            Professional-grade translations powered by local AI models
          </Heading>
        </Box>
        
        {renderStepContent()}
      </Container>
      
      <Footer />
    </Box>
  )
}

export default App
