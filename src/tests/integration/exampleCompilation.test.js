import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileSource } from '../../compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function compileSourceWithErrors(filename) {
    const source = readFileSync(filename, 'utf-8');
    const result = compileSource(source, filename, true);
    
    if (!result.success) {
      const errorMessages = result.errors.map(err => err.message || 'Unknown error').join('\n');
      throw new Error(`${filename} failed to compile:\n${errorMessages}`);
    }
    expect(result.success).toBe(true);
  }




describe('Example files compilation', () => {
  test('Compile all example files without errors', () => {
    // get all files in example directory and compile them, ensuring no errors are thrown
    const exampleDir = join(__dirname, '../../../example');
    // Read all files in the example directory, and sub directories, that end with .blop

    function getAllBlopFiles(dir) {
      let results = [];
      const list = readdirSync(dir, { withFileTypes: true });
      list.forEach((dirent) => {
        const fullPath = join(dir, dirent.name);
        if (dirent.isDirectory()) {
          results = results.concat(getAllBlopFiles(fullPath));
        } else if (dirent.isFile() && dirent.name.endsWith('.blop')) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const files = getAllBlopFiles(exampleDir);

    // // Compile each file and ensure no errors are thrown
    files.forEach(file => {
      expect(() => compileSourceWithErrors(file)).not.toThrow();
    });
  });
});
