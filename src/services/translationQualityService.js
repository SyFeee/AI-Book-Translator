/**
 * Real-time Translation Quality Analysis Service
 * Provides dynamic quality metrics instead of hardcoded values
 */

import natural from 'natural';

export class TranslationQualityService {
  constructor(options = {}) {
    this.options = {
      sourceLanguage: options.sourceLanguage || 'en',
      targetLanguage: options.targetLanguage || 'zh',
      ...options
    };
    
    this.metrics = {
      terminology: new Map(),
      contextCoherence: [],
      grammarIssues: [],
      styleConsistency: []
    };
  }

  /**
   * Analyze translation quality in real-time
   */
  async analyzeTranslationQuality(originalChunks, translatedChunks, options = {}) {
    console.log('[QualityAnalysis] Starting real-time quality analysis...');
    
    const { glossary = {}, sourceLanguage, targetLanguage } = options;
    
    // Ensure we have the same number of chunks
    if (originalChunks.length !== translatedChunks.length) {
      console.warn('[QualityAnalysis] Chunk count mismatch - some chunks may have failed translation');
    }
    
    const analysis = {
      overallQuality: this.calculateOverallQuality(originalChunks, translatedChunks),
      terminologyConsistency: this.analyzeTerminologyConsistency(originalChunks, translatedChunks, glossary),
      contextCoherence: this.analyzeContextCoherence(translatedChunks),
      grammarAndStyle: this.analyzeGrammarAndStyle(translatedChunks, targetLanguage),
      lengthConsistency: this.analyzeLengthConsistency(originalChunks, translatedChunks),
      completeness: this.analyzeCompleteness(originalChunks, translatedChunks),
      detailedMetrics: this.calculateDetailedMetrics(originalChunks, translatedChunks),
      issues: this.identifyIssues(originalChunks, translatedChunks),
      recommendations: []
    };
    
    // Generate recommendations based on issues
    analysis.recommendations = this.generateRecommendations(analysis);
    
    console.log('[QualityAnalysis] Analysis complete:', {
      overall: analysis.overallQuality,
      terminology: analysis.terminologyConsistency.percentage,
      coherence: analysis.contextCoherence.score,
      completeness: analysis.completeness.percentage
    });
    
    return analysis;
  }

  /**
   * Calculate overall quality score
   */
  calculateOverallQuality(originalChunks, translatedChunks) {
    let totalScore = 0;
    let validChunks = 0;
    
    for (let i = 0; i < Math.min(originalChunks.length, translatedChunks.length); i++) {
      const original = this.getChunkText(originalChunks[i]);
      const translated = this.getChunkText(translatedChunks[i]);
      
      if (!translated || translated.includes('TRANSLATION ERROR') || translated.includes('[Translation error]')) {
        continue; // Skip failed translations
      }
      
      validChunks++;
      
      // Score based on multiple factors
      let chunkScore = 100;
      
      // Length ratio penalty (should be reasonable)
      const lengthRatio = translated.length / original.length;
      if (lengthRatio < 0.3 || lengthRatio > 3.0) {
        chunkScore -= 30;
      } else if (lengthRatio < 0.5 || lengthRatio > 2.0) {
        chunkScore -= 15;
      }
      
      // Empty or very short translation penalty
      if (translated.length < 10) {
        chunkScore -= 40;
      }
      
      // Repetition penalty
      if (this.hasExcessiveRepetition(translated)) {
        chunkScore -= 20;
      }
      
      // Incomplete sentence penalty
      if (!this.isCompleteSentence(translated)) {
        chunkScore -= 15;
      }
      
      totalScore += Math.max(0, chunkScore);
    }
    
    if (validChunks === 0) {
      return { score: 0, level: 'FAILED', validChunks: 0, totalChunks: originalChunks.length };
    }
    
    const averageScore = totalScore / validChunks;
    const completionRate = validChunks / originalChunks.length;
    const finalScore = averageScore * completionRate;
    
    return {
      score: Math.round(finalScore),
      level: this.getQualityLevel(finalScore),
      validChunks,
      totalChunks: originalChunks.length,
      completionRate: Math.round(completionRate * 100)
    };
  }

  /**
   * Analyze terminology consistency
   */
  analyzeTerminologyConsistency(originalChunks, translatedChunks, glossary) {
    const glossaryTerms = Object.keys(glossary);
    if (glossaryTerms.length === 0) {
      return { percentage: 100, correctTerms: 0, totalTerms: 0, issues: [] };
    }
    
    let correctTerms = 0;
    let totalTerms = 0;
    const issues = [];
    
    for (let i = 0; i < Math.min(originalChunks.length, translatedChunks.length); i++) {
      const original = this.getChunkText(originalChunks[i]);
      const translated = this.getChunkText(translatedChunks[i]);
      
      if (!translated || translated.includes('TRANSLATION ERROR')) continue;
      
      for (const term of glossaryTerms) {
        const expectedTranslation = glossary[term];
        const termRegex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
        const matches = original.match(termRegex);
        
        if (matches) {
          totalTerms += matches.length;
          
          // Check if expected translation appears in translated text
          const translationRegex = new RegExp(`\\b${this.escapeRegex(expectedTranslation)}\\b`, 'gi');
          const translationMatches = translated.match(translationRegex);
          
          if (translationMatches && translationMatches.length >= matches.length) {
            correctTerms += matches.length;
          } else {
            issues.push({
              chunkIndex: i,
              term,
              expectedTranslation,
              found: translationMatches ? translationMatches.length : 0,
              expected: matches.length
            });
          }
        }
      }
    }
    
    const percentage = totalTerms > 0 ? Math.round((correctTerms / totalTerms) * 100) : 100;
    
    return {
      percentage,
      correctTerms,
      totalTerms,
      issues: issues.slice(0, 10) // Limit to first 10 issues
    };
  }

  /**
   * Analyze context coherence across chunks
   */
  analyzeContextCoherence(translatedChunks) {
    let coherenceScore = 100;
    const issues = [];
    
    for (let i = 1; i < translatedChunks.length; i++) {
      const prevChunk = this.getChunkText(translatedChunks[i - 1]);
      const currentChunk = this.getChunkText(translatedChunks[i]);
      
      if (!prevChunk || !currentChunk || 
          prevChunk.includes('TRANSLATION ERROR') || 
          currentChunk.includes('TRANSLATION ERROR')) {
        coherenceScore -= 10;
        continue;
      }
      
      // Check for abrupt topic changes (simplified)
      const prevWords = this.extractKeywords(prevChunk);
      const currentWords = this.extractKeywords(currentChunk);
      
      const overlap = this.calculateWordOverlap(prevWords, currentWords);
      
      if (overlap < 0.1 && i < translatedChunks.length - 1) { // Very low overlap might indicate poor coherence
        issues.push({
          chunkIndex: i,
          issue: 'Low context overlap with previous chunk',
          overlap: Math.round(overlap * 100)
        });
        coherenceScore -= 5;
      }
    }
    
    return {
      score: Math.max(0, coherenceScore),
      level: this.getQualityLevel(coherenceScore),
      issues: issues.slice(0, 5)
    };
  }

  /**
   * Analyze grammar and style consistency
   */
  analyzeGrammarAndStyle(translatedChunks, targetLanguage) {
    let grammarScore = 100;
    let styleScore = 100;
    const issues = [];
    
    let inconsistentPunctuation = 0;
    let incompleteChunks = 0;
    
    for (let i = 0; i < translatedChunks.length; i++) {
      const translated = this.getChunkText(translatedChunks[i]);
      
      if (!translated || translated.includes('TRANSLATION ERROR')) {
        incompleteChunks++;
        continue;
      }
      
      // Check for incomplete sentences
      if (!this.isCompleteSentence(translated)) {
        grammarScore -= 5;
        issues.push({
          chunkIndex: i,
          issue: 'Incomplete sentence',
          text: translated.substring(0, 50) + '...'
        });
      }
      
      // Check punctuation consistency (simplified for Chinese/English)
      if (targetLanguage === 'zh' || targetLanguage === 'zh-CN') {
        if (translated.match(/[.!?]/) && !translated.match(/[。！？]/)) {
          inconsistentPunctuation++;
        }
      }
      
      // Check for excessive repetition
      if (this.hasExcessiveRepetition(translated)) {
        styleScore -= 10;
        issues.push({
          chunkIndex: i,
          issue: 'Excessive repetition detected',
          text: translated.substring(0, 50) + '...'
        });
      }
    }
    
    // Adjust scores based on inconsistencies
    if (inconsistentPunctuation > translatedChunks.length * 0.2) {
      grammarScore -= 15;
    }
    
    const completionRate = 1 - (incompleteChunks / translatedChunks.length);
    grammarScore *= completionRate;
    styleScore *= completionRate;
    
    return {
      grammarScore: Math.max(0, Math.round(grammarScore)),
      styleScore: Math.max(0, Math.round(styleScore)),
      grammarLevel: this.getQualityLevel(grammarScore),
      styleLevel: this.getQualityLevel(styleScore),
      issues: issues.slice(0, 10)
    };
  }

  /**
   * Analyze length consistency
   */
  analyzeLengthConsistency(originalChunks, translatedChunks) {
    const ratios = [];
    
    for (let i = 0; i < Math.min(originalChunks.length, translatedChunks.length); i++) {
      const original = this.getChunkText(originalChunks[i]);
      const translated = this.getChunkText(translatedChunks[i]);
      
      if (translated && !translated.includes('TRANSLATION ERROR') && original.length > 0) {
        ratios.push(translated.length / original.length);
      }
    }
    
    if (ratios.length === 0) {
      return { averageRatio: 0, consistency: 0, level: 'POOR' };
    }
    
    const averageRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - averageRatio, 2), 0) / ratios.length;
    const consistency = Math.max(0, 100 - (variance * 100));
    
    return {
      averageRatio: Math.round(averageRatio * 100) / 100,
      consistency: Math.round(consistency),
      level: this.getQualityLevel(consistency),
      validSamples: ratios.length
    };
  }

  /**
   * Analyze translation completeness
   */
  analyzeCompleteness(originalChunks, translatedChunks) {
    let successfulTranslations = 0;
    let failedTranslations = 0;
    const failures = [];
    
    for (let i = 0; i < originalChunks.length; i++) {
      const translated = i < translatedChunks.length ? this.getChunkText(translatedChunks[i]) : null;
      
      if (!translated || 
          translated.includes('TRANSLATION ERROR') || 
          translated.includes('[Translation error]') ||
          translated.trim().length === 0) {
        failedTranslations++;
        failures.push({
          chunkIndex: i,
          originalText: this.getChunkText(originalChunks[i]).substring(0, 100) + '...',
          error: translated || 'Missing translation'
        });
      } else {
        successfulTranslations++;
      }
    }
    
    const percentage = Math.round((successfulTranslations / originalChunks.length) * 100);
    
    return {
      percentage,
      successfulTranslations,
      failedTranslations,
      totalChunks: originalChunks.length,
      level: this.getQualityLevel(percentage),
      failures: failures.slice(0, 5)
    };
  }

  /**
   * Calculate detailed metrics
   */
  calculateDetailedMetrics(originalChunks, translatedChunks) {
    const totalOriginalLength = originalChunks.reduce((sum, chunk) => 
      sum + this.getChunkText(chunk).length, 0);
    
    const totalTranslatedLength = translatedChunks.reduce((sum, chunk) => {
      const text = this.getChunkText(chunk);
      return sum + (text && !text.includes('TRANSLATION ERROR') ? text.length : 0);
    }, 0);
    
    return {
      totalOriginalLength,
      totalTranslatedLength,
      compressionRatio: totalOriginalLength > 0 ? 
        Math.round((totalTranslatedLength / totalOriginalLength) * 100) / 100 : 0,
      averageChunkSize: Math.round(totalTranslatedLength / translatedChunks.length),
      processingTime: new Date().toISOString()
    };
  }

  /**
   * Identify major issues
   */
  identifyIssues(originalChunks, translatedChunks) {
    const issues = [];
    
    // Missing chunks
    if (translatedChunks.length < originalChunks.length) {
      issues.push({
        type: 'missing_chunks',
        severity: 'high',
        description: `${originalChunks.length - translatedChunks.length} chunks were not translated`,
        impact: 'Incomplete translation'
      });
    }
    
    // Failed translations
    let failedCount = 0;
    translatedChunks.forEach((chunk, i) => {
      const text = this.getChunkText(chunk);
      if (!text || text.includes('TRANSLATION ERROR') || text.includes('[Translation error]')) {
        failedCount++;
      }
    });
    
    if (failedCount > 0) {
      issues.push({
        type: 'translation_failures',
        severity: failedCount > translatedChunks.length * 0.1 ? 'high' : 'medium',
        description: `${failedCount} chunks failed to translate properly`,
        impact: 'Quality degradation'
      });
    }
    
    return issues;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.completeness.percentage < 90) {
      recommendations.push({
        type: 'completeness',
        priority: 'high',
        message: 'Some chunks failed to translate. Consider retrying failed chunks or adjusting chunk size.',
        action: 'retry_failed_chunks'
      });
    }
    
    if (analysis.terminologyConsistency.percentage < 80) {
      recommendations.push({
        type: 'terminology',
        priority: 'medium',
        message: 'Terminology consistency is below optimal. Review glossary terms and their usage.',
        action: 'review_glossary'
      });
    }
    
    if (analysis.overallQuality.score < 70) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        message: 'Overall translation quality is low. Consider using different translation settings or reviewing source text.',
        action: 'adjust_settings'
      });
    }
    
    return recommendations;
  }

  // Helper methods
  getChunkText(chunk) {
    if (typeof chunk === 'string') return chunk;
    return chunk?.translatedText || chunk?.text || '';
  }

  getQualityLevel(score) {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 80) return 'VERY GOOD';
    if (score >= 70) return 'GOOD';
    if (score >= 60) return 'FAIR';
    if (score >= 40) return 'POOR';
    return 'FAILED';
  }

  isCompleteSentence(text) {
    const trimmed = text.trim();
    return trimmed.length > 0 && /[.!?。！？]$/.test(trimmed);
  }

  hasExcessiveRepetition(text) {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = new Map();
    
    for (const word of words) {
      if (word.length > 3) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }
    
    for (const [word, count] of wordCount) {
      if (count > Math.max(3, words.length * 0.2)) {
        return true;
      }
    }
    
    return false;
  }

  extractKeywords(text) {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  calculateWordOverlap(words1, words2) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
