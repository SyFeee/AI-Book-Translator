import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Enhanced document processing libraries
let mammoth, EPub, pdfParse;

try {
  mammoth = await import('mammoth');
} catch (error) {
  console.warn('Mammoth import failed:', error.message);
  mammoth = null;
}

try {
  EPub = (await import('epub')).default;
} catch (error) {
  console.warn('EPub import failed:', error.message);
  EPub = null;
}

try {
  pdfParse = (await import('pdf-parse')).default;
} catch (error) {
  console.warn('PDF-parse import failed:', error.message);
  pdfParse = null;
}

/**
 * Advanced document processor that creates clean text + layout map
 * Following the structured approach: ingestion → separation → tagging → normalization → output
 */
export class AdvancedDocumentProcessor {
  constructor(options = {}) {
    this.options = {
      assetsDir: options.assetsDir || './assets',
      preserveFormatting: options.preserveFormatting !== false,
      normalizeUnicode: options.normalizeUnicode !== false,
      ...options
    };
    
    // Ensure assets directory exists
    this.ensureAssetsDirectory();
  }

  /**
   * Main processing pipeline
   * @param {Object} file - Uploaded file object
   * @returns {Object} - {cleanText, structureMap, metadata, assets}
   */
  async processDocument(file) {
    const fileExtension = path.extname(file.name).toLowerCase();
    console.log(`[AdvancedProcessor] Processing ${fileExtension} file: ${file.name}`);

    let rawDocument;
    
    // Step 1: File Ingestion
    switch (fileExtension) {
      case '.docx':
        rawDocument = await this.ingestDocx(file.tempFilePath);
        break;
      case '.epub':
        rawDocument = await this.ingestEpub(file.tempFilePath);
        break;
      case '.pdf':
        rawDocument = await this.ingestPdf(file.tempFilePath);
        break;
      case '.txt':
      case '.md':
        rawDocument = await this.ingestPlainText(file.tempFilePath);
        break;
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    // Step 2: Text vs Non-text Separation
    const separated = await this.separateContent(rawDocument);
    
    // Step 3: Structural Tagging
    const tagged = this.addStructuralTags(separated);
    
    // Step 4: Normalization
    const normalized = this.normalizeText(tagged);
    
    // Step 5: Generate Output Artifacts
    return this.generateOutputArtifacts(normalized, file.name);
  }

  /**
   * Step 1a: DOCX Ingestion using python-docx equivalent (mammoth)
   */
  async ingestDocx(filePath) {
    if (!mammoth) throw new Error('Mammoth library not available');
    
    console.log('[AdvancedProcessor] Ingesting DOCX file...');
    
    // Extract both raw text and HTML structure
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ path: filePath }),
      mammoth.convertToHtml({ path: filePath })
    ]);

    return {
      type: 'docx',
      rawText: rawResult.value,
      htmlContent: htmlResult.value,
      messages: htmlResult.messages || [],
      structure: this.parseDocxStructure(htmlResult.value)
    };
  }

  /**
   * Step 1b: EPUB Ingestion using ebooklib equivalent
   */
  async ingestEpub(filePath) {
    if (!EPub) throw new Error('EPUB library not available');
    
    console.log('[AdvancedProcessor] Ingesting EPUB file...');
    
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);
      const chapters = [];
      
      epub.on('end', async () => {
        const chapterPromises = epub.flow.map((chapter, index) => 
          this.extractEpubChapter(epub, chapter, index)
        );
        
        const extractedChapters = await Promise.all(chapterPromises);
        
        resolve({
          type: 'epub',
          metadata: epub.metadata || {},
          chapters: extractedChapters.filter(ch => ch !== null),
          toc: epub.toc || []
        });
      });
      
      epub.on('error', reject);
      epub.parse();
    });
  }

  /**
   * Step 1c: PDF Ingestion using pdfplumber equivalent
   */
  async ingestPdf(filePath) {
    if (!pdfParse) throw new Error('PDF parsing library not available');
    
    console.log('[AdvancedProcessor] Ingesting PDF file...');
    
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(pdfBuffer);
    
    return {
      type: 'pdf',
      rawText: pdfData.text,
      metadata: pdfData.info || {},
      pageCount: pdfData.numpages,
      version: pdfData.version
    };
  }

  /**
   * Step 1d: Plain text ingestion
   */
  async ingestPlainText(filePath) {
    console.log('[AdvancedProcessor] Ingesting plain text file...');
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    return {
      type: 'plaintext',
      rawText: content,
      metadata: {}
    };
  }

  /**
   * Step 2: Text vs Non-text Separation
   */
  async separateContent(rawDocument) {
    console.log('[AdvancedProcessor] Separating content types...');
    
    const assets = {
      images: [],
      tables: [],
      footnotes: []
    };
    
    let workingText = '';
    const structureSpans = [];
    
    switch (rawDocument.type) {
      case 'docx':
        return this.separateDocxContent(rawDocument, assets, structureSpans);
      case 'epub':
        return this.separateEpubContent(rawDocument, assets, structureSpans);
      case 'pdf':
        return this.separatePdfContent(rawDocument, assets, structureSpans);
      case 'plaintext':
        return this.separatePlainTextContent(rawDocument, assets, structureSpans);
    }
  }

  /**
   * Separate DOCX content
   */
  separateDocxContent(rawDocument, assets, structureSpans) {
    let cleanText = rawDocument.rawText;
    let currentOffset = 0;
    
    // Extract images from HTML
    const imageRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    let imageMatch;
    while ((imageMatch = imageRegex.exec(rawDocument.htmlContent)) !== null) {
      const imageHash = this.generateAssetHash(imageMatch[1]);
      assets.images.push({
        id: imageHash,
        originalSrc: imageMatch[1],
        path: `./assets/img/${imageHash}`,
        position: imageMatch.index
      });
      
      // Replace in text with placeholder
      const placeholder = `[IMAGE:${imageHash}]`;
      cleanText = cleanText.replace(/\[image\]/gi, placeholder);
    }
    
    // Extract tables
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(rawDocument.htmlContent)) !== null) {
      const tableHash = this.generateAssetHash(tableMatch[0]);
      const tableMarkdown = this.convertTableToMarkdown(tableMatch[0]);
      
      assets.tables.push({
        id: tableHash,
        originalHtml: tableMatch[0],
        markdown: tableMarkdown,
        position: tableMatch.index
      });
      
      // Replace in text with structured content
      const placeholder = `[TABLE:${tableHash}]\n${tableMarkdown}\n[/TABLE:${tableHash}]`;
      cleanText = cleanText.replace(tableMatch[0], placeholder);
    }
    
    // Handle formatting tags
    cleanText = this.preserveFormattingTags(cleanText, structureSpans);
    
    return {
      cleanText,
      assets,
      structureSpans,
      originalDocument: rawDocument
    };
  }

  /**
   * Separate EPUB content  
   */
  separateEpubContent(rawDocument, assets, structureSpans) {
    let cleanText = '';
    let currentOffset = 0;
    
    for (let i = 0; i < rawDocument.chapters.length; i++) {
      const chapter = rawDocument.chapters[i];
      
      // Add chapter boundary marker
      if (i > 0) {
        cleanText += '\n\n';
        currentOffset = cleanText.length;
      }
      
      // Add chapter header
      structureSpans.push({
        start: currentOffset,
        end: currentOffset + chapter.title.length,
        type: 'chapter-title',
        level: 1,
        metadata: { chapterIndex: i, title: chapter.title }
      });
      
      cleanText += chapter.title + '\n\n';
      currentOffset = cleanText.length;
      
      // Process chapter content
      const chapterResult = this.processChapterContent(chapter.content, currentOffset, assets);
      cleanText += chapterResult.text;
      structureSpans.push(...chapterResult.spans);
      currentOffset = cleanText.length;
    }
    
    return {
      cleanText,
      assets,
      structureSpans,
      originalDocument: rawDocument
    };
  }

  /**
   * Separate PDF content
   */
  separatePdfContent(rawDocument, assets, structureSpans) {
    let cleanText = rawDocument.rawText;
    
    // Clean PDF artifacts
    cleanText = this.cleanPdfArtifacts(cleanText);
    
    // Detect and extract tables (basic heuristic)
    const tables = this.detectPdfTables(cleanText);
    assets.tables = tables;
    
    // Remove page numbers and headers
    cleanText = this.removePdfPageElements(cleanText);
    
    return {
      cleanText,
      assets,
      structureSpans,
      originalDocument: rawDocument
    };
  }

  /**
   * Separate plain text content
   */
  separatePlainTextContent(rawDocument, assets, structureSpans) {
    return {
      cleanText: rawDocument.rawText,
      assets,
      structureSpans,
      originalDocument: rawDocument
    };
  }

  /**
   * Step 3: Structural Tagging
   */
  addStructuralTags(separated) {
    console.log('[AdvancedProcessor] Adding structural tags...');
    
    let { cleanText, structureSpans } = separated;
    
    // Ensure cleanText exists
    if (!cleanText) {
      console.warn('[AdvancedProcessor] cleanText is undefined in separated content');
      cleanText = separated.originalDocument?.rawText || '';
    }
    
    // Detect chapter boundaries
    cleanText = this.tagChapterBoundaries(cleanText, structureSpans);
    
    // Detect scene breaks
    cleanText = this.tagSceneBreaks(cleanText, structureSpans);
    
    // Detect dialogue paragraphs
    cleanText = this.tagDialogue(cleanText, structureSpans);
    
    // Detect headings and subheadings
    cleanText = this.tagHeadings(cleanText, structureSpans);
    
    return {
      ...separated,
      cleanText,
      structureSpans
    };
  }

  /**
   * Step 4: Normalization
   */
  normalizeText(tagged) {
    console.log('[AdvancedProcessor] Normalizing text...');
    
    let { cleanText } = tagged;
    
    // Ensure cleanText exists
    if (!cleanText) {
      console.warn('[AdvancedProcessor] cleanText is undefined, using empty string');
      cleanText = '';
    }
    
    if (this.options.normalizeUnicode) {
      // Unicode NFKC normalization
      cleanText = cleanText.normalize('NFKC');
      
      // Curly quote straightening
      cleanText = cleanText
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/…/g, '...');
    }
    
    // Remove soft hyphens
    cleanText = cleanText.replace(/\u00AD/g, '');
    
    // Clean up excessive whitespace
    cleanText = cleanText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim();
    
    return {
      ...tagged,
      cleanText
    };
  }

  /**
   * Step 5: Generate Output Artifacts
   */
  generateOutputArtifacts(processed, originalFileName) {
    console.log('[AdvancedProcessor] Generating output artifacts...');
    
    const baseName = path.basename(originalFileName, path.extname(originalFileName));
    
    // Generate structure.json (layout map)
    const structureMap = {
      version: '1.0',
      originalFile: originalFileName,
      timestamp: new Date().toISOString(),
      encoding: 'UTF-8',
      textLength: processed.cleanText.length,
      spans: processed.structureSpans,
      assets: processed.assets,
      metadata: {
        documentType: processed.originalDocument.type,
        hasImages: processed.assets.images.length > 0,
        hasTables: processed.assets.tables.length > 0,
        hasFootnotes: processed.assets.footnotes.length > 0,
        chapterCount: processed.structureSpans.filter(s => s.type === 'chapter-title').length
      }
    };
    
    return {
      cleanText: processed.cleanText,
      structureMap,
      assets: processed.assets,
      metadata: {
        originalFileName,
        processedFileName: `${baseName}_clean.txt`,
        structureFileName: `${baseName}_structure.json`,
        wordCount: processed.cleanText ? processed.cleanText.split(/\s+/).length : 0,
        characterCount: processed.cleanText ? processed.cleanText.length : 0,
        processingTimestamp: new Date().toISOString()
      }
    };
  }

  // Helper methods...
  
  ensureAssetsDirectory() {
    const dirs = ['./assets', './assets/img', './assets/tables'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  generateAssetHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }
  
  parseDocxStructure(htmlContent) {
    // Parse HTML structure to identify elements
    return {
      headings: this.extractHeadings(htmlContent),
      images: this.extractImages(htmlContent),
      tables: this.extractTables(htmlContent)
    };
  }
  
  async extractEpubChapter(epub, chapter, index) {
    return new Promise(resolve => {
      epub.getChapter(chapter.id, (err, content) => {
        if (err) {
          console.warn(`Failed to extract chapter ${chapter.id}:`, err);
          resolve(null);
          return;
        }
        
        resolve({
          index,
          id: chapter.id,
          title: chapter.title || `Chapter ${index + 1}`,
          content: content
        });
      });
    });
  }
  
  // Additional helper methods for content processing...
  convertTableToMarkdown(htmlTable) {
    // Simple table conversion - could be enhanced
    return htmlTable
      .replace(/<table[^>]*>/gi, '')
      .replace(/<\/table>/gi, '')
      .replace(/<tr[^>]*>/gi, '|')
      .replace(/<\/tr>/gi, '|\n')
      .replace(/<td[^>]*>/gi, ' ')
      .replace(/<\/td>/gi, ' |')
      .replace(/<th[^>]*>/gi, ' **')
      .replace(/<\/th>/gi, '** |');
  }
  
  preserveFormattingTags(text, structureSpans) {
    // Convert formatting to semantic tags
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>');
  }
  
  tagChapterBoundaries(text, structureSpans) {
    const chapterRegex = /^(chapter\s+\d+|chapter\s+[ivx]+)/gmi;
    return text.replace(chapterRegex, '<h1>$1</h1>');
  }
  
  tagSceneBreaks(text, structureSpans) {
    return text
      .replace(/^\s*\*\s*\*\s*\*\s*$/gm, '<scene-break/>')
      .replace(/^\s*---+\s*$/gm, '<scene-break/>');
  }
  
  tagDialogue(text, structureSpans) {
    const lines = text.split('\n');
    return lines.map(line => {
      if (line.trim().match(/^["'"]/) || line.trim().match(/^[—–-]/)) {
        return `<dialogue>${line}</dialogue>`;
      }
      return line;
    }).join('\n');
  }
  
  tagHeadings(text, structureSpans) {
    // Detect headings based on formatting patterns
    const lines = text.split('\n');
    return lines.map(line => {
      if (line.trim().length > 0 && line.trim().length < 80 && 
          !line.includes('.') && /^[A-Z]/.test(line.trim())) {
        return `<h2>${line}</h2>`;
      }
      return line;
    }).join('\n');
  }
  
  cleanPdfArtifacts(text) {
    return text
      .replace(/\f/g, '\n') // Form feed to newline
      .replace(/(\w)-\s+(\w)/g, '$1$2') // Rejoin hyphenated words
      .replace(/^\d+\s*$/gm, '') // Remove isolated page numbers
      .replace(/^.{1,20}\s*\d+\s*$/gm, ''); // Remove headers with page numbers
  }
  
  detectPdfTables(text) {
    // Basic table detection heuristics
    const lines = text.split('\n');
    const tables = [];
    // Implementation would go here
    return tables;
  }
  
  removePdfPageElements(text) {
    return text
      .split('\n')
      .filter(line => {
        // Remove obvious headers/footers
        return !(line.trim().length < 50 && /page\s+\d+/i.test(line));
      })
      .join('\n');
  }
  
  processChapterContent(content, startOffset, assets) {
    // Process individual chapter content
    const cleanContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      text: cleanContent,
      spans: []
    };
  }
  
  extractHeadings(htmlContent) {
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(htmlContent)) !== null) {
      headings.push({
        level: parseInt(match[1]),
        text: match[2].replace(/<[^>]+>/g, ''),
        position: match.index
      });
    }
    return headings;
  }
  
  extractImages(htmlContent) {
    const imageRegex = /<img[^>]*>/gi;
    return (htmlContent.match(imageRegex) || []).map((img, index) => ({
      index,
      element: img,
      position: htmlContent.indexOf(img)
    }));
  }
  
  extractTables(htmlContent) {
    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    return (htmlContent.match(tableRegex) || []).map((table, index) => ({
      index,
      element: table,
      position: htmlContent.indexOf(table)
    }));
  }
}

export default AdvancedDocumentProcessor;
