/**
 * Debug utility to diagnose the 2-segment duplication issue
 */

import fs from 'fs';
import { ProductionChunkingService } from './src/services/productionChunkingService.js';
import { reassembleDocument } from './src/services/postProcessing.js';

const chunker = new ProductionChunkingService({
  maxChunkSize: 1500,
  preserveParagraphStructure: true,
  splitAtSceneBreaks: true,
  splitAtChapterBreaks: true
});

// Test with the sample text that produces 2 segments
const testText = `Chapter 1: The Beginning

This is the first chapter of our test document. It contains some sample text to demonstrate the chapter extraction and chunking functionality. This paragraph is deliberately made longer to ensure that the document will be split into multiple chunks when processing, which will help us debug the 2-segment duplication issue that occurs specifically when documents are split into exactly two parts during the translation process.

Maria walked through the Royal Academy. The ancient halls echoed with the footsteps of countless scholars who had walked these paths before her. She carried a leather-bound notebook filled with observations from her travels. Each page contained detailed sketches and notes about the local customs she had encountered during her extensive journey across the continent.

The morning sun streamed through the tall windows, casting long shadows across the marble floors. Students and professors moved purposefully through the corridors, their conversations a mixture of scholarly debate and casual discussion about their research projects and ongoing studies.

Chapter 2: The Middle

This is the second chapter. It should be extracted separately from the first chapter and maintain proper ordering. The second chapter contains additional content that should ensure the document gets split into multiple chunks during processing, allowing us to test the specific scenario where documents are divided into exactly two segments.

She carried a leather-bound notebook filled with observations from her travels. Each page contained detailed sketches and notes about the local customs. The professor reviewed her work carefully, paying particular attention to the detailed illustrations and comprehensive notes that demonstrated her thorough understanding of the subject matter.

Her research methodology was particularly impressive, showing a deep understanding of both theoretical frameworks and practical applications. The combination of field observations and academic analysis created a comprehensive picture of the cultural phenomena she was studying.

Chapter 3: The End

This is the third chapter, which should come after the second chapter and not be duplicated. This final chapter serves as a conclusion to the test document and should maintain the proper sequence when the document is processed and reassembled after translation.

The professor smiled as he reviewed her work. "Your attention to detail is remarkable," he said, adjusting his glasses. "This level of scholarship represents exactly the kind of rigorous analysis we expect from our advanced students."

End of document.`;

console.log('=== DEBUGGING 2-SEGMENT ISSUE ===');
console.log(`Original text length: ${testText.length} characters`);

// Step 1: Test chunking
console.log('\n--- CHUNKING TEST ---');
const chunks = chunker.chunkDocument(testText);
console.log(`Generated ${chunks.length} chunks:`);

chunks.forEach((chunk, index) => {
  console.log(`\nChunk ${index}:`);
  console.log(`  ID: ${chunk.id}`);
  console.log(`  Type: ${chunk.type}`);
  console.log(`  Length: ${chunk.text.length} chars`);
  console.log(`  Chapter: ${chunk.metadata?.chapterNumber || 'N/A'}`);
  console.log(`  Chapter Part: ${chunk.metadata?.chapterPart || 'N/A'}`);
  console.log(`  Preview: "${chunk.text.substring(0, 100)}..."`);
});

// Step 2: Simulate translation (just copy the text for testing)
console.log('\n--- SIMULATED TRANSLATION ---');
const translatedChunks = chunks.map(chunk => ({
  ...chunk,
  translatedText: `[TRANSLATED] ${chunk.text}`
}));

console.log(`Translation created ${translatedChunks.length} chunks`);

// Step 3: Test reassembly
console.log('\n--- REASSEMBLY TEST ---');
try {
  const reassembled = await reassembleDocument(translatedChunks, 'test-document', 'txt');
  
  // Handle different possible return formats
  let content;
  if (typeof reassembled === 'string') {
    content = reassembled;
  } else if (reassembled && reassembled.content) {
    // Handle Buffer content
    content = reassembled.content instanceof Buffer ? 
      reassembled.content.toString('utf8') : 
      reassembled.content;
  } else if (reassembled && reassembled.translatedText) {
    content = reassembled.translatedText;
  } else {
    content = JSON.stringify(reassembled);
  }
  
  console.log(`Reassembled document length: ${content.length} characters`);
  
  // Check for duplication by looking for repeated sections
  const lines = content.split('\n');
  const duplicateLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].trim() && lines[i] === lines[j] && lines[i].length > 20) {
        duplicateLines.push({
          line: lines[i],
          positions: [i, j]
        });
      }
    }
  }
  
  if (duplicateLines.length > 0) {
    console.log('\n🚨 DUPLICATES DETECTED:');
    duplicateLines.forEach(dup => {
      console.log(`  Line "${dup.line.substring(0, 50)}..." appears at positions: ${dup.positions.join(', ')}`);
    });
  } else {
    console.log('\n✅ No duplicates detected in reassembly');
  }
  
  // Check for chapter ordering issues
  const chapterMatches = content.match(/Chapter \d+:/g);
  if (chapterMatches) {
    console.log(`\n📚 Chapters found: ${chapterMatches.join(', ')}`);
    
    // Check if chapters are in correct order
    for (let i = 1; i < chapterMatches.length; i++) {
      const prevNum = parseInt(chapterMatches[i-1].match(/\d+/)[0]);
      const currNum = parseInt(chapterMatches[i].match(/\d+/)[0]);
      if (currNum <= prevNum) {
        console.log(`🚨 Chapter ordering issue: ${chapterMatches[i-1]} followed by ${chapterMatches[i]}`);
      }
    }
  }
  
  // Write output for manual inspection
  fs.writeFileSync('./debug-output.txt', content);
  console.log('\n📝 Output written to debug-output.txt for manual inspection');
  
} catch (error) {
  console.error('\n❌ Reassembly failed:', error.message);
  console.error(error.stack);
}
