#!/usr/bin/env node

/**
 * Quick test to verify chunking is working
 */

import { ProductionChunkingService } from './src/services/productionChunkingService.js';

async function testChunking() {
  console.log('🧪 Testing basic chunking functionality...\n');
  
  const chunker = new ProductionChunkingService();
  
  const testText = `
# Chapter 1: The Beginning

This is the first paragraph of our test document. It contains some meaningful content that should be properly chunked and processed.

This is the second paragraph. It continues the narrative and provides additional context for our translation system.

# Chapter 2: The Continuation  

Here we have a new chapter that should be detected by the chapter-based chunking system.

This paragraph belongs to chapter 2 and should be grouped accordingly.
  `;

  try {
    const result = await chunker.chunkDocument(testText.trim());
    
    console.log('✅ Chunking Result:');
    console.log(`   Type: ${Array.isArray(result) ? 'Array' : 'Object'}`);
    
    if (Array.isArray(result)) {
      console.log(`   Chunks: ${result.length}`);
      result.forEach((chunk, index) => {
        const text = chunk.text || chunk;
        console.log(`   Chunk ${index + 1}: "${text.substring(0, 50)}..."`);
      });
    } else if (result && result.chunks) {
      console.log(`   Chunks: ${result.chunks.length}`);
      console.log(`   Strategy: ${result.strategy || 'unknown'}`);
      result.chunks.forEach((chunk, index) => {
        const text = chunk.text || chunk;
        console.log(`   Chunk ${index + 1}: "${text.substring(0, 50)}..."`);
      });
    } else {
      console.log('   ❌ Unexpected result format:', typeof result);
      console.log('   Result:', result);
    }
    
  } catch (error) {
    console.log('❌ Chunking failed:', error.message);
    console.log('Error details:', error);
  }
}

testChunking().catch(console.error);
