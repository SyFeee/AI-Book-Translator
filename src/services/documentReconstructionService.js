import fs from 'fs';
import path from 'path';

/**
 * Document Reconstruction Service
 * Uses the structure map to faithfully rebuild translated documents
 */
export class DocumentReconstructionService {
  constructor(options = {}) {
    this.options = {
      preserveOriginalFormatting: options.preserveOriginalFormatting !== false,
      outputFormats: options.outputFormats || ['txt', 'html', 'md'],
      assetsBaseUrl: options.assetsBaseUrl || './assets',
      ...options
    };
  }

  /**
   * Reconstruct document from translated chunks and structure map
   * @param {Array} translatedChunks - Translated text chunks with metadata
   * @param {Object} structureMap - Original document structure map
   * @param {string} outputFormat - Desired output format
   * @returns {Object} - Reconstructed document
   */
  async reconstructDocument(translatedChunks, structureMap, outputFormat = 'txt') {
    console.log(`[DocumentReconstruction] Reconstructing ${translatedChunks.length} chunks to ${outputFormat}`);
    
    // Step 1: Reassemble translated text in correct order
    const reassembledText = this.reassembleTranslatedText(translatedChunks, structureMap);
    
    // Step 2: Apply structural formatting based on structure map
    const formattedText = this.applyStructuralFormatting(reassembledText, structureMap, outputFormat);
    
    // Step 3: Reintegrate assets (images, tables, etc.)
    const finalDocument = await this.reintegrateAssets(formattedText, structureMap, outputFormat);
    
    // Step 4: Generate output with metadata
    return this.generateFinalOutput(finalDocument, structureMap, outputFormat);
  }

  /**
   * Reassemble translated chunks respecting original structure
   */
  reassembleTranslatedText(translatedChunks, structureMap) {
    console.log('[DocumentReconstruction] Reassembling translated text...');
    
    // Sort chunks by their original position/ID
    const sortedChunks = [...translatedChunks].sort((a, b) => {
      return (a.id || a.position || 0) - (b.id || b.position || 0);
    });
    
    let reconstructedText = '';
    let lastEndOffset = 0;
    
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const translatedText = chunk.translatedText || chunk.text || '';
      
      // Handle chunk boundaries based on structural information
      if (chunk.structuralInfo) {
        const spacing = this.determineChunkSpacing(chunk, sortedChunks[i - 1], sortedChunks[i + 1]);
        reconstructedText += spacing + translatedText;
      } else {
        // Default spacing for chunks without structural info
        if (i > 0) reconstructedText += '\n\n';
        reconstructedText += translatedText;
      }
      
      lastEndOffset = chunk.endOffset || lastEndOffset + translatedText.length;
    }
    
    return reconstructedText.trim();
  }

  /**
   * Determine appropriate spacing between chunks
   */
  determineChunkSpacing(currentChunk, previousChunk, nextChunk) {
    const current = currentChunk.structuralInfo;
    const previous = previousChunk?.structuralInfo;
    
    // Chapter boundaries
    if (current?.type === 'chapter' || current?.isCompleteChapter) {
      return previous ? '\n\n\n' : '';
    }
    
    // Scene breaks
    if (current?.type === 'scene' || current?.isCompleteScene) {
      return previous ? '\n\n' : '';
    }
    
    // Dialogue transitions
    if (current?.isDialogueHeavy && !previous?.isDialogueHeavy) {
      return previous ? '\n\n' : '';
    }
    
    // Partial paragraphs - minimal spacing
    if (current?.isPartialParagraph || current?.isPartialSentence) {
      return '';
    }
    
    // Default paragraph spacing
    return previous ? '\n\n' : '';
  }

  /**
   * Apply structural formatting based on output format
   */
  applyStructuralFormatting(text, structureMap, outputFormat) {
    console.log(`[DocumentReconstruction] Applying ${outputFormat} formatting...`);
    
    let formattedText = text;
    
    switch (outputFormat) {
      case 'html':
        formattedText = this.applyHtmlFormatting(text, structureMap);
        break;
      case 'md':
      case 'markdown':
        formattedText = this.applyMarkdownFormatting(text, structureMap);
        break;
      case 'txt':
      default:
        formattedText = this.applyPlainTextFormatting(text, structureMap);
        break;
    }
    
    return formattedText;
  }

  /**
   * Apply HTML formatting using structure map
   */
  applyHtmlFormatting(text, structureMap) {
    let html = text;
    
    // Convert structural tags
    html = html
      .replace(/<h1>(.*?)<\/h1>/g, '<h1 class="chapter-title">$1</h1>')
      .replace(/<h2>(.*?)<\/h2>/g, '<h2 class="section-title">$1</h2>')
      .replace(/<scene-break\/>/g, '<hr class="scene-break" />')
      .replace(/<dialogue>(.*?)<\/dialogue>/g, '<p class="dialogue">$1</p>')
      .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
      .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>');
    
    // Wrap paragraphs
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Skip if already has HTML tags
        if (p.startsWith('<h') || p.startsWith('<hr') || p.includes('<p class=')) {
          return p;
        }
        return `<p>${p}</p>`;
      })
      .join('\n\n');
    
    // Add HTML document structure
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Translated Document</title>
    <style>
        body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .chapter-title { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section-title { color: #666; margin-top: 30px; }
        .scene-break { border: none; border-top: 3px solid #ccc; width: 50%; margin: 30px auto; }
        .dialogue { margin-left: 20px; font-style: italic; }
    </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  /**
   * Apply Markdown formatting using structure map
   */
  applyMarkdownFormatting(text, structureMap) {
    let markdown = text;
    
    // Convert structural tags to Markdown
    markdown = markdown
      .replace(/<h1>(.*?)<\/h1>/g, '# $1')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1')
      .replace(/<scene-break\/>/g, '\n---\n')
      .replace(/<dialogue>(.*?)<\/dialogue>/g, '> $1')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<i>(.*?)<\/i>/g, '*$1*');
    
    return markdown;
  }

  /**
   * Apply plain text formatting
   */
  applyPlainTextFormatting(text, structureMap) {
    let plainText = text;
    
    // Convert structural tags to plain text equivalents
    plainText = plainText
      .replace(/<h1>(.*?)<\/h1>/g, '\n$1\n' + '='.repeat(50))
      .replace(/<h2>(.*?)<\/h2>/g, '\n$1\n' + '-'.repeat(30))
      .replace(/<scene-break\/>/g, '\n\n* * *\n\n')
      .replace(/<dialogue>(.*?)<\/dialogue>/g, '$1')
      .replace(/<b>(.*?)<\/b>/g, '$1')
      .replace(/<i>(.*?)<\/i>/g, '$1')
      .replace(/<[^>]+>/g, ''); // Remove any remaining tags
    
    return plainText;
  }

  /**
   * Reintegrate assets (images, tables, footnotes)
   */
  async reintegrateAssets(formattedText, structureMap, outputFormat) {
    console.log('[DocumentReconstruction] Reintegrating assets...');
    
    let textWithAssets = formattedText;
    const { assets } = structureMap;
    
    // Reintegrate images
    if (assets.images && assets.images.length > 0) {
      textWithAssets = await this.reintegrateImages(textWithAssets, assets.images, outputFormat);
    }
    
    // Reintegrate tables
    if (assets.tables && assets.tables.length > 0) {
      textWithAssets = await this.reintegrateTables(textWithAssets, assets.tables, outputFormat);
    }
    
    // Reintegrate footnotes
    if (assets.footnotes && assets.footnotes.length > 0) {
      textWithAssets = await this.reintegrateFootnotes(textWithAssets, assets.footnotes, outputFormat);
    }
    
    return textWithAssets;
  }

  /**
   * Reintegrate images based on output format
   */
  async reintegrateImages(text, images, outputFormat) {
    let result = text;
    
    for (const image of images) {
      const placeholder = `[IMAGE:${image.id}]`;
      let replacement = '';
      
      switch (outputFormat) {
        case 'html':
          replacement = `<img src="${this.options.assetsBaseUrl}/img/${image.id}" alt="Image ${image.id}" class="document-image" />`;
          break;
        case 'md':
        case 'markdown':
          replacement = `![Image ${image.id}](${this.options.assetsBaseUrl}/img/${image.id})`;
          break;
        case 'txt':
        default:
          replacement = `[Image: ${image.id}]`;
          break;
      }
      
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    return result;
  }

  /**
   * Reintegrate tables based on output format
   */
  async reintegrateTables(text, tables, outputFormat) {
    let result = text;
    
    for (const table of tables) {
      const startPlaceholder = `[TABLE:${table.id}]`;
      const endPlaceholder = `[/TABLE:${table.id}]`;
      
      // Find the table content between placeholders
      const tableRegex = new RegExp(`\\[TABLE:${table.id}\\]([\\s\\S]*?)\\[\\/TABLE:${table.id}\\]`, 'g');
      const match = tableRegex.exec(result);
      
      if (match) {
        let replacement = '';
        const tableContent = match[1].trim();
        
        switch (outputFormat) {
          case 'html':
            replacement = this.convertMarkdownTableToHtml(tableContent);
            break;
          case 'md':
          case 'markdown':
            replacement = tableContent; // Already in Markdown format
            break;
          case 'txt':
          default:
            replacement = this.convertMarkdownTableToPlainText(tableContent);
            break;
        }
        
        result = result.replace(match[0], replacement);
      }
    }
    
    return result;
  }

  /**
   * Reintegrate footnotes
   */
  async reintegrateFootnotes(text, footnotes, outputFormat) {
    let result = text;
    let footnoteSection = '';
    
    for (let i = 0; i < footnotes.length; i++) {
      const footnote = footnotes[i];
      const placeholder = `«NOTE id=${footnote.id}»${footnote.text}«/NOTE»`;
      
      let replacement = '';
      const footnoteNumber = i + 1;
      
      switch (outputFormat) {
        case 'html':
          replacement = `<sup><a href="#fn${footnoteNumber}" id="ref${footnoteNumber}">${footnoteNumber}</a></sup>`;
          footnoteSection += `<p id="fn${footnoteNumber}"><sup>${footnoteNumber}</sup> ${footnote.text} <a href="#ref${footnoteNumber}">↩</a></p>\n`;
          break;
        case 'md':
        case 'markdown':
          replacement = `[^${footnoteNumber}]`;
          footnoteSection += `[^${footnoteNumber}]: ${footnote.text}\n`;
          break;
        case 'txt':
        default:
          replacement = `[${footnoteNumber}]`;
          footnoteSection += `[${footnoteNumber}] ${footnote.text}\n`;
          break;
      }
      
      result = result.replace(placeholder, replacement);
    }
    
    // Add footnotes section at the end
    if (footnoteSection) {
      const sectionTitle = outputFormat === 'html' ? '<h2>Notes</h2>' : 
                          outputFormat === 'md' ? '## Notes' : '\n\nNotes:\n' + '-'.repeat(20);
      result += '\n\n' + sectionTitle + '\n' + footnoteSection;
    }
    
    return result;
  }

  /**
   * Generate final output with metadata
   */
  generateFinalOutput(finalDocument, structureMap, outputFormat) {
    const fileExtension = this.getFileExtension(outputFormat);
    const mimeType = this.getMimeType(outputFormat);
    
    // Generate filename
    const baseName = path.basename(structureMap.originalFile, path.extname(structureMap.originalFile));
    const fileName = `${baseName}_translated.${fileExtension}`;
    
    return {
      content: Buffer.from(finalDocument, 'utf8'),
      fileName,
      mimeType,
      metadata: {
        originalFile: structureMap.originalFile,
        outputFormat,
        reconstructionTimestamp: new Date().toISOString(),
        structureMapVersion: structureMap.version,
        assetCounts: {
          images: structureMap.assets?.images?.length || 0,
          tables: structureMap.assets?.tables?.length || 0,
          footnotes: structureMap.assets?.footnotes?.length || 0
        },
        wordCount: finalDocument.split(/\s+/).length,
        characterCount: finalDocument.length
      }
    };
  }

  // Helper methods

  convertMarkdownTableToHtml(markdownTable) {
    const lines = markdownTable.trim().split('\n');
    let html = '<table class="document-table">\n';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
        const tag = i === 0 ? 'th' : 'td';
        
        html += '  <tr>\n';
        cells.forEach(cell => {
          html += `    <${tag}>${cell}</${tag}>\n`;
        });
        html += '  </tr>\n';
      }
    }
    
    html += '</table>';
    return html;
  }

  convertMarkdownTableToPlainText(markdownTable) {
    return markdownTable
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getFileExtension(outputFormat) {
    const extensions = {
      'html': 'html',
      'md': 'md',
      'markdown': 'md',
      'txt': 'txt'
    };
    return extensions[outputFormat] || 'txt';
  }

  getMimeType(outputFormat) {
    const mimeTypes = {
      'html': 'text/html',
      'md': 'text/markdown',
      'markdown': 'text/markdown',
      'txt': 'text/plain'
    };
    return mimeTypes[outputFormat] || 'text/plain';
  }
}

export default DocumentReconstructionService;
