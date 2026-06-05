/**
 * Errors module exports
 *
 * Two complementary error systems:
 *  - Class hierarchy (OpenGuardError + subclasses) from base.ts — for throw/catch patterns
 *  - Result<T> functional types (OpenGuardResult, success, error, unwrap) from result.ts
 */

// Class-based error hierarchy
export * from './base.js';
export * from './provider.js';
export * from './validation.js';
export * from './retry.js';
export * from './parsing.js';
export * from './streaming.js';

// Functional Result<T> error system
export * from './result.js';
