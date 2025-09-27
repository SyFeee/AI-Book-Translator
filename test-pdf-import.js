#!/usr/bin/env node

import fs from 'fs';

async function testPdfParse() {
  try {
    console.log('Testing pdf-parse import...');
    const pdfParse = (await import('pdf-parse')).default;
    console.log('✅ pdf-parse imported successfully:', typeof pdfParse);
    
    // Test with a minimal PDF buffer (empty for now)
    console.log('pdf-parse function available and ready to use');
    
  } catch (error) {
    console.log('❌ pdf-parse import failed:', error.message);
    console.log('Error details:', error);
  }
}

testPdfParse();
