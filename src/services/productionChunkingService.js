/**
 * Production-Grade Paragraph-Preserving Chunking Service
 * 
 * Design Philosophy:
 * - Preserve DeepL paragraph map untouched (no re-wrapping)
 * - Split at natural boundaries (chapters, scenes, paragraphs)
 * - Maintain exact paragraph structure for rhythm preservation
 * - Context window limited to prevent token overflow
 * - Token-aware processing for large documents
 * - Structure-aware handling for images/tables
 */

export class ProductionChunkingService {
  constructor(options = {}) {
    this.options = {
      maxChunkSize: options.maxChunkSize || 1500, // Characters per chunk
      contextWindowTokens: options.contextWindowTokens || 100, // Previous context
      preserveParagraphStructure: options.preserveParagraphStructure !== false,
      splitAtSceneBreaks: options.splitAtSceneBreaks !== false,
      splitAtChapterBreaks: options.splitAtChapterBreaks !== false,
      enableTokenAwareProcessing: options.enableTokenAwareProcessing !== false,
      enableStructureHandling: options.enableStructureHandling !== false,
      targetModel: options.targetModel || 'gpt-4',
      ...options
    };
    
    // Initialize advanced services if enabled
    if (this.options.enableTokenAwareProcessing) {
      this.initializeTokenAwareService();
    }
    
    if (this.options.enableStructureHandling) {
      this.initializeStructureHandler();
    }
    
    console.log('[ProductionChunking] Initialized with advanced paragraph-preserving strategy');
  }

  /**
   * Initialize token-aware processing service
   */
  async initializeTokenAwareService() {
    try {
      const { TokenAwareChunkingService } = await import('./tokenAwareChunkingService.js');
      this.tokenAwareService = new TokenAwareChunkingService({
        targetModel: this.options.targetModel,
        modelType: 'gemma-3-1b',  // Match your current model
        maxTokensPerChunk: 2500,  // Increased for better coherence and fewer chunks
        targetTokensPerChunk: 2000  // Higher target for optimal performance
      });
      console.log('[ProductionChunking] Token-aware service initialized');
    } catch (error) {
      console.warn('[ProductionChunking] Token-aware service not available:', error.message);
      this.options.enableTokenAwareProcessing = false;
    }
  }

  /**
   * Initialize document structure handler
   */
  async initializeStructureHandler() {
    try {
      const { DocumentStructureHandler } = await import('./documentStructureHandler.js');
      this.structureHandler = new DocumentStructureHandler({
        preserveImages: true,
        preserveTables: true,
        translateTableContent: this.options.translateTableContent,
        translateImageCaptions: this.options.translateImageCaptions
      });
      console.log('[ProductionChunking] Structure handler initialized');
    } catch (error) {
      console.warn('[ProductionChunking] Structure handler not available:', error.message);
      this.options.enableStructureHandling = false;
    }
  }

  /**
   * Main chunking entry point - preserves paragraph structure
   */
  async chunkDocument(text, options = {}) {
    console.log(`[ProductionChunking] Chunking document (${text.length} chars) with paragraph preservation`);
    
    // Use advanced processing if available and needed
    if (this.shouldUseAdvancedProcessing(text, options)) {
      return await this.advancedChunkDocument(text, options);
    }
    
    const strategy = this.selectChunkingStrategy(text, options);
    
    switch (strategy) {
      case 'paragraph-preserving':
        return this.paragraphPreservingChunk(text, options);
      case 'scene-aware':
        return this.sceneAwareChunk(text, options);
      case 'chapter-based':
        return this.chapterBasedChunk(text, options);
      default:
        return this.paragraphPreservingChunk(text, options);
    }
  }

  /**
   * Advanced chunking with token-awareness and structure handling
   */
  async advancedChunkDocument(text, options = {}) {
    console.log('[ProductionChunking] Using advanced processing pipeline');
    
    let processedResult = { chunks: [], structureMap: null, processingInstructions: null };
    
    // Step 1: Handle document structure (images, tables, etc.)
    if (this.structureHandler && this.options.enableStructureHandling) {
      try {
        const documentData = options.documentData || { type: 'text' };
        const structureResult = await this.structureHandler.processComplexDocument(documentData, text);
        
        processedResult.structureMap = structureResult.structureMap;
        processedResult.processingInstructions = structureResult.processingInstructions;
        
        // Use structure-aware chunks if available
        if (structureResult.chunks && structureResult.chunks.length > 0) {
          text = structureResult.chunks.map(chunk => chunk.text).join('\n');
          console.log('[ProductionChunking] Applied structure-aware preprocessing');
        }
      } catch (error) {
        console.warn('[ProductionChunking] Structure processing failed:', error.message);
      }
    }
    
    // Step 2: Apply token-aware chunking if needed
    if (this.tokenAwareService && this.options.enableTokenAwareProcessing) {
      try {
        const tokenResult = await this.tokenAwareService.chunkDocument(text, {
          targetModel: this.options.targetModel,
          preserveStructure: true,
          ...options
        });
        
        if (tokenResult.chunks && tokenResult.chunks.length > 0) {
          processedResult.chunks = tokenResult.chunks;
          console.log(`[ProductionChunking] Applied token-aware processing: ${tokenResult.chunks.length} chunks`);
          return processedResult;
        }
      } catch (error) {
        console.warn('[ProductionChunking] Token-aware processing failed:', error.message);
      }
    }
    
    // Step 3: Fallback to standard chunking
    console.log('[ProductionChunking] Falling back to standard chunking');
    const standardChunks = this.chapterBasedChunk(text, options);
    processedResult.chunks = standardChunks;
    
    return processedResult;
  }

  /**
   * Determine if advanced processing is needed
   */
  shouldUseAdvancedProcessing(text, options = {}) {
    // Use advanced processing if:
    // 1. Document is very large (potential token issues)
    // 2. Document contains complex structures
    // 3. Explicitly requested
    
    const isLargeDocument = text.length > 50000; // 50K chars
    const hasComplexStructures = this.detectComplexStructures(text);
    const explicitlyRequested = options.useAdvancedProcessing;
    
    return isLargeDocument || hasComplexStructures || explicitlyRequested;
  }

  /**
   * Detect if document has complex structures
   */
  detectComplexStructures(text) {
    // Quick detection of images, tables, and complex formatting
    const hasImages = /\[IMAGE:|<img|!\[.*\]/.test(text);
    const hasTables = /\[TABLE:|\|.*\|.*\||\\t.*\\t/.test(text);
    const hasComplexLists = /(\\n\\s*[•·‣⁃]\\s+.*){3,}/.test(text);
    const hasMultipleChapters = (text.match(/chapter|Chapter|CHAPTER/g) || []).length > 5;
    
    return hasImages || hasTables || hasComplexLists || hasMultipleChapters;
  }

  /**
   * Core paragraph-preserving chunking (your specification)
   */
  paragraphPreservingChunk(text, options = {}) {
    console.log('[ProductionChunking] Using paragraph-preserving strategy');
    
    // Step 1: Split into natural paragraphs
    const paragraphs = this.extractParagraphs(text);
    console.log(`[ProductionChunking] Found ${paragraphs.length} natural paragraphs`);
    
    // Step 2: Group paragraphs into chunks while preserving structure
    const chunks = [];
    let currentChunk = '';
    let currentParagraphs = [];
    let chunkIndex = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphText = paragraph.text;
      
      // Check if adding this paragraph would exceed chunk size
      const wouldExceedSize = (currentChunk.length + paragraphText.length) > this.options.maxChunkSize;
      
      if (wouldExceedSize && currentChunk.length > 0) {
        // Create chunk with current paragraphs
        chunks.push(this.createChunk(currentChunk, currentParagraphs, chunkIndex++));
        currentChunk = '';
        currentParagraphs = [];
      }
      
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraphText;
      currentParagraphs.push(paragraph);
      
      // Handle oversized single paragraphs
      if (paragraphText.length > this.options.maxChunkSize) {
        console.warn(`[ProductionChunking] Oversized paragraph (${paragraphText.length} chars) - will be split`);
        const splitChunks = this.splitOversizedParagraph(paragraph, chunkIndex);
        chunks.push(...splitChunks);
        chunkIndex += splitChunks.length;
        currentChunk = '';
        currentParagraphs = [];
      }
    }
    
    // Add final chunk if any content remains
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, currentParagraphs, chunkIndex));
    }
    
    console.log(`[ProductionChunking] Created ${chunks.length} paragraph-preserving chunks`);
    return chunks;
  }

  /**
   * Extract paragraphs with structure preservation
   */
  extractParagraphs(text) {
    const paragraphs = [];
    
    // Split on double newlines (paragraph breaks) but preserve structure
    const rawParagraphs = text.split(/\n\s*\n/);
    
    for (let i = 0; i < rawParagraphs.length; i++) {
      const rawText = rawParagraphs[i].trim();
      if (!rawText) continue;
      
      const paragraph = {
        text: rawText,
        index: i,
        type: this.classifyParagraph(rawText),
        isDialogue: this.isDialogue(rawText),
        isSceneBreak: this.isSceneBreak(rawText),
        isChapterStart: this.isChapterStart(rawText),
        wordCount: rawText.split(/\s+/).length,
        preserveStructure: true // Critical for DeepL rhythm preservation
      };
      
      paragraphs.push(paragraph);
    }
    
    return paragraphs;
  }

  /**
   * Scene-aware chunking for narrative flow
   */
  sceneAwareChunk(text, options = {}) {
    console.log('[ProductionChunking] Using scene-aware strategy');
    
    const paragraphs = this.extractParagraphs(text);
    const chunks = [];
    let currentScene = [];
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      // Detect scene breaks
      if (paragraph.isSceneBreak && currentScene.length > 0) {
        // End current scene
        const sceneText = currentScene.map(p => p.text).join('\\n\\n');
        chunks.push(this.createChunk(sceneText, currentScene, chunkIndex++, 'scene'));
        currentScene = [];
      }
      
      currentScene.push(paragraph);
      
      // Check for size limits within scenes
      const sceneSize = currentScene.reduce((sum, p) => sum + p.text.length, 0);
      if (sceneSize > this.options.maxChunkSize) {
        // Split scene if too large
        const sceneText = currentScene.map(p => p.text).join('\\n\\n');
        chunks.push(this.createChunk(sceneText, currentScene, chunkIndex++, 'scene-split'));
        currentScene = [];
      }
    }
    
    // Add final scene
    if (currentScene.length > 0) {
      const sceneText = currentScene.map(p => p.text).join('\\n\\n');
      chunks.push(this.createChunk(sceneText, currentScene, chunkIndex, 'scene-final'));
    }
    
    return chunks;
  }

  /**
   * Chapter-based chunking for book-length works
   */
  chapterBasedChunk(text, options = {}) {
    console.log('[ProductionChunking] Using chapter-based strategy');
    
    const chapters = this.extractChapters(text);
    const chunks = [];
    let chunkIndex = 0;
    
    for (const chapter of chapters) {
      const paragraphs = this.extractParagraphs(chapter.text);
      
      if (chapter.text.length <= this.options.maxChunkSize) {
        // Entire chapter fits in one chunk
        chunks.push(this.createChunk(chapter.text, paragraphs, chunkIndex++, 'chapter', {
          chapterNumber: chapter.number,
          chapterTitle: chapter.title
        }));
      } else {
        // Split chapter into multiple chunks
        const chapterChunks = this.paragraphPreservingChunk(chapter.text);
        chapterChunks.forEach((chunk, i) => {
          chunk.metadata = {
            ...chunk.metadata,
            chapterNumber: chapter.number,
            chapterTitle: chapter.title,
            chapterPart: i + 1,
            totalChapterParts: chapterChunks.length
          };
          chunk.id = chunkIndex++;
        });
        chunks.push(...chapterChunks);
      }
    }
    
    return chunks;
  }

  /**
   * Create standardized chunk object
   */
  createChunk(text, paragraphs, index, type = 'paragraph', metadata = {}) {
    return {
      id: index,
      text: text.trim(),
      type,
      paragraphs: paragraphs.map(p => ({
        text: p.text,
        type: p.type,
        isDialogue: p.isDialogue,
        preserveStructure: p.preserveStructure
      })),
      metadata: {
        wordCount: text.split(/\s+/).length,
        characterCount: text.length,
        paragraphCount: paragraphs.length,
        hasDialogue: paragraphs.some(p => p.isDialogue),
        preserveStructure: true, // Critical for rhythm preservation
        ...metadata
      },
      // Context for translation
      context: {
        position: index,
        isFirstChunk: index === 0,
        previousContext: '', // Will be filled during translation
        structuralType: type
      }
    };
  }

  /**
   * Handle oversized paragraphs (preserve as much structure as possible)
   */
  splitOversizedParagraph(paragraph, startIndex) {
    console.log(`[ProductionChunking] Splitting oversized paragraph (${paragraph.text.length} chars)`);
    
    const chunks = [];
    const sentences = this.extractSentences(paragraph.text);
    let currentChunk = '';
    let currentSentences = [];
    let chunkIndex = startIndex;
    
    for (const sentence of sentences) {
      if ((currentChunk.length + sentence.length) > this.options.maxChunkSize && currentChunk) {
        chunks.push(this.createChunk(currentChunk, [{ 
          text: currentChunk, 
          type: 'split-paragraph',
          preserveStructure: true 
        }], chunkIndex++, 'split-paragraph'));
        currentChunk = '';
        currentSentences = [];
      }
      
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentSentences.push(sentence);
    }
    
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, [{ 
        text: currentChunk, 
        type: 'split-paragraph',
        preserveStructure: true 
      }], chunkIndex, 'split-paragraph'));
    }
    
    return chunks;
  }

  /**
   * Strategy selection based on document analysis
   */
  selectChunkingStrategy(text, options = {}) {
    const hasChapters = this.detectChapters(text);
    const hasSceneBreaks = this.detectSceneBreaks(text);
    const documentLength = text.length;
    
    console.log(`[StrategySelection] Length: ${documentLength}, Chapters: ${hasChapters}, Scenes: ${hasSceneBreaks}`);
    
    // Prioritize chapter-based chunking if chapters are detected (regardless of length)
    if (hasChapters && this.options.splitAtChapterBreaks) {
      console.log('[StrategySelection] Using chapter-based strategy');
      return 'chapter-based';
    } else if (hasSceneBreaks && this.options.splitAtSceneBreaks && documentLength > 5000) {
      console.log('[StrategySelection] Using scene-aware strategy');
      return 'scene-aware';
    } else {
      console.log('[StrategySelection] Using paragraph-preserving strategy');
      return 'paragraph-preserving';
    }
  }

  // Helper methods for content analysis
  classifyParagraph(text) {
    if (this.isChapterStart(text)) return 'chapter-start';
    if (this.isSceneBreak(text)) return 'scene-break';
    if (this.isDialogue(text)) return 'dialogue';
    if (text.length < 100) return 'short-paragraph';
    return 'narrative';
  }

  isDialogue(text) {
    return /["«»""''„"]/.test(text) || /^[\s]*[-—]\s+/.test(text);
  }

  isSceneBreak(text) {
    return /^[\s]*[*]{3,}[\s]*$|^[\s]*[-]{3,}[\s]*$|^[\s]*[#]{3,}[\s]*$/.test(text) ||
           text.trim().length < 10 && /[*\-#]/.test(text);
  }

  isChapterStart(text) {
    return /^[\s]*(Chapter|Capítulo|Chapitre|Kapitel)[\s]*\d+/i.test(text) ||
           /^[\s]*\d+[\s]*\./.test(text) ||
           /^[\s]*[A-Z][A-Z\s]{5,}[\s]*$/.test(text);
  }

  detectChapters(text) {
    return (text.match(/^[\s]*(Chapter|Capítulo|Chapitre|Kapitel)[\s]*\d+/gim) || []).length > 1;
  }

  detectSceneBreaks(text) {
    return (text.match(/^[\s]*[*\-#]{3,}[\s]*$/gm) || []).length > 2;
  }

  extractSentences(text) {
    // Simple sentence splitting - in production use more sophisticated NLP
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).map(s => s.trim() + '.');
  }

  extractChapters(text) {
    // More robust chapter detection and extraction
    const chapterRegex = /^[\s]*(Chapter|Capítulo|Chapitre|Kapitel)[\s]*(\d+)/gim;
    const matches = [...text.matchAll(chapterRegex)];
    
    if (matches.length === 0) {
      return [{ number: 1, title: 'Document', text: text.trim() }];
    }
    
    const chapters = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const chapterNumber = parseInt(match[2]);
      const chapterTitle = `Chapter ${chapterNumber}`;
      
      // Find start and end positions
      const startPos = match.index;
      const endPos = i < matches.length - 1 ? matches[i + 1].index : text.length;
      
      // Extract chapter content (excluding the chapter header line)
      const fullChapterText = text.substring(startPos, endPos);
      const contentStart = fullChapterText.indexOf('\n') + 1;
      const chapterContent = fullChapterText.substring(contentStart).trim();
      
      if (chapterContent.length > 0) {
        chapters.push({
          number: chapterNumber,
          title: chapterTitle,
          text: chapterContent,
          startIndex: startPos,
          endIndex: endPos
        });
      }
    }
    
    // If no chapters were extracted, treat the whole text as one chapter
    if (chapters.length === 0) {
      chapters.push({
        number: 1,
        title: 'Document',
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length
      });
    }
    
    console.log(`[ProductionChunking] Extracted ${chapters.length} chapters:`, 
      chapters.map(ch => `Ch${ch.number} (${ch.text.length} chars)`));
    
    return chapters;
  }
}
