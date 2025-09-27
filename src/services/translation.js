import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ContextCoherenceService } from './contextCoherenceService.js';
import { HybridTranslationService } from './hybridTranslationService.js';

dotenv.config();

// Configuration for the local LLM API
const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:1234/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-3-1b-it';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '-1'); // -1 means model's maximum
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.3');

console.log(`[Translation] LLM Configuration: Model=${LLM_MODEL}, MaxTokens=${LLM_MAX_TOKENS}, Temperature=${LLM_TEMPERATURE}`);

// Initialize services
const contextService = new ContextCoherenceService();
const hybridService = new HybridTranslationService({
  enableDeepLFirst: true,
  enableLLMEditor: true,
  enableGlossaryEnforcement: true,
  enableContextualAnalysis: true
});

/**
 * Translate a text chunk using the local LLM with advanced context
 * @param {string} text - The text to translate
 * @param {string} sourceLanguage - The source language code
 * @param {string} targetLanguage - The target language code
 * @param {Object} context - Additional context for translation
 * @param {boolean} preserveFormatting - Whether to preserve formatting
 * @returns {Promise<string>} - The translated text
 */
export async function translateText(text, sourceLanguage, targetLanguage, context = {}, preserveFormatting = true) {
  try {
    console.log(`Translating from ${sourceLanguage} to ${targetLanguage}`);
    console.log(`Text to translate (first 100 chars): ${text.substring(0, 100)}...`);
    console.log(`Total length: ${text.length} characters`);
    
    // Use production-grade prompt only if context has actual content (not just default empty object)
    if (context && Object.keys(context).length > 0 && context.hasRealContext === true) {
      console.log('[Translation] Using production-grade context-aware prompt');
      return await translateTextWithProductionPrompt(text, sourceLanguage, targetLanguage, context, preserveFormatting);
    }
    
    // Use basic prompt for all other translations (including those with prompt context)
    console.log('[Translation] Using basic translation prompt');
    
    // Convert language codes to full names for clearer instructions
    const languageMap = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic'
    };
    
    const sourceLangName = languageMap[sourceLanguage] || sourceLanguage;
    const targetLangName = languageMap[targetLanguage] || targetLanguage;
    
    const prompt = `TRANSLATE ONLY - NO EXPLANATIONS

Translate this ${sourceLangName} text to ${targetLangName}:

${text}

Rules:
- Output ONLY the ${targetLangName} translation
- NO introduction phrases like "Here's the translation"
- NO explanatory text
- NO quotes around the translation
- NO <TRANSLATION> tags
- Just the pure ${targetLangName} text

${targetLangName} translation:`;

    // Call the local LLM API
    const response = await axios.post(LLM_API_URL, {
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate text accurately and completely. Output ONLY the translated text with no additional comments, explanations, or formatting tags.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: LLM_TEMPERATURE,
      // For max_tokens:
      // If set to -1, let the model decide (send undefined)
      // If positive, use that specific value
      // If negative but not -1, calculate based on input length
      max_tokens: LLM_MAX_TOKENS === -1 ? 
        undefined : 
        (LLM_MAX_TOKENS < -1 ? 
          Math.max(text.length * 2, 1000) : 
          LLM_MAX_TOKENS)
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    let translatedText = response.data.choices[0].message.content.trim();
    
    // Enhanced cleaning for LLM responses
    // First, try to extract from <TRANSLATION> tags
    const translationMatch = translatedText.match(/<TRANSLATION>\s*([\s\S]*?)\s*(?:<\/TRANSLATION>|$)/i);
    if (translationMatch) {
      translatedText = translationMatch[1].trim();
      console.log('[Translation] Successfully extracted translation from tags');
    } else {
      // If no tags, clean up common LLM prefixes and artifacts
      translatedText = translatedText
        // Remove common LLM introduction phrases (more aggressive)
        .replace(/^.*?(?:here'?s\s+the\s+translation|translation\s+follows?|translated\s+text|translation\s+to\s+[^:]*?):?\s*/i, '')
        .replace(/^.*?(?:okay,?\s*)?(?:here'?s|this\s+is|below\s+is).*?translation.*?:?\s*/i, '')
        .replace(/^.*?(?:translation\s+from\s+[^:]*?\s+to\s+[^:]*?):?\s*/i, '')
        .replace(/^.*?(?:translating|translate).*?(?:into|to)\s+[^:]*?:?\s*/i, '')
        // Remove instruction artifacts  
        .replace(/^.*?(?:rules?|requirements?):?\s*-\s*output\s+only.*?\n/i, '')
        .replace(/^.*?-\s*just\s+the\s+pure\s+[^:]*?\s+text.*?\n/i, '')
        // Remove any remaining tag artifacts
        .replace(/^.*?<TRANSLATION>\s*/i, '')
        .replace(/\s*<\/TRANSLATION>.*$/i, '')
        // Remove quotation marks if the entire text is wrapped
        .replace(/^["'"]([\s\S]*?)["'"]$/s, '$1')
        .trim();
    }
    
    // Additional aggressive cleaning for persistent artifacts
    translatedText = translatedText
      // Remove any remaining translation instructions
      .replace(/^.*?(?:maintain|preserving|keeping).*?tone.*?:?\s*/i, '')
      .replace(/^.*?(?:professional|academic|formal).*?translation.*?:?\s*/i, '')
      .replace(/^.*?(?:no\s+explanations?|no\s+additional|output\s+only).*?\n/i, '')
      // Clean up formatting artifacts
      .replace(/^["'"]+|["'"]+$/g, '')
      .replace(/^\s*-\s+just\s+the\s+pure.*?\n/i, '')
      .replace(/^\s*tags\s*-?\s*just\s+the\s+pure.*?\n/i, '') // Specific fix for "tags - Just the pure English text"
      .replace(/^\s*tags\s*-?\s*just\s+the\s+pure.*?text\s*/i, '') // Even more specific
      .replace(/^\s*tags\s*/i, '') // Remove just "tags" at start
      .replace(/^[^a-zA-Z]*tags[^a-zA-Z].*?\n/i, '') // Remove lines starting with "tags"
      .trim();
    
    // Validate translation quality
    if (!translatedText || translatedText.length === 0) {
      console.warn('[Translation] Translation result is empty after cleaning. Raw response:', response.data.choices[0].message.content.substring(0, 200));
      throw new Error('Empty translation result');
    }
    
    // Check for problematic artifacts that indicate cleaning failed
    if (translatedText.toLowerCase().includes('translation') && translatedText.length < 100) {
      console.warn('[Translation] Detected translation artifact in short result:', translatedText);
      // Try more aggressive cleaning
      translatedText = translatedText
        .replace(/^.*?translation.*?:?\s*/i, '')
        .replace(/^.*?english\s+text.*?\n/i, '')
        .trim();
    }
    
    // Log cleaning success for debugging
    console.log(`[Translation] Cleaned result: ${translatedText.substring(0, 100)}${translatedText.length > 100 ? '...' : ''}`);

    // Check if the response might be truncated (enhanced heuristic)
    const originalLength = text.length;
    const translatedLength = translatedText.length;
    const expectedRatio = getExpectedRatio(sourceLanguage, targetLanguage);
    
    if (translatedLength < originalLength * 0.3 * expectedRatio) {
      console.warn(`Translation may be truncated! Original: ${originalLength} chars, Translated: ${translatedLength} chars`);
      console.warn(`This could indicate a max_tokens limit issue with your LLM configuration.`);
    }
    
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error.message);
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Build context-aware translation prompt using production-grade template
 */
function buildContextAwarePrompt(text, sourceLanguage, targetLanguage, context, preserveFormatting) {
  // Use your excellent production prompt template with enhancements
  let prompt = `You are an award-winning literary translator specializing in ${sourceLanguage} ←→ ${targetLanguage} translation.

TRANSLATION GUIDELINES:
• Keep sentence length and rhythm close to the original
• Translate dialogue naturally; preserve each character's voice (see CharacterSheet)
• Use the provided Glossary exactly—do not transliterate glossary terms
• ${preserveFormatting ? 'Preserve all formatting, paragraph breaks, and punctuation style' : 'Focus on meaning over formatting'}
• Maintain narrative flow and consistency with previous context
• Output ONLY the translation, inside <TRANSLATION> tags

`;

  // GLOSSARY SECTION
  if (context.glossary && context.glossary.entries.length > 0) {
    prompt += `GLOSSARY:\n`;
    context.glossary.entries.forEach(entry => {
      prompt += `${entry.source} → ${entry.target} (${entry.type})\n`;
    });
    prompt += `\n`;
  } else {
    prompt += `GLOSSARY:\n[No specific terms for this chunk]\n\n`;
  }

  // CHARACTER SHEET SECTION
  if (context.character_voices && context.character_voices.voices.length > 0) {
    prompt += `CHARACTER SHEET:\n`;
    context.character_voices.voices.forEach(voice => {
      prompt += `${voice.character}: ${voice.style}\n`;
      if (voice.patterns && voice.patterns.length > 0) {
        prompt += `  • Patterns: ${voice.patterns.join(', ')}\n`;
      }
    });
    prompt += `\n`;
  } else {
    prompt += `CHARACTER SHEET:\n[No character-specific guidance for this chunk]\n\n`;
  }

  // PREVIOUS SUMMARY SECTION
  if (context.plot_memory && context.plot_memory.summaries.length > 0) {
    const recentSummaries = context.plot_memory.summaries.slice(-2); // Last 2 summaries
    prompt += `PREVIOUS SUMMARY:\n${recentSummaries.join(' ')}\n\n`;
  } else {
    prompt += `PREVIOUS SUMMARY:\n[Beginning of document or no prior context]\n\n`;
  }

  // PREVIOUS TAIL SECTION (Sliding Window)
  if (context.sliding_window) {
    // Extract last 2 sentences for natural flow
    const sentences = context.sliding_window.text.split(/[.!?]+/).filter(s => s.trim());
    const lastSentences = sentences.slice(-2).join('. ').trim();
    prompt += `PREVIOUS TAIL (last 2 sentences for flow):\n"${lastSentences}"\n\n`;
  } else {
    prompt += `PREVIOUS TAIL:\n[Beginning of document]\n\n`;
  }

  // REFERENCE TRANSLATIONS (Enhanced RAG)
  if (context.similar_translations && context.similar_translations.length > 0) {
    prompt += `REFERENCE TRANSLATIONS (for consistency):\n`;
    context.similar_translations
      .filter(ref => ref.similarity > 0.3)
      .slice(0, 2) // Top 2 most similar
      .forEach((ref, idx) => {
        prompt += `Example ${idx + 1}:\n`;
        prompt += `Source: "${ref.translation.original.substring(0, 80)}..."\n`;
        prompt += `Translation: "${ref.translation.translated.substring(0, 80)}..."\n\n`;
      });
  }

  // SOURCE TEXT SECTION
  prompt += `SOURCE TEXT TO TRANSLATE:\n${text}\n\n<TRANSLATION>\n`;

  return prompt;
}

/**
 * Enhanced translation with production-grade prompt parsing
 */
export async function translateTextWithProductionPrompt(text, sourceLanguage, targetLanguage, context = {}, preserveFormatting = true) {
  try {
    console.log(`[ProductionTranslation] Translating ${text.length} chars from ${sourceLanguage} to ${targetLanguage}`);
    
    // Build production-grade prompt
    const prompt = buildContextAwarePrompt(text, sourceLanguage, targetLanguage, context, preserveFormatting);
    
    // Log prompt structure for debugging
    console.log(`[ProductionTranslation] Prompt sections: ${Object.keys(context).length} context types`);
    
    // Call LLM with enhanced prompt
    const response = await axios.post(LLM_API_URL, {
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional literary translator. Follow the provided guidelines exactly and output only clean translations within <TRANSLATION> tags.`
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      stop: ["</TRANSLATION>"] // Stop at closing tag
    });

    let translatedText = response.data.choices[0].message.content.trim();
    
    // Parse translation from tags (production-grade extraction)
    const translationMatch = translatedText.match(/<TRANSLATION>\s*([\s\S]*?)\s*(?:<\/TRANSLATION>|$)/i);
    if (translationMatch) {
      translatedText = translationMatch[1].trim();
      console.log(`[ProductionTranslation] Successfully extracted translation from tags`);
    } else {
      console.warn(`[ProductionTranslation] No <TRANSLATION> tags found, using raw output`);
      // Fallback: try to clean up raw output
      translatedText = translatedText
        .replace(/^.*?<TRANSLATION>\s*/i, '')
        .replace(/\s*<\/TRANSLATION>.*$/i, '')
        .trim();
    }

    // Validate translation quality
    const qualityCheck = validateTranslationQuality(text, translatedText, context);
    if (!qualityCheck.isValid) {
      console.warn(`[ProductionTranslation] Quality issues detected: ${qualityCheck.issues.join(', ')}`);
    }

    console.log(`[ProductionTranslation] Translation complete: ${translatedText.length} chars`);
    return translatedText;

  } catch (error) {
    console.error('[ProductionTranslation] Translation error:', error.message);
    if (error.response) {
      console.error('[ProductionTranslation] API response error:', error.response.data);
    }
    throw new Error(`Production translation failed: ${error.message}`);
  }
}

/**
 * Validate translation quality against context
 */
function validateTranslationQuality(original, translated, context) {
  const issues = [];
  
  // Check for glossary term compliance
  if (context.glossary && context.glossary.entries.length > 0) {
    context.glossary.entries.forEach(entry => {
      if (original.toLowerCase().includes(entry.source.toLowerCase())) {
        if (!translated.includes(entry.target)) {
          issues.push(`Missing glossary term: ${entry.source} → ${entry.target}`);
        }
      }
    });
  }
  
  // Check for reasonable length (shouldn't be drastically different)
  const lengthRatio = translated.length / original.length;
  if (lengthRatio < 0.3 || lengthRatio > 3.0) {
    issues.push(`Suspicious length ratio: ${lengthRatio.toFixed(2)}`);
  }
  
  // Check for untranslated content (basic heuristic)
  const originalLang = detectLanguage(original);
  const translatedLang = detectLanguage(translated);
  if (originalLang === translatedLang && original.length > 50) {
    issues.push('Possible untranslated content detected');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, 1 - (issues.length * 0.2)) // Simple scoring
  };
}

/**
 * Simple language detection (basic heuristic)
 */
function detectLanguage(text) {
  // Very basic detection - in production, use proper language detection
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[ひらがなカタカナ]/.test(text)) return 'ja';
  return 'en'; // Default fallback
}

/**
 * Enhanced chunk translation with context coherence
 */
export async function translateChunkWithContext(chunk, chunks, currentIndex, sourceLanguage, targetLanguage, preserveFormatting = true) {
  try {
    console.log(`[ContextTranslation] Translating chunk ${currentIndex + 1}/${chunks.length}: ${chunk.id}`);
    
    // Compile comprehensive context
    const context = await contextService.compileTranslationContext(chunks, currentIndex, chunk.text);
    
    console.log(`[ContextTranslation] Context types: ${context.metadata.context_types.join(', ')}`);
    console.log(`[ContextTranslation] Total context tokens: ${context.metadata.total_context_tokens}`);
    
    // Translate with context
    const translatedText = await translateText(chunk.text, sourceLanguage, targetLanguage, context, preserveFormatting);
    
    // Index this translation for future RAG
    await contextService.indexTranslatedChunk(chunk.id, chunk.text, translatedText);
    
    // Update plot memory if this is a chapter boundary
    if (chunk.type === 'chapter' && translatedText.length > 100) {
      const chapterSummary = `Chapter ${chunk.chapter}: ${translatedText.substring(0, 200).replace(/[.!?].*$/, '')}...`;
      contextService.updatePlotMemory(chapterSummary);
    }
    
    return {
      ...chunk,
      translatedText,
      translationMetadata: {
        ...chunk.translationMetadata,
        contextUsed: context.metadata.context_types,
        contextTokens: context.metadata.total_context_tokens,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error(`[ContextTranslation] Error translating chunk ${chunk.id}:`, error);
    throw error;
  }
}

/**
 * Initialize context system for a new document
 */
export async function initializeContextForDocument(fullText, sourceLanguage, targetLanguage) {
  console.log('[ContextTranslation] Initializing context system for document...');
  
  try {
    // Build glossary
    await contextService.buildGlossary(fullText, sourceLanguage, targetLanguage);
    
    // Extract character names and build voice profiles
    const characters = extractCharacterNames(fullText);
    if (characters.length > 0) {
      await contextService.buildCharacterVoices(fullText, characters);
    }
    
    console.log('[ContextTranslation] Context system initialized successfully');
    return contextService;
    
  } catch (error) {
    console.error('[ContextTranslation] Context initialization failed:', error);
    return contextService; // Return basic service anyway
  }
}

function extractCharacterNames(text) {
  // Simple extraction - in production, use NER
  const names = [];
  const dialoguePattern = /"[^"]*"\s+([A-Z][a-z]+)/g;
  let match;
  
  while ((match = dialoguePattern.exec(text)) !== null) {
    const name = match[1];
    if (!names.includes(name) && name.length < 20) {
      names.push(name);
    }
  }
  
  return names.slice(0, 10); // Limit to top 10 characters
}

/**
 * Translates text chunks while maintaining context between them
 * @param {Array} chunks - Array of text chunks to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {Object} options - Translation options
 * @returns {Array} - Array of translated chunks
 */
export async function translateChunks(chunks, sourceLanguage, targetLanguage, options = {}) {
  const {
    preserveFormatting = true,
    contextWindow = 3, // Number of previous chunks to include as context
    delayBetweenRequests = 300, // Delay between API requests in ms
    batchSize = 10, // Process chunks in batches to save progress
    maxRetries = 3, // Maximum number of retries for failed translations
    onProgress = null, // Progress callback function
    onBatchComplete = null, // Callback when a batch is completed
    useHybridTranslation = false, // Enable hybrid DeepL + LLM approach
    hybridOptions = {} // Options for hybrid translation
  } = options;

  // Use hybrid translation if enabled
  if (useHybridTranslation) {
    console.log('[Translation] Using hybrid translation service');
    try {
      return await hybridService.translateHybrid(chunks, sourceLanguage, targetLanguage, {
        ...hybridOptions,
        preserveFormatting,
        onProgress
      });
    } catch (error) {
      console.warn('[Translation] Hybrid translation failed, falling back to standard:', error.message);
      // Continue with standard translation
    }
  }

  const translatedChunks = [];
  let context = "";
  const totalChunks = chunks.length;
  const isLargeBook = totalChunks > 100; // Special handling for large books
  
  console.log(`Starting translation of ${totalChunks} chunks from ${sourceLanguage} to ${targetLanguage}`);
  console.log(`Using ${isLargeBook ? 'large book mode' : 'standard mode'} with context window of ${contextWindow}, batch size of ${batchSize}`);
  
  // For large books, process chunks in batches to save progress and prevent memory issues
  for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, chunks.length);
    const currentBatch = chunks.slice(batchStart, batchEnd);
    const batchResults = new Array(currentBatch.length);
    
    console.log(`Processing batch ${Math.floor(batchStart/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}: chunks ${batchStart+1} to ${batchEnd}`);
    
    // Process each chunk in the current batch
    for (let i = 0; i < currentBatch.length; i++) {
      const chunkIndex = batchStart + i;
      let retries = 0;
      let success = false;
      
      while (retries < maxRetries && !success) {
        try {
          const chunk = currentBatch[i];
          const chunkText = typeof chunk === 'string' ? chunk : chunk.text;
          
          // Build prompt with context from previous translations
          let promptText = chunkText;
          
          // If we have context from previous chunks, include it
          if (context && contextWindow > 0) {
            // For very large chunks, use a shorter context
            const contextToUse = context.length > 2000 ? context.slice(-2000) : context;
            promptText = `[CONTEXT FROM PREVIOUS SECTIONS]:\n${contextToUse}\n\n[CONTINUE TRANSLATION WITH THIS SECTION]:\n${chunkText}`;
          }
          
          console.log(`Translating chunk ${chunkIndex+1}/${totalChunks}, length: ${chunkText.length} characters`);
          
          // If this chunk is part of a partial paragraph/sentence, add a note to maintain continuity
          const isPartialParagraph = chunk.isPartialParagraph;
          const isPartialSentence = chunk.isPartialSentence;
          
          if (isPartialSentence) {
            // Add extra instruction for partial sentences
            promptText = `${promptText}\n[NOTE: This is part of a sentence split across multiple chunks. Translate it as a continuation, maintaining consistency.]`;
          } else if (isPartialParagraph) {
            // Add extra instruction for partial paragraphs
            promptText = `${promptText}\n[NOTE: This is part of a paragraph split across multiple chunks. Maintain consistency with previous translations.]`;
          }
          
          // Translate the current chunk
          const translatedChunk = await translateText(promptText, sourceLanguage, targetLanguage, preserveFormatting);
          
          // Remove any context markers that might have been included in the response
          let cleanedTranslation = translatedChunk
            .replace(/^\[CONTEXT FROM PREVIOUS SECTIONS\]:\s*.*?\n\n\[CONTINUE TRANSLATION WITH THIS SECTION\]:\s*/is, '')
            .replace(/^\[CONTINUE TRANSLATION WITH THIS SECTION\]:\s*/i, '')
            .replace(/^\[TRANSLATION\]:\s*/i, '')
            .replace(/\[NOTE:.*?\]/g, '')
            .trim();
          
          // Validate that we have a meaningful translation
          if (!cleanedTranslation || cleanedTranslation.length === 0) {
            throw new Error('Empty translation result after cleaning');
          }
          
          // Check for minimal translation quality (at least some words)
          const wordCount = cleanedTranslation.split(/\s+/).filter(w => w.length > 0).length;
          if (wordCount < 3 && chunkText.split(/\s+/).length > 10) {
            console.warn(`[Translation] Suspiciously short translation: ${wordCount} words for ${chunkText.split(/\s+/).length} input words`);
            console.warn(`[Translation] Input: ${chunkText.substring(0, 100)}...`);
            console.warn(`[Translation] Output: ${cleanedTranslation}`);
          }
          
          // Store result
          batchResults[i] = cleanedTranslation;
          
          // Update context for the next chunk
          if (contextWindow > 0) {
            // For consecutive chunks that are part of the same paragraph, keep more context
            const contextSize = isPartialParagraph ? Math.max(contextWindow, 5) : contextWindow;
            
            // Create context from all successfully translated chunks in this batch so far
            const contextChunks = batchResults.filter(c => c).slice(-contextSize);
            if (contextChunks.length > 0) {
              context = contextChunks.join("\n");
            }
          }
          
          // Call progress callback if provided
          if (onProgress) {
            onProgress({
              currentChunk: chunkIndex + 1,
              totalChunks,
              percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
              translatedText: cleanedTranslation.substring(0, 50) + '...'
            });
          }
          
          // Add delay between requests to avoid rate limiting
          if (i < currentBatch.length - 1 && delayBetweenRequests > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
          
          success = true;
        } catch (error) {
          retries++;
          console.error(`Error translating chunk ${chunkIndex + 1} (attempt ${retries}/${maxRetries}):`, error);
          
          if (retries >= maxRetries) {
            // Add error marker but continue with next chunks after max retries
            batchResults[i] = `[TRANSLATION ERROR: ${error.message}]`;
            
            // Call progress callback with error if provided
            if (onProgress) {
              onProgress({
                currentChunk: chunkIndex + 1,
                totalChunks,
                percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
                error: error.message
              });
            }
            
            success = true; // Mark as success to exit the retry loop
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            console.log(`Retrying chunk ${chunkIndex + 1}...`);
          }
        }
      }
    }
    
    // Process the batch results and add to the overall results
    for (let i = 0; i < currentBatch.length; i++) {
      const chunk = currentBatch[i];
      const translatedText = batchResults[i];
      
      // For object chunks, preserve metadata
      if (typeof chunk === 'object') {
        translatedChunks.push({
          ...chunk,
          translatedText: translatedText,
          chunkIndex: batchStart + i
        });
      } else {
        // For string chunks
        translatedChunks.push(translatedText);
      }
    }
    
    // Call batch complete callback if provided
    if (onBatchComplete) {
      const processedBatch = currentBatch.map((chunk, i) => {
        const globalIndex = batchStart + i;
        return typeof chunk === 'object' ? 
          { ...chunk, translatedText: batchResults[i] } : 
          { text: chunk, translatedText: batchResults[i], id: globalIndex };
      });
      
      await onBatchComplete(processedBatch, Math.floor(batchStart/batchSize), Math.ceil(chunks.length/batchSize));
    }
    
    console.log(`Batch ${Math.floor(batchStart/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)} complete, total progress: ${Math.round(((batchEnd) / totalChunks) * 100)}%`);
  }
  
  console.log(`Translation complete. Translated ${translatedChunks.length} of ${totalChunks} chunks.`);
  return translatedChunks;
}

/**
 * Construct the system prompt for the LLM
 * @param {string} sourceLanguage - The source language
 * @param {string} targetLanguage - The target language
 * @param {Array} glossary - Glossary of terms to consistently translate
 * @param {Array} characterProfiles - Character descriptions for consistent voice
 * @param {string} documentTitle - Title of the document
 * @returns {string} - The system prompt
 */
const constructSystemPrompt = (sourceLanguage, targetLanguage, glossary = [], characterProfiles = [], documentTitle = '') => {
  return `You are an expert literary translator specializing in translating from ${sourceLanguage} to ${targetLanguage}. 
Your task is to translate the text while maintaining the original style, tone, and meaning. 
This is part of a longer document titled "${documentTitle || 'untitled document'}".

${glossary && glossary.length > 0 ? `
IMPORTANT TERMINOLOGY GLOSSARY (maintain these exact translations):
${glossary.map(entry => `- "${entry.original}" → "${entry.translation}"`).join('\n')}
` : ''}

${characterProfiles && characterProfiles.length > 0 ? `
CHARACTER PROFILES (maintain consistent voice):
${characterProfiles.map(char => `- ${char.name}: ${char.description}`).join('\n')}
` : ''}

TRANSLATION INSTRUCTIONS:
1. Maintain the literary style and flow of the original text.
2. Preserve paragraph breaks and document structure.
3. Keep proper nouns unchanged unless specified in the glossary.
4. Maintain any formatting like emphasis, bullet points, or numbering.
5. Ensure consistency with previously translated sections.
6. Use contextually appropriate idioms in the target language.
7. Translate for readability and natural flow in the target language.

Output only the translated text without any explanations or notes.`;
};

/**
 * Construct the user prompt for the LLM
 * @param {string} text - The text to translate
 * @param {string} previousTranslation - Previous chunk translation for context
 * @param {number} chunkPosition - Position of chunk in document (0 to 1)
 * @returns {string} - The user prompt
 */
const constructUserPrompt = (text, previousTranslation = '', chunkPosition = 0) => {
  let prompt = '';
  
  // For non-first chunks, provide context from previous translation
  if (previousTranslation && chunkPosition > 0) {
    prompt += `CONTEXT FROM PREVIOUS SECTION:\n${previousTranslation.slice(-300)}\n\n`;
  }
  
  prompt += `TEXT TO TRANSLATE:\n${text}\n\nTranslated text:`;
  
  return prompt;
};

export async function translateChunk(text, sourceLanguage, targetLanguage, context = {}) {
  return await translateText(text, sourceLanguage, targetLanguage, context?.preserveFormatting);
}

/**
 * Get expected length ratio between source and target languages
 * This helps detect truncations based on typical expansion/contraction between languages
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @returns {number} - Expected ratio of target/source text length
 */
function getExpectedRatio(sourceLanguage, targetLanguage) {
  // Some common language length ratios (target/source)
  const ratios = {
    'en-es': 1.15, // English to Spanish typically expands by ~15%
    'es-en': 0.87, // Spanish to English typically contracts by ~13%
    'en-fr': 1.15, // English to French typically expands by ~15%
    'fr-en': 0.87, // French to English typically contracts by ~13%
    'en-de': 1.1,  // English to German typically expands by ~10%
    'de-en': 0.9,  // German to English typically contracts by ~10%
    'en-ja': 0.6,  // English to Japanese typically contracts by ~40%
    'ja-en': 1.7,  // Japanese to English typically expands by ~70%
    'en-zh': 0.5,  // English to Chinese typically contracts by ~50%
    'zh-en': 2.0   // Chinese to English typically expands by ~100%
  };
  
  const key = `${sourceLanguage}-${targetLanguage}`.toLowerCase();
  return ratios[key] || 1.0; // Default to 1.0 if no specific ratio is known
}

export default {
  translateChunk,
  translateText,
  translateChunks
};
