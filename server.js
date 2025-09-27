import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Import enhanced services
let processDocument, translateText, translateChunks, translateChunk, reassembleDocument, DocumentReconstructionService, EnhancedPostProcessingService, TranslationQualityService;

// Create tmp directory if it doesn't exist
const ensureTmpDir = () => {
  const tmpDir = './tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }
};

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Ensure tmp directory exists
ensureTmpDir();

// Dynamically import services
const importServices = async () => {
  try {
    const docProcessing = await import('./src/services/documentProcessing.js');
    const translation = await import('./src/services/translation.js');
    const postProcessing = await import('./src/services/postProcessing.js');
    const reconstruction = await import('./src/services/documentReconstructionService.js');
    const enhancedPostProcessing = await import('./src/services/enhancedPostProcessingService.js');
    const qualityService = await import('./src/services/translationQualityService.js');
    
    processDocument = docProcessing.processDocument;
    translateText = translation.translateText;
    translateChunks = translation.translateChunks;
    translateChunk = translation.translateChunk;
    reassembleDocument = postProcessing.reassembleDocument;
    DocumentReconstructionService = reconstruction.DocumentReconstructionService;
    EnhancedPostProcessingService = enhancedPostProcessing.EnhancedPostProcessingService;
    TranslationQualityService = qualityService.TranslationQualityService;
    
    console.log('Services loaded successfully');
  } catch (error) {
    console.error('Error loading services:', error);
  }
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure temp directory exists
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Configure file upload middleware
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: tmpDir,
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  abortOnLimit: true,
  debug: true // Enable debug mode for troubleshooting
}));

// Routes
app.post('/api/upload', async (req, res) => {
  try {
    console.log('Upload request received');
    
    // Make sure services are loaded
    if (!processDocument) {
      await importServices();
      if (!processDocument) {
        throw new Error('Document processing service not available');
      }
    }
    
    // Check if files were uploaded
    if (!req.files) {
      console.error('No req.files object');
      return res.status(400).json({ error: 'No files were uploaded. File upload middleware may not be configured correctly.' });
    }
    
    if (Object.keys(req.files).length === 0) {
      console.error('Empty files object');
      return res.status(400).json({ error: 'No files were uploaded. Make sure the form field is named "document".' });
    }

    const file = req.files.document;
    if (!file) {
      console.error('No document field in request');
      return res.status(400).json({ error: 'The "document" field is missing in the upload request.' });
    }
    
    console.log(`File received: ${file.name}, size: ${file.size} bytes, temp path: ${file.tempFilePath}`);
    
    // Validate file
    if (!file.tempFilePath || !fs.existsSync(file.tempFilePath)) {
      console.error('Temp file not created');
      return res.status(500).json({ error: 'Failed to create temporary file.' });
    }
    
    const fileExtension = path.extname(file.name).toLowerCase();
    
    // Check if file type is supported
    const supportedTypes = ['.docx', '.epub', '.txt', '.pdf', '.md'];
    if (!supportedTypes.includes(fileExtension)) {
      return res.status(400).json({ 
        error: 'Unsupported file format. Please upload a .docx, .epub, .txt, .pdf, or .md file.' 
      });
    }

    // Process the document with enhanced options
    console.log('Processing document...');
    
    // Extract processing options from request body
    const useAdvancedPipeline = req.body?.useAdvancedPipeline !== false; // Default to true
    const preserveStructure = req.body?.preserveStructure !== false; // Default to true
    const preserveFormatting = req.body?.preserveFormatting !== false; // Default to true
    
    const processingOptions = {
      useAdvancedPipeline,
      preserveStructure,
      preserveFormatting
    };
    
    console.log('Processing options:', processingOptions);
    
    const { chunks, metadata } = await processDocument(file, processingOptions);
    console.log(`Document processed. Extracted ${chunks ? chunks.length : 0} chunks.`);
    
    // Ensure chunks is an array
    const safeChunks = Array.isArray(chunks) ? chunks : [];
    
    // Enhanced response with structure information if available
    const response = { 
      message: 'Document processed successfully', 
      fileName: file.name,
      fileSize: file.size,
      chunkCount: safeChunks.length,
      metadata,
      processingMethod: useAdvancedPipeline ? 'advanced' : 'basic',
      chunks: safeChunks.map((chunk, index) => ({
        id: index,
        text: chunk.text || chunk,
        preview: (chunk.text || chunk).substring(0, 100) + ((chunk.text || chunk).length > 100 ? '...' : ''),
        ...(chunk.structureInfo && { structureInfo: chunk.structureInfo }),
        ...(chunk.chapter && { chapter: chunk.chapter }),
        ...(chunk.section && { section: chunk.section })
      }))
    };
    
    // Include structure map if available
    if (metadata?.structureMap) {
      response.structureMap = metadata.structureMap;
    }
    
    // Include asset information if available
    if (metadata?.assets && metadata.assets.length > 0) {
      response.assets = metadata.assets;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Hybrid translation endpoints
app.post('/api/translate-chunk', async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage, prompt, options = {} } = req.body;
    
    if (!translateText) {
      await importServices();
      if (!translateText) {
        throw new Error('Translation service not available');
      }
    }
    
    // Use custom prompt if provided, otherwise use standard translation
    let translatedText;
    if (prompt) {
      // Custom LLM call with provided prompt
      const response = await fetch(process.env.LLM_API_URL || 'http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || 'gemma-3-1b-it',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens || -1,
          temperature: options.temperature || 0.3
        })
      });
      
      if (!response.ok) {
        throw new Error(`LLM API request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      translatedText = data.choices[0].message.content;
      
      // Extract translation from tags if present
      if (translatedText.includes('<TRANSLATION>')) {
        translatedText = translatedText
          .replace(/^.*?<TRANSLATION>\s*/i, '')
          .replace(/\s*<\/TRANSLATION>.*$/i, '')
          .trim();
      }
    } else {
      // Standard translation
      translatedText = await translateText(text, sourceLanguage, targetLanguage);
    }
    
    res.json({
      translatedText,
      confidence: options.confidence || 0.8,
      method: prompt ? 'custom-llm' : 'standard'
    });
    
  } catch (error) {
    console.error('Chunk translation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refine-translation', async (req, res) => {
  try {
    const { prompt, maxTokens = 2000 } = req.body;
    
    const response = await fetch(process.env.LLM_API_URL || 'http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gemma-3-1b-it',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.2 // Lower temperature for refinement
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    let refinedText = data.choices[0].message.content;
    
    // Clean up the response
    refinedText = refinedText.trim();
    
    res.json({
      refinedText,
      method: 'llm-refinement'
    });
    
  } catch (error) {
    console.error('Translation refinement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    // Make sure services are loaded
    if (!translateChunks) {
      await importServices();
      if (!translateChunks) {
        throw new Error('Translation service not available');
      }
    }
    
    const { 
      chunks, 
      sourceLanguage, 
      targetLanguage, 
      preserveFormatting = true,
      contextWindow = 3,
      batchSize: requestedBatchSize = 10, // Process chunks in batches to save progress
      fileName, // For saving progress files
      useHybridTranslation = false, // Enable hybrid DeepL + LLM approach
      hybridOptions = {} // Options for hybrid translation
    } = req.body;
    
    if (!chunks || !chunks.length) {
      return res.status(400).json({ error: 'No text chunks provided for translation.' });
    }
    
    // Generate a translation ID for tracking progress
    const translationId = uuidv4();
    
    // Determine if we're processing a large book
    const isLargeBook = chunks.length > 100;
    // Adjust batch size based on document size - smaller batches for very large books
    const batchSize = isLargeBook ? Math.min(requestedBatchSize, 5) : requestedBatchSize;
    
    console.log(`Starting translation job ${translationId} with ${chunks.length} chunks`);
    console.log(`Source: ${sourceLanguage}, Target: ${targetLanguage}`);
    console.log(`Document size: ${isLargeBook ? 'Large book' : 'Standard document'}, using batch size: ${batchSize}`);
    
    // Create checkpoint directory if it doesn't exist
    const checkpointDir = path.join(__dirname, 'tmp', 'checkpoints');
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }
    
    // Store progress tracking info
    app.locals.translationProgress = app.locals.translationProgress || {};
    app.locals.translationProgress[translationId] = {
      currentChunk: 0,
      totalChunks: chunks.length,
      percentage: 0,
      status: 'processing',
      errors: [],
      startTime: new Date().toISOString(),
      fileName: fileName || 'document',
      isLargeBook,
      batchSize
    };
    
    // Return translation ID immediately so client can poll for progress
    res.json({ 
      message: 'Translation started',
      translationId,
      totalChunks: chunks.length,
      estimatedTimeMinutes: isLargeBook ? 
        Math.ceil(chunks.length * 5 / 60) : // More conservative estimate for books
        Math.ceil(chunks.length * 3 / 60)   // Standard estimate for normal documents
    });
    
    // Extract text and metadata from chunks
    const textChunks = chunks.map(chunk => {
      // If chunk has additional metadata we want to preserve
      if (typeof chunk === 'object') {
        return {
          text: chunk.text,
          id: chunk.id,
          position: chunk.position,
          isPartialParagraph: chunk.isPartialParagraph || false,
          isPartialSentence: chunk.isPartialSentence || false
        };
      }
      // If chunk is just a string
      return chunk;
    });
    
    // Initialize array to store translated chunks
    let allTranslatedChunks = [];
    
    // Start translation in the background
    translateChunks(textChunks, sourceLanguage, targetLanguage, {
      preserveFormatting,
      contextWindow: isLargeBook ? Math.max(contextWindow, 5) : contextWindow, // Increase context window for books
      batchSize,
      delayBetweenRequests: isLargeBook ? 200 : 500, // Faster processing for books with more batches
      useHybridTranslation,
      hybridOptions: {
        ...hybridOptions,
        enableDeepLFirst: hybridOptions.enableDeepLFirst !== false,
        enableLLMEditor: hybridOptions.enableLLMEditor !== false,
        costOptimization: isLargeBook // Enable cost optimization for large documents
      },
      onProgress: (progressInfo) => {
        // Update progress
        const updatedProgress = {
          ...app.locals.translationProgress[translationId],
          ...progressInfo,
          status: progressInfo.currentChunk >= chunks.length ? 'completed' : 'processing'
        };
        
        app.locals.translationProgress[translationId] = updatedProgress;
        
        // Add console logging for debugging
        console.log(`[Progress] Translation ${translationId}: ${progressInfo.currentChunk}/${chunks.length} chunks (${Math.round((progressInfo.currentChunk / chunks.length) * 100)}%)`);
        
        if (progressInfo.error) {
          app.locals.translationProgress[translationId].errors = 
            app.locals.translationProgress[translationId].errors || [];
          app.locals.translationProgress[translationId].errors.push(progressInfo.error);
          console.log(`[Progress] Error in translation ${translationId}:`, progressInfo.error);
        }
      },
      onBatchComplete: async (batchChunks, batchNumber, totalBatches) => {
        // Add batch chunks to all translated chunks
        allTranslatedChunks.push(...batchChunks);
        
        // Save checkpoint after each batch
        const checkpointPath = path.join(checkpointDir, `${translationId}_checkpoint.json`);
        fs.writeFileSync(checkpointPath, JSON.stringify({
          translationId,
          progress: {
            currentChunk: allTranslatedChunks.length,
            totalChunks: chunks.length,
            percentage: Math.round((allTranslatedChunks.length / chunks.length) * 100),
            batchCompleted: batchNumber + 1,
            totalBatches
          },
          completedChunks: allTranslatedChunks
        }));
        
        console.log(`Saved checkpoint for translation ${translationId}, batch ${batchNumber + 1}/${totalBatches}, ${Math.round((allTranslatedChunks.length / chunks.length) * 100)}% complete`);
      }
    })
    .then(async (translatedTextChunks) => {
      // Create translated chunks with original metadata if we don't already have them from batch processing
      if (allTranslatedChunks.length !== textChunks.length) {
        allTranslatedChunks = textChunks.map((chunk, index) => {
          const originalChunk = typeof chunks[index] === 'object' ? chunks[index] : { id: index };
          return {
            ...originalChunk,
            translatedText: translatedTextChunks[index] || '[Translation error]',
            id: originalChunk.id || index,
            isPartialParagraph: originalChunk.isPartialParagraph || false,
            isPartialSentence: originalChunk.isPartialSentence || false
          };
        });
      }
      
      // Store results with quality analysis
      const qualityAnalyzer = new TranslationQualityService({
        sourceLanguage,
        targetLanguage
      });
      
      // Perform quality analysis
      const qualityAnalysis = await qualityAnalyzer.analyzeTranslationQuality(
        chunks.map(chunk => typeof chunk === 'object' ? chunk : { text: chunk }),
        allTranslatedChunks,
        {
          glossary: hybridOptions?.glossary || {},
          sourceLanguage,
          targetLanguage
        }
      );
      
      app.locals.translationResults = app.locals.translationResults || {};
      app.locals.translationResults[translationId] = {
        translationId,
        fileName: fileName || 'document',
        translatedChunks: allTranslatedChunks,
        sourceLanguage,
        targetLanguage,
        timestamp: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        isLargeBook,
        qualityAnalysis
      };
      
      // Update progress to completed
      app.locals.translationProgress[translationId].status = 'completed';
      app.locals.translationProgress[translationId].percentage = 100;
      app.locals.translationProgress[translationId].completedAt = new Date().toISOString();
      
      console.log(`Translation completed for job ${translationId}`);
      
      // Remove checkpoint file as we've completed
      const checkpointPath = path.join(checkpointDir, `${translationId}_checkpoint.json`);
      if (fs.existsSync(checkpointPath)) {
        fs.unlinkSync(checkpointPath);
      }
    })
    .catch((error) => {
      console.error('Translation error:', error);
      if (app.locals.translationProgress[translationId]) {
        app.locals.translationProgress[translationId].status = 'error';
        app.locals.translationProgress[translationId].errors = 
          app.locals.translationProgress[translationId].errors || [];
        app.locals.translationProgress[translationId].errors.push(error.message);
      }
    });
  } catch (error) {
    console.error('Translation initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get translation progress
app.get('/api/translate/progress/:translationId', (req, res) => {
  const { translationId } = req.params;
  
  // Check if translation progress exists
  if (!app.locals.translationProgress || !app.locals.translationProgress[translationId]) {
    console.log(`[Progress API] Translation not found: ${translationId}`);
    return res.status(404).json({ error: 'Translation not found' });
  }
  
  const progress = app.locals.translationProgress[translationId];
  console.log(`[Progress API] Returning progress for ${translationId}: ${progress.currentChunk}/${progress.totalChunks} (${progress.percentage}%)`);
  
  // Return progress
  res.json(progress);
});

// Get translation quality analysis
app.get('/api/translate/quality/:translationId', (req, res) => {
  const { translationId } = req.params;
  
  // Check if translation results exist
  if (!app.locals.translationResults || !app.locals.translationResults[translationId]) {
    return res.status(404).json({ error: 'Translation results not found' });
  }
  
  const result = app.locals.translationResults[translationId];
  
  if (!result.qualityAnalysis) {
    return res.status(404).json({ error: 'Quality analysis not available for this translation' });
  }
  
  res.json({
    translationId,
    qualityAnalysis: result.qualityAnalysis,
    fileName: result.fileName,
    timestamp: result.timestamp
  });
});

// Get translation results
app.get('/api/translate/result/:translationId', (req, res) => {
  const { translationId } = req.params;
  
  // Check if translation results exist
  if (!app.locals.translationResults || !app.locals.translationResults[translationId]) {
    return res.status(404).json({ error: 'Translation results not found' });
  }
  
  const result = app.locals.translationResults[translationId];
  const isLargeBook = result.isLargeBook || result.translatedChunks.length > 100;
  
  // For large translations, return a preview only to avoid large response size
  const translatedChunksPreview = result.translatedChunks.map(chunk => ({
    ...chunk,
    text: chunk.text?.length > 200 ? chunk.text.substring(0, 200) + '...' : chunk.text,
    translatedText: chunk.translatedText?.length > 200 ? 
      chunk.translatedText.substring(0, 200) + '...' : chunk.translatedText
  }));
  
  res.json({
    ...result,
    translatedChunks: translatedChunksPreview,
    isLargeBook,
    complete: true
  });
});

// Download a translation directly
app.get('/api/translation/download/:translationId', async (req, res) => {
  try {
    // Make sure services are loaded
    if (!reassembleDocument) {
      await importServices();
      if (!reassembleDocument) {
        throw new Error('Document reassembly service not available');
      }
    }
    
    const { translationId } = req.params;
    const format = req.query.format || 'txt';
    
    console.log(`Download requested for translation ${translationId} in ${format} format`);
    
    // Check if translation results exist
    if (!app.locals.translationResults || !app.locals.translationResults[translationId]) {
      return res.status(404).json({ error: 'Translation results not found' });
    }
    
    const result = app.locals.translationResults[translationId];
    const isLargeBook = result.isLargeBook || result.translatedChunks.length > 100;
    
    if (isLargeBook) {
      console.log(`Processing large book with ${result.translatedChunks.length} chunks for download...`);
    }
    
    try {
      // Use enhanced post-processing service for proper format handling
      if (EnhancedPostProcessingService && (format === 'docx' || format === 'pdf' || format === 'epub' || format === 'html')) {
        console.log(`Using enhanced post-processing for ${format} format...`);
        
        const enhancedService = new EnhancedPostProcessingService();
        const processedDocument = await enhancedService.mergeChunks(result.translatedChunks);
        const exportedDoc = await enhancedService.exportToFormat(processedDocument.mergedText, format, {
          fileName: result.fileName || 'translated_document',
          baseName: (result.fileName || 'translated_document').replace(/\.[^/.]+$/, ''),
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          title: result.title || 'Translated Document'
        });
        
        // Send the properly formatted document
        res.setHeader('Content-Type', exportedDoc.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportedDoc.fileName}"`);
        res.send(exportedDoc.content);
        
        console.log(`Enhanced download completed for translation ${translationId} in ${format} format`);
      } else {
        // Fallback to basic reassemble for TXT and other formats
        const document = await reassembleDocument(
          result.translatedChunks,
          result.fileName || 'translated_document',
          format,
          { 
            sourceLanguage: result.sourceLanguage, 
            targetLanguage: result.targetLanguage,
            isLargeBook,
            exportTime: new Date().toISOString() 
          }
        );
        
        // Send the document as a downloadable file
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.send(document.content);
        
        console.log(`Basic download completed for translation ${translationId} in ${format} format`);
      }
    } catch (error) {
      console.error('Document export error:', error);
      res.status(500).json({ error: `Export failed: ${error.message}` });
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Failed to download translation' });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    // Make sure services are loaded
    if (!reassembleDocument) {
      await importServices();
      if (!reassembleDocument) {
        throw new Error('Document reassembly service not available');
      }
    }
    
    const { translationId, fileName, format, metadata } = req.body;
    let translatedChunks;
    let isLargeBook = false;
    let sourceLanguage = 'unknown';
    let targetLanguage = 'unknown';
    
    // If translationId is provided, get chunks from stored results
    if (translationId) {
      if (!app.locals.translationResults || !app.locals.translationResults[translationId]) {
        return res.status(404).json({ error: 'Translation results not found' });
      }
      
      const result = app.locals.translationResults[translationId];
      translatedChunks = result.translatedChunks;
      isLargeBook = result.isLargeBook || translatedChunks.length > 100;
      sourceLanguage = result.sourceLanguage;
      targetLanguage = result.targetLanguage;
      
      console.log(`Exporting translation ${translationId} with ${translatedChunks.length} chunks. Large book mode: ${isLargeBook}`);
    } else {
      // Otherwise use the chunks provided in the request
      translatedChunks = req.body.translatedChunks;
      isLargeBook = translatedChunks.length > 100;
      sourceLanguage = req.body.sourceLanguage || 'unknown';
      targetLanguage = req.body.targetLanguage || 'unknown';
    }
    
    if (!translatedChunks || !translatedChunks.length) {
      return res.status(400).json({ error: 'No translated content provided.' });
    }
    
    // For large books, show a progress message
    if (isLargeBook) {
      console.log(`Processing large book with ${translatedChunks.length} chunks for export...`);
    }
    
    try {
      // Reassemble the document with enhanced metadata
      const document = await reassembleDocument(translatedChunks, fileName || 'document', format, {
        ...metadata,
        sourceLanguage,
        targetLanguage,
        isLargeBook,
        chunkCount: translatedChunks.length,
        exportTime: new Date().toISOString()
      });
      
      console.log(`Document reassembled successfully, size: ${document.content.length} bytes`);
      
      // Send the document as a downloadable file
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.send(document.content);
      
      console.log(`Document exported successfully as ${document.fileName}`);
    } catch (error) {
      console.error('Document export error:', error);
      res.status(500).json({ error: `Export failed: ${error.message}` });
    }
  } catch (error) {
    console.error('Export initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Document reconstruction endpoint
app.post('/api/reconstruct', async (req, res) => {
  try {
    // Dynamically import the reconstruction service
    const { DocumentReconstructionService } = await import('./src/services/documentReconstructionService.js');
    
    const { 
      translatedChunks, 
      structureMap, 
      originalMetadata, 
      outputFormat = 'html',
      preserveFormatting = true,
      fileName = 'translated_document'
    } = req.body;
    
    if (!translatedChunks || !Array.isArray(translatedChunks)) {
      return res.status(400).json({ error: 'Translated chunks are required' });
    }
    
    if (!structureMap) {
      return res.status(400).json({ error: 'Structure map is required for faithful reconstruction' });
    }
    
    console.log(`Reconstructing document with ${translatedChunks.length} chunks`);
    
    // Initialize reconstruction service
    const reconstructionService = new DocumentReconstructionService({
      preserveFormatting,
      outputDir: './tmp/reconstructed'
    });
    
    // Reconstruct the document
    const reconstructedDocument = await reconstructionService.reconstructDocument(
      translatedChunks,
      structureMap,
      originalMetadata,
      {
        outputFormat,
        fileName
      }
    );
    
    console.log(`Document reconstructed successfully: ${reconstructedDocument.filePath}`);
    
    // Return reconstruction results
    res.json({
      message: 'Document reconstructed successfully',
      outputFormat,
      fileName: reconstructedDocument.fileName,
      filePath: reconstructedDocument.filePath,
      contentType: reconstructedDocument.contentType,
      size: reconstructedDocument.size,
      structureMetrics: {
        chaptersRestored: reconstructedDocument.metrics?.chaptersRestored || 0,
        sectionsRestored: reconstructedDocument.metrics?.sectionsRestored || 0,
        assetsReintegrated: reconstructedDocument.metrics?.assetsReintegrated || 0,
        formattingPreserved: reconstructedDocument.metrics?.formattingPreserved || false
      }
    });
    
  } catch (error) {
    console.error('Document reconstruction error:', error);
    res.status(500).json({ error: `Reconstruction failed: ${error.message}` });
  }
});

// Download reconstructed document endpoint
app.get('/api/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'tmp', 'reconstructed', fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate headers based on file extension
    const ext = path.extname(fileName).toLowerCase();
    const contentTypeMap = {
      '.html': 'text/html',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.epub': 'application/epub+zip',
      '.pdf': 'application/pdf'
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve client static files
app.use(express.static(path.join(__dirname, 'client/dist')));

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Send the React app for all other routes
  // Check if the file exists
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If we're in development, send a message that the client needs to be built
    res.send('Client app not built yet. Run "npm run build" in the client directory.');
  }
});

// Import services then start the server
importServices().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
