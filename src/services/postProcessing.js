import fs from 'fs';
import path from 'path';

/**
 * Validate chunk ordering and detect potential issues
 */
function validateChunkOrder(chunks) {
  const issues = [];
  const seenIds = new Set();
  const chapterParts = new Map();
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Check for duplicate IDs
    if (chunk.id !== undefined) {
      if (seenIds.has(chunk.id)) {
        issues.push({
          type: 'duplicate_id',
          message: `Duplicate chunk ID ${chunk.id} at position ${i}`,
          chunkIndex: i
        });
      }
      seenIds.add(chunk.id);
    }
    
    // Check chapter sequence
    if (chunk.metadata?.chapterNumber) {
      const chapterNum = chunk.metadata.chapterNumber;
      const chapterPart = chunk.metadata.chapterPart || 1;
      
      if (!chapterParts.has(chapterNum)) {
        chapterParts.set(chapterNum, new Set());
      }
      
      if (chapterParts.get(chapterNum).has(chapterPart)) {
        issues.push({
          type: 'duplicate_chapter_part',
          message: `Duplicate chapter ${chapterNum} part ${chapterPart} at position ${i}`,
          chunkIndex: i
        });
      }
      
      chapterParts.get(chapterNum).add(chapterPart);
    }
  }
  
  return { issues, totalChunks: chunks.length, uniqueIds: seenIds.size };
}

/**
 * Reassemble translated chunks into a complete document
 * @param {Array} translatedChunks - Array of translated text chunks
 * @param {string} fileName - Original file name
 * @param {string} format - Output format ('txt', 'md', 'docx', etc)
 * @param {Object} metadata - Document metadata
 * @returns {Object} - The reassembled document ready for download
 */
export const reassembleDocument = async (translatedChunks, fileName, format = 'txt', metadata = {}) => {
  console.log(`Reassembling document with ${translatedChunks.length} chunks into ${format} format`);
  
  // Enhanced sorting with multiple fallbacks and validation
  const sortedChunks = [...translatedChunks].sort((a, b) => {
    // Primary sort by ID
    if (a.id !== undefined && b.id !== undefined) {
      return a.id - b.id;
    }
    
    // Fallback to chapter and part numbers for chapter-based documents
    if (a.metadata?.chapterNumber !== undefined && b.metadata?.chapterNumber !== undefined) {
      const chapterDiff = a.metadata.chapterNumber - b.metadata.chapterNumber;
      if (chapterDiff !== 0) return chapterDiff;
      
      // If same chapter, sort by part
      const partA = a.metadata.chapterPart || 0;
      const partB = b.metadata.chapterPart || 0;
      return partA - partB;
    }
    
    // Final fallback: maintain original order
    return 0;
  });
  
  // Validate chunk order and detect duplicates
  const chunkValidation = validateChunkOrder(sortedChunks);
  if (chunkValidation.issues.length > 0) {
    console.warn('[Reassembly] Chunk order issues detected:', chunkValidation.issues);
  }
  
  console.log(`Reassembling ${sortedChunks.length} chunks in correct order:`, 
    sortedChunks.slice(0, 5).map(c => `Ch${c.metadata?.chapterNumber || '?'}.${c.metadata?.chapterPart || '?'} (ID: ${c.id})`));
  
  // Process chunks with special handling for partial paragraphs
  let processedText = '';
  let currentParagraph = '';
  let chunkCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < sortedChunks.length; i++) {
    const chunk = sortedChunks[i];
    // Handle potentially undefined text fields with better validation
    const text = chunk.translatedText || chunk.text || '';
    chunkCount++;
    
    // Log periodic reassembly progress for large documents
    if (chunkCount % 50 === 0) {
      console.log(`Processed ${chunkCount}/${sortedChunks.length} chunks`);
    }
    
    // Enhanced error handling for various error patterns
    if (!text || 
        text.trim().length === 0 ||
        text.startsWith('[TRANSLATION ERROR:') ||
        text.includes('TRANSLATION ERROR') ||
        text.includes('Translation failed') ||
        text.includes('Empty translation result')) {
      
      const errorMessage = `[TRANSLATION ERROR: Chunk ${chunk.id || i} failed to translate]`;
      processedText += errorMessage + '\n\n';
      errorCount++;
      console.warn(`Chunk ${chunk.id || i} translation failed:`, text.substring(0, 100));
      continue;
    }
    
    // Check if this is part of a partial paragraph/sentence
    if (chunk.isPartialParagraph || chunk.isPartialSentence) {
      // If it's part of a paragraph, don't add extra newlines
      currentParagraph += text;
      
      // If it's the last part of the paragraph or the last chunk overall
      const isLastPartOfParagraph = !sortedChunks[i+1]?.isPartialParagraph || i === sortedChunks.length - 1;
      if (isLastPartOfParagraph) {
        processedText += currentParagraph + '\n\n';
        currentParagraph = '';
      }
    } else {
      // Regular complete paragraph
      processedText += text + '\n\n';
    }
  }
  
  if (errorCount > 0) {
    console.warn(`Document reassembly encountered ${errorCount} chunks with translation errors`);
  }
  
  // Process the text to fix common formatting issues in machine translation
  const translatedText = processedText
    .replace(/\n{3,}/g, '\n\n') // Replace multiple line breaks with double line breaks
    .replace(/\s+\./g, '.') // Fix spaces before periods
    .replace(/\s+,/g, ',') // Fix spaces before commas
    .replace(/\s+:/g, ':') // Fix spaces before colons
    .replace(/\s+;/g, ';') // Fix spaces before semicolons
    .trim();
  
  console.log(`Document reassembled: ${translatedText.length} characters in total`);
  
  // Determine output file name and MIME type
  const originalExt = path.extname(fileName);
  const baseName = path.basename(fileName, originalExt);
  const outputFormat = format || 'txt';
  const outputFileName = `${baseName}_translated.${outputFormat}`;
  
  // Get appropriate MIME type for the output format
  const mimeType = getMimeType(outputFormat);
  
  // For simple text formats, return directly
  if (outputFormat === 'txt' || outputFormat === 'md') {
    return {
      fileName: outputFileName,
      content: Buffer.from(translatedText, 'utf8'),
      mimeType
    };
  }
  
  // For more complex formats like DOCX or EPUB, additional processing would be needed
  // This is a placeholder for more sophisticated document reassembly
  if (outputFormat === 'docx') {
    // In a real implementation, this would use a library like docx to create a proper DOCX
    // For now, we'll return a simple text file
    return {
      fileName: outputFileName.replace('.docx', '.txt'),
      content: Buffer.from(translatedText, 'utf8'),
      mimeType: 'text/plain'
    };
  }
  
  // Default fallback to text
  return {
    fileName: `${baseName}_translated.txt`,
    content: Buffer.from(translatedText, 'utf8'),
    mimeType: 'text/plain'
  };
};

/**
 * Get the appropriate MIME type for a file format
 * @param {string} format - The file format
 * @returns {string} - The MIME type
 */
const getMimeType = (format) => {
  const mimeTypes = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pdf': 'application/pdf',
    'epub': 'application/epub+zip',
    'html': 'text/html',
    'json': 'application/json'
  };
  
  return mimeTypes[format] || 'text/plain';
};

export default {
  reassembleDocument
};
