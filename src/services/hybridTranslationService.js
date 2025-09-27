/**
 * Hybrid Translation Service
 * Combines multiple translation strategies for optimal quality and cost efficiency:
 * 
 * Strategy 1: DeepL + LLM Editor (Your suggestion)
 * - DeepL for initial translation (maintains fluency and rhythm)
 * - Light LLM pass for glossary, character voice, and continuity
 * 
 * Strategy 2: Multi-Model Ensemble
 * - Primary: High-quality model for critical passages
 * - Secondary: Fast model for simple text
 * - Validator: Cross-reference for accuracy
 * 
 * Strategy 3: Context-Aware Processing
 * - Character dialogue preservation
 * - Technical term consistency
 * - Cultural adaptation
 */

import axios from 'axios';
import { ProductionHybridTranslator } from './productionHybridTranslator.js';

export class HybridTranslationService {
  constructor(options = {}) {
    this.options = {
      // Translation providers
      primaryProvider: options.primaryProvider || 'deepl', // deepl, google, azure
      llmProvider: options.llmProvider || 'local', // local, openai, anthropic
      
      // Quality settings
      enableDeepLFirst: options.enableDeepLFirst !== false,
      enableLLMEditor: options.enableLLMEditor !== false,
      enableGlossaryEnforcement: options.enableGlossaryEnforcement !== false,
      enableContextualAnalysis: options.enableContextualAnalysis !== false,
      
      // Cost optimization
      useHybridForLongTexts: options.useHybridForLongTexts !== false,
      deeplCharacterLimit: options.deeplCharacterLimit || 500000, // DeepL monthly limit
      costThreshold: options.costThreshold || 0.1, // per 1000 chars
      
      // Quality thresholds
      confidenceThreshold: options.confidenceThreshold || 0.85,
      editDistanceThreshold: options.editDistanceThreshold || 0.25,
      
      ...options
    };
    
    // Initialize production hybrid translator
    this.productionTranslator = new ProductionHybridTranslator({
      deepLApiKey: process.env.DEEPL_API_KEY,
      llmApiUrl: process.env.LLM_API_URL || 'http://localhost:1234/v1/chat/completions',
      fallbackToLLMThreshold: 20,
      maxLengthVariance: 0.1
    });
    
    // Translation memory and glossary
    this.glossary = new Map();
    this.characterVoices = new Map();
    this.translationMemory = new Map();
    this.contextStack = [];
    
    // Performance metrics
    this.metrics = {
      totalCost: 0,
      averageEditDistance: 0,
      glossaryErrorsReduced: 0,
      translationTime: 0
    };
  }

  /**
   * Main hybrid translation entry point
   */
  async translateHybrid(chunks, sourceLanguage, targetLanguage, options = {}) {
    console.log(`[HybridTranslation] Starting production hybrid translation: ${sourceLanguage} → ${targetLanguage}`);
    console.log(`[HybridTranslation] Processing ${chunks.length} chunks with DeepL+LLM architecture`);
    
    const startTime = Date.now();
    
    // Build glossary and voice sheet from options
    const glossary = this.buildGlossaryFromOptions(options);
    const voiceSheet = this.buildVoiceSheetFromOptions(options);
    
    // Use production hybrid translator (your exact architecture)
    const translatedChunks = await this.productionTranslator.translateHybrid(
      chunks, 
      sourceLanguage, 
      targetLanguage, 
      {
        glossary,
        voiceSheet,
        onProgress: options.onProgress
      }
    );
    
    // Merge metrics
    this.metrics = {
      ...this.metrics,
      ...this.productionTranslator.metrics,
      translationTime: Date.now() - startTime
    };
    
    console.log(`[HybridTranslation] Production hybrid complete in ${this.metrics.translationTime}ms`);
    console.log(`[HybridTranslation] DeepL calls: ${this.metrics.deeplCalls}, LLM editor calls: ${this.metrics.llmEditorCalls}`);
    console.log(`[HybridTranslation] Fallback to full-LLM: ${this.metrics.fallbackToLLM}`);
    console.log(`[HybridTranslation] Average edit distance: ${(this.metrics.editDistance.reduce((a, b) => a + b, 0) / this.metrics.editDistance.length * 100).toFixed(1)}%`);
    
    return translatedChunks;
  }

  /**
   * Build glossary from options/context
   */
  buildGlossaryFromOptions(options) {
    const glossary = {};
    
    // Add character glossary if provided
    if (options.characterGlossary && Array.isArray(options.characterGlossary)) {
      options.characterGlossary.forEach(entry => {
        if (entry.original && entry.translation) {
          glossary[entry.original] = entry.translation;
        }
      });
    }
    
    // Add any other glossary sources
    if (options.glossary) {
      Object.assign(glossary, options.glossary);
    }
    
    return glossary;
  }

  /**
   * Build voice sheet from options/context
   */
  buildVoiceSheetFromOptions(options) {
    const voiceSheet = {};
    
    // Extract character voices from glossary or options
    if (options.characterVoices) {
      Object.assign(voiceSheet, options.characterVoices);
    }
    
    // Default voice guidelines
    voiceSheet.default = {
      tone: options.tone || 'literary',
      formality: options.formality || 'medium',
      perspective: options.perspective || 'third-person'
    };
    
    return voiceSheet;
  }

  /**
   * Strategy 1: DeepL + LLM Editor (Your suggested approach)
   */
  async translateDeepLLLMHybrid(chunk, sourceLanguage, targetLanguage, chunkIndex) {
    console.log(`[DeepL-LLM] Processing chunk ${chunkIndex} with DeepL → LLM pipeline`);
    
    try {
      // Step 1: DeepL translation for fluency and rhythm
      let deeplTranslation = await this.translateWithDeepL(chunk.text, sourceLanguage, targetLanguage);
      
      if (!deeplTranslation) {
        console.warn(`[DeepL-LLM] DeepL failed, falling back to LLM-only`);
        return await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, chunkIndex);
      }
      
      // Step 2: Light LLM editor pass for refinement
      const refinedTranslation = await this.refineWithLLM(
        chunk.text, 
        deeplTranslation, 
        sourceLanguage, 
        targetLanguage, 
        {
          enforceGlossary: true,
          preserveCharacterVoice: true,
          maintainContinuity: true,
          contextWindow: this.getRelevantContext(chunkIndex)
        }
      );
      
      // Step 3: Quality validation
      const qualityScore = this.calculateQualityScore(chunk.text, refinedTranslation, deeplTranslation);
      
      return {
        ...chunk,
        translatedText: refinedTranslation,
        translationMethod: 'deepl-llm-hybrid',
        qualityScore: qualityScore,
        metadata: {
          originalDeepL: deeplTranslation,
          editDistance: this.calculateEditDistance(deeplTranslation, refinedTranslation),
          processingTime: Date.now()
        }
      };
      
    } catch (error) {
      console.error(`[DeepL-LLM] Error in chunk ${chunkIndex}:`, error);
      // Fallback to LLM-only
      return await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, chunkIndex);
    }
  }

  /**
   * Strategy 2: Multi-Model Ensemble
   */
  async translateMultiModelEnsemble(chunk, sourceLanguage, targetLanguage, chunkIndex) {
    console.log(`[Ensemble] Processing chunk ${chunkIndex} with multi-model ensemble`);
    
    const textComplexity = this.analyzeTextComplexity(chunk.text);
    const isDialogue = this.isDialogue(chunk.text);
    const isTechnical = this.isTechnicalContent(chunk.text);
    
    let translations = [];
    
    // Primary translation (high-quality model for complex content)
    if (textComplexity > 0.7 || isDialogue || isTechnical) {
      const primaryTranslation = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, chunkIndex, {
        model: 'high-quality',
        temperature: 0.3,
        contextAware: true
      });
      translations.push({ ...primaryTranslation, provider: 'primary-llm', weight: 0.6 });
    }
    
    // Secondary translation (fast model for simple content)
    const secondaryTranslation = await this.translateWithDeepL(chunk.text, sourceLanguage, targetLanguage);
    if (secondaryTranslation) {
      translations.push({ 
        translatedText: secondaryTranslation, 
        provider: 'deepl', 
        weight: 0.4 
      });
    }
    
    // Ensemble combination
    const bestTranslation = await this.combineTranslations(translations, chunk.text, sourceLanguage, targetLanguage);
    
    return {
      ...chunk,
      translatedText: bestTranslation.text,
      translationMethod: 'multi-model-ensemble',
      qualityScore: bestTranslation.confidence,
      metadata: {
        ensembleSize: translations.length,
        selectedProvider: bestTranslation.provider,
        textComplexity: textComplexity
      }
    };
  }

  /**
   * Strategy 3: Context-Aware Adaptive
   */
  async translateContextAwareAdaptive(chunk, sourceLanguage, targetLanguage, chunkIndex) {
    console.log(`[Adaptive] Processing chunk ${chunkIndex} with context-aware adaptation`);
    
    // Analyze chunk type and select appropriate approach
    const chunkType = this.classifyChunkType(chunk.text);
    const context = this.getRelevantContext(chunkIndex);
    
    let translationApproach;
    
    switch (chunkType) {
      case 'dialogue':
        translationApproach = await this.translateDialogue(chunk, sourceLanguage, targetLanguage, context);
        break;
      case 'narrative':
        translationApproach = await this.translateNarrative(chunk, sourceLanguage, targetLanguage, context);
        break;
      case 'technical':
        translationApproach = await this.translateTechnical(chunk, sourceLanguage, targetLanguage, context);
        break;
      case 'descriptive':
        translationApproach = await this.translateDescriptive(chunk, sourceLanguage, targetLanguage, context);
        break;
      default:
        translationApproach = await this.translateGeneral(chunk, sourceLanguage, targetLanguage, context);
    }
    
    return {
      ...chunk,
      translatedText: translationApproach.text,
      translationMethod: 'context-aware-adaptive',
      qualityScore: translationApproach.confidence,
      metadata: {
        chunkType: chunkType,
        adaptationStrategy: translationApproach.strategy,
        contextUsed: context.length
      }
    };
  }

  /**
   * DeepL API integration
   */
  async translateWithDeepL(text, sourceLanguage, targetLanguage) {
    // Note: This would require DeepL API key in production
    console.log(`[DeepL] Translating ${text.length} characters`);
    
    try {
      // Simulated DeepL translation - replace with actual API call
      const deeplApiKey = process.env.DEEPL_API_KEY;
      
      if (!deeplApiKey) {
        console.warn('[DeepL] No API key found, simulating translation');
        return this.simulateDeepLTranslation(text, sourceLanguage, targetLanguage);
      }
      
      // Actual DeepL API call would go here
      const response = await axios.post('https://api-free.deepl.com/v2/translate', {
        text: [text],
        source_lang: this.mapLanguageCodeForDeepL(sourceLanguage),
        target_lang: this.mapLanguageCodeForDeepL(targetLanguage),
        preserve_formatting: true
      }, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.translations[0].text;
      
    } catch (error) {
      console.error('[DeepL] Translation failed:', error.message);
      return null;
    }
  }

  /**
   * LLM translation with context awareness
   */
  async translateWithLLM(chunk, sourceLanguage, targetLanguage, chunkIndex, options = {}) {
    const context = this.getRelevantContext(chunkIndex);
    const glossaryTerms = this.getRelevantGlossaryTerms(chunk.text);
    
    const prompt = this.buildContextAwarePrompt(
      chunk.text,
      sourceLanguage,
      targetLanguage,
      context,
      glossaryTerms,
      options
    );
    
    try {
      // Use your existing translation service
      const response = await fetch('/api/translate-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunk.text,
          sourceLanguage,
          targetLanguage,
          prompt,
          options
        })
      });
      
      const result = await response.json();
      return {
        ...chunk,
        translatedText: result.translatedText,
        confidence: result.confidence || 0.8
      };
      
    } catch (error) {
      console.error('[LLM] Translation failed:', error);
      throw error;
    }
  }

  /**
   * LLM refinement pass
   */
  async refineWithLLM(originalText, initialTranslation, sourceLanguage, targetLanguage, options = {}) {
    const refinementPrompt = `
You are a professional editor refining a translation. Your task is to improve the translation while maintaining its core meaning and flow.

ORIGINAL TEXT (${sourceLanguage}):
${originalText}

INITIAL TRANSLATION (${targetLanguage}):
${initialTranslation}

REFINEMENT REQUIREMENTS:
${options.enforceGlossary ? '- Enforce glossary terms and consistency' : ''}
${options.preserveCharacterVoice ? '- Preserve character voice and dialogue style' : ''}
${options.maintainContinuity ? '- Maintain story continuity and flow' : ''}

GLOSSARY TERMS:
${this.getGlossaryForPrompt(originalText)}

CONTEXT:
${options.contextWindow || 'No additional context'}

Please provide ONLY the refined translation, maintaining the same structure and paragraph breaks:`;

    try {
      const response = await fetch('/api/refine-translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: refinementPrompt,
          maxTokens: Math.min(2000, initialTranslation.length * 2)
        })
      });
      
      const result = await response.json();
      return result.refinedText || initialTranslation;
      
    } catch (error) {
      console.error('[LLM-Refine] Refinement failed:', error);
      return initialTranslation; // Return original if refinement fails
    }
  }

  /**
   * Document structure analysis
   */
  async analyzeDocumentStructure(chunks, sourceLanguage) {
    const analysis = {
      totalChunks: chunks.length,
      averageChunkLength: chunks.reduce((sum, chunk) => sum + (chunk.text?.length || 0), 0) / chunks.length,
      dialoguePercentage: 0,
      technicalContentPercentage: 0,
      narrativePercentage: 0,
      characters: new Set(),
      locationMentions: new Set(),
      timeReferences: new Set(),
      complexityScore: 0
    };
    
    // Analyze each chunk for patterns
    chunks.forEach(chunk => {
      const text = chunk.text || '';
      
      // Dialogue detection
      if (this.isDialogue(text)) {
        analysis.dialoguePercentage++;
        this.extractCharacterNames(text).forEach(name => analysis.characters.add(name));
      }
      
      // Technical content detection
      if (this.isTechnicalContent(text)) {
        analysis.technicalContentPercentage++;
      }
      
      // Extract locations and time references
      this.extractLocations(text).forEach(loc => analysis.locationMentions.add(loc));
      this.extractTimeReferences(text).forEach(time => analysis.timeReferences.add(time));
      
      // Calculate complexity
      analysis.complexityScore += this.analyzeTextComplexity(text);
    });
    
    // Convert to percentages
    analysis.dialoguePercentage = (analysis.dialoguePercentage / chunks.length) * 100;
    analysis.technicalContentPercentage = (analysis.technicalContentPercentage / chunks.length) * 100;
    analysis.narrativePercentage = 100 - analysis.dialoguePercentage - analysis.technicalContentPercentage;
    analysis.complexityScore = analysis.complexityScore / chunks.length;
    
    console.log('[Analysis] Document structure:', analysis);
    return analysis;
  }

  /**
   * Strategy selection based on document analysis
   */
  selectOptimalStrategy(documentAnalysis, options = {}) {
    const { dialoguePercentage, technicalContentPercentage, complexityScore, totalChunks } = documentAnalysis;
    
    // High dialogue content → Context-aware adaptive
    if (dialoguePercentage > 40) {
      return {
        name: 'Context-Aware Adaptive (Dialogue-Heavy)',
        approach: 'context-aware-adaptive',
        reason: `High dialogue content (${dialoguePercentage.toFixed(1)}%) requires character voice preservation`
      };
    }
    
    // High technical content → Multi-model ensemble
    if (technicalContentPercentage > 30) {
      return {
        name: 'Multi-Model Ensemble (Technical)',
        approach: 'multi-model-ensemble',
        reason: `High technical content (${technicalContentPercentage.toFixed(1)}%) requires specialized handling`
      };
    }
    
    // Large documents → DeepL + LLM hybrid for cost efficiency
    if (totalChunks > 50 || documentAnalysis.averageChunkLength > 1000) {
      return {
        name: 'DeepL-LLM Hybrid (Cost-Efficient)',
        approach: 'deepl-llm-hybrid',
        reason: `Large document (${totalChunks} chunks) optimized for cost and quality balance`
      };
    }
    
    // Default: DeepL + LLM hybrid
    return {
      name: 'DeepL-LLM Hybrid (Balanced)',
      approach: 'deepl-llm-hybrid',
      reason: 'Balanced approach for general content'
    };
  }

  // Helper methods for text analysis
  isDialogue(text) {
    return /["«»""''„"]/g.test(text) || /^[\s]*[-—]\s+/.test(text) || /said|asked|replied|answered|whispered|shouted/i.test(text);
  }

  isTechnicalContent(text) {
    const technicalIndicators = /\b(algorithm|function|method|process|system|analysis|data|research|study|experiment)\b/gi;
    return (text.match(technicalIndicators) || []).length > 2;
  }

  analyzeTextComplexity(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    const complexWords = (text.match(/\b\w{8,}\b/g) || []).length;
    const totalWords = (text.match(/\b\w+\b/g) || []).length;
    
    return Math.min(1, (avgSentenceLength / 50 + complexWords / totalWords) / 2);
  }

  classifyChunkType(text) {
    if (this.isDialogue(text)) return 'dialogue';
    if (this.isTechnicalContent(text)) return 'technical';
    if (/\b(the|a|an|was|were|had|has|beautiful|dark|bright|large|small)\b/gi.test(text)) return 'descriptive';
    if (/\b(then|next|after|before|meanwhile|suddenly|later)\b/gi.test(text)) return 'narrative';
    return 'general';
  }

  // Additional helper methods implementation
  extractCharacterNames(text) { 
    const names = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    return names.filter(name => name.length > 2 && name.length < 20);
  }
  
  extractLocations(text) { 
    const locationKeywords = /\b(at|in|to|from|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    const locations = [];
    let match;
    while ((match = locationKeywords.exec(text)) !== null) {
      locations.push(match[2]);
    }
    return locations;
  }
  
  extractTimeReferences(text) { 
    const timePatterns = /\b(morning|afternoon|evening|night|yesterday|today|tomorrow|week|month|year|ago|later)\b/gi;
    return text.match(timePatterns) || [];
  }
  
  getRelevantContext(chunkIndex) { 
    return this.contextStack.slice(-3).map(ctx => ({
      text: ctx.originalText?.substring(0, 200) + '...',
      translation: ctx.translatedText?.substring(0, 200) + '...'
    }));
  }
  
  calculateQualityScore(original, translation, reference) { 
    // Simple quality heuristic based on length ratio and common patterns
    const lengthRatio = translation.length / original.length;
    const hasTranslationTags = translation.includes('<TRANSLATION>');
    const baseScore = Math.min(1, lengthRatio) * 0.8;
    const bonusScore = hasTranslationTags ? 0 : 0.2; // Bonus for clean output
    return Math.min(1, baseScore + bonusScore);
  }
  
  calculateEditDistance(text1, text2) { 
    // Simple Levenshtein distance ratio
    const maxLen = Math.max(text1.length, text2.length);
    if (maxLen === 0) return 0;
    
    // Simplified calculation - would use proper Levenshtein in production
    const commonChars = [...text1].filter((char, i) => text2[i] === char).length;
    return 1 - (commonChars / maxLen);
  }
  
  // Placeholder methods for full implementation
  async buildGlossaryAndContext(analysis, sourceLanguage, targetLanguage) {
    // Build glossary from character names and locations
    analysis.characters.forEach(char => this.characterVoices.set(char, { style: 'default' }));
    analysis.locationMentions.forEach(loc => this.glossary.set(loc, loc));
  }
  
  async enforceGlobalConsistency(chunks, sourceLanguage, targetLanguage) { 
    // Apply global consistency rules
    console.log('[HybridTranslation] Enforcing global consistency across chunks');
    return chunks.map(chunk => ({
      ...chunk,
      translatedText: this.applyConsistencyRules(chunk.translatedText)
    }));
  }
  
  applyConsistencyRules(text) {
    // Apply basic consistency rules
    let processed = text;
    
    // Ensure consistent quote marks
    processed = processed.replace(/[""]/g, '"');
    processed = processed.replace(/['']/g, "'");
    
    // Ensure consistent spacing
    processed = processed.replace(/\s+/g, ' ');
    
    return processed.trim();
  }
  
  updateContextStack(chunk, translatedChunk, index) {
    this.contextStack.push({
      index,
      originalText: chunk.text,
      translatedText: translatedChunk.translatedText,
      timestamp: Date.now()
    });
    
    // Keep only recent context
    if (this.contextStack.length > 10) {
      this.contextStack.shift();
    }
  }
  
  simulateDeepLTranslation(text, sourceLang, targetLang) { 
    // Simulation for when DeepL API is not available
    console.log('[DeepL-Sim] Simulating DeepL translation');
    return `[SIMULATED DEEPL ${sourceLang}→${targetLang}] ${text}`;
  }
  
  mapLanguageCodeForDeepL(lang) { 
    const mapping = {
      'en': 'EN',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT',
      'ru': 'RU',
      'zh': 'ZH',
      'ja': 'JA'
    };
    return mapping[lang.toLowerCase()] || lang.toUpperCase();
  }
  
  buildContextAwarePrompt(text, source, target, context, glossary, options) { 
    let prompt = `You are a professional translator. Translate the following text from ${source} to ${target}.\n\n`;
    
    if (context.length > 0) {
      prompt += `CONTEXT (previous translations):\n${context.map(c => `- ${c.text} → ${c.translation}`).join('\n')}\n\n`;
    }
    
    if (glossary.length > 0) {
      prompt += `GLOSSARY:\n${glossary.map(g => `${g.original} → ${g.translation}`).join('\n')}\n\n`;
    }
    
    prompt += `TEXT TO TRANSLATE:\n${text}\n\nProvide ONLY the translation:`;
    return prompt;
  }
  
  getRelevantGlossaryTerms(text) { 
    const terms = [];
    this.glossary.forEach((translation, original) => {
      if (text.toLowerCase().includes(original.toLowerCase())) {
        terms.push({ original, translation });
      }
    });
    return terms;
  }
  
  getGlossaryForPrompt(text) { 
    const relevantTerms = this.getRelevantGlossaryTerms(text);
    return relevantTerms.map(term => `${term.original} → ${term.translation}`).join('\n');
  }
  
  logPerformanceMetrics() {
    console.log('[HybridTranslation] Performance Metrics:', this.metrics);
  }

  /**
   * Combine multiple translations using ensemble approach
   */
  async combineTranslations(translations, originalText, sourceLanguage, targetLanguage) {
    if (translations.length === 0) {
      throw new Error('No translations provided for ensemble');
    }
    
    if (translations.length === 1) {
      return {
        text: translations[0].translatedText,
        confidence: 0.8,
        provider: translations[0].provider
      };
    }
    
    // Simple weighted combination - in production would use more sophisticated methods
    const weightedTranslation = translations.reduce((best, current) => {
      const currentWeight = current.weight || 0.5;
      const bestWeight = best.weight || 0.5;
      
      if (currentWeight > bestWeight) {
        return current;
      }
      return best;
    }, translations[0]);
    
    return {
      text: weightedTranslation.translatedText,
      confidence: 0.85,
      provider: weightedTranslation.provider
    };
  }

  /**
   * Specialized translation methods for different content types
   */
  async translateDialogue(chunk, sourceLanguage, targetLanguage, context) {
    const result = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, 0, {
      model: 'dialogue-specialist',
      preserveCharacterVoice: true,
      contextAware: true
    });
    
    return {
      text: result.translatedText,
      confidence: 0.9,
      strategy: 'dialogue-specialist'
    };
  }

  async translateNarrative(chunk, sourceLanguage, targetLanguage, context) {
    const deeplResult = await this.translateWithDeepL(chunk.text, sourceLanguage, targetLanguage);
    
    if (deeplResult) {
      return {
        text: deeplResult,
        confidence: 0.85,
        strategy: 'narrative-flow'
      };
    }
    
    const llmResult = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, 0);
    return {
      text: llmResult.translatedText,
      confidence: 0.8,
      strategy: 'narrative-flow-fallback'
    };
  }

  async translateTechnical(chunk, sourceLanguage, targetLanguage, context) {
    const result = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, 0, {
      model: 'technical-specialist',
      preserveTerminology: true
    });
    
    return {
      text: result.translatedText,
      confidence: 0.9,
      strategy: 'technical-precision'
    };
  }

  async translateDescriptive(chunk, sourceLanguage, targetLanguage, context) {
    const deeplResult = await this.translateWithDeepL(chunk.text, sourceLanguage, targetLanguage);
    
    if (deeplResult) {
      return {
        text: deeplResult,
        confidence: 0.8,
        strategy: 'descriptive-beauty'
      };
    }
    
    const llmResult = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, 0);
    return {
      text: llmResult.translatedText,
      confidence: 0.75,
      strategy: 'descriptive-beauty-fallback'
    };
  }

  async translateGeneral(chunk, sourceLanguage, targetLanguage, context) {
    const deeplResult = await this.translateWithDeepL(chunk.text, sourceLanguage, targetLanguage);
    
    if (deeplResult) {
      return {
        text: deeplResult,
        confidence: 0.75,
        strategy: 'general-purpose'
      };
    }
    
    const llmResult = await this.translateWithLLM(chunk, sourceLanguage, targetLanguage, 0);
    return {
      text: llmResult.translatedText,
      confidence: 0.7,
      strategy: 'general-purpose-fallback'
    };
  }

  /**
   * Check if language is right-to-left
   */
  isRightToLeftLanguage(languageCode) {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    return rtlLanguages.includes(languageCode.toLowerCase());
  }
}
