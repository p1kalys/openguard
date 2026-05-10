/**
 * Source document processors for grounding validation
 */

import { SourceDocument, TextChunk, SourceType } from './types.js';

/**
 * Document processor factory
 */
export class DocumentProcessor {
  /**
   * Process document based on type
   */
  static processDocument(document: SourceDocument): SourceDocument {
    switch (document.type) {
      case 'text':
        return this.processTextDocument(document);
      case 'retrieval_chunk':
        return this.processRetrievalChunkDocument(document);
      case 'structured':
        return this.processStructuredDocument(document);
      case 'metadata':
        return this.processMetadataDocument(document);
      default:
        return document;
    }
  }

  /**
   * Process plain text document
   */
  static processTextDocument(document: SourceDocument): SourceDocument {
    const chunks = this.chunkText(document.content);
    
    return {
      ...document,
      chunks,
    };
  }

  /**
   * Process retrieval chunk document
   */
  static processRetrievalChunkDocument(document: SourceDocument): SourceDocument {
    // For retrieval chunks, ensure chunks are properly formatted
    if (!document.chunks) {
      const chunks = this.chunkText(document.content);
      return {
        ...document,
        chunks,
      };
    }
    
    return document;
  }

  /**
   * Process structured document
   */
  static processStructuredDocument(document: SourceDocument): SourceDocument {
    let textContent = '';
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(document.content);
      textContent = this.extractTextFromStructured(parsed);
    } catch {
      // If not JSON, treat as plain text
      textContent = document.content;
    }
    
    const chunks = this.chunkText(textContent);
    
    return {
      ...document,
      content: textContent,
      chunks,
    };
  }

  /**
   * Process metadata document
   */
  static processMetadataDocument(document: SourceDocument): SourceDocument {
    // Extract text from metadata fields
    const textParts = [document.content];
    
    if (document.metadata.title) {
      textParts.push(document.metadata.title);
    }
    
    if (document.metadata.author) {
      textParts.push(`By ${document.metadata.author}`);
    }
    
    if (document.metadata.tags) {
      textParts.push(...document.metadata.tags);
    }
    
    const combinedText = textParts.join(' ');
    const chunks = this.chunkText(combinedText);
    
    return {
      ...document,
      content: combinedText,
      chunks,
    };
  }

  /**
   * Extract text from structured data
   */
  private static extractTextFromStructured(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.extractTextFromStructured(item)).join(' ');
    }
    
    if (typeof data === 'object' && data !== null) {
      const textParts: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        const textValue = this.extractTextFromStructured(value);
        if (textValue) {
          textParts.push(`${key}: ${textValue}`);
        }
      }
      return textParts.join(' ');
    }
    
    return '';
  }

  /**
   * Chunk text into smaller pieces
   */
  static chunkText(text: string, chunkSize: number = 300, overlap: number = 50): TextChunk[] {
    const chunks: TextChunk[] = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(' ');
      
      if (chunkText.trim().length > 0) {
        const startPos = text.indexOf(chunkText);
        const endPos = startPos + chunkText.length;
        
        chunks.push({
          id: `chunk_${chunks.length}`,
          text: chunkText,
          position: {
            start: startPos,
            end: endPos,
          },
          metadata: {
            type: this.determineChunkType(chunkText),
            relevanceScore: 1.0, // Default relevance
          },
        });
      }
    }
    
    return chunks;
  }

  /**
   * Determine chunk type
   */
  private static determineChunkType(text: string): TextChunk['metadata']['type'] {
    const trimmedText = text.trim();
    
    // Check if it's a complete sentence
    if (/[.!?]$/.test(trimmedText)) {
      return 'sentence';
    }
    
    // Check if it's a paragraph (multiple sentences)
    if (trimmedText.split(/[.!?]/).length > 1) {
      return 'paragraph';
    }
    
    // Default to section
    return 'section';
  }

  /**
   * Create document from various input types
   */
  static createDocument(
    id: string,
    content: string,
    type: SourceType,
    metadata?: SourceDocument['metadata']
  ): SourceDocument {
    return {
      id,
      type,
      content,
      metadata: metadata || {},
    };
  }

  /**
   * Create documents from array of texts
   */
  static createDocumentsFromTexts(
    texts: string[],
    type: SourceType = 'text'
  ): SourceDocument[] {
    return texts.map((text, index) => 
      this.createDocument(`doc_${index}`, text, type)
    );
  }

  /**
   * Create documents from JSON data
   */
  static createDocumentsFromJSON(
    jsonData: any[],
    type: SourceType = 'structured'
  ): SourceDocument[] {
    return jsonData.map((item, index) => {
      const content = typeof item === 'string' ? item : JSON.stringify(item);
      return this.createDocument(`doc_${index}`, content, type, {
        title: item.title || `Document ${index + 1}`,
        source: item.source || item.url,
        createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
        author: item.author,
        tags: item.tags || [],
      });
    });
  }

  /**
   * Create retrieval chunk documents
   */
  static createRetrievalDocuments(
    chunks: Array<{ text: string; metadata?: any }>,
    baseId: string = 'retrieval'
  ): SourceDocument[] {
    return chunks.map((chunk, index) => {
      const document = this.createDocument(
        `${baseId}_${index}`,
        chunk.text,
        'retrieval_chunk',
        chunk.metadata
      );
      
      // Create text chunk
      const textChunk: TextChunk = {
        id: `chunk_${index}`,
        text: chunk.text,
        position: {
          start: 0,
          end: chunk.text.length,
        },
        metadata: {
          type: 'section',
          relevanceScore: chunk.metadata?.relevanceScore || 1.0,
          ...chunk.metadata,
        },
      };
      
      return {
        ...document,
        chunks: [textChunk],
      };
    });
  }

  /**
   * Merge documents with same content
   */
  static mergeDocuments(documents: SourceDocument[]): SourceDocument[] {
    const mergedDocs: SourceDocument[] = [];
    const contentMap = new Map<string, SourceDocument[]>();
    
    // Group by content
    for (const doc of documents) {
      const key = doc.content.substring(0, 100); // First 100 chars as key
      if (!contentMap.has(key)) {
        contentMap.set(key, []);
      }
      contentMap.get(key)!.push(doc);
    }
    
    // Merge each group
    for (const [key, docs] of contentMap) {
      if (docs.length === 1) {
        mergedDocs.push(docs[0]);
        continue;
      }
      
      // Create merged document
      const mergedDoc: SourceDocument = {
        id: `merged_${mergedDocs.length}`,
        type: docs[0].type,
        content: docs[0].content,
        metadata: {
          title: `Merged Document ${mergedDocs.length + 1}`,
          source: docs.map(d => d.metadata.source).filter(Boolean).join(', '),
          author: docs.map(d => d.metadata.author).filter(Boolean).join(', '),
          tags: [...new Set(docs.flatMap(d => d.metadata.tags || []))],
          mergedFrom: docs.map(d => d.id),
          mergeCount: docs.length,
        },
      };
      
      // Merge chunks
      const allChunks = docs.flatMap(d => d.chunks || []);
      mergedDoc.chunks = allChunks;
      
      mergedDocs.push(mergedDoc);
    }
    
    return mergedDocs;
  }

  /**
   * Filter documents by relevance
   */
  static filterByRelevance(
    documents: SourceDocument[],
    minRelevance: number = 0.5
  ): SourceDocument[] {
    return documents.filter(doc => {
      // Check document relevance
      if (doc.metadata.relevanceScore && doc.metadata.relevanceScore < minRelevance) {
        return false;
      }
      
      // Check chunk relevance
      if (doc.chunks) {
        const avgChunkRelevance = doc.chunks.reduce((sum, chunk) => 
          sum + (chunk.metadata.relevanceScore || 0), 0) / doc.chunks.length;
        
        if (avgChunkRelevance < minRelevance) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Sort documents by relevance
   */
  static sortByRelevance(documents: SourceDocument[]): SourceDocument[] {
    return documents.sort((a, b) => {
      const aRelevance = a.metadata.relevanceScore || 0;
      const bRelevance = b.metadata.relevanceScore || 0;
      
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }
      
      // Fallback to chunk relevance
      const aChunkRelevance = a.chunks ? 
        a.chunks.reduce((sum, chunk) => sum + (chunk.metadata.relevanceScore || 0), 0) / a.chunks.length : 0;
      const bChunkRelevance = b.chunks ? 
        b.chunks.reduce((sum, chunk) => sum + (chunk.metadata.relevanceScore || 0), 0) / b.chunks.length : 0;
      
      return bChunkRelevance - aChunkRelevance;
    });
  }

  /**
   * Get document statistics
   */
  static getDocumentStats(documents: SourceDocument[]): {
    total: number;
    byType: Record<SourceType, number>;
    totalChunks: number;
    avgChunkSize: number;
    totalLength: number;
  } {
    const stats = {
      total: documents.length,
      byType: {} as Record<SourceType, number>,
      totalChunks: 0,
      avgChunkSize: 0,
      totalLength: 0,
    };
    
    for (const doc of documents) {
      // Count by type
      stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;
      
      // Count chunks
      if (doc.chunks) {
        stats.totalChunks += doc.chunks.length;
        stats.totalLength += doc.content.length;
      }
    }
    
    // Calculate average chunk size
    if (stats.totalChunks > 0) {
      stats.avgChunkSize = stats.totalLength / stats.totalChunks;
    }
    
    return stats;
  }
}
