/**
 * Example usage of Streaming Stabilizer utility
 */

import { createStreamingStabilizer, processStreamWithStabilization } from '../src/utils/streaming.js';

// Example 1: Basic JSON streaming stabilization
async function basicStabilizationExample() {
  console.log('=== Basic Streaming Stabilization Example ===');
  
  const stabilizer = createStreamingStabilizer({
    maxBufferSize: 5000,
    enableProgressiveRepair: true,
  });

  // Simulate streaming JSON chunks
  const chunks = [
    '{"name": "John", "age": 30, "',
    'city": "New York", "interests": ["rea',
    'ding", "coding", "music"]}',
  ];

  console.log('Processing chunks:');
  
  for (const chunk of chunks) {
    console.log(`📦 Chunk: "${chunk}"`);
    
    const result = await stabilizer.processChunk(chunk);
    
    if (result.success) {
      console.log('✅ Stabilized JSON:', JSON.stringify(result.data, null, 2));
      console.log('📊 Is complete:', result.isComplete);
      
      if (result.isComplete) {
        stabilizer.reset();
        break;
      }
    } else {
      console.log('⏳ Buffering... (length:', stabilizer.getBuffer().length, ')');
    }
  }
}

// Example 2: Custom validation with stabilization
async function validationExample() {
  console.log('\n=== Validation Example ===');
  
  // Custom validation function
  const validatePerson = (data: any) => {
    return (
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      typeof data.age === 'number' &&
      data.age >= 0 && data.age <= 150
    );
  };

  const stabilizer = createStreamingStabilizer({
    validateFn: validatePerson,
    enableProgressiveRepair: true,
  });

  // Simulate malformed JSON chunks
  const malformedChunks = [
    '{"name": "Alice", "age": 25, "',
    'city": "Boston", "hobbies": ["painting", "',
    'hiking"]', // Missing closing brace
  ];

  for (const chunk of malformedChunks) {
    console.log(`📦 Chunk: "${chunk}"`);
    
    const result = await stabilizer.processChunk(chunk);
    
    if (result.success) {
      console.log('✅ Valid JSON:', JSON.stringify(result.data, null, 2));
      console.log('📊 Validation passed');
    } else {
      console.log('❌', result.error);
    }
  }
}

// Example 3: Processing async iterator with stabilization
async function asyncIteratorExample() {
  console.log('\n=== Async Iterator Example ===');
  
  // Simulate async stream of responses
  async function* mockStream() {
    const responses = [
      { content: '{"products": [' },
      { content: '{"id": 1, "name": "Laptop", ' },
      { content: '"price": 999.99, "category": ' },
      { content: '"Electronics"}]}' },
    ];
    
    for (const response of responses) {
      yield response;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const validateProduct = (data: any) => {
    return (
      Array.isArray(data.products) &&
      data.products.length > 0 &&
      data.products.every((p: any) => 
        typeof p.id === 'number' && 
        typeof p.name === 'string'
      )
    );
  };

  console.log('Processing stream with stabilization:');
  
  for await (const result of processStreamWithStabilization(
    mockStream(),
    (item) => item.content,
    { validateFn: validateProduct }
  )) {
    if (result.success) {
      console.log('✅ Stabilized product data:', JSON.stringify(result.data, null, 2));
      console.log('📊 Original chunk:', result.original.content);
    } else {
      console.log('⏳ Still buffering:', result.error);
    }
  }
}

// Example 4: Complex nested JSON stabilization
async function nestedJSONExample() {
  console.log('\n=== Nested JSON Example ===');
  
  const stabilizer = createStreamingStabilizer({
    maxBufferSize: 8000,
    enableProgressiveRepair: true,
  });

  // Simulate complex nested JSON chunks
  const nestedChunks = [
    '{"user": {"id": 123, "profile": {"name": "',
    'Bob", "email": "bob@example.com", "preferences": {"',
    'theme": "dark", "notifications": true}}, "orders": [{"id": ',
    '456, "items": [{"name": "Book", "quantity": 2}, ',
    '{"name": "Pen", "quantity": 3}]}]}',
  ];

  console.log('Processing nested JSON:');
  
  for (const chunk of nestedChunks) {
    console.log(`📦 Chunk: "${chunk}"`);
    
    const result = await stabilizer.processChunk(chunk);
    
    if (result.success) {
      console.log('✅ Complete nested JSON:');
      console.log(JSON.stringify(result.data, null, 2));
      break;
    } else {
      console.log('🔧 Attempting repair...');
    }
  }
}

// Example 5: Error handling and recovery
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const stabilizer = createStreamingStabilizer({
    maxBufferSize: 2000, // Small buffer to force errors
    enableProgressiveRepair: true,
  });

  // Simulate problematic chunks
  const problematicChunks = [
    '{"data": [',
    '{"type": "error", "message": "First chunk"}',
    '{"type": "error", "message": "Second chunk"}',
    // This will exceed buffer size
    '{"type": "error", "message": "Third chunk that makes buffer too long"}',
  ];

  for (const chunk of problematicChunks) {
    console.log(`📦 Chunk: "${chunk}"`);
    
    const result = await stabilizer.processChunk(chunk);
    
    if (result.success) {
      console.log('✅ Success:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ Error:', result.error);
      console.log('📊 Buffer size:', stabilizer.getBuffer().length);
      
      // Reset and continue with next chunk
      if (result.error?.includes('too large')) {
        console.log('🔄 Resetting buffer due to size limit');
        stabilizer.reset();
      }
    }
  }
}

// Example 6: Real-world API response simulation
async function realWorldExample() {
  console.log('\n=== Real-world API Example ===');
  
  const stabilizer = createStreamingStabilizer({
    maxBufferSize: 10000,
    enableProgressiveRepair: true,
    validateFn: (data) => {
      // Validate that we have expected structure
      return (
        typeof data === 'object' &&
        'response' in data &&
        'metadata' in data
      );
    },
  });

  // Simulate realistic streaming response
  const apiChunks = [
    '{"response": {"text": "The weather today is ',
    'sunny with a high of 75°F. The forecast for ',
    'tomorrow shows partly cloudy conditions with a ',
    'high of 72°F. UV index is moderate at ',
    '5. Remember to wear sunscreen if outdoors ',
    'for extended periods."}, "metadata": {"',
    'model": "weather-v2", "tokens_used": 45, ',
    '"processing_time": 1.2, "source": "weather_api"}}',
  ];

  console.log('Simulating API stream processing:');
  
  for (const chunk of apiChunks) {
    console.log(`📦 Received chunk (${chunk.length} chars)`);
    
    const result = await stabilizer.processChunk(chunk);
    
    if (result.success && result.isComplete) {
      console.log('✅ Complete API response received!');
      console.log('📝 Response text:', result.data.response.text);
      console.log('📊 Metadata:', result.data.metadata);
      console.log('🔢 Total tokens:', result.data.metadata.tokens_used);
      break;
    } else if (result.success) {
      console.log('⏳ Partial JSON received, continuing...');
    } else {
      console.log('🔧 Repairing incomplete JSON...');
    }
  }
}

// Example 7: Performance comparison
async function performanceExample() {
  console.log('\n=== Performance Example ===');
  
  const iterations = 1000;
  const chunkSize = 100;
  
  // Test with stabilization
  const stabilizer = createStreamingStabilizer({
    enableProgressiveRepair: true,
  });

  console.log(`Testing performance with ${iterations} iterations...`);
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const chunk = '{"data": "' + 'x'.repeat(chunkSize) + '"}';
    await stabilizer.processChunk(chunk);
    stabilizer.reset();
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgTime = duration / iterations;
  
  console.log(`✅ Performance results:`);
  console.log(`📊 Total time: ${duration}ms`);
  console.log(`📊 Average time per chunk: ${avgTime.toFixed(2)}ms`);
  console.log(`📊 Chunks per second: ${(1000 / avgTime).toFixed(0)}`);
}

// Run all examples
async function main() {
  await basicStabilizationExample();
  await validationExample();
  await asyncIteratorExample();
  await nestedJSONExample();
  await errorHandlingExample();
  await realWorldExample();
  await performanceExample();
}

main().catch(console.error);
