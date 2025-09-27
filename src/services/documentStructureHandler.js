/**
 * Advanced Document Structure Handler
 * Handles images, tables, and complex document elements during translation
 */

export class DocumentStructureHandler {
  constructor(options = {}) {
    this.options = {
      preserveImages: options.preserveImages !== false,
      preserveTables: options.preserveTables !== false,
      translateTableContent: options.translateTableContent !== false,
      translateImageCaptions: options.translateImageCaptions !== false,
      preserveFormatting: options.preserveFormatting !== false,
      ...options
    };
    
    console.log('[DocumentStructure] Initialized with image and table handling');
  }

  /**
   * Process document with complex structures (images, tables, etc.)
   */
  async processComplexDocument(documentData, extractedText) {
    const analysis = this.analyzeDocumentStructure(documentData, extractedText);
    
    // Create structure-aware chunks
    const enhancedChunks = await this.createStructureAwareChunks(extractedText, analysis);
    
    return {
      chunks: enhancedChunks,
      structureMap: analysis,
      processingInstructions: this.generateProcessingInstructions(analysis)
    };
  }

  /**
   * Analyze document structure to identify images, tables, and special elements
   */
  analyzeDocumentStructure(documentData, text) {
    const structure = {
      images: [],
      tables: [],
      figures: [],
      charts: [],
      specialElements: [],
      textRegions: []
    };

    // Process different document types
    if (documentData.type === 'pdf') {
      return this.analyzePDFStructure(documentData, text, structure);
    } else if (documentData.type === 'docx') {
      return this.analyzeDOCXStructure(documentData, text, structure);
    } else {
      return this.analyzeTextStructure(text, structure);
    }
  }

  /**
   * Handle PDF with images and tables
   */
  analyzePDFStructure(documentData, text, structure) {
    console.log('[DocumentStructure] Analyzing PDF structure');
    
    // Extract image placeholders and positions
    const imageMatches = [...text.matchAll(/\[IMAGE:\s*([^\]]+)\]/gi)];
    imageMatches.forEach((match, index) => {
      structure.images.push({
        id: `img_${index}`,
        placeholder: match[0],
        description: match[1] || `Image ${index + 1}`,
        position: match.index,
        preserveInTranslation: true
      });
    });

    // Extract table placeholders and content
    const tableMatches = [...text.matchAll(/\[TABLE:\s*([^\]]+)\]/gi)];
    tableMatches.forEach((match, index) => {
      structure.tables.push({
        id: `table_${index}`,
        placeholder: match[0],
        description: match[1] || `Table ${index + 1}`,
        position: match.index,
        needsTranslation: this.options.translateTableContent
      });
    });

    // Extract figure references
    const figureRefs = [...text.matchAll(/(Figure|Fig\\.?|Figura)\\s*(\\d+)/gi)];
    figureRefs.forEach((match, index) => {
      structure.figures.push({
        id: `fig_ref_${index}`,
        text: match[0],
        number: match[2],
        position: match.index,
        needsTranslation: true
      });
    });

    return this.identifyTextRegions(text, structure);
  }

  /**
   * Handle DOCX with embedded objects
   */
  analyzeDOCXStructure(documentData, text, structure) {
    console.log('[DocumentStructure] Analyzing DOCX structure');
    
    // DOCX-specific structure analysis
    // Images are often represented as [object Object] or similar placeholders
    const objectMatches = [...text.matchAll(/\[object Object\]/gi)];
    objectMatches.forEach((match, index) => {
      structure.images.push({
        id: `docx_obj_${index}`,
        placeholder: match[0],
        description: `Embedded object ${index + 1}`,
        position: match.index,
        preserveInTranslation: true
      });
    });

    // Tables in DOCX might be preserved as tab-separated content
    const tableLines = text.split('\\n').filter(line => 
      line.includes('\\t') && line.split('\\t').length > 2
    );
    
    if (tableLines.length > 1) {
      structure.tables.push({
        id: 'docx_table_main',
        content: tableLines,
        needsTranslation: this.options.translateTableContent,
        format: 'tab-separated'
      });
    }

    return this.identifyTextRegions(text, structure);
  }

  /**
   * Handle plain text with identified structures
   */
  analyzeTextStructure(text, structure) {
    console.log('[DocumentStructure] Analyzing text structure');
    
    // Look for ASCII tables
    const asciiTables = this.detectASCIITables(text);
    structure.tables.push(...asciiTables);
    
    // Look for list structures
    const lists = this.detectLists(text);
    structure.specialElements.push(...lists);
    
    return this.identifyTextRegions(text, structure);
  }

  /**
   * Create chunks that respect document structure
   */
  async createStructureAwareChunks(text, structure) {
    const chunks = [];
    let currentPosition = 0;
    let chunkId = 0;

    // Sort all structural elements by position
    const allElements = [
      ...structure.images.map(img => ({ ...img, type: 'image' })),
      ...structure.tables.map(table => ({ ...table, type: 'table' })),
      ...structure.figures.map(fig => ({ ...fig, type: 'figure' }))
    ].sort((a, b) => (a.position || 0) - (b.position || 0));

    for (const element of allElements) {
      const elementPosition = element.position || text.indexOf(element.placeholder || element.text);
      
      if (elementPosition > currentPosition) {
        // Add text chunk before this element
        const textSegment = text.substring(currentPosition, elementPosition).trim();
        if (textSegment.length > 0) {
          chunks.push({
            id: chunkId++,
            text: textSegment,
            type: 'text',
            elementsBefore: [],
            elementsAfter: [element]
          });
        }
        currentPosition = elementPosition;
      }

      // Add the structural element as a special chunk
      chunks.push(this.createStructuralChunk(element, chunkId++));
      
      // Move position past this element
      if (element.placeholder) {
        currentPosition = elementPosition + element.placeholder.length;
      } else if (element.text) {
        currentPosition = elementPosition + element.text.length;
      }
    }

    // Add remaining text
    if (currentPosition < text.length) {
      const remainingText = text.substring(currentPosition).trim();
      if (remainingText.length > 0) {
        chunks.push({
          id: chunkId++,
          text: remainingText,
          type: 'text',
          elementsBefore: [],
          elementsAfter: []
        });
      }
    }

    return chunks;
  }

  /**
   * Create special chunk for structural elements
   */
  createStructuralChunk(element, id) {
    const baseChunk = {
      id,
      type: element.type,
      preserveInTranslation: element.preserveInTranslation || false,
      needsTranslation: element.needsTranslation || false,
      processingInstructions: []
    };

    switch (element.type) {
      case 'image':
        return {
          ...baseChunk,
          text: element.placeholder || `[IMAGE: ${element.description}]`,
          originalDescription: element.description,
          translationNote: 'Preserve image placeholder, translate description if caption',
          processingInstructions: [
            'preserve_placeholder',
            element.description ? 'translate_description' : 'preserve_description'
          ]
        };

      case 'table':
        return {
          ...baseChunk,
          text: element.placeholder || this.formatTableForTranslation(element),
          originalContent: element.content,
          format: element.format,
          translationNote: 'Preserve table structure, translate content if enabled',
          processingInstructions: [
            'preserve_structure',
            this.options.translateTableContent ? 'translate_content' : 'preserve_content'
          ]
        };

      case 'figure':
        return {
          ...baseChunk,
          text: element.text,
          figureNumber: element.number,
          translationNote: 'Translate figure reference maintaining number',
          processingInstructions: ['translate_text', 'preserve_number']
        };

      default:
        return {
          ...baseChunk,
          text: element.text || element.placeholder,
          translationNote: 'Handle as special element',
          processingInstructions: ['preserve_structure']
        };
    }
  }

  /**
   * Generate processing instructions for translators
   */
  generateProcessingInstructions(structure) {
    const instructions = {
      images: [],
      tables: [],
      specialHandling: [],
      preservationRules: []
    };

    if (structure.images.length > 0) {
      instructions.images.push(
        'Preserve all image placeholders exactly as they appear',
        'Translate image captions and descriptions if present',
        'Maintain image positioning references in text'
      );
    }

    if (structure.tables.length > 0) {
      instructions.tables.push(
        'Preserve table structure and formatting',
        this.options.translateTableContent ? 
          'Translate table content while preserving column alignment' : 
          'Preserve table content without translation',
        'Maintain table references and numbering'
      );
    }

    if (structure.figures.length > 0) {
      instructions.specialHandling.push(
        'Translate figure references while preserving numbers',
        'Maintain consistency in figure numbering throughout document'
      );
    }

    instructions.preservationRules.push(
      'Maintain document structure and visual hierarchy',
      'Preserve all placeholders for non-text elements',
      'Keep relative positioning of elements intact'
    );

    return instructions;
  }

  /**
   * Helper methods for structure detection
   */
  detectASCIITables(text) {
    const tables = [];
    const lines = text.split('\\n');
    let currentTable = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect table borders or consistent column separators
      if (this.isTableLine(line)) {
        if (!inTable) {
          inTable = true;
          currentTable = [line];
        } else {
          currentTable.push(line);
        }
      } else if (inTable && currentTable.length > 2) {
        // End of table
        tables.push({
          id: `ascii_table_${tables.length}`,
          content: currentTable,
          needsTranslation: this.options.translateTableContent,
          format: 'ascii',
          startLine: i - currentTable.length,
          endLine: i - 1
        });
        currentTable = [];
        inTable = false;
      } else if (inTable) {
        currentTable = [];
        inTable = false;
      }
    }

    return tables;
  }

  isTableLine(line) {
    // Check for common table patterns
    const trimmed = line.trim();
    
    // Table border lines
    if (/^[+\-|=\\s]+$/.test(trimmed)) return true;
    
    // Lines with multiple column separators
    if ((trimmed.match(/\\|/g) || []).length >= 2) return true;
    if ((trimmed.match(/\\t/g) || []).length >= 2) return true;
    
    // Consistent spacing patterns
    if (/\\s{3,}/.test(line) && (line.match(/\\s{3,}/g) || []).length >= 2) return true;
    
    return false;
  }

  detectLists(text) {
    const lists = [];
    const listPatterns = [
      /^\\s*[•·‣⁃]\\s+/gm,  // Bullet points
      /^\\s*\\d+[.):]\\s+/gm, // Numbered lists
      /^\\s*[a-zA-Z][.):]\\s+/gm, // Lettered lists
      /^\\s*[-*+]\\s+/gm // Dash/asterisk lists
    ];

    listPatterns.forEach((pattern, index) => {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 1) {
        lists.push({
          id: `list_${index}`,
          type: 'list',
          pattern: pattern.source,
          itemCount: matches.length,
          needsTranslation: true,
          preserveStructure: true
        });
      }
    });

    return lists;
  }

  identifyTextRegions(text, structure) {
    // Mark regions between structural elements as pure text
    const textRegions = [];
    let lastPosition = 0;

    const allPositions = [
      ...structure.images.map(img => img.position),
      ...structure.tables.map(table => table.position),
      ...structure.figures.map(fig => fig.position)
    ].filter(pos => pos !== undefined).sort((a, b) => a - b);

    for (const position of allPositions) {
      if (position > lastPosition) {
        textRegions.push({
          start: lastPosition,
          end: position,
          type: 'text',
          content: text.substring(lastPosition, position).trim()
        });
      }
      lastPosition = position;
    }

    // Add final text region
    if (lastPosition < text.length) {
      textRegions.push({
        start: lastPosition,
        end: text.length,
        type: 'text',
        content: text.substring(lastPosition).trim()
      });
    }

    structure.textRegions = textRegions.filter(region => region.content.length > 0);
    return structure;
  }

  formatTableForTranslation(table) {
    if (table.format === 'tab-separated' && table.content) {
      return table.content.join('\\n');
    } else if (table.placeholder) {
      return table.placeholder;
    } else {
      return `[TABLE: ${table.description || 'Table content'}]`;
    }
  }
}
