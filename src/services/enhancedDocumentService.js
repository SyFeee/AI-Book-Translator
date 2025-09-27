import { AdvancedDocumentProcessor } from './advancedDocumentProcessor.js';

/**
 * Enhanced document processing service that bridges the advanced processor
 * with the existing translation pipeline
 */
export class EnhancedDocumentService {
  constructor(options = {}) {
    this.processor = new AdvancedDocumentProcessor(options);
    this.options = options;
  }

  /**
   * Process document using the advanced pipeline and prepare for translation
   * @param {Object} file - Uploaded file object
   * @returns {Object} - Enhanced chunks and metadata for translation
   */
  async processDocumentForTranslation(file) {
    console.log('[EnhancedDocumentService] Starting advanced document processing...');
    
    // Step 1: Use advanced processor to get clean text + structure map
    const processed = await this.processor.processDocument(file);
    
    // Step 2: Create translation-optimized chunks using structure information
    const translationChunks = this.createStructureAwareChunks(
      processed.cleanText, 
      processed.structureMap
    );
    
    // Step 3: Enhance chunks with contextual metadata
    const enhancedChunks = this.enhanceChunksWithContext(translationChunks, processed);
    
    console.log(`[EnhancedDocumentService] Created ${enhancedChunks.length} structure-aware chunks`);
    
    return {
      chunks: enhancedChunks,
      metadata: {
        ...processed.metadata,
        structureMap: processed.structureMap,
        assets: processed.assets,
        processingMethod: 'advanced',
        chunkingStrategy: 'structure-aware'
      }
    };
  }

    /**
   * Create structure-aware chunks using hierarchical book-aware strategy
   */
  createStructureAwareChunks(processed) {
    // Use hierarchical chunking strategy for novels
    if (this.isNovel(processed)) {
      return this.createNovelAwareChunks(processed);
    }
    
    // For non-fiction or shorter documents, use semantic chunking
    return this.createSemanticChunks(processed);
  }

  /**
   * Determine if document is a novel (>50k words, has chapters)
   */
  isNovel(processed) {
    const wordCount = processed.normalizedText.split(/\s+/).length;
    const hasChapters = processed.structureMap.chapters && processed.structureMap.chapters.length > 2; // Lower threshold
    const hasDialogue = /[""].*?[""]/.test(processed.normalizedText);
    
    console.log(`[isNovel] Word count: ${wordCount}, Chapters: ${processed.structureMap.chapters?.length}, Has dialogue: ${hasDialogue}`);
    
    return wordCount > 300 && hasChapters && hasDialogue; // Very low threshold for testing
  }

  /**
   * Book-aware chunking strategy for novels
   */
  createNovelAwareChunks(processed) {
    console.log('[EnhancedDocumentService] Using novel-aware chunking strategy');
    
    const chunks = [];
    const TARGET_TOKENS = 512;  // Configurable based on model
    const MAX_TOKENS = 1024;    // Hard limit
    const OVERLAP_PARAGRAPHS = 1; // One paragraph overlap
    
    // Level 0: Try chapter-level chunks
    for (const chapter of processed.structureMap.chapters) {
      const chapterText = this.extractChapterText(processed.normalizedText, chapter);
      const chapterTokens = this.estimateTokens(chapterText);
      
      if (chapterTokens <= TARGET_TOKENS) {
        // Chapter fits in one chunk
        chunks.push(this.createNovelChunk({
          text: chapterText,
          id: `c${chapter.number}`,
          type: 'chapter',
          chapter: chapter.number,
          tokens: chapterTokens,
          structureInfo: {
            level: 'chapter',
            boundaries: 'complete'
          }
        }));
      } else {
        // Level 1: Split by scenes within chapter
        const sceneChunks = this.splitChapterByScenes(chapterText, chapter, TARGET_TOKENS, MAX_TOKENS);
        chunks.push(...sceneChunks);
      }
    }
    
    // Add overlap and linking
    return this.addChunkOverlap(chunks, OVERLAP_PARAGRAPHS);
  }

  /**
   * Split chapter by scene breaks when too large
   */
  splitChapterByScenes(chapterText, chapter, targetTokens, maxTokens) {
    const chunks = [];
    
    // Scene break patterns: *** or ### or significant whitespace
    const sceneBreaks = chapterText.split(/\n\s*(?:\*{3,}|#{3,}|\n\s*\n\s*\n)/);
    
    let currentScene = '';
    let sceneIndex = 0;
    
    for (let i = 0; i < sceneBreaks.length; i++) {
      const scene = sceneBreaks[i].trim();
      if (!scene) continue;
      
      const combinedText = currentScene + (currentScene ? '\n\n' : '') + scene;
      const combinedTokens = this.estimateTokens(combinedText);
      
      if (combinedTokens <= targetTokens) {
        currentScene = combinedText;
      } else {
        // Current scene is ready, start new one
        if (currentScene) {
          chunks.push(this.createNovelChunk({
            text: currentScene,
            id: `c${chapter.number}-s${sceneIndex}`,
            type: 'scene',
            chapter: chapter.number,
            scene: sceneIndex,
            tokens: this.estimateTokens(currentScene),
            structureInfo: {
              level: 'scene',
              boundaries: 'scene-break'
            }
          }));
          sceneIndex++;
        }
        
        // Check if single scene is too large
        const sceneTokens = this.estimateTokens(scene);
        if (sceneTokens > maxTokens) {
          // Level 2: Split by paragraphs
          const paragraphChunks = this.splitSceneByParagraphs(scene, chapter.number, sceneIndex, targetTokens);
          chunks.push(...paragraphChunks);
          sceneIndex += paragraphChunks.length;
          currentScene = '';
        } else {
          currentScene = scene;
        }
      }
    }
    
    // Add final scene
    if (currentScene) {
      chunks.push(this.createNovelChunk({
        text: currentScene,
        id: `c${chapter.number}-s${sceneIndex}`,
        type: 'scene',
        chapter: chapter.number,
        scene: sceneIndex,
        tokens: this.estimateTokens(currentScene),
        structureInfo: {
          level: 'scene',
          boundaries: 'scene-break'
        }
      }));
    }
    
    return chunks;
  }

  /**
   * Level 2: Split scene by paragraphs (last resort)
   */
  splitSceneByParagraphs(sceneText, chapterNum, sceneNum, targetTokens) {
    const paragraphs = sceneText.split(/\n\s*\n/).filter(p => p.trim());
    const chunks = [];
    
    let currentChunk = '';
    let paragraphIndex = 0;
    
    for (const paragraph of paragraphs) {
      const combinedText = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const combinedTokens = this.estimateTokens(combinedText);
      
      if (combinedTokens <= targetTokens) {
        currentChunk = combinedText;
      } else {
        // Save current chunk
        if (currentChunk) {
          chunks.push(this.createNovelChunk({
            text: currentChunk,
            id: `c${chapterNum}-s${sceneNum}-p${paragraphIndex}`,
            type: 'paragraph-group',
            chapter: chapterNum,
            scene: sceneNum,
            paragraphGroup: paragraphIndex,
            tokens: this.estimateTokens(currentChunk),
            structureInfo: {
              level: 'paragraph',
              boundaries: 'paragraph-break',
              preserveIntegrity: true
            }
          }));
          paragraphIndex++;
        }
        currentChunk = paragraph;
      }
    }
    
    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createNovelChunk({
        text: currentChunk,
        id: `c${chapterNum}-s${sceneNum}-p${paragraphIndex}`,
        type: 'paragraph-group',
        chapter: chapterNum,
        scene: sceneNum,
        paragraphGroup: paragraphIndex,
        tokens: this.estimateTokens(currentChunk),
        structureInfo: {
          level: 'paragraph',
          boundaries: 'paragraph-break',
          preserveIntegrity: true
        }
      }));
    }
    
    return chunks;
  }

  /**
   * Add intelligent overlap between chunks (one paragraph)
   */
  addChunkOverlap(chunks, overlapParagraphs = 1) {
    if (chunks.length <= 1) return chunks;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Add previous context
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const prevParagraphs = prevChunk.text.split(/\n\s*\n/).slice(-overlapParagraphs);
        chunk.previousContext = prevParagraphs.join('\n\n');
        chunk.prev_id = prevChunk.id;
      }
      
      // Add next context
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const nextParagraphs = nextChunk.text.split(/\n\s*\n/).slice(0, overlapParagraphs);
        chunk.nextContext = nextParagraphs.join('\n\n');
        chunk.next_id = nextChunk.id;
      }
    }
    
    return chunks;
  }

  /**
   * Create chunk object with metadata for novel processing
   */
  createNovelChunk(data) {
    return {
      id: data.id,
      text: data.text,
      type: data.type,
      chapter: data.chapter,
      scene: data.scene,
      paragraphGroup: data.paragraphGroup,
      tokens: data.tokens,
      structureInfo: data.structureInfo,
      translationMetadata: {
        preserveStructure: true,
        contextRequired: data.type !== 'chapter', // Smaller chunks need more context
        specialHandling: this.detectSpecialContent(data.text)
      }
    };
  }

  /**
   * Detect special content requiring careful translation
   */
  detectSpecialContent(text) {
    if (typeof text !== 'string') return [];
    
    const special = {
      hasDialogue: /[""].*?[""]/.test(text),
      hasNames: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(text),
      hasPoetry: /\n\s{4,}/.test(text), // Indented text
      hasEmphasis: /\*[^*]+\*|_[^_]+_/.test(text)
    };
    
    return Object.keys(special).filter(key => special[key]);
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters for English
    // More accurate for novel text than technical content
    return Math.ceil(text.length / 4);
  }

  /**
   * Create semantic chunks for non-fiction or shorter documents
   */
  createSemanticChunks(processed) {
    console.log('[EnhancedDocumentService] Using semantic chunking strategy');
    
    const chunks = [];
    const TARGET_TOKENS = 512;
    const MAX_TOKENS = 1024;
    
    // Split by sections if available
    if (processed.structureMap.sections && processed.structureMap.sections.length > 0) {
      return this.chunkBySections(processed);
    }
    
    // Fall back to paragraph-based chunking
    return this.chunkByParagraphs(processed);
  }

  /**
   * Extract chapter text using structure map
   */
  extractChapterText(fullText, chapter) {
    const lines = fullText.split('\n');
    const startLine = chapter.startLine || 0;
    const endLine = chapter.endLine || lines.length;
    
    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Chunk by chapter boundaries, respecting scene breaks within chapters
   */
  chunkByChapters(cleanText, chapterSpans, sceneBreaks, structureMap) {
    const chunks = [];
    
    for (let i = 0; i < chapterSpans.length; i++) {
      const chapterStart = chapterSpans[i].start;
      const chapterEnd = i < chapterSpans.length - 1 ? 
        chapterSpans[i + 1].start : cleanText.length;
      
      const chapterText = cleanText.substring(chapterStart, chapterEnd);
      
      // Find scene breaks within this chapter
      const chapterSceneBreaks = sceneBreaks.filter(sb => 
        sb.start >= chapterStart && sb.start < chapterEnd
      );
      
      if (chapterText.length <= 2000) {
        // Small chapter - keep as single chunk
        chunks.push(this.createChunk(chapterText, chapterStart, {
          type: 'chapter',
          chapterIndex: i,
          title: chapterSpans[i].metadata?.title || `Chapter ${i + 1}`,
          isCompleteChapter: true
        }));
      } else if (chapterSceneBreaks.length > 0) {
        // Large chapter with scene breaks - chunk by scenes
        const sceneChunks = this.chunkChapterByScenes(
          chapterText, chapterStart, chapterSceneBreaks, i
        );
        chunks.push(...sceneChunks);
      } else {
        // Large chapter without scene breaks - use semantic chunking
        const semanticChunks = this.semanticChunkLargeChapter(
          chapterText, chapterStart, i
        );
        chunks.push(...semanticChunks);
      }
    }
    
    return chunks;
  }

  /**
   * Chunk by scene breaks
   */
  chunkByScenes(cleanText, sceneBreaks, structureMap) {
    const chunks = [];
    
    for (let i = 0; i < sceneBreaks.length; i++) {
      const sceneStart = i === 0 ? 0 : sceneBreaks[i - 1].end;
      const sceneEnd = sceneBreaks[i].start;
      
      const sceneText = cleanText.substring(sceneStart, sceneEnd);
      
      if (sceneText.trim().length > 0) {
        chunks.push(this.createChunk(sceneText, sceneStart, {
          type: 'scene',
          sceneIndex: i,
          isCompleteScene: true
        }));
      }
    }
    
    // Handle text after last scene break
    if (sceneBreaks.length > 0) {
      const lastSceneEnd = sceneBreaks[sceneBreaks.length - 1].end;
      if (lastSceneEnd < cleanText.length) {
        const remainingText = cleanText.substring(lastSceneEnd);
        if (remainingText.trim().length > 0) {
          chunks.push(this.createChunk(remainingText, lastSceneEnd, {
            type: 'scene',
            sceneIndex: sceneBreaks.length,
            isCompleteScene: true
          }));
        }
      }
    }
    
    return chunks;
  }

  /**
   * Chunk with dialogue awareness for unstructured text
   */
  chunkWithDialogueAwareness(cleanText, dialogueSpans, structureMap) {
    // Use existing semantic chunking but enhance with dialogue info
    const basicChunks = this.basicSemanticChunk(cleanText);
    
    // Enhance chunks with dialogue information
    return basicChunks.map((chunk, index) => {
      const chunkDialogue = dialogueSpans.filter(ds => 
        ds.start >= chunk.startOffset && ds.start < chunk.endOffset
      );
      
      return {
        ...chunk,
        structuralInfo: {
          ...chunk.structuralInfo,
          dialogueCount: chunkDialogue.length,
          isDialogueHeavy: chunkDialogue.length > 3,
          hasDialogue: chunkDialogue.length > 0
        }
      };
    });
  }

  /**
   * Create a chunk with enhanced metadata
   */
  createChunk(text, startOffset, structuralMetadata) {
    return {
      text: text.trim(),
      startOffset,
      endOffset: startOffset + text.length,
      length: text.trim().length,
      wordCount: text.trim().split(/\s+/).length,
      structuralInfo: {
        ...structuralMetadata,
        hasFormatting: /<[^>]+>/.test(text),
        isPartialParagraph: false,
        isPartialSentence: false
      }
    };
  }

  /**
   * Enhance chunks with translation context
   */
  enhanceChunksWithContext(chunks, processed) {
    return chunks.map((chunk, index) => {
      // Find relevant assets within this chunk
      const relevantAssets = this.findRelevantAssets(chunk, processed.assets);
      
      // Determine chunk complexity for translation
      const complexity = this.assessChunkComplexity(chunk, processed.structureMap);
      
      // Add context from adjacent chunks
      const context = {
        previousChunk: index > 0 ? chunks[index - 1] : null,
        nextChunk: index < chunks.length - 1 ? chunks[index + 1] : null,
        position: index / chunks.length,
        totalChunks: chunks.length
      };
      
      return {
        id: index,
        ...chunk,
        translationMetadata: {
          complexity,
          relevantAssets,
          context,
          requiresSpecialHandling: this.requiresSpecialHandling(chunk),
          estimatedTokens: Math.ceil(chunk.text.length / 4) // Rough token estimate
        }
      };
    });
  }

  /**
   * Find assets (images, tables, etc.) relevant to this chunk
   */
  findRelevantAssets(chunk, assets) {
    const relevant = {
      images: [],
      tables: [],
      footnotes: []
    };
    
    // Check if chunk contains asset references
    Object.keys(assets).forEach(assetType => {
      assets[assetType].forEach(asset => {
        if (chunk.text.includes(`[${assetType.toUpperCase()}:${asset.id}]`)) {
          relevant[assetType].push(asset);
        }
      });
    });
    
    return relevant;
  }

  /**
   * Assess translation complexity of a chunk
   */
  assessChunkComplexity(chunk, structureMap) {
    let score = 0;
    
    // Length factor
    if (chunk.length > 1500) score += 2;
    else if (chunk.length > 800) score += 1;
    
    // Structural factors
    if (chunk.structuralInfo?.type === 'chapter') score += 1;
    if (chunk.structuralInfo?.isDialogueHeavy) score += 1;
    if (chunk.structuralInfo?.hasFormatting) score += 1;
    
    // Asset factors
    if (chunk.text.includes('[IMAGE:')) score += 1;
    if (chunk.text.includes('[TABLE:')) score += 2;
    
    // Technical content
    const technicalTerms = (chunk.text.match(/\b(algorithm|database|API|protocol|framework)\b/gi) || []).length;
    if (technicalTerms > 5) score += 2;
    else if (technicalTerms > 2) score += 1;
    
    if (score >= 5) return 'very_high';
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Determine if chunk requires special handling during translation
   */
  requiresSpecialHandling(chunk) {
    const specialCases = [];
    
    if (chunk.structuralInfo?.type === 'chapter') {
      specialCases.push('chapter_title');
    }
    
    if (chunk.structuralInfo?.isDialogueHeavy) {
      specialCases.push('dialogue_heavy');
    }
    
    if (chunk.text.includes('[TABLE:')) {
      specialCases.push('contains_table');
    }
    
    if (chunk.text.includes('[IMAGE:')) {
      specialCases.push('contains_image');
    }
    
    if (/<[^>]+>/.test(chunk.text)) {
      specialCases.push('has_formatting');
    }
    
    return specialCases;
  }

  // Helper methods for chunking strategies
  
  chunkChapterByScenes(chapterText, chapterStart, sceneBreaks, chapterIndex) {
    // Implementation for scene-based chunking within chapters
    const chunks = [];
    let currentStart = 0;
    
    sceneBreaks.forEach((sceneBreak, index) => {
      const relativeSceneStart = sceneBreak.start - chapterStart;
      const sceneText = chapterText.substring(currentStart, relativeSceneStart);
      
      if (sceneText.trim().length > 0) {
        chunks.push(this.createChunk(sceneText, chapterStart + currentStart, {
          type: 'scene',
          chapterIndex,
          sceneIndex: index,
          isPartOfChapter: true
        }));
      }
      
      currentStart = relativeSceneStart;
    });
    
    return chunks;
  }
  
  semanticChunkLargeChapter(chapterText, chapterStart, chapterIndex) {
    // Break large chapters semantically while preserving paragraph boundaries
    const paragraphs = chapterText.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let currentStart = chapterStart;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > 1500 && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, currentStart, {
          type: 'chapter_section',
          chapterIndex,
          isPartOfChapter: true
        }));
        
        currentStart += currentChunk.length;
        currentChunk = paragraph;
      } else {
        if (currentChunk.length > 0) currentChunk += '\n\n';
        currentChunk += paragraph;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, currentStart, {
        type: 'chapter_section',
        chapterIndex,
        isPartOfChapter: true
      }));
    }
    
    return chunks;
  }
  
  basicSemanticChunk(text) {
    // Simple semantic chunking for fallback
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let currentStart = 0;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > 1200 && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startOffset: currentStart,
          endOffset: currentStart + currentChunk.length,
          length: currentChunk.trim().length,
          wordCount: currentChunk.trim().split(/\s+/).length,
          structuralInfo: { type: 'semantic_chunk' }
        });
        
        currentStart += currentChunk.length;
        currentChunk = paragraph;
      } else {
        if (currentChunk.length > 0) currentChunk += '\n\n';
        currentChunk += paragraph;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        startOffset: currentStart,
        endOffset: currentStart + currentChunk.length,
        length: currentChunk.trim().length,
        wordCount: currentChunk.trim().split(/\s+/).length,
        structuralInfo: { type: 'semantic_chunk' }
      });
    }
    
    return chunks;
  }
}

export default EnhancedDocumentService;
