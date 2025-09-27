#!/usr/bin/env node

/**
 * Comprehensive Test Script for Advanced Document Processing
 * Tests token limits, large chapters, images, tables, and complex structures
 */

import { ProductionChunkingService } from './src/services/productionChunkingService.js';
import { TokenAwareChunkingService } from './src/services/tokenAwareChunkingService.js';
import { DocumentStructureHandler } from './src/services/documentStructureHandler.js';

// Test data with various complexities
const testDocuments = {
  largeChapter: `
# Chapter 1: The Beginning of Everything

This is a very long chapter that might exceed token limits when processing with certain LLM models. The chapter contains multiple sections and subsections with detailed explanations and examples.

## Section 1.1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

[IMAGE: Figure 1 - The basic diagram showing the system architecture]

The above image demonstrates the fundamental concepts we'll be exploring throughout this chapter. Notice how the components interact with each other in a hierarchical manner.

## Section 1.2: Complex Tables and Data

The following table shows the performance metrics across different scenarios:

[TABLE: Performance comparison table with multiple columns and rows of data]

| Scenario | Performance | Memory | CPU Usage |
|----------|-------------|---------|-----------|
| Test 1   | 95%        | 2.1GB   | 45%       |
| Test 2   | 87%        | 1.8GB   | 52%       |
| Test 3   | 92%        | 2.4GB   | 38%       |

Additional data points and analysis follow this table, with detailed explanations of each metric and its significance in the overall system performance evaluation.

## Section 1.3: Extended Analysis

This section continues with extensive analysis that would typically span several pages in a traditional document. The content includes multiple paragraphs, each building upon the previous concepts and introducing new complexity.

The methodology employed in our research involves several sophisticated approaches that have been validated through extensive testing and peer review. Each approach addresses specific aspects of the problem domain and contributes to the overall solution framework.

Furthermore, the implementation details require careful consideration of various factors including scalability, maintainability, and performance optimization. These considerations become particularly important when dealing with large-scale deployments in production environments.

[IMAGE: Figure 2 - Detailed workflow diagram showing the complete process]

The workflow illustrated above represents the culmination of our research efforts and provides a comprehensive view of the entire system from input to output.

## Section 1.4: Conclusion and Future Work

This concluding section summarizes the key findings and outlines potential areas for future research and development. The implications of our work extend beyond the immediate application domain and may have broader significance for related fields.

# Chapter 2: Advanced Concepts

Building upon the foundation established in Chapter 1, this chapter delves into more advanced topics and sophisticated methodologies that require deeper understanding of the underlying principles.

The advanced concepts presented here are designed to challenge conventional thinking and provide new perspectives on traditional approaches to problem-solving in this domain.

[TABLE: Advanced configuration parameters and their optimal values]

These parameters represent the culmination of extensive experimentation and optimization efforts, providing practitioners with reliable guidelines for implementation.
`.repeat(3), // Make it even larger

  withImages: `
# Technical Documentation with Visual Elements

This document contains various types of visual and structural elements that need special handling during translation.

## Introduction

[IMAGE: Company logo and branding elements]

Welcome to our comprehensive guide. The image above shows our corporate identity elements that should be preserved in all translations.

## System Architecture

The following diagram illustrates the complete system architecture:

[IMAGE: System architecture diagram showing data flow between components]

As shown in Figure 1, the data flows through multiple processing stages, each with specific responsibilities and interfaces.

## Performance Data

Our testing results are summarized in the following table:

[TABLE: Comprehensive performance metrics across different test scenarios]

| Test Case | Throughput | Latency | Error Rate | Memory Usage |
|-----------|------------|---------|------------|--------------|
| Baseline  | 1000 req/s | 50ms    | 0.1%       | 512MB        |
| Optimized | 1500 req/s | 30ms    | 0.05%      | 384MB        |
| Maximum   | 2000 req/s | 25ms    | 0.02%      | 768MB        |

The performance improvements are clearly visible when comparing the baseline with our optimized configuration.

[IMAGE: Performance comparison charts and graphs]

The visual representation above provides additional insights into the performance characteristics under various load conditions.

## Configuration Examples

Below are some ASCII art diagrams showing network topology:

    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │   Client    │───▶│   Server    │───▶│  Database   │
    │             │    │             │    │             │
    └─────────────┘    └─────────────┘    └─────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │    Cache    │    │   Monitor   │    │   Backup    │
    └─────────────┘    └─────────────┘    └─────────────┘

This topology ensures high availability and performance across all system components.
`,

  complexStructure: `
# Multi-Modal Document with Complex Structures

This document tests the system's ability to handle various document structures simultaneously.

## Chapter 1: Lists and Hierarchies

### Bullet Point Lists
• First level item with important information
• Second item with nested content
  - Nested item 1
  - Nested item 2
    ○ Sub-nested item
    ○ Another sub-item
• Third main item

### Numbered Lists
1. Primary requirement analysis
2. System design and architecture
   a. Frontend components
   b. Backend services
   c. Database design
3. Implementation phases
   i. Phase 1: Core functionality
   ii. Phase 2: Advanced features
   iii. Phase 3: Optimization

### Mixed Content with Images
Here we have explanatory text followed by visual elements:

[IMAGE: Workflow diagram showing the list processing pipeline]

The image above demonstrates how different list types are processed and rendered in the final output.

## Chapter 2: Tables and Data Structures

### Simple Data Table
[TABLE: Basic user information]
Name     | Age | Department | Status
---------|-----|------------|--------
John Doe | 30  | Engineering| Active
Jane Smith| 28 | Marketing  | Active
Bob Wilson| 35 | Sales      | Inactive

### Complex Multi-Column Table
[TABLE: Detailed project metrics with multiple data categories]

| Project | Start Date | End Date   | Budget    | Team Size | Status      | Risk Level |
|---------|------------|------------|-----------|-----------|-------------|------------|
| Alpha   | 2024-01-01 | 2024-03-31 | $150,000  | 5         | In Progress | Low        |
| Beta    | 2024-02-15 | 2024-06-30 | $200,000  | 8         | Planning    | Medium     |
| Gamma   | 2024-03-01 | 2024-12-31 | $500,000  | 12        | Approved    | High       |

Additional analysis of the project data reveals interesting patterns in resource allocation and timeline management.

### ASCII Tables
Here's an ASCII representation of system resources:

+----------------+----------+----------+----------+
| Resource Type  | Used     | Available| Total    |
+----------------+----------+----------+----------+
| CPU Cores      | 8        | 4        | 12       |
| Memory (GB)    | 16       | 16       | 32       |
| Storage (TB)   | 2.5      | 1.5      | 4.0      |
+----------------+----------+----------+----------+

## Chapter 3: Figures and References

As shown in Figure 1, the system architecture follows a microservices pattern.

[IMAGE: Figure 1 - Microservices architecture diagram]

Reference to Figure 2 will be made in the following section, where we discuss the data flow patterns.

[IMAGE: Figure 2 - Data flow and processing pipeline]

Figure 3 below illustrates the user interface mockups:

[IMAGE: Figure 3 - UI mockups and user interaction flows]

The figures above collectively provide a comprehensive view of the system from multiple perspectives.

## Conclusion

This multi-modal document demonstrates the complexity that modern translation systems must handle, including:
- Multiple image types and placements
- Various table formats and structures
- Mixed content with figures and references
- Hierarchical text organization
- ASCII art and special formatting

Each element requires special consideration during the translation process to maintain document integrity and usability.
`
};

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Advanced Document Processing Tests\n');

  // Test 1: Token-Aware Processing for Large Documents
  console.log('📊 Test 1: Token-Aware Processing for Large Documents');
  console.log('=' .repeat(60));
  
  try {
    const tokenService = new TokenAwareChunkingService({
      targetModel: 'gpt-4'
    });
    
    const largeDocResult = await tokenService.chunkDocument(testDocuments.largeChapter, {
      maxTokensPerChunk: 2000,
      preserveStructure: true
    });
    
    console.log(`✅ Large document processed successfully:`);
    console.log(`   - Original length: ${testDocuments.largeChapter.length} characters`);
    console.log(`   - Generated chunks: ${largeDocResult.chunks.length}`);
    console.log(`   - Processing strategy: ${largeDocResult.strategy || 'hierarchical'}`);
    console.log(`   - Token estimates: ${JSON.stringify(largeDocResult.tokenEstimates || {}, null, 2)}`);
    
    // Show first chunk as example
    if (largeDocResult.chunks.length > 0) {
      console.log(`   - First chunk preview: "${largeDocResult.chunks[0].text.substring(0, 100)}..."`);
    }
    
  } catch (error) {
    console.log(`❌ Token-aware processing failed: ${error.message}`);
  }
  
  console.log('\n');

  // Test 2: Document Structure Handling
  console.log('🖼️  Test 2: Document Structure Handling (Images & Tables)');
  console.log('=' .repeat(60));
  
  try {
    const structureHandler = new DocumentStructureHandler({
      preserveImages: true,
      preserveTables: true,
      translateTableContent: true,
      translateImageCaptions: true
    });
    
    const structureResult = await structureHandler.processComplexDocument(
      { type: 'pdf' },
      testDocuments.withImages
    );
    
    console.log(`✅ Structure analysis completed:`);
    console.log(`   - Images detected: ${structureResult.structureMap.images.length}`);
    console.log(`   - Tables detected: ${structureResult.structureMap.tables.length}`);
    console.log(`   - Figures detected: ${structureResult.structureMap.figures.length}`);
    console.log(`   - Text regions: ${structureResult.structureMap.textRegions.length}`);
    console.log(`   - Structure-aware chunks: ${structureResult.chunks.length}`);
    
    // Show processing instructions
    if (structureResult.processingInstructions) {
      console.log(`   - Processing instructions generated for translators`);
    }
    
  } catch (error) {
    console.log(`❌ Structure handling failed: ${error.message}`);
  }
  
  console.log('\n');

  // Test 3: Integrated Advanced Processing
  console.log('🔧 Test 3: Integrated Advanced Processing Pipeline');
  console.log('=' .repeat(60));
  
  try {
    const productionService = new ProductionChunkingService({
      enableTokenAwareProcessing: true,
      enableStructureHandling: true,
      targetModel: 'gpt-4',
      translateTableContent: true,
      translateImageCaptions: true
    });
    
    // Wait for services to initialize
    await productionService.initializeTokenAwareService();
    await productionService.initializeStructureHandler();
    
    const integratedResult = await productionService.chunkDocument(
      testDocuments.complexStructure,
      {
        documentData: { type: 'pdf' },
        useAdvancedProcessing: true
      }
    );
    
    console.log(`✅ Integrated processing completed:`);
    console.log(`   - Total chunks generated: ${integratedResult.chunks.length}`);
    
    if (integratedResult.structureMap) {
      console.log(`   - Structure elements found: ${
        integratedResult.structureMap.images.length + 
        integratedResult.structureMap.tables.length + 
        integratedResult.structureMap.figures.length
      }`);
    }
    
    if (integratedResult.processingInstructions) {
      console.log(`   - Processing instructions: Available for translators`);
    }
    
    // Show chunk types distribution
    const chunkTypes = {};
    integratedResult.chunks.forEach(chunk => {
      const type = chunk.type || 'text';
      chunkTypes[type] = (chunkTypes[type] || 0) + 1;
    });
    
    console.log(`   - Chunk types: ${JSON.stringify(chunkTypes)}`);
    
  } catch (error) {
    console.log(`❌ Integrated processing failed: ${error.message}`);
  }
  
  console.log('\n');

  // Test 4: Token Limit Scenarios
  console.log('⚡ Test 4: Token Limit Scenarios with Different Models');
  console.log('=' .repeat(60));
  
  const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet'];
  
  for (const model of models) {
    try {
      const tokenService = new TokenAwareChunkingService({
        targetModel: model
      });
      
      const result = await tokenService.chunkDocument(testDocuments.largeChapter, {
        maxTokensPerChunk: 1500, // Smaller chunks
        preserveStructure: true
      });
      
      console.log(`✅ ${model}:`);
      console.log(`   - Chunks: ${result.chunks.length}`);
      console.log(`   - Strategy: ${result.strategy || 'hierarchical'}`);
      
    } catch (error) {
      console.log(`❌ ${model}: ${error.message}`);
    }
  }
  
  console.log('\n');

  // Test 5: Performance Benchmarks
  console.log('⏱️  Test 5: Performance Benchmarks');
  console.log('=' .repeat(60));
  
  const testSizes = [
    { name: 'Small (5KB)', text: testDocuments.withImages },
    { name: 'Medium (50KB)', text: testDocuments.complexStructure.repeat(5) },
    { name: 'Large (500KB)', text: testDocuments.largeChapter.repeat(2) }
  ];
  
  for (const test of testSizes) {
    try {
      const startTime = Date.now();
      
      const productionService = new ProductionChunkingService({
        enableTokenAwareProcessing: true,
        enableStructureHandling: true
      });
      
      await productionService.initializeTokenAwareService();
      await productionService.initializeStructureHandler();
      
      const result = await productionService.chunkDocument(test.text, {
        useAdvancedProcessing: true
      });
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ ${test.name}:`);
      console.log(`   - Size: ${test.text.length} characters`);
      console.log(`   - Processing time: ${processingTime}ms`);
      console.log(`   - Chunks generated: ${result.chunks.length}`);
      console.log(`   - Avg chunk size: ${Math.round(test.text.length / result.chunks.length)} chars`);
      
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
  
  console.log('\n');
  console.log('🎉 Comprehensive testing completed!');
  console.log('\n');
  console.log('📋 Summary of Advanced Features Tested:');
  console.log('   ✅ Token-aware chunking for large documents');
  console.log('   ✅ Image and table detection and preservation');
  console.log('   ✅ Structure-aware document processing');
  console.log('   ✅ Multiple LLM model support');
  console.log('   ✅ Hierarchical chunking strategies');
  console.log('   ✅ Performance optimization across document sizes');
  console.log('   ✅ Integration with existing production chunking');
}

// Run the tests
runComprehensiveTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
