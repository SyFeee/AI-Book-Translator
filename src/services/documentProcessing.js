import fs from 'fs';
import path from 'path';
import natural from 'natural';
import { createRequire } from 'module';
import { EnhancedDocumentService } from './enhancedDocumentService.js';
import { ProductionChunkingService } from './productionChunkingService.js';

// Use createRequire for pdf-parse which doesn't work well with ES6 imports
const require = createRequire(import.meta.url);

// Direct import of PDF parsing library using CommonJS
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('[DocumentProcessing] PDF-parse library loaded successfully');
} catch (error) {
  console.error('[DocumentProcessing] PDF-parse import failed:', error.message);
  pdfParse = null;
}

// Initialize production chunking service
const productionChunker = new ProductionChunkingService({
  maxChunkSize: 1500,
  preserveParagraphStructure: true,
  splitAtSceneBreaks: true,
  splitAtChapterBreaks: true
});

// Enhanced document processing libraries
let mammoth, EPub;

try {
  mammoth = await import('mammoth');
} catch (error) {
  console.warn('Mammoth import failed:', error.message);
  mammoth = { 
    extractRawText: async () => ({ 
      value: "DOCX parsing unavailable. Please install mammoth: npm install mammoth" 
    }) 
  };
}

try {
  EPub = (await import('epub')).default;
} catch (error) {
  console.warn('EPub import failed:', error.message);
  EPub = class MockEPub {
    constructor() { 
      this.flow = []; 
    }
    on(event, callback) { 
      if (event === 'end') setTimeout(callback, 0);
      return this; 
    }
    parse() {}
  };
}

const { SentenceTokenizer } = natural;
const tokenizer = new SentenceTokenizer();

// Initialize enhanced document service
const enhancedService = new EnhancedDocumentService({
  assetsDir: './assets',
  preserveFormatting: true,
  normalizeUnicode: true
});

/**
 * Main document processing function - now with enhanced pipeline option
 * @param {Object} file - The uploaded file object
 * @param {Object} options - Processing options
 * @returns {Object} - Processed chunks and metadata
 */
export const processDocument = async (file, options = {}) => {
  const useAdvancedPipeline = options.useAdvancedPipeline !== false; // Default to true
  
  if (useAdvancedPipeline) {
    console.log('[DocumentProcessing] Using advanced pipeline with structure awareness...');
    
    try {
      // Use the enhanced document service for better structure-aware processing
      return await enhancedService.processDocumentForTranslation(file);
    } catch (error) {
      console.warn('[DocumentProcessing] Advanced pipeline failed, falling back to basic processing:', error.message);
      // Fall back to basic processing if advanced fails
    }
  }
  
  console.log('[DocumentProcessing] Using basic document processing pipeline...');
  return await processDocumentBasic(file);
};

/**
 * Basic document processing (original implementation)
 * @param {Object} file - The uploaded file object
 * @returns {Object} - Processed chunks and metadata
 */
const processDocumentBasic = async (file) => {
  const fileExtension = path.extname(file.name).toLowerCase();
  let extractedText = '';
  let metadata = {};
  let documentStructure = {
    chapters: [],
    sections: [],
    images: [],
    tables: [],
    footnotes: []
  };
  
  console.log(`Processing ${fileExtension} file: ${file.name} (${file.size} bytes)`);
  
  // Extract text based on file type
  switch (fileExtension) {
    case '.docx':
      try {
        // Extract both raw text and document structure
        const rawResult = await mammoth.extractRawText({ path: file.tempFilePath });
        extractedText = rawResult.value;
        
        // Try to extract more detailed information including images and formatting
        const htmlResult = await mammoth.convertToHtml({ path: file.tempFilePath });
        
        // Parse HTML to identify document structure
        documentStructure = parseDocumentStructure(htmlResult.value);
        
        metadata = {
          hasImages: documentStructure.images.length > 0,
          hasTables: documentStructure.tables.length > 0,
          chapterCount: documentStructure.chapters.length,
          messages: htmlResult.messages || []
        };
        
        console.log(`DOCX processed: ${extractedText.length} chars, ${documentStructure.chapters.length} chapters detected`);
        
      } catch (error) {
        console.error('Error parsing DOCX:', error);
        extractedText = `[DOCX parsing error: ${error.message}]`;
        metadata = { error: error.message };
      }
      break;
      
    case '.epub':
      try {
        const epubResult = await extractTextFromEpub(file.tempFilePath);
        extractedText = epubResult.text;
        documentStructure = epubResult.structure;
        metadata = epubResult.metadata;
        
        console.log(`EPUB processed: ${extractedText.length} chars, ${documentStructure.chapters.length} chapters`);
        
      } catch (error) {
        console.error('Error parsing EPUB:', error);
        extractedText = `[EPUB parsing error: ${error.message}]`;
        metadata = { error: error.message };
      }
      break;
      
    case '.pdf':
      try {
        if (pdfParse) {
          const pdfBuffer = fs.readFileSync(file.tempFilePath);
          const pdfData = await pdfParse(pdfBuffer);
          
          extractedText = pdfData.text;
          metadata = {
            info: pdfData.info,
            pageCount: pdfData.numpages,
            version: pdfData.version,
            hasImages: pdfData.text.includes('[IMAGE]') || pdfData.text.includes('[FIGURE]'),
            hasTables: detectTablesInText(pdfData.text)
          };
          
          // Clean up PDF text artifacts
          extractedText = cleanPdfText(extractedText);
          
          console.log(`PDF processed: ${extractedText.length} chars, ${metadata.pageCount} pages`);
        } else {
          throw new Error('PDF parsing library not available');
        }
      } catch (error) {
        console.error('Error parsing PDF:', error);
        extractedText = `[PDF parsing error: ${error.message}]`;
        metadata = { error: error.message };
      }
      break;
      
    case '.txt':
    case '.md':
      extractedText = fs.readFileSync(file.tempFilePath, 'utf8');
      break;
      
    default:
      throw new Error('Unsupported file format');
  }
  
  // Extract basic metadata and combine with format-specific metadata
  const finalMetadata = {
    ...metadata,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileExtension,
    wordCount: countWords(extractedText),
    characterCount: extractedText.length,
    documentStructure,
    processingTimestamp: new Date().toISOString(),
    // Text quality indicators
    textQuality: {
      hasNonTextElements: documentStructure.images.length > 0 || documentStructure.tables.length > 0,
      structuredContent: documentStructure.chapters.length > 0,
      estimatedTranslationComplexity: getTranslationComplexity(extractedText, documentStructure)
    }
  };
  
  console.log(`Document processing complete:
    - Format: ${fileExtension}
    - Text length: ${extractedText.length} characters
    - Word count: ${finalMetadata.wordCount}
    - Chapters detected: ${documentStructure.chapters.length}
    - Images: ${documentStructure.images.length}
    - Tables: ${documentStructure.tables.length}
    - Translation complexity: ${finalMetadata.textQuality.estimatedTranslationComplexity}`);
  
  // Chunk the text with production paragraph-preserving strategy
  console.log('[DocumentProcessing] Using production chunking with paragraph preservation');
  const chunkingResult = await productionChunker.chunkDocument(extractedText, {
    documentStructure,
    preserveFormatting: true
  });
  
  // Handle both simple chunks array and advanced processing object
  let chunks;
  if (Array.isArray(chunkingResult)) {
    chunks = chunkingResult;
  } else if (chunkingResult && chunkingResult.chunks) {
    chunks = chunkingResult.chunks;
    // Merge any additional metadata from advanced processing
    if (chunkingResult.structureMap) {
      finalMetadata.structureMap = chunkingResult.structureMap;
    }
    if (chunkingResult.processingInstructions) {
      finalMetadata.processingInstructions = chunkingResult.processingInstructions;
    }
  } else {
    // Fallback in case something went wrong
    chunks = [];
    console.warn('[DocumentProcessing] Chunking returned unexpected format, using empty chunks array');
  }
  
  console.log(`Document processed. Extracted ${chunks ? chunks.length : 0} chunks.`);
  
  return { chunks, metadata: finalMetadata };
};

/**
 * Estimate translation complexity based on content analysis
 * @param {string} text - The extracted text
 * @param {Object} structure - Document structure information
 * @returns {string} - Complexity level: 'low', 'medium', 'high', 'very_high'
 */
const getTranslationComplexity = (text, structure) => {
  let complexityScore = 0;
  
  // Length factor
  if (text.length > 500000) complexityScore += 3; // Very long book
  else if (text.length > 100000) complexityScore += 2; // Long book
  else if (text.length > 50000) complexityScore += 1; // Medium book
  
  // Structure factor
  if (structure.chapters.length > 20) complexityScore += 2;
  else if (structure.chapters.length > 10) complexityScore += 1;
  
  // Content complexity
  if (structure.images.length > 10) complexityScore += 1;
  if (structure.tables.length > 5) complexityScore += 1;
  if (structure.footnotes.length > 20) complexityScore += 1;
  
  // Technical content detection
  const technicalTerms = (text.match(/\b(algorithm|database|API|protocol|framework|methodology)\b/gi) || []).length;
  if (technicalTerms > 50) complexityScore += 2;
  else if (technicalTerms > 20) complexityScore += 1;
  
  // Dialogue detection (affects consistency requirements)
  const dialogueMarkers = (text.match(/["'][^"']*["']/g) || []).length;
  if (dialogueMarkers > 500) complexityScore += 1;
  
  if (complexityScore >= 7) return 'very_high';
  if (complexityScore >= 5) return 'high';
  if (complexityScore >= 3) return 'medium';
  return 'low';
};

/**
 * Parse HTML content to identify document structure
 * @param {string} htmlContent - HTML content from document conversion
 * @returns {Object} - Document structure information
 */
const parseDocumentStructure = (htmlContent) => {
  const structure = {
    chapters: [],
    sections: [],
    images: [],
    tables: [],
    footnotes: []
  };
  
  try {
    // Detect chapters (common patterns)
    const chapterRegex = /(chapter\s+\d+|chapter\s+[ivx]+|\d+\.\s)|(<h[1-3][^>]*>)/gi;
    const chapterMatches = htmlContent.match(chapterRegex) || [];
    structure.chapters = chapterMatches.map((match, index) => ({
      index: index + 1,
      title: match.replace(/<[^>]*>/g, '').trim(),
      position: htmlContent.indexOf(match)
    }));
    
    // Detect images
    const imageRegex = /<img[^>]*>/gi;
    const imageMatches = htmlContent.match(imageRegex) || [];
    structure.images = imageMatches.map((img, index) => ({
      index: index + 1,
      element: img,
      position: htmlContent.indexOf(img)
    }));
    
    // Detect tables
    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tableMatches = htmlContent.match(tableRegex) || [];
    structure.tables = tableMatches.map((table, index) => ({
      index: index + 1,
      element: table,
      position: htmlContent.indexOf(table)
    }));
    
    // Detect footnotes
    const footnoteRegex = /(footnote|endnote|\[\d+\])/gi;
    const footnoteMatches = htmlContent.match(footnoteRegex) || [];
    structure.footnotes = footnoteMatches.map((footnote, index) => ({
      index: index + 1,
      text: footnote,
      position: htmlContent.indexOf(footnote)
    }));
    
  } catch (error) {
    console.error('Error parsing document structure:', error);
  }
  
  return structure;
};

/**
 * Clean PDF text from common artifacts
 * @param {string} text - Raw PDF text
 * @returns {string} - Cleaned text
 */
const cleanPdfText = (text) => {
  return text
    // Remove excessive whitespace
    .replace(/\s{3,}/g, ' ')
    // Fix broken words across lines
    .replace(/(\w)-\s+(\w)/g, '$1$2')
    // Remove page numbers at start/end of lines
    .replace(/^\d+\s*$/gm, '')
    // Remove common PDF artifacts
    .replace(/\f/g, '\n') // Form feed to newline
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Detect tables in text content
 * @param {string} text - Text content to analyze
 * @returns {boolean} - Whether tables are detected
 */
const detectTablesInText = (text) => {
  // Simple heuristics to detect tabular data
  const lines = text.split('\n');
  let tableIndicators = 0;
  
  for (const line of lines) {
    // Look for multiple tabs or aligned columns
    if (line.includes('\t') && line.split('\t').length > 2) {
      tableIndicators++;
    }
    // Look for pipe-separated values
    if (line.includes('|') && line.split('|').length > 2) {
      tableIndicators++;
    }
    // Look for consistent spacing patterns
    if (/\s{5,}/.test(line) && line.trim().split(/\s{5,}/).length > 2) {
      tableIndicators++;
    }
  }
  
  return tableIndicators > 3; // Threshold for table detection
};

/**
 * Extract text from an EPUB file with enhanced structure detection
 * @param {string} filePath - Path to the EPUB file
 * @returns {Promise<Object>} - Extracted text, structure, and metadata
 */
const extractTextFromEpub = (filePath) => {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);
    let extractedText = '';
    const structure = {
      chapters: [],
      sections: [],
      images: [],
      tables: [],
      footnotes: []
    };
    let metadata = {};
    
    epub.on('end', () => {
      // Extract metadata
      metadata = {
        title: epub.metadata?.title || 'Unknown Title',
        creator: epub.metadata?.creator || 'Unknown Author',
        language: epub.metadata?.language || 'en',
        publisher: epub.metadata?.publisher || '',
        date: epub.metadata?.date || '',
        description: epub.metadata?.description || '',
        hasImages: false,
        hasTables: false,
        chapterCount: epub.flow?.length || 0
      };
      
      let chapterPromises = [];
      
      // Get chapter list and process each chapter
      epub.flow.forEach((chapter, index) => {
        if (chapter.id) {
          const promise = new Promise(resolve => {
            epub.getChapter(chapter.id, (err, text) => {
              if (err) {
                console.warn(`Failed to extract chapter ${chapter.id}:`, err);
                return resolve({
                  text: '',
                  title: chapter.title || `Chapter ${index + 1}`,
                  index: index
                });
              }
              
              // Clean HTML tags and extract plain text
              const plainText = cleanHtmlToText(text);
              
              // Detect structural elements in this chapter
              const chapterStructure = analyzeChapterStructure(text, plainText);
              
              // Update global structure
              if (chapterStructure.hasImages) metadata.hasImages = true;
              if (chapterStructure.hasTables) metadata.hasTables = true;
              
              structure.chapters.push({
                index: index + 1,
                title: chapter.title || `Chapter ${index + 1}`,
                id: chapter.id,
                wordCount: countWords(plainText),
                hasImages: chapterStructure.hasImages,
                hasTables: chapterStructure.hasTables
              });
              
              resolve({
                text: plainText,
                title: chapter.title || `Chapter ${index + 1}`,
                index: index
              });
            });
          });
          
          chapterPromises.push(promise);
        }
      });
      
      // Resolve all chapter promises
      Promise.all(chapterPromises)
        .then(chapters => {
          // Sort chapters by index to maintain order
          chapters.sort((a, b) => a.index - b.index);
          
          // Combine all chapter texts
          extractedText = chapters
            .map(chapter => chapter.text)
            .join('\n\n=== CHAPTER BREAK ===\n\n');
          
          resolve({
            text: extractedText,
            structure,
            metadata
          });
        })
        .catch(reject);
    });
    
    epub.on('error', reject);
    epub.parse();
  });
};

/**
 * Clean HTML content and convert to plain text
 * @param {string} htmlContent - HTML content
 * @returns {string} - Plain text
 */
const cleanHtmlToText = (htmlContent) => {
  return htmlContent
    // Remove script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert common HTML elements to text equivalents
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Analyze chapter structure for images, tables, etc.
 * @param {string} htmlContent - Original HTML content
 * @param {string} plainText - Converted plain text
 * @returns {Object} - Structure analysis
 */
const analyzeChapterStructure = (htmlContent, plainText) => {
  return {
    hasImages: /<img[^>]*>/i.test(htmlContent) || /\[image\]/i.test(plainText),
    hasTables: /<table[^>]*>/i.test(htmlContent) || detectTablesInText(plainText),
    hasFootnotes: /footnote|endnote|\[\d+\]/i.test(plainText),
    wordCount: countWords(plainText)
  };
};

/**
 * Count words in a text string
 * @param {string} text - The text to count words in
 * @returns {number} - Word count
 */
const countWords = (text) => {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Chunk text by semantic segments like paragraphs and sections
 * @param {string} text - The full text to chunk
 * @param {Object} documentStructure - Document structure information
 * @returns {Array} - Array of text chunks with metadata
 */
const chunkTextBySemanticSegments = (text, documentStructure = {}) => {
  // Split text into paragraphs, but also consider chapter breaks
  let paragraphs = text.split(/\n\s*\n/);
  
  // If we have chapter information, try to split at chapter boundaries
  if (documentStructure.chapters && documentStructure.chapters.length > 0) {
    // Look for chapter break markers that might have been inserted during EPUB processing
    paragraphs = text.split(/\n\s*===\s*CHAPTER\s+BREAK\s*===\s*\n/);
    if (paragraphs.length === 1) {
      // Fall back to paragraph splitting if no chapter breaks found
      paragraphs = text.split(/\n\s*\n/);
    }
  }
  
  const chunks = [];
  let currentChunk = { text: '', paragraphCount: 0 };
  
  // For books, use appropriate chunk sizes for translation quality vs. performance
  // Smaller chunks for more reliable translation with smaller models
  const isLargeDocument = text.length > 100000; // Consider docs > 100KB as potentially books
  
  // Use smaller chunks (1000-1500 chars) to ensure complete translation and better quality
  // This helps prevent truncation issues with LLMs that have limited output capacity
  const MAX_CHUNK_LENGTH = isLargeDocument ? 1000 : 1500;
  
  console.log(`Document contains ${paragraphs.length} segments, total length: ${text.length} characters`);
  console.log(`Using ${isLargeDocument ? 'book mode' : 'standard mode'} with max chunk size: ${MAX_CHUNK_LENGTH}`);
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // Special handling for very long paragraphs (common in books)
    if (trimmedParagraph.length > MAX_CHUNK_LENGTH) {
      // If we have content in the current chunk, save it first
      if (currentChunk.text.length > 0) {
        chunks.push({ ...currentChunk });
        currentChunk = { text: '', paragraphCount: 0 };
      }
      
      // For long books with long paragraphs, split by sentences for better translation
      const sentences = trimmedParagraph.match(/[^.!?]+[.!?]+/g) || [trimmedParagraph];
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        // If adding this sentence would exceed chunk size and we already have content
        if ((sentenceChunk.length + sentence.length) > MAX_CHUNK_LENGTH && sentenceChunk.length > 0) {
          chunks.push({ 
            text: sentenceChunk, 
            paragraphCount: 1,
            isPartialParagraph: true
          });
          sentenceChunk = '';
        }
        
        // If a single sentence is too long (rare but possible)
        if (sentence.length > MAX_CHUNK_LENGTH) {
          // Split very long sentences into parts
          let remainingSentence = sentence;
          while (remainingSentence.length > MAX_CHUNK_LENGTH) {
            const part = remainingSentence.substring(0, MAX_CHUNK_LENGTH);
            chunks.push({
              text: part,
              paragraphCount: 1,
              isPartialParagraph: true,
              isPartialSentence: true
            });
            remainingSentence = remainingSentence.substring(MAX_CHUNK_LENGTH);
          }
          
          if (remainingSentence.length > 0) {
            sentenceChunk += remainingSentence;
          }
        } else {
          // Add normal sentence to current sentence chunk
          sentenceChunk += sentence;
        }
      }
      
      // Add any remaining sentence chunk
      if (sentenceChunk.length > 0) {
        chunks.push({ 
          text: sentenceChunk, 
          paragraphCount: 1,
          isPartialParagraph: true
        });
      }
      
      continue;
    }
    
    // If adding this paragraph would exceed our chunk size, save current chunk and start a new one
    if (currentChunk.text.length + trimmedParagraph.length > MAX_CHUNK_LENGTH && currentChunk.text.length > 0) {
      chunks.push({ ...currentChunk });
      currentChunk = { text: '', paragraphCount: 0 };
    }
    
    // Add paragraph to current chunk
    if (currentChunk.text.length > 0) {
      currentChunk.text += '\n\n';
    }
    currentChunk.text += trimmedParagraph;
    currentChunk.paragraphCount += 1;
  }
  
  // Add the final chunk if it has content
  if (currentChunk.text.length > 0) {
    chunks.push({ ...currentChunk });
  }
  
  // Add chunk metadata including structural information
  return chunks.map((chunk, index) => ({
    ...chunk,
    id: index,
    position: index / chunks.length,
    previousChunkPreview: index > 0 ? chunks[index-1].text.slice(-100) : null,
    nextChunkPreview: index < chunks.length - 1 ? chunks[index+1].text.slice(0, 100) : null,
    // Enhanced metadata for translation context
    structuralInfo: {
      isChapterStart: chunk.text.match(/^(chapter\s+\d+|chapter\s+[ivx]+)/i) !== null,
      isDialogueHeavy: (chunk.text.match(/["'][^"']*["']/g) || []).length > 5,
      hasSpecialFormatting: chunk.text.includes('***') || chunk.text.includes('---'),
      estimatedComplexity: chunk.text.length > 800 ? 'high' : chunk.text.length > 400 ? 'medium' : 'low'
    }
  }));
};

export default {
  processDocument
};
