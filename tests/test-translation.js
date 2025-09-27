import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import services manually
import { processDocument } from './src/services/documentProcessing.js';
import { translateChunks } from './src/services/translation.js';
import { reassembleDocument } from './src/services/postProcessing.js';

async function testTranslation() {
  console.log('Starting test translation...');
  const testFile = './test-doc.txt';
  
  // Mock file object
  const file = {
    name: 'test-doc.txt',
    tempFilePath: testFile,
    size: fs.statSync(testFile).size
  };
  
  try {
    // Process the document
    console.log('Processing document...');
    const { chunks } = await processDocument(file);
    console.log(`Document processed into ${chunks.length} chunks`);
    
    console.log('\nChunk details:');
    chunks.forEach((chunk, i) => {
      console.log(`Chunk ${i+1}: ${chunk.text.length} chars, isPartial: ${chunk.isPartialParagraph || false}`);
      console.log(`Preview: ${chunk.text.substring(0, 100)}...`);
    });
    
    // Translate chunks
    console.log('\nTranslating chunks...');
    const translatedChunks = await translateChunks(
      chunks,
      'English',
      'Spanish',
      {
        preserveFormatting: true,
        contextWindow: 2,
        onProgress: (info) => {
          console.log(`Translation progress: ${info.percentage}%`);
        }
      }
    );
    
    console.log('\nTranslation Results:');
    translatedChunks.forEach((chunk, i) => {
      if (typeof chunk === 'string') {
        console.log(`Chunk ${i+1}: ${chunk.length} chars`);
        console.log(`Preview: ${chunk.substring(0, 100)}...`);
      } else {
        console.log(`Chunk ${i+1}: ${chunk.translatedText?.length || 0} chars`);
        console.log(`Preview: ${chunk.translatedText?.substring(0, 100) || 'No translated text'}...`);
      }
    });
    
    // Reassemble document
    console.log('\nReassembling document...');
    const mappedChunks = chunks.map((chunk, i) => {
      return {
        ...chunk,
        translatedText: typeof translatedChunks[i] === 'string' ? 
          translatedChunks[i] : 
          translatedChunks[i]?.translatedText || '[Translation error]'
      };
    });
    
    const result = await reassembleDocument(
      mappedChunks,
      'test-doc.txt',
      'txt'
    );
    
    // Write result to file
    fs.writeFileSync('./test-doc_translated.txt', result.content);
    console.log(`\nTranslation complete! Saved to test-doc_translated.txt (${result.content.length} bytes)`);
    console.log(`Preview of final translation: ${result.content.toString().substring(0, 500)}...`);
  } catch (error) {
    console.error('Error during translation test:', error);
  }
}

// Run the test
testTranslation();
