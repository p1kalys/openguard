/**
 * Example demonstrating JSON repair for common LLM mistakes
 */

import { repairJson, extractJsonFromMarkdown } from '../src/index.js';

console.log('=== Broken JSON Repair Examples ===\n');

// Example 1: Trailing commas
console.log('1. Fixing trailing commas:');
const trailingCommas = '{"name": "John", "age": 30,}';
console.log('  Input:', trailingCommas);
const result1 = repairJson(trailingCommas);
if (result1.success) {
  console.log('  Output:', result1.data);
  console.log('  Parsed:', JSON.parse(result1.data));
}
console.log();

// Example 2: Single quotes
console.log('2. Fixing single quotes:');
const singleQuotes = "{'name': 'John', 'age': 30}";
console.log('  Input:', singleQuotes);
const result2 = repairJson(singleQuotes);
if (result2.success) {
  console.log('  Output:', result2.data);
  console.log('  Parsed:', JSON.parse(result2.data));
}
console.log();

// Example 3: Unquoted keys
console.log('3. Fixing unquoted keys:');
const unquotedKeys = '{name: "John", age: 30}';
console.log('  Input:', unquotedKeys);
const result3 = repairJson(unquotedKeys);
if (result3.success) {
  console.log('  Output:', result3.data);
  console.log('  Parsed:', JSON.parse(result3.data));
}
console.log();

// Example 4: Missing closing brace
console.log('4. Fixing missing closing brace:');
const missingBrace = '{"name": "John", "age": 30';
console.log('  Input:', missingBrace);
const result4 = repairJson(missingBrace);
if (result4.success) {
  console.log('  Output:', result4.data);
  console.log('  Parsed:', JSON.parse(result4.data));
}
console.log();

// Example 5: JavaScript comments
console.log('5. Removing JavaScript comments:');
const withComments = `{
  // User information
  "name": "John",
  "age": 30 /* in years */
}`;
console.log('  Input:', withComments);
const result5 = repairJson(withComments);
if (result5.success) {
  console.log('  Output:', result5.data);
  console.log('  Parsed:', JSON.parse(result5.data));
}
console.log();

// Example 6: Multiple issues at once
console.log('6. Fixing multiple issues at once:');
const multipleIssues = "{name: 'John', age: 30, active: true,}";
console.log('  Input:', multipleIssues);
const result6 = repairJson(multipleIssues);
if (result6.success) {
  console.log('  Output:', result6.data);
  console.log('  Parsed:', JSON.parse(result6.data));
}
console.log();

// Example 7: Invalid arrays
console.log('7. Fixing invalid arrays:');
const invalidArray = '[1, 2, 3,]';
console.log('  Input:', invalidArray);
const result7 = repairJson(invalidArray);
if (result7.success) {
  console.log('  Output:', result7.data);
  console.log('  Parsed:', JSON.parse(result7.data));
}
console.log();

// Example 8: Real LLM response with markdown
console.log('8. Real LLM response with markdown:');
const llmResponse = `
Here's the data you requested:

\`\`\`json
{
  users: [
    {name: 'John', age: 30,},
    {name: 'Jane', age: 25,}
  ]
}
\`\`\`
`;
console.log('  Input:', llmResponse.trim());
const extractResult = extractJsonFromMarkdown(llmResponse);
if (extractResult.success) {
  console.log('  Extracted:', extractResult.data);
  const repairResult = repairJson(JSON.stringify(extractResult.data));
  if (repairResult.success) {
    console.log('  Repaired:', repairResult.data);
    console.log('  Parsed:', JSON.parse(repairResult.data));
  }
}
console.log();
