import fs from 'fs';
import path from 'path';
import docx from 'docx';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Create temporary directory for file processing
const TMP_DIR = path.join(tmpdir(), 'ai-translator-exports');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Exports translated text as a TXT file
 * @param {string} text - The translated text content
 * @param {string} filename - The filename to use (without extension)
 * @returns {Promise<string>} - Path to the exported file
 */
export async function exportAsTxt(text, filename) {
  const outputPath = path.join(TMP_DIR, `${filename}-${uuidv4()}.txt`);
  await fs.promises.writeFile(outputPath, text, 'utf8');
  return outputPath;
}

/**
 * Exports translated text as a DOCX file
 * @param {string} text - The translated text content
 * @param {string} filename - The filename to use (without extension)
 * @returns {Promise<string>} - Path to the exported file
 */
export async function exportAsDocx(text, filename) {
  try {
    const outputPath = path.join(TMP_DIR, `${filename}-${uuidv4()}.docx`);
    
    // Split text into paragraphs
    const paragraphs = text.split(/\r?\n\r?\n/).filter(p => p.trim().length > 0);
    
    // Create document
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: paragraphs.map(paragraph => {
          return new docx.Paragraph({
            text: paragraph,
            spacing: {
              after: 200,
            }
          });
        }),
      }],
    });
    
    // Write document to file
    const buffer = await docx.Packer.toBuffer(doc);
    await fs.promises.writeFile(outputPath, buffer);
    
    return outputPath;
  } catch (error) {
    console.error('Error creating DOCX file:', error);
    throw new Error(`Failed to create DOCX file: ${error.message}`);
  }
}

/**
 * Exports translated text as a PDF file
 * @param {string} text - The translated text content
 * @param {string} filename - The filename to use (without extension)
 * @returns {Promise<string>} - Path to the exported file
 */
export async function exportAsPdf(text, filename) {
  return new Promise((resolve, reject) => {
    try {
      const outputPath = path.join(TMP_DIR, `${filename}-${uuidv4()}.pdf`);
      const doc = new PDFDocument();
      const stream = createWriteStream(outputPath);
      
      // Handle stream events
      stream.on('finish', () => {
        resolve(outputPath);
      });
      
      stream.on('error', (err) => {
        reject(new Error(`PDF stream error: ${err.message}`));
      });
      
      doc.pipe(stream);
      
      // Split text into paragraphs
      const paragraphs = text.split(/\r?\n\r?\n/).filter(p => p.trim().length > 0);
      
      // Add metadata
      doc.info.Title = `Translated: ${filename}`;
      doc.info.Author = 'AI Translator';
      doc.info.Creator = 'AI Translator';
      
      // Add title
      doc.fontSize(16).text(`${filename} (Translated)`, {
        align: 'center',
        underline: true
      });
      
      doc.moveDown();
      
      // Add content
      doc.fontSize(12);
      paragraphs.forEach(paragraph => {
        doc.text(paragraph, {
          align: 'left',
          indent: 20,
          lineGap: 5
        });
        doc.moveDown();
      });
      
      // Finalize the PDF
      doc.end();
    } catch (error) {
      console.error('Error creating PDF file:', error);
      reject(new Error(`Failed to create PDF file: ${error.message}`));
    }
  });
}

/**
 * Exports translated text in the specified format
 * @param {string} text - The translated text content
 * @param {string} format - The format to export to (txt, docx, pdf)
 * @param {string} filename - The filename to use (without extension)
 * @returns {Promise<string>} - Path to the exported file
 */
export async function exportTranslation(text, format, filename) {
  const baseName = path.basename(filename, path.extname(filename));
  
  switch (format.toLowerCase()) {
    case 'txt':
      return exportAsTxt(text, baseName);
    case 'docx':
      return exportAsDocx(text, baseName);
    case 'pdf':
      return exportAsPdf(text, baseName);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Clean up temporary files older than the specified age
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
export async function cleanupTempFiles(maxAgeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = await fs.promises.readdir(TMP_DIR);
    
    for (const file of files) {
      const filePath = path.join(TMP_DIR, file);
      const stats = await fs.promises.stat(filePath);
      const fileAge = now - stats.mtimeMs;
      
      if (fileAge > maxAgeMs) {
        await fs.promises.unlink(filePath);
        console.log(`Deleted old temp file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
}
