/**
 * CompressedCache
 * Handles compressed caching for better disk usage
 */

const zlib = require('zlib');
const fs = require('fs');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class CompressedCache {
  /**
   * Save data with compression
   */
  static async save(filePath, data) {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = await gzip(jsonString);
      
      // Add .gz extension
      const compressedPath = filePath + '.gz';
      fs.writeFileSync(compressedPath, compressed);
      
      // Remove uncompressed version if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return true;
    } catch (error) {
      console.debug('Failed to save compressed cache:', error.message);
      return false;
    }
  }

  /**
   * Load data with decompression
   */
  static async load(filePath) {
    try {
      // Try compressed version first
      const compressedPath = filePath + '.gz';
      
      if (fs.existsSync(compressedPath)) {
        const compressed = fs.readFileSync(compressedPath);
        const decompressed = await gunzip(compressed);
        return JSON.parse(decompressed.toString());
      }
      
      // Fallback to uncompressed
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
      
      return null;
    } catch (error) {
      console.debug('Failed to load compressed cache:', error.message);
      return null;
    }
  }

  /**
   * Get file size (compressed or uncompressed)
   */
  static getFileSize(filePath) {
    try {
      const compressedPath = filePath + '.gz';
      
      if (fs.existsSync(compressedPath)) {
        return fs.statSync(compressedPath).size;
      }
      
      if (fs.existsSync(filePath)) {
        return fs.statSync(filePath).size;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate compression ratio
   */
  static async getCompressionInfo(data) {
    try {
      const jsonString = JSON.stringify(data);
      const originalSize = Buffer.byteLength(jsonString);
      const compressed = await gzip(jsonString);
      const compressedSize = compressed.length;
      
      return {
        originalSize,
        compressedSize,
        ratio: ((1 - (compressedSize / originalSize)) * 100).toFixed(1) + '%'
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = CompressedCache;