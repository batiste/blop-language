import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileSource } from '../../compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Example files compilation', () => {
  test('example/index.blop compiles without errors', () => {
    const filePath = join(__dirname, '../../../example/index.blop');
    const source = readFileSync(filePath, 'utf-8');
    
    const result = compileSource(source, 'example/index.blop', true);
    
    if (!result.success) {
      const errorMessages = result.errors.map(err => err.message || 'Unknown error').join('\n');
      throw new Error(`example/index.blop failed to compile:\n${errorMessages}`);
    }
    
    expect(result.success).toBe(true);
  });

  test('example/routing.blop compiles without errors', () => {
    const filePath = join(__dirname, '../../../example/routing.blop');
    const source = readFileSync(filePath, 'utf-8');
    
    const result = compileSource(source, 'example/routing.blop', true);
    
    if (!result.success) {
      const errorMessages = result.errors.map(err => err.message || 'Unknown error').join('\n');
      throw new Error(`example/routing.blop failed to compile:\n${errorMessages}`);
    }
    
    expect(result.success).toBe(true);
  });

  test('example/services.blop compiles without errors', () => {
    const filePath = join(__dirname, '../../../example/services.blop');
    const source = readFileSync(filePath, 'utf-8');
    
    const result = compileSource(source, 'example/services.blop', true);
    
    if (!result.success) {
      const errorMessages = result.errors.map(err => err.message || 'Unknown error').join('\n');
      throw new Error(`example/services.blop failed to compile:\n${errorMessages}`);
    }
    
    expect(result.success).toBe(true);
  });
});
