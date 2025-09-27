#!/usr/bin/env node

// Test script to verify translation fixes
import { translateText } from './src/services/translation.js';

console.log('Testing translation fixes...\n');

const testText = `Branding fashion through gameplay: the branded gaming and the cool dynamics in the fashion markets.

A game-theory approach

Alshaimaa Bahgat Alanadoly
The Design School, Faculty of Innovation and Technology, Taylor's University Lakeside Campus, Subang Jaya, Malaysia, and

Suha Fouad Salem
Royal Docks School of Business and Law, University of East London, London, UK`;

console.log('Original text (first 200 chars):');
console.log(testText.substring(0, 200) + '...\n');

try {
  console.log('Starting translation test...');
  const translation = await translateText(testText, 'en', 'es');
  
  console.log('\n--- TRANSLATION RESULT ---');
  console.log('Length:', translation.length);
  console.log('First 300 chars:');
  console.log(translation.substring(0, 300));
  console.log('\n--- END RESULT ---');
  
  // Check for common issues
  const issues = [];
  if (translation.includes('<TRANSLATION>')) {
    issues.push('Contains <TRANSLATION> tags');
  }
  if (translation.includes('here\'s the translation') || translation.includes('Here\'s the translation')) {
    issues.push('Contains unwanted prefix text');
  }
  if (translation.includes('Okay,')) {
    issues.push('Contains "Okay," prefix');
  }
  if (translation.length === 0) {
    issues.push('Empty translation');
  }
  
  if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => console.log('  -', issue));
  } else {
    console.log('\n✅ TRANSLATION LOOKS CLEAN!');
  }
  
} catch (error) {
  console.error('❌ Translation failed:', error.message);
}
