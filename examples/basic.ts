/**
 * Basic usage example for OpenGuard
 */

import { extractJsonFromMarkdown, repairJson, validateSchema } from '../src/index.js';
import { z } from 'zod';

// Example 1: Extract JSON from markdown
const markdownResponse = `
Here's the user information:

\`\`\`json
{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com"
}
\`\`\`
`;

const extractResult = extractJsonFromMarkdown(markdownResponse);
if (extractResult.success) {
  console.log('Extracted JSON:', extractResult.data);
} else {
  console.error('Extraction failed:', extractResult.error);
}

// Example 2: Repair malformed JSON
const malformedJson = "{name: 'John', age: 30,}";
const repairResult = repairJson(malformedJson);
if (repairResult.success) {
  console.log('Repaired JSON:', repairResult.data);
  const parsed = JSON.parse(repairResult.data);
  console.log('Parsed:', parsed);
} else {
  console.error('Repair failed:', repairResult.error);
}

// Example 3: Validate against schema
const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

const userData = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
};

const validationResult = validateSchema(userSchema, userData);
if (validationResult.success) {
  console.log('Validation passed:', validationResult.data);
} else {
  console.error('Validation failed:', validationResult.error.validationIssues);
}

// Example 4: Combine extraction, repair, and validation
const llmResponse = `
User data:
\`\`\`json
{name: 'Jane', age: '25', email: 'jane@example.com',}
\`\`\`
`;

const combinedResult = extractJsonFromMarkdown(llmResponse);
if (combinedResult.success) {
  const repaired = repairJson(JSON.stringify(combinedResult.data));
  if (repaired.success) {
    const parsed = JSON.parse(repaired.data);
    const validated = validateSchema(userSchema, parsed);
    if (validated.success) {
      console.log('Final validated data:', validated.data);
    } else {
      console.error('Schema validation failed:', validated.error.validationIssues);
    }
  }
}
