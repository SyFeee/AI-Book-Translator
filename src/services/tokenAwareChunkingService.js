/**
 * Advanced Token-Aware Chunking Service
 * Handles large chapters, token limits, and complex document structures
 */

export class TokenAwareChunkingService {
  constructor(options = {}) {
    this.options = {
      // Token-based limits (more accurate than character-based)
      maxTokensPerChunk: options.maxTokensPerChunk || 2500,  // Significantly increased for fewer chunks
      minTokensPerChunk: options.minTokensPerChunk || 500,
      targetTokensPerChunk: options.targetTokensPerChunk || 2000,  // Increased target for better coherence
      
      // Character fallback when no tokenizer available
      maxCharsPerChunk: options.maxCharsPerChunk || 8000,  // Increased for larger chunks
      
      // Overlap for context preservation
      tokenOverlap: options.tokenOverlap || 100,  // Increased overlap for better context
      
      // Model-specific settings
      modelType: options.modelType || 'gpt-3.5-turbo', // gpt-3.5-turbo, gpt-4, claude, etc.
      hasTokenizer: options.hasTokenizer || false,
      
      // Content preservation
      preserveChapterBoundaries: options.preserveChapterBoundaries !== false,
      preserveSceneBoundaries: options.preserveSceneBoundaries !== false,
      preserveDialogueBoundaries: options.preserveDialogueBoundaries !== false,
      
      ...options
    };
    
    // Set model-specific token limits
    this.setModelLimits();
    
    console.log(`[TokenAware] Initialized for ${this.options.modelType} with ${this.options.maxTokensPerChunk} token limit`);
  }

  /**
   * Set appropriate token limits based on model type
   */
  setModelLimits() {
    const modelLimits = {
      'gpt-3.5-turbo': { context: 4096, output: 1000, safe: 500 },
      'gpt-4': { context: 8192, output: 2000, safe: 800 },
      'gpt-4-32k': { context: 32768, output: 4000, safe: 2000 },
      'claude-2': { context: 100000, output: 2000, safe: 1500 },
      'claude-instant': { context: 100000, output: 1500, safe: 1000 },
      'llama-2-7b': { context: 4096, output: 800, safe: 600 },
      'llama-2-13b': { context: 4096, output: 1000, safe: 800 },
      'gemma-3-1b': { context: 8192, output: 8000, safe: 2500 }, // Updated for better performance
      'default': { context: 4096, output: 1000, safe: 800 }
    };

    const limits = modelLimits[this.options.modelType] || modelLimits.default;
    
    // Reserve space for system prompts, context, and safety margin
    this.options.maxTokensPerChunk = Math.min(
      this.options.maxTokensPerChunk, 
      limits.safe
    );
    
    console.log(`[TokenAware] Model ${this.options.modelType}: max ${this.options.maxTokensPerChunk} tokens/chunk`);
  }

  /**
   * Main chunking entry point with intelligent strategy selection
   */
  async chunkDocument(text, documentStructure = {}) {
    console.log(`[TokenAware] Processing document: ${text.length} chars`);
    
    // Analyze document structure
    const analysis = await this.analyzeDocument(text, documentStructure);
    
    // Select optimal chunking strategy
    const strategy = this.selectOptimalStrategy(analysis);
    
    console.log(`[TokenAware] Selected strategy: ${strategy} for document with ${analysis.chapters} chapters, ${analysis.estimatedTokens} tokens`);
    
    // Apply chosen strategy
    switch (strategy) {
      case 'hierarchical-chapter':
        return await this.hierarchicalChapterChunking(text, analysis);
      case 'smart-scene':
        return await this.smartSceneChunking(text, analysis);
      case 'adaptive-paragraph':
        return await this.adaptiveParagraphChunking(text, analysis);
      default:
        return await this.adaptiveParagraphChunking(text, analysis);
    }
  }

  /**
   * Analyze document to determine optimal chunking approach
   */
  async analyzeDocument(text, documentStructure) {
    const tokens = this.estimateTokens(text);
    const chapters = this.detectChapters(text);
    const scenes = this.detectScenes(text);
    const dialogueRatio = this.calculateDialogueRatio(text);
    const avgParagraphLength = this.calculateAvgParagraphLength(text);
    
    return {
      totalLength: text.length,
      estimatedTokens: tokens,
      chapters: chapters.length,
      chaptersData: chapters,
      scenes: scenes.length,
      dialogueRatio,
      avgParagraphLength,
      hasImages: documentStructure.images?.length > 0,
      hasTables: documentStructure.tables?.length > 0,
      complexity: this.assessComplexity(text, documentStructure)
    };
  }

  /**
   * Hierarchical chapter chunking for large chapters
   */
  async hierarchicalChapterChunking(text, analysis) {
    const chunks = [];
    let globalIndex = 0;

    for (const chapter of analysis.chaptersData) {
      const chapterTokens = this.estimateTokens(chapter.text);
      
      if (chapterTokens <= this.options.maxTokensPerChunk) {
        // Chapter fits in one chunk
        chunks.push(this.createEnhancedChunk({
          id: globalIndex++,
          text: chapter.text,
          tokens: chapterTokens,
          type: 'complete-chapter',
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          boundaries: 'complete'
        }));
      } else {
        // Chapter is too large - use hierarchical splitting
        console.log(`[TokenAware] Chapter ${chapter.number} (${chapterTokens} tokens) exceeds limit, splitting hierarchically`);
        
        const chapterChunks = await this.splitLargeChapter(chapter, globalIndex);
        chapterChunks.forEach(chunk => {
          chunk.id = globalIndex++;
        });
        chunks.push(...chapterChunks);
      }
    }

    return chunks;
  }

  /**
   * Split large chapter using multiple strategies
   */
  async splitLargeChapter(chapter, startIndex) {
    // Strategy 1: Try scene-based splitting first
    const scenes = this.detectScenesInText(chapter.text);
    
    if (scenes.length > 1) {
      console.log(`[TokenAware] Splitting chapter ${chapter.number} by ${scenes.length} scenes`);
      return await this.splitChapterByScenes(chapter, scenes, startIndex);
    }
    
    // Strategy 2: Try paragraph-based splitting with overlap
    console.log(`[TokenAware] Splitting chapter ${chapter.number} by paragraphs with context overlap`);
    return await this.splitChapterByParagraphs(chapter, startIndex);
  }

  /**
   * Split chapter by scenes with proper context preservation
   */
  async splitChapterByScenes(chapter, scenes, startIndex) {
    const chunks = [];
    let chunkIndex = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneTokens = this.estimateTokens(scene.text);
      
      if (sceneTokens <= this.options.maxTokensPerChunk) {
        // Scene fits in one chunk
        chunks.push(this.createEnhancedChunk({
          id: startIndex + chunkIndex++,
          text: scene.text,
          tokens: sceneTokens,
          type: 'scene',
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          sceneNumber: i + 1,
          boundaries: 'scene-complete'
        }));
      } else {
        // Scene is still too large - split by paragraphs
        const sceneChunks = await this.splitSceneByParagraphs(scene, chapter, i + 1, startIndex + chunkIndex);
        chunkIndex += sceneChunks.length;
        chunks.push(...sceneChunks);
      }
    }

    return chunks;
  }

  /**
   * Split chapter by paragraphs with intelligent overlap
   */
  async splitChapterByParagraphs(chapter, startIndex) {
    const paragraphs = this.extractParagraphs(chapter.text);
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTokens = this.estimateTokens(paragraph.text);
      
      // Check if adding this paragraph would exceed limits
      if (currentTokens + paragraphTokens > this.options.maxTokensPerChunk && currentChunk.length > 0) {
        // Create chunk from current paragraphs
        const chunkText = currentChunk.map(p => p.text).join('\\n\\n');
        
        chunks.push(this.createEnhancedChunk({
          id: startIndex + chunkIndex++,
          text: chunkText,
          tokens: currentTokens,
          type: 'chapter-part',
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          chapterPart: chunkIndex,
          boundaries: 'paragraph-split',
          contextInfo: this.generateContextInfo(currentChunk, paragraphs, i)
        }));

        // Start new chunk with overlap
        currentChunk = this.getOverlapParagraphs(currentChunk, this.options.tokenOverlap);
        currentTokens = this.estimateTokens(currentChunk.map(p => p.text).join('\\n\\n'));
      }
      
      // Handle single paragraph that's too large
      if (paragraphTokens > this.options.maxTokensPerChunk) {
        console.warn(`[TokenAware] Paragraph exceeds token limit (${paragraphTokens} tokens), splitting by sentences`);
        const sentenceChunks = await this.splitParagraphBySentences(paragraph, chapter, startIndex + chunkIndex);
        chunkIndex += sentenceChunks.length;
        chunks.push(...sentenceChunks);
        continue;
      }
      
      currentChunk.push(paragraph);
      currentTokens += paragraphTokens;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.map(p => p.text).join('\\n\\n');
      chunks.push(this.createEnhancedChunk({
        id: startIndex + chunkIndex,
        text: chunkText,
        tokens: currentTokens,
        type: 'chapter-final',
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        chapterPart: chunkIndex + 1,
        boundaries: 'chapter-end'
      }));
    }

    return chunks;
  }

  /**
   * Last resort: split paragraph by sentences (for extremely long paragraphs)
   */
  async splitParagraphBySentences(paragraph, chapter, startIndex) {
    const sentences = this.splitIntoSentences(paragraph.text);
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > this.options.maxTokensPerChunk && currentChunk.length > 0) {
        chunks.push(this.createEnhancedChunk({
          id: startIndex + chunkIndex++,
          text: currentChunk.join(' '),
          tokens: currentTokens,
          type: 'sentence-split',
          chapterNumber: chapter.number,
          boundaries: 'sentence-forced',
          warning: 'Forced sentence split due to token limits'
        }));
        
        currentChunk = [];
        currentTokens = 0;
      }
      
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createEnhancedChunk({
        id: startIndex + chunkIndex,
        text: currentChunk.join(' '),
        tokens: currentTokens,
        type: 'sentence-final',
        chapterNumber: chapter.number,
        boundaries: 'sentence-end'
      }));
    }

    return chunks;
  }

  /**
   * Enhanced chunk creation with comprehensive metadata
   */
  createEnhancedChunk(options) {
    return {
      id: options.id,
      text: options.text,
      estimatedTokens: options.tokens || this.estimateTokens(options.text),
      type: options.type,
      metadata: {
        chapterNumber: options.chapterNumber,
        chapterTitle: options.chapterTitle,
        chapterPart: options.chapterPart,
        sceneNumber: options.sceneNumber,
        boundaries: options.boundaries,
        contextInfo: options.contextInfo,
        warning: options.warning
      },
      processingHints: {
        preserveFormatting: options.type.includes('chapter') || options.type.includes('scene'),
        requiresContext: options.boundaries?.includes('split'),
        isPartial: options.type.includes('part') || options.type.includes('split')
      }
    };
  }

  /**
   * Token estimation (character-based fallback when no tokenizer available)
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // More accurate estimation based on language and content type
    if (this.isAsianLanguage(text)) {
      // Asian languages: roughly 1 token per character
      return text.length;
    } else {
      // Western languages: roughly 1 token per 3.5-4 characters
      return Math.ceil(text.length / 3.7);
    }
  }

  isAsianLanguage(text) {
    // Simple detection for Chinese, Japanese, Korean
    return /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
  }

  // Helper methods for document analysis
  detectChapters(text) {
    const chapterRegex = /^[\s]*(Chapter|Capítulo|Chapitre|Kapitel|第.*章)[\s]*(\d+|[IVXLCDM]+)/gim;
    const matches = [...text.matchAll(chapterRegex)];
    
    if (matches.length === 0) {
      return [{ number: 1, title: 'Document', text: text.trim() }];
    }
    
    const chapters = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startPos = match.index;
      const endPos = i < matches.length - 1 ? matches[i + 1].index : text.length;
      
      const chapterText = text.substring(startPos, endPos);
      const contentStart = chapterText.indexOf('\\n') + 1;
      const content = chapterText.substring(contentStart).trim();
      
      if (content.length > 0) {
        chapters.push({
          number: i + 1,
          title: match[0].trim(),
          text: content
        });
      }
    }
    
    return chapters;
  }

  detectScenes(text) {
    return (text.match(/^[\s]*[*\-#]{3,}[\s]*$/gm) || []).length;
  }

  detectScenesInText(text) {
    const sceneBreaks = text.split(/^[\s]*[*\-#]{3,}[\s]*$/gm);
    return sceneBreaks.map((scene, index) => ({
      number: index + 1,
      text: scene.trim()
    })).filter(scene => scene.text.length > 0);
  }

  calculateDialogueRatio(text) {
    const dialogueMatches = text.match(/["«»""''„"]/g) || [];
    return dialogueMatches.length / text.length;
  }

  calculateAvgParagraphLength(text) {
    const paragraphs = text.split(/\\n\\s*\\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return 0;
    return paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
  }

  extractParagraphs(text) {
    return text.split(/\\n\\s*\\n/)
      .filter(p => p.trim().length > 0)
      .map(p => ({
        text: p.trim(),
        isDialogue: /["«»""''„"]/.test(p),
        length: p.trim().length
      }));
  }

  splitIntoSentences(text) {
    // Basic sentence splitting - in production, use more sophisticated NLP
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  selectOptimalStrategy(analysis) {
    if (analysis.chapters > 1) {
      return 'hierarchical-chapter';
    } else if (analysis.scenes > 2) {
      return 'smart-scene';
    } else {
      return 'adaptive-paragraph';
    }
  }

  assessComplexity(text, documentStructure) {
    let complexity = 'simple';
    
    if (documentStructure.images?.length > 0 || documentStructure.tables?.length > 0) {
      complexity = 'complex';
    } else if (text.length > 50000) {
      complexity = 'moderate';
    }
    
    return complexity;
  }

  getOverlapParagraphs(paragraphs, targetTokens) {
    const overlap = [];
    let tokens = 0;
    
    for (let i = paragraphs.length - 1; i >= 0 && tokens < targetTokens; i--) {
      const paragraph = paragraphs[i];
      const paragraphTokens = this.estimateTokens(paragraph.text);
      
      if (tokens + paragraphTokens <= targetTokens) {
        overlap.unshift(paragraph);
        tokens += paragraphTokens;
      } else {
        break;
      }
    }
    
    return overlap;
  }

  generateContextInfo(currentChunk, allParagraphs, currentIndex) {
    return {
      precedingContext: currentIndex > 0 ? allParagraphs[currentIndex - 1].text.substring(0, 100) + '...' : null,
      followingContext: currentIndex < allParagraphs.length - 1 ? allParagraphs[currentIndex + 1].text.substring(0, 100) + '...' : null,
      chunkPosition: `${currentIndex + 1}/${allParagraphs.length}`
    };
  }

  /**
   * Adaptive paragraph chunking that adjusts to content and token limits
   */
  async adaptiveParagraphChunking(text, analysis) {
    console.log('[TokenAware] Using adaptive paragraph chunking strategy');
    
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunk = '';
    let currentTokens = 0;
    let chunkId = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      const paragraphTokens = this.estimateTokens(paragraph);

      // If adding this paragraph would exceed token limit
      if (currentTokens + paragraphTokens > this.options.maxTokensPerChunk && currentChunk.length > 0) {
        // Create chunk with current content
        chunks.push({
          id: chunkId++,
          text: currentChunk.trim(),
          tokenEstimate: currentTokens,
          type: 'adaptive-paragraph',
          metadata: {
            paragraphCount: currentChunk.split(/\n\s*\n/).length,
            strategy: 'adaptive',
            chapterHint: this.getChapterHint(currentChunk),
            contextInfo: this.generateAdaptiveContextInfo(currentChunk, paragraphs, i)
          }
        });

        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
        }
        currentTokens += paragraphTokens;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: chunkId++,
        text: currentChunk.trim(),
        tokenEstimate: currentTokens,
        type: 'adaptive-paragraph',
        metadata: {
          paragraphCount: currentChunk.split(/\n\s*\n/).length,
          strategy: 'adaptive',
          chapterHint: this.getChapterHint(currentChunk),
          contextInfo: this.generateAdaptiveContextInfo(currentChunk, paragraphs, paragraphs.length)
        }
      });
    }

    console.log(`[TokenAware] Created ${chunks.length} adaptive chunks`);
    return {
      chunks,
      strategy: 'adaptive-paragraph',
      tokenEstimates: {
        total: analysis.estimatedTokens,
        maxPerChunk: this.options.maxTokensPerChunk,
        avgPerChunk: Math.round(analysis.estimatedTokens / chunks.length)
      }
    };
  }

  /**
   * Get chapter hint from chunk content
   */
  getChapterHint(text) {
    const chapterMatch = text.match(/(chapter|Chapter|CHAPTER)\s*(\d+|\w+)/);
    return chapterMatch ? chapterMatch[0] : null;
  }

  /**
   * Generate adaptive context information
   */
  generateAdaptiveContextInfo(chunk, allParagraphs, currentIndex) {
    return {
      precedingContext: currentIndex > 0 ? allParagraphs[currentIndex - 1].substring(0, 100) + '...' : null,
      followingContext: currentIndex < allParagraphs.length - 1 ? allParagraphs[currentIndex + 1].substring(0, 100) + '...' : null,
      position: `${currentIndex}/${allParagraphs.length}`,
      adaptiveHints: {
        hasDialogue: /[""]/.test(chunk),
        hasNarration: !/^[""]/.test(chunk.trim()),
        hasAction: /\b(walked|ran|jumped|said|replied|asked)\b/i.test(chunk),
        complexity: chunk.split(/[.!?]/).length
      }
    };
  }

  /**
   * Smart scene chunking for narrative content
   */
  async smartSceneChunking(text, analysis) {
    console.log('[TokenAware] Using smart scene chunking strategy');
    
    // Fallback to adaptive if no clear scenes detected
    if (analysis.scenes < 2) {
      return await this.adaptiveParagraphChunking(text, analysis);
    }

    const chunks = [];
    const scenes = this.detectScenes(text);
    let chunkId = 0;

    for (const scene of scenes) {
      const sceneTokens = this.estimateTokens(scene.text);
      
      if (sceneTokens <= this.options.maxTokensPerChunk) {
        // Scene fits in one chunk
        chunks.push({
          id: chunkId++,
          text: scene.text,
          tokenEstimate: sceneTokens,
          type: 'scene',
          metadata: {
            sceneNumber: scene.number,
            strategy: 'smart-scene',
            sceneMarkers: scene.markers
          }
        });
      } else {
        // Split large scene using adaptive method
        const sceneResult = await this.adaptiveParagraphChunking(scene.text, {
          estimatedTokens: sceneTokens
        });
        
        sceneResult.chunks.forEach((chunk, index) => {
          chunks.push({
            ...chunk,
            id: chunkId++,
            type: 'scene-part',
            metadata: {
              ...chunk.metadata,
              sceneNumber: scene.number,
              scenePart: index + 1,
              totalSceneParts: sceneResult.chunks.length,
              strategy: 'smart-scene-split'
            }
          });
        });
      }
    }

    console.log(`[TokenAware] Created ${chunks.length} scene-aware chunks`);
    return {
      chunks,
      strategy: 'smart-scene',
      tokenEstimates: {
        total: analysis.estimatedTokens,
        maxPerChunk: this.options.maxTokensPerChunk,
        avgPerChunk: Math.round(analysis.estimatedTokens / chunks.length)
      }
    };
  }
}
