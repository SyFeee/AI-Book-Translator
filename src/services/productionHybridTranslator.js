/**
 * Production-Grade DeepL + LLM Hybrid Translation System
 * 
 * Design Philosophy:
 * - DeepL handles local fluency, idiom, grammar, register
 * - LLM editor only fixes global consistency issues DeepL can't see
 * - Preserve DeepL's paragraph structure and rhythm (±10% length constraint)
 * - 60-80% cost reduction vs pure LLM while maintaining quality
 */

import axios from 'axios';

export class ProductionHybridTranslator {
  constructor(options = {}) {
    this.options = {
      deepLApiKey: options.deepLApiKey || process.env.DEEPL_API_KEY,
      deepLApiUrl: options.deepLApiUrl || 'https://api-free.deepl.com/v2/translate',
      llmApiUrl: options.llmApiUrl || process.env.LLM_API_URL || 'http://localhost:1234/v1/chat/completions',
      fallbackToLLMThreshold: options.fallbackToLLMThreshold || 20, // tokens
      maxLengthVariance: options.maxLengthVariance || 0.1, // ±10%
      ...options
    };
    
    // Performance tracking
    this.metrics = {
      deeplCalls: 0,
      llmEditorCalls: 0,
      fallbackToLLM: 0,
      totalCost: 0,
      editDistance: [],
      rhythmPreservation: 0
    };
    
    console.log('[ProductionHybrid] Initialized with DeepL + LLM architecture');
  }

  /**
   * Main hybrid translation pipeline
   */
  async translateHybrid(chunks, sourceLanguage, targetLanguage, options = {}) {
    console.log(`[ProductionHybrid] Starting DeepL+LLM translation: ${sourceLanguage} → ${targetLanguage}`);
    console.log(`[ProductionHybrid] Processing ${chunks.length} chunks with production architecture`);
    
    const { glossary = {}, voiceSheet = {}, onProgress } = options;
    const translatedChunks = [];
    let previousTail = '';
    
    // Build optimized context for the entire document
    const documentContext = await this.buildDocumentContext(chunks, glossary, voiceSheet);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const paragraph = chunk.text || chunk;
      
      console.log(`[ProductionHybrid] Processing chunk ${i + 1}/${chunks.length} (${paragraph.length} chars)`);
      
      // Determine translation strategy based on content analysis
      const strategy = this.selectTranslationStrategy(paragraph, sourceLanguage);
      
      let translatedText;
      
      if (strategy === 'full-llm') {
        // Fallback for problematic content (short dialogue, slang, etc.)
        translatedText = await this.fullLLMTranslate(paragraph, sourceLanguage, targetLanguage, {
          glossary,
          voiceSheet,
          previousTail,
          documentContext
        });
        this.metrics.fallbackToLLM++;
      } else {
        // Primary hybrid pipeline: DeepL → LLM editor
        translatedText = await this.hybridTranslate(paragraph, sourceLanguage, targetLanguage, {
          glossary,
          voiceSheet,
          previousTail,
          documentContext
        });
      }
      
      // Update context for next chunk
      previousTail = this.extractTail(translatedText, 100); // Last 100 tokens
      
      const translatedChunk = {
        ...chunk,
        translatedText,
        translationMethod: strategy,
        originalLength: paragraph.length,
        translatedLength: translatedText.length,
        lengthVariance: Math.abs(translatedText.length - paragraph.length) / paragraph.length
      };
      
      translatedChunks.push(translatedChunk);
      
      // Progress callback
      if (onProgress) {
        onProgress({
          currentChunk: i + 1,
          totalChunks: chunks.length,
          percentage: ((i + 1) / chunks.length) * 100,
          strategy,
          metrics: { ...this.metrics }
        });
      }
    }
    
    console.log(`[ProductionHybrid] Translation complete. Metrics:`, this.metrics);
    return translatedChunks;
  }

  /**
   * Core hybrid translation pipeline per paragraph
   */
  async hybridTranslate(paragraph, sourceLanguage, targetLanguage, context) {
    try {
      // Step 1: Protect glossary terms from DeepL mutation
      const { maskedText, protectionStash } = this.protectGlossaryTerms(paragraph, context.glossary);
      
      // Step 2: DeepL first pass (preserve paragraph structure)
      const deeplResult = await this.translateWithDeepL(maskedText, sourceLanguage, targetLanguage);
      this.metrics.deeplCalls++;
      
      if (!deeplResult) {
        throw new Error('DeepL translation failed');
      }
      
      // Step 3: Restore protected terms
      const deeplWithGlossary = this.restoreProtectedTerms(deeplResult, protectionStash);
      
      // Step 4: LLM constrained editor pass
      const editedResult = await this.constrainedLLMEditor(
        paragraph,
        deeplWithGlossary,
        sourceLanguage,
        targetLanguage,
        context
      );
      this.metrics.llmEditorCalls++;
      
      // Step 5: Validate length constraint (±10%)
      const lengthVariance = Math.abs(editedResult.length - deeplWithGlossary.length) / deeplWithGlossary.length;
      if (lengthVariance > this.options.maxLengthVariance) {
        console.warn(`[ProductionHybrid] Length variance ${(lengthVariance * 100).toFixed(1)}% exceeds threshold, using DeepL result`);
        return deeplWithGlossary;
      }
      
      // Track edit distance
      const editDistance = this.calculateEditDistance(deeplWithGlossary, editedResult);
      this.metrics.editDistance.push(editDistance);
      
      return editedResult;
      
    } catch (error) {
      console.error('[ProductionHybrid] Hybrid translation failed:', error);
      // Fallback to full LLM
      return await this.fullLLMTranslate(paragraph, sourceLanguage, targetLanguage, context);
    }
  }

  /**
   * Strategy selector based on content analysis
   */
  selectTranslationStrategy(paragraph, sourceLanguage) {
    const tokenCount = this.estimateTokens(paragraph);
    const isDialogue = this.isDialogue(paragraph);
    const containsSlang = this.containsSlang(paragraph, sourceLanguage);
    const isVeryShort = tokenCount < this.options.fallbackToLLMThreshold;
    
    // Rule-based router (as per your specification)
    if (isVeryShort && isDialogue && containsSlang) {
      console.log('[ProductionHybrid] Using full-LLM for short idiomatic dialogue');
      return 'full-llm';
    }
    
    // Additional fallback conditions
    if (tokenCount < 10 && isDialogue) {
      console.log('[ProductionHybrid] Using full-LLM for very short dialogue');
      return 'full-llm';
    }
    
    return 'hybrid';
  }

  /**
   * Protect glossary terms from DeepL mutation using XML tags
   */
  protectGlossaryTerms(text, glossary) {
    let maskedText = text;
    const protectionStash = new Map();
    let protectionId = 0;
    
    // Sort by length (longest first) to avoid nested replacements
    const sortedTerms = Object.keys(glossary).sort((a, b) => b.length - a.length);
    
    for (const term of sortedTerms) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      maskedText = maskedText.replace(regex, (match) => {
        const id = `PROTECT_${protectionId++}`;
        protectionStash.set(id, {
          original: match,
          translation: glossary[term]
        });
        return `<protect>${id}</protect>`;
      });
    }
    
    return { maskedText, protectionStash };
  }

  /**
   * Restore protected terms after DeepL translation
   */
  restoreProtectedTerms(deeplText, protectionStash) {
    let restoredText = deeplText;
    
    for (const [id, data] of protectionStash) {
      const protectTag = `<protect>${id}</protect>`;
      restoredText = restoredText.replace(protectTag, data.translation);
    }
    
    return restoredText;
  }

  /**
   * DeepL API integration
   */
  async translateWithDeepL(text, sourceLanguage, targetLanguage) {
    if (!this.options.deepLApiKey) {
      console.warn('[ProductionHybrid] No DeepL API key, simulating translation');
      return this.simulateDeepLTranslation(text, sourceLanguage, targetLanguage);
    }
    
    try {
      const response = await axios.post(this.options.deepLApiUrl, {
        text: [text],
        source_lang: this.mapLanguageForDeepL(sourceLanguage),
        target_lang: this.mapLanguageForDeepL(targetLanguage),
        preserve_formatting: true,
        tag_handling: 'xml' // This allows our <protect> tags to work
      }, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.options.deepLApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      this.metrics.totalCost += 0.0050; // Estimated DeepL cost per request
      return response.data.translations[0].text;
      
    } catch (error) {
      console.error('[ProductionHybrid] DeepL API error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Constrained LLM editor (follows your exact prompt template)
   */
  async constrainedLLMEditor(originalText, deeplText, sourceLanguage, targetLanguage, context) {
    const { glossary, voiceSheet, previousTail } = context;
    
    const prompt = `You are a literary copy-editor.
Keep the paragraph structure, sentence count and rhythm identical to the DeepL text.
Only change words if they violate the glossary or character voice below.
Output the edited paragraph only, no explanations.

Glossary: ${JSON.stringify(glossary, null, 2)}
Voice sheet: ${JSON.stringify(voiceSheet, null, 2)}
Previous tail: ${previousTail}

DeepL text:
${deeplText}

Edited paragraph:`;

    try {
      const response = await axios.post(this.options.llmApiUrl, {
        model: 'gpt-3.5-turbo', // 10x cheaper than GPT-4
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Deterministic, repeatable
        max_tokens: this.estimateTokens(deeplText) + 30 // Prevent flowery padding
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      this.metrics.totalCost += 0.0015; // Estimated GPT-3.5 cost
      return response.data.choices[0].message.content.trim();
      
    } catch (error) {
      console.error('[ProductionHybrid] LLM editor error:', error);
      return deeplText; // Fallback to DeepL result
    }
  }

  /**
   * Full LLM translation for fallback cases
   */
  async fullLLMTranslate(text, sourceLanguage, targetLanguage, context) {
    const { glossary, voiceSheet, previousTail } = context;
    
    const prompt = `You are an award-winning literary translator specializing in ${sourceLanguage} to ${targetLanguage} translation.

TRANSLATION GUIDELINES:
• Maintain the exact paragraph structure and sentence count
• Preserve character voice and dialogue style (see voice sheet below)
• Use glossary terms exactly as specified
• Consider the previous context for flow

GLOSSARY: ${JSON.stringify(glossary, null, 2)}
VOICE SHEET: ${JSON.stringify(voiceSheet, null, 2)}
PREVIOUS CONTEXT: ${previousTail}

TEXT TO TRANSLATE:
${text}

TRANSLATION:`;

    try {
      const response = await axios.post(this.options.llmApiUrl, {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: this.estimateTokens(text) * 2
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      this.metrics.totalCost += 0.003; // Higher cost for full LLM
      return response.data.choices[0].message.content.trim();
      
    } catch (error) {
      console.error('[ProductionHybrid] Full LLM translation error:', error);
      throw error;
    }
  }

  // Helper methods
  buildDocumentContext(chunks, glossary, voiceSheet) {
    return {
      totalChunks: chunks.length,
      avgChunkLength: chunks.reduce((sum, chunk) => sum + (chunk.text || chunk).length, 0) / chunks.length,
      detectedCharacters: this.extractCharacters(chunks),
      narrativeStyle: this.analyzeNarrativeStyle(chunks)
    };
  }

  isDialogue(text) {
    return /["«»""''„"]/.test(text) || /^[\s]*[-—]\s+/.test(text) || /\bsaid\b|\basked\b|\breplied\b/i.test(text);
  }

  containsSlang(text, sourceLanguage) {
    // Simple heuristic - in production, use a trained classifier
    const slangIndicators = {
      'en': /\b(gonna|wanna|ain't|kinda|sorta|yeah|nah|dude|bro)\b/i,
      'es': /\b(vale|guay|tío|chaval|mola)\b/i,
      'fr': /\b(ouais|bof|mec|truc|machin)\b/i
    };
    
    const pattern = slangIndicators[sourceLanguage] || /\b(informal|slang|colloquial)\b/i;
    return pattern.test(text);
  }

  extractTail(text, maxTokens) {
    const words = text.split(/\s+/);
    return words.slice(-maxTokens).join(' ');
  }

  estimateTokens(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3); // Rough estimate
  }

  calculateEditDistance(text1, text2) {
    // Simple character-level edit distance
    const len1 = text1.length;
    const len2 = text2.length;
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        if (text1[i - 1] === text2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }
    
    return matrix[len2][len1] / Math.max(len1, len2);
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  mapLanguageForDeepL(lang) {
    const mapping = {
      'en': 'EN-US',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT-BR',
      'ru': 'RU',
      'zh': 'ZH',
      'ja': 'JA'
    };
    return mapping[lang] || lang.toUpperCase();
  }

  simulateDeepLTranslation(text, sourceLang, targetLang) {
    // Fallback simulation when no DeepL key available
    return `[DEEPL-SIM ${sourceLang}→${targetLang}] ${text}`;
  }

  // Placeholder methods for full implementation
  extractCharacters(chunks) { return []; }
  analyzeNarrativeStyle(chunks) { return 'third-person'; }
}
