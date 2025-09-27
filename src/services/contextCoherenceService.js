/**
 * Context & Coherence Service
 * Implements advanced context management for long-form translation
 * Based on the 4-technique approach: Sliding Window + Global Context + RAG + Memory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ContextCoherenceService {
  constructor(options = {}) {
    this.options = {
      slidingWindowTokens: options.slidingWindowTokens || 150,
      plotMemoryTokens: options.plotMemoryTokens || 400,
      ragTopK: options.ragTopK || 3,
      contextDir: options.contextDir || './tmp/context',
      ...options
    };
    
    // Initialize storage
    this.glossary = new Map();
    this.characterVoices = new Map();
    this.plotMemory = [];
    this.translatedChunks = new Map(); // For RAG
    this.chunkEmbeddings = new Map(); // For similarity search
    
    this.ensureContextDir();
  }

  /**
   * A. SLIDING WINDOW: Get context from previous chunk
   */
  getSlidingWindowContext(chunks, currentIndex) {
    if (currentIndex === 0) return null;
    
    const previousChunk = chunks[currentIndex - 1];
    if (!previousChunk || !previousChunk.translatedText) return null;
    
    // Get last N tokens from previous translation
    const words = previousChunk.translatedText.split(/\s+/);
    const contextTokens = Math.min(this.options.slidingWindowTokens, words.length);
    const contextWords = words.slice(-Math.ceil(contextTokens * 0.75)); // Rough token-to-word conversion
    
    return {
      type: 'sliding_window',
      text: contextWords.join(' '),
      sourceChunkId: previousChunk.id,
      tokens: contextTokens
    };
  }

  /**
   * B. GLOBAL CONTEXT: Build and manage terminology & character consistency
   */
  
  // B1: Glossary Management
  async buildGlossary(fullText, sourceLanguage, targetLanguage) {
    console.log('[ContextCoherence] Building glossary for terminology consistency...');
    
    try {
      // Extract candidate terms using LLM
      const candidates = await this.extractTerminologyCandidates(fullText, sourceLanguage);
      
      // Store for human review
      const glossaryPath = path.join(this.options.contextDir, 'glossary-candidates.json');
      await fs.promises.writeFile(glossaryPath, JSON.stringify(candidates, null, 2));
      
      console.log(`[ContextCoherence] Generated ${candidates.length} glossary candidates`);
      return candidates;
      
    } catch (error) {
      console.error('[ContextCoherence] Glossary building failed:', error);
      return [];
    }
  }

  async extractTerminologyCandidates(text, sourceLanguage) {
    // Simulate NER + LLM extraction
    const prompt = `Extract all important terms from this ${sourceLanguage} text that need consistent translation:

1. Character names (people, fictional beings)
2. Place names (cities, regions, fictional locations)  
3. Invented terms (magic systems, technology, organizations)
4. Cultural concepts (titles, customs, artifacts)

Text sample: ${text.substring(0, 2000)}...

Return as JSON array with format:
[
  {"term": "Katniss Everdeen", "type": "character", "context": "protagonist"},
  {"term": "District 12", "type": "place", "context": "coal mining district"},
  {"term": "Mockingjay", "type": "symbol", "context": "rebellion symbol"}
]`;

    // In real implementation, this would call your LLM API
    return [
      { term: "Maria", type: "character", context: "protagonist scholar" },
      { term: "Thomas", type: "character", context: "companion" },
      { term: "Royal Academy", type: "organization", context: "research institution" },
      { term: "Northern Territories", type: "place", context: "unexplored region" }
    ];
  }

  loadGlossary(glossaryPath) {
    try {
      const glossaryData = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
      glossaryData.forEach(entry => {
        this.glossary.set(entry.source, {
          target: entry.target,
          type: entry.type,
          context: entry.context,
          notes: entry.notes
        });
      });
      console.log(`[ContextCoherence] Loaded ${this.glossary.size} glossary entries`);
    } catch (error) {
      console.warn('[ContextCoherence] Could not load glossary:', error.message);
    }
  }

  // B2: Character Voice Management
  async buildCharacterVoices(fullText, characters) {
    console.log('[ContextCoherence] Analyzing character voices...');
    
    for (const character of characters) {
      const voiceProfile = await this.analyzeCharacterVoice(fullText, character);
      this.characterVoices.set(character.toLowerCase(), voiceProfile);
    }
    
    // Save character voices
    const voicesPath = path.join(this.options.contextDir, 'character-voices.json');
    const voicesData = Object.fromEntries(this.characterVoices);
    await fs.promises.writeFile(voicesPath, JSON.stringify(voicesData, null, 2));
    
    return voicesData;
  }

  async analyzeCharacterVoice(text, characterName) {
    // Extract dialogue and generate voice profile
    const dialoguePattern = new RegExp(`"([^"]*)" [^"]*${characterName}`, 'gi');
    const dialogues = [...text.matchAll(dialoguePattern)].map(match => match[1]);
    
    if (dialogues.length === 0) {
      return { style: "Standard narrative voice", examples: [] };
    }

    // In real implementation, analyze with LLM
    return {
      style: `${characterName} speaks with gravity and precision, often using academic terminology`,
      examples: dialogues.slice(0, 3),
      patterns: ['formal tone', 'complex sentence structure', 'scholarly vocabulary']
    };
  }

  // B3: Plot Memory System
  updatePlotMemory(chapterSummary) {
    this.plotMemory.push({
      timestamp: new Date().toISOString(),
      summary: chapterSummary,
      tokens: Math.ceil(chapterSummary.length / 4)
    });

    // Keep only recent memory within token limit
    let totalTokens = 0;
    const recentMemory = [];
    
    for (let i = this.plotMemory.length - 1; i >= 0; i--) {
      const memory = this.plotMemory[i];
      if (totalTokens + memory.tokens <= this.options.plotMemoryTokens) {
        recentMemory.unshift(memory);
        totalTokens += memory.tokens;
      } else {
        break;
      }
    }
    
    this.plotMemory = recentMemory;
    console.log(`[ContextCoherence] Plot memory: ${this.plotMemory.length} entries, ${totalTokens} tokens`);
  }

  getPlotMemoryContext() {
    if (this.plotMemory.length === 0) return null;
    
    return {
      type: 'plot_memory',
      summaries: this.plotMemory.map(m => m.summary),
      totalTokens: this.plotMemory.reduce((sum, m) => sum + m.tokens, 0)
    };
  }

  /**
   * C. RETRIEVAL-AUGMENTED GENERATION: Find similar translated chunks
   */
  async indexTranslatedChunk(chunkId, originalText, translatedText) {
    // Store translation for future reference
    this.translatedChunks.set(chunkId, {
      original: originalText,
      translated: translatedText,
      timestamp: new Date().toISOString()
    });

    // In production, generate embedding with actual embedding service
    const embedding = this.generateSimpleEmbedding(originalText);
    this.chunkEmbeddings.set(chunkId, embedding);
  }

  generateSimpleEmbedding(text) {
    // Simplified embedding (in production, use OpenAI Ada-002 or similar)
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Simulated 384-dim vector
    
    words.forEach((word, idx) => {
      const hash = this.simpleHash(word);
      embedding[hash % 384] += 1;
    });
    
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }

  async findSimilarTranslations(currentText, topK = null) {
    const k = topK || this.options.ragTopK;
    if (this.chunkEmbeddings.size === 0) return [];

    const currentEmbedding = this.generateSimpleEmbedding(currentText);
    const similarities = [];

    for (const [chunkId, embedding] of this.chunkEmbeddings) {
      const similarity = this.cosineSimilarity(currentEmbedding, embedding);
      similarities.push({ chunkId, similarity });
    }

    // Return top-K most similar
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)
      .map(item => ({
        chunkId: item.chunkId,
        similarity: item.similarity,
        translation: this.translatedChunks.get(item.chunkId)
      }));
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  /**
   * MASTER METHOD: Compile all context for translation
   */
  async compileTranslationContext(chunks, currentIndex, currentText) {
    const context = {
      sliding_window: this.getSlidingWindowContext(chunks, currentIndex),
      glossary: this.getRelevantGlossaryEntries(currentText),
      character_voices: this.getRelevantCharacterVoices(currentText),
      plot_memory: this.getPlotMemoryContext(),
      similar_translations: await this.findSimilarTranslations(currentText),
      metadata: {
        chunk_position: `${currentIndex + 1}/${chunks.length}`,
        context_types: [],
        total_context_tokens: 0
      }
    };

    // Calculate context types and tokens
    Object.keys(context).forEach(key => {
      if (context[key] && key !== 'metadata') {
        context.metadata.context_types.push(key);
        if (context[key].tokens) {
          context.metadata.total_context_tokens += context[key].tokens;
        }
      }
    });

    return context;
  }

  getRelevantGlossaryEntries(text) {
    const relevant = [];
    
    for (const [term, entry] of this.glossary) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        relevant.push({
          source: term,
          target: entry.target,
          type: entry.type,
          context: entry.context
        });
      }
    }
    
    return relevant.length > 0 ? { entries: relevant, count: relevant.length } : null;
  }

  getRelevantCharacterVoices(text) {
    const relevant = [];
    
    for (const [character, voice] of this.characterVoices) {
      if (text.toLowerCase().includes(character) || text.includes('"')) {
        relevant.push({
          character,
          style: voice.style,
          patterns: voice.patterns
        });
      }
    }
    
    return relevant.length > 0 ? { voices: relevant, count: relevant.length } : null;
  }

  // Utility methods
  ensureContextDir() {
    if (!fs.existsSync(this.options.contextDir)) {
      fs.mkdirSync(this.options.contextDir, { recursive: true });
    }
  }

  async saveContextState() {
    const state = {
      glossary: Object.fromEntries(this.glossary),
      characterVoices: Object.fromEntries(this.characterVoices),
      plotMemory: this.plotMemory,
      translatedChunks: Object.fromEntries(this.translatedChunks)
    };

    const statePath = path.join(this.options.contextDir, 'context-state.json');
    await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2));
    console.log('[ContextCoherence] Context state saved');
  }

  async loadContextState() {
    const statePath = path.join(this.options.contextDir, 'context-state.json');
    
    try {
      const state = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
      
      this.glossary = new Map(Object.entries(state.glossary || {}));
      this.characterVoices = new Map(Object.entries(state.characterVoices || {}));
      this.plotMemory = state.plotMemory || [];
      this.translatedChunks = new Map(Object.entries(state.translatedChunks || {}));
      
      console.log('[ContextCoherence] Context state loaded');
    } catch (error) {
      console.warn('[ContextCoherence] Could not load context state:', error.message);
    }
  }
}
