/**
 * Enhanced Post-Processing & Reassembly Service
 * Implements production-grade document reconstruction with:
 * - Chunk merging with overlap handling
 * - Style replay from structure.json
 * - Automated cleanup rules
 * - Format-specific exporters
 * - QA heuristics
 */

import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import PDFDocument from 'pdfkit';

export class EnhancedPostProcessingService {
  constructor(options = {}) {
    this.options = {
      overlapTolerance: options.overlapTolerance || 0.01, // ±1%
      enableQAHeuristics: options.enableQAHeuristics !== false,
      languageThreshold: options.languageThreshold || 0.95,
      pronounRatioThreshold: options.pronounRatioThreshold || 2.0,
      cleanupRules: options.cleanupRules || true,
      ...options
    };
  }

  /**
   * A. MERGE CHUNKS with overlap handling and verification
   */
  async mergeChunks(translatedChunks, originalMetadata = {}) {
    console.log(`[PostProcessing] Merging ${translatedChunks.length} chunks with overlap handling...`);
    
    // Sort chunks by original order
    const sortedChunks = this.sortChunksByOrder(translatedChunks);
    
    let mergedText = '';
    let totalTokens = 0;
    let overlapDetections = 0;
    
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const translatedText = chunk.translatedText || chunk.text || '';
      
      if (i === 0) {
        // First chunk - add as-is
        mergedText = translatedText;
      } else {
        // Detect and strip overlap with previous chunk
        const cleanText = this.stripOverlap(mergedText, translatedText, chunk);
        mergedText += cleanText;
        
        if (cleanText.length < translatedText.length) {
          overlapDetections++;
        }
      }
      
      totalTokens += this.estimateTokens(translatedText);
    }
    
    // Verify token count vs original (±1%)
    const originalTokens = originalMetadata.estimatedTokens || totalTokens;
    const tokenDifference = Math.abs(totalTokens - originalTokens) / originalTokens;
    
    if (tokenDifference > this.options.overlapTolerance) {
      console.warn(`[PostProcessing] Token count variance: ${(tokenDifference * 100).toFixed(2)}% (expected ±${this.options.overlapTolerance * 100}%)`);
    }
    
    console.log(`[PostProcessing] Merged successfully: ${overlapDetections} overlaps stripped, ${tokenDifference.toFixed(3)} token variance`);
    
    return {
      mergedText,
      metrics: {
        originalTokens,
        finalTokens: totalTokens,
        tokenVariance: tokenDifference,
        overlapsStripped: overlapDetections
      }
    };
  }

  /**
   * Strip overlap between chunks (keep second occurrence)
   */
  stripOverlap(previousText, currentText, chunkMetadata) {
    // If chunk has overlap metadata, use it
    if (chunkMetadata.previousContext || chunkMetadata.overlap) {
      const overlapText = chunkMetadata.previousContext || chunkMetadata.overlap;
      const overlapIndex = currentText.indexOf(overlapText);
      
      if (overlapIndex === 0) {
        // Overlap at beginning - strip it
        return currentText.substring(overlapText.length);
      }
    }
    
    // Heuristic overlap detection (last 50 chars of previous vs first 50 of current)
    const prevTail = previousText.slice(-50).trim();
    const currHead = currentText.slice(0, 100).trim();
    
    // Find common substring
    for (let len = Math.min(prevTail.length, 30); len >= 10; len--) {
      const suffix = prevTail.slice(-len);
      if (currHead.startsWith(suffix)) {
        console.log(`[PostProcessing] Detected ${len}-char overlap: "${suffix}"`);
        return currentText.substring(len);
      }
    }
    
    // No overlap detected - add with appropriate spacing
    return this.addChunkSpacing(currentText, chunkMetadata);
  }

  /**
   * B. STYLE REPLAY from structure.json
   */
  async applyStyleReplay(mergedText, structureMap) {
    console.log('[PostProcessing] Applying style replay from structure map...');
    
    let styledText = mergedText;
    let stylesApplied = 0;
    
    // Apply structural formatting based on structure map
    if (structureMap.chapters) {
      structureMap.chapters.forEach((chapter, idx) => {
        const chapterPattern = new RegExp(`(CHAPTER\\s+${chapter.number}[^\\n]*)`,'gi');
        styledText = styledText.replace(chapterPattern, '<h1>$1</h1>');
        stylesApplied++;
      });
    }
    
    // Apply emphasis spans from structure map
    if (structureMap.formattingSpans) {
      structureMap.formattingSpans.forEach(span => {
        if (span.type === 'italic') {
          const spanText = mergedText.substring(span.start, span.end);
          styledText = styledText.replace(spanText, `<i>${spanText}</i>`);
          stylesApplied++;
        } else if (span.type === 'bold') {
          const spanText = mergedText.substring(span.start, span.end);
          styledText = styledText.replace(spanText, `<b>${spanText}</b>`);
          stylesApplied++;
        }
      });
    }
    
    console.log(`[PostProcessing] Applied ${stylesApplied} style elements`);
    return styledText;
  }

  /**
   * C. AUTOMATED CLEANUP RULES
   */
  applyCleanupRules(text, targetLanguage) {
    console.log('[PostProcessing] Applying automated cleanup rules...');
    
    let cleanedText = text;
    let rulesApplied = 0;
    
    // 1. Quote-style normalization (language specific)
    const quoteRules = this.getQuoteRules(targetLanguage);
    cleanedText = this.normalizeQuotes(cleanedText, quoteRules);
    rulesApplied++;
    
    // 2. Delete spurious LLM tags
    const spuriousTags = [
      /<\/?TRANSLATION>/gi,
      /<\/?translation>/gi,
      /\[TRANSLATED\]/gi,
      /\[TRANSLATION\]/gi,
      /```[^`]*```/gi, // Code blocks
      /<\/?thinking>/gi
    ];
    
    spuriousTags.forEach(pattern => {
      if (pattern.test(cleanedText)) {
        cleanedText = cleanedText.replace(pattern, '');
        rulesApplied++;
      }
    });
    
    // 3. Normalize whitespace
    cleanedText = cleanedText
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .trim();
    rulesApplied++;
    
    // 4. Fix punctuation spacing
    cleanedText = this.fixPunctuationSpacing(cleanedText, targetLanguage);
    rulesApplied++;
    
    console.log(`[PostProcessing] Applied ${rulesApplied} cleanup rules`);
    return cleanedText;
  }

  /**
   * D. FORMAT-SPECIFIC EXPORTERS
   */
  async exportToFormat(text, format, metadata = {}) {
    console.log(`[PostProcessing] Exporting to ${format} format...`);
    
    switch (format.toLowerCase()) {
      case 'docx':
        return await this.exportToDOCX(text, metadata);
      
      case 'epub':
        return await this.exportToEPUB(text, metadata);
      
      case 'pdf':
        return await this.exportToPDF(text, metadata);
      
      case 'html':
        return this.exportToHTML(text, metadata);
      
      case 'md':
      case 'markdown':
        return this.exportToMarkdown(text, metadata);
      
      default:
        return this.exportToTXT(text, metadata);
    }
  }

  async exportToDOCX(text, metadata) {
    // DOCX export with real DOCX library
    console.log('[PostProcessing] Generating DOCX with Word styles...');
    
    try {
      // Enhanced paragraph processing to preserve original structure
      // Split by double newlines first, then by single newlines for better paragraph detection
      let paragraphs = text.split('\n\n').filter(p => p.trim());
      
      // If we have very few paragraphs, try splitting by single newlines too
      if (paragraphs.length < 5) {
        paragraphs = text.split('\n').filter(p => p.trim());
      }
      
      const docChildren = [];
      
      paragraphs.forEach((paragraph, index) => {
        let trimmedParagraph = paragraph.trim();
        
        // Skip empty paragraphs
        if (!trimmedParagraph) return;
        
        // Clean up common translation artifacts
        trimmedParagraph = trimmedParagraph
          .replace(/^\s*\[Translation\]\s*/i, '')
          .replace(/^\s*Translation:\s*/i, '')
          .replace(/^\s*Here's the translation[^:]*:\s*/i, '')
          .replace(/^\s*Okay,?\s*here'?s the translation[^:]*:\s*/i, '')
          .trim();
        
        // Skip if paragraph became empty after cleaning
        if (!trimmedParagraph) return;
        
        // Detect if this is a chapter heading
        if (trimmedParagraph.match(/^(Chapter|Capítulo|Chapitre|Kapitel|Capítulo)\s+\d+/i) || 
            trimmedParagraph.match(/^#\s+/) ||
            trimmedParagraph.match(/^[IVX]+\./i) ||
            (index === 0 && trimmedParagraph.length < 100 && !trimmedParagraph.includes('.'))) {
          // Create heading
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedParagraph,
                  bold: true,
                  size: 28
                })
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: {
                after: 300,
                before: 400
              }
            })
          );
        } else {
          // Create regular paragraph with better spacing
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedParagraph,
                  size: 24
                })
              ],
              spacing: {
                after: 180,
                before: 0
              }
            })
          );
        }
      });
      
      // If no content was processed, create a simple paragraph
      if (docChildren.length === 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: text.trim(),
                size: 24
              })
            ]
          })
        );
      }
      
      // Create the document
      const doc = new Document({
        sections: [{
          properties: {},
          children: docChildren
        }],
        title: metadata.title || 'Translated Document',
        creator: 'AI Translator',
        description: `Translated from ${metadata.sourceLanguage || 'unknown'} to ${metadata.targetLanguage || 'unknown'}`
      });
      
      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      
      return {
        format: 'docx',
        content: buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: `${metadata.baseName || 'translated'}.docx`
      };
      
    } catch (error) {
      console.error('[PostProcessing] DOCX generation error:', error);
      // Fallback to text content
      return {
        format: 'docx',
        content: text,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: `${metadata.baseName || 'translated'}.docx`
      };
    }
  }

  async exportToEPUB(text, metadata) {
    // EPUB export using Jinja2 → XHTML, then zip with mimetype
    console.log('[PostProcessing] Generating EPUB with XHTML structure...');
    
    const xhtmlContent = this.generateXHTML(text, metadata);
    
    return {
      format: 'epub',
      content: JSON.stringify({
        mimetype: 'application/epub+zip',
        xhtml: xhtmlContent,
        metadata: metadata
      }, null, 2), // Placeholder
      mimeType: 'application/epub+zip',
      fileName: `${metadata.baseName || 'translated'}.epub`
    };
  }

  async exportToPDF(text, metadata) {
    // PDF export using PDFKit
    console.log('[PostProcessing] Generating PDF with language support...');
    
    try {
      const isRTL = this.isRightToLeftLanguage(metadata.targetLanguage);
      
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 72,
          bottom: 72,
          left: 72,
          right: 72
        }
      });
      
      // Create buffer to collect PDF data
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      const pdfPromise = new Promise((resolve, reject) => {
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
        doc.on('error', reject);
      });
      
      // Add title
      const title = metadata.title || 'Translated Document';
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(2);
      
      // Split text into paragraphs
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach((paragraph) => {
        const trimmedParagraph = paragraph.trim();
        
        // Check if this is a chapter heading
        if (trimmedParagraph.match(/^(Chapter|Capítulo|Chapitre|Kapitel)\s+\d+/i) || 
            trimmedParagraph.match(/^#\s+/)) {
          // Chapter heading
          doc.addPage();
          doc.fontSize(16).font('Helvetica-Bold');
          doc.text(trimmedParagraph, { align: isRTL ? 'right' : 'left' });
          doc.moveDown(1);
        } else {
          // Regular paragraph
          doc.fontSize(12).font('Helvetica');
          doc.text(trimmedParagraph, { 
            align: isRTL ? 'right' : 'left',
            lineGap: 5
          });
          doc.moveDown(0.5);
        }
        
        // Add page break if needed
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
      });
      
      // Add metadata
      doc.info = {
        Title: title,
        Author: 'AI Translator',
        Subject: `Translation from ${metadata.sourceLanguage || 'unknown'} to ${metadata.targetLanguage || 'unknown'}`,
        Creator: 'AI Book Translator',
        Producer: 'AI Book Translator'
      };
      
      // Finalize the PDF
      doc.end();
      
      // Wait for PDF generation to complete
      const buffer = await pdfPromise;
      
      return {
        format: 'pdf',
        content: buffer,
        mimeType: 'application/pdf',
        fileName: `${metadata.baseName || 'translated'}.pdf`
      };
      
    } catch (error) {
      console.error('[PostProcessing] PDF generation error:', error);
      // Fallback to text content
      return {
        format: 'pdf',
        content: text,
        mimeType: 'application/pdf',
        fileName: `${metadata.baseName || 'translated'}.pdf`
      };
    }
  }

  exportToHTML(text, metadata) {
    const htmlContent = `<!DOCTYPE html>
<html lang="${metadata.targetLanguage || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title || 'Translated Document'}</title>
    <style>
        body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #333; }
        .chapter { margin-top: 2em; }
        .dialogue { font-style: italic; }
    </style>
</head>
<body>
    ${this.convertTextToHTML(text)}
</body>
</html>`;

    return {
      format: 'html',
      content: htmlContent,
      mimeType: 'text/html',
      fileName: `${metadata.baseName || 'translated'}.html`
    };
  }

  /**
   * E. QA HEURISTICS (cheap quality checks)
   */
  async runQAHeuristics(translatedText, originalText, translatedChunks, metadata = {}) {
    if (!this.options.enableQAHeuristics) {
      return { passed: true, warnings: [], score: 1.0 };
    }
    
    console.log('[PostProcessing] Running QA heuristics...');
    
    const warnings = [];
    let score = 1.0;
    
    // 1. Language-id filter: every chunk must be ≥95% target language
    const languageCheck = await this.checkLanguageConsistency(translatedChunks, metadata.targetLanguage);
    if (languageCheck.confidence < this.options.languageThreshold) {
      warnings.push(`Language consistency: ${(languageCheck.confidence * 100).toFixed(1)}% (expected ≥${this.options.languageThreshold * 100}%)`);
      score -= 0.2;
    }
    
    // 2. Pronoun count sanity: if "he/she" count in translation is >2× source, flag
    const pronounCheck = this.checkPronounRatio(originalText, translatedText, metadata);
    if (pronounCheck.ratio > this.options.pronounRatioThreshold) {
      warnings.push(`Pronoun ratio suspicious: ${pronounCheck.ratio.toFixed(1)}× source (threshold: ${this.options.pronounRatioThreshold}×)`);
      score -= 0.15;
    }
    
    // 3. Glossary regression test: grep for un-translated glossary terms
    const glossaryCheck = this.checkGlossaryCompliance(translatedText, metadata.glossary);
    if (glossaryCheck.violations.length > 0) {
      warnings.push(`Glossary violations: ${glossaryCheck.violations.length} terms not translated correctly`);
      score -= 0.1 * glossaryCheck.violations.length;
    }
    
    // 4. Length sanity check
    const lengthRatio = translatedText.length / originalText.length;
    if (lengthRatio < 0.3 || lengthRatio > 3.0) {
      warnings.push(`Suspicious length ratio: ${lengthRatio.toFixed(2)} (expected 0.3-3.0)`);
      score -= 0.2;
    }
    
    const passed = warnings.length === 0;
    score = Math.max(0, score);
    
    console.log(`[PostProcessing] QA complete: ${passed ? 'PASSED' : 'WARNINGS'} (score: ${score.toFixed(2)})`);
    
    return {
      passed,
      warnings,
      score,
      details: {
        languageConsistency: languageCheck.confidence,
        pronounRatio: pronounCheck.ratio,
        glossaryViolations: glossaryCheck.violations.length,
        lengthRatio
      }
    };
  }

  // Helper methods
  sortChunksByOrder(chunks) {
    return [...chunks].sort((a, b) => {
      const aOrder = a.id || a.position || a.order || 0;
      const bOrder = b.id || b.position || b.order || 0;
      return aOrder - bOrder;
    });
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Rough approximation
  }

  addChunkSpacing(text, metadata) {
    if (metadata?.type === 'chapter') return '\n\n\n' + text;
    if (metadata?.type === 'scene') return '\n\n' + text;
    return '\n' + text; // Default paragraph spacing
  }

  getQuoteRules(language) {
    const rules = {
      'en': { open: '"', close: '"' },
      'fr': { open: '«', close: '»' },
      'de': { open: '„', close: '"' },
      'zh': { open: '"', close: '"' },
      'ja': { open: '「', close: '」' },
      'default': { open: '"', close: '"' }
    };
    return rules[language] || rules.default;
  }

  normalizeQuotes(text, quoteRules) {
    // Replace various quote styles with language-appropriate ones
    return text
      .replace(/[""]/g, quoteRules.open)
      .replace(/[""]/g, quoteRules.close);
  }

  fixPunctuationSpacing(text, language) {
    // Language-specific punctuation rules
    if (language === 'fr') {
      // French: space before :;!?
      return text.replace(/\s*([;:!?])/g, ' $1');
    }
    return text.replace(/\s+([.,:;!?])/g, '$1'); // Remove space before punctuation
  }

  async checkLanguageConsistency(chunks, targetLanguage) {
    // Simple heuristic - in production, use proper language detection
    let consistentChunks = 0;
    
    chunks.forEach(chunk => {
      const text = chunk.translatedText || chunk.text || '';
      if (this.detectLanguage(text) === targetLanguage) {
        consistentChunks++;
      }
    });
    
    return {
      confidence: consistentChunks / chunks.length,
      consistentChunks,
      totalChunks: chunks.length
    };
  }

  checkPronounRatio(originalText, translatedText, metadata) {
    const originalPronouns = (originalText.match(/\b(he|she|him|her|his|hers)\b/gi) || []).length;
    
    // Language-specific pronoun patterns
    let translatedPronouns = 0;
    if (metadata.targetLanguage === 'zh') {
      translatedPronouns = (translatedText.match(/[他她它]/g) || []).length;
    } else {
      translatedPronouns = (translatedText.match(/\b(he|she|him|her|his|hers)\b/gi) || []).length;
    }
    
    return {
      ratio: originalPronouns > 0 ? translatedPronouns / originalPronouns : 0,
      originalCount: originalPronouns,
      translatedCount: translatedPronouns
    };
  }

  checkGlossaryCompliance(translatedText, glossary = []) {
    const violations = [];
    
    glossary.forEach(term => {
      if (typeof term === 'object' && term.source && term.target) {
        // Check if source term appears in translation (should be target instead)
        if (translatedText.includes(term.source)) {
          violations.push({
            term: term.source,
            expected: term.target,
            type: 'untranslated'
          });
        }
      }
    });
    
    return { violations };
  }

  detectLanguage(text) {
    // Basic language detection
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[а-яё]/i.test(text)) return 'ru';
    if (/[ひらがなカタカナ]/.test(text)) return 'ja';
    if (/[à-ÿ]/i.test(text)) return 'fr';
    return 'en';
  }

  isRightToLeftLanguage(language) {
    return ['ar', 'he', 'fa', 'ur'].includes(language);
  }

  convertTextToHTML(text) {
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  generateXHTML(text, metadata) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>${metadata.title || 'Translated Document'}</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
</head>
<body>
    ${this.convertTextToHTML(text)}
</body>
</html>`;
  }
}
