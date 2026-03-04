#! /usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import vm from 'vm';
import { compileSource } from './compile.js';
import { loadConfig } from './utils.js';
import { COLORS } from './constants.js';
import { format } from './formatter/index.js';

/**
 * Recursively collect all *.blop files under a directory.
 * @param {string} dir
 * @param {string[]} [acc=[]]
 * @returns {string[]}
 */
function findBlopFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      findBlopFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.blop')) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Format a single .blop file in-place.
 * @param {string} filePath
 * @param {object} formatOptions
 */
function formatFile(filePath, formatOptions) {
  const source = fs.readFileSync(filePath, 'utf8');
  const formatted = format(source, formatOptions);
  if (formatted !== source) {
    fs.writeFileSync(filePath, formatted);
    console.log(`${COLORS.GREEN}[blop] ${COLORS.YELLOW}✔${COLORS.RESET} ${filePath} formatted`);
  } else {
    console.log(`${COLORS.GREEN}[blop] ✔${COLORS.RESET} ${filePath} is already correctly formatted`);
  }
}

program
  .version('0.1.0')
  .option('-i, --input <path>', 'file or directory input')
  .option('-o, --output <file>', 'file output')
  .option('-e, --execute', 'execute the input')
  .option('-r, --resolve', 'resolve import statements')
  .option('-s, --sourceMap', 'add source maps')
  .option('-f, --inference', 'enable type inference checking')
  .option('-v, --validate', 'validate only (check for type errors without generating output)')
  .option('-t, --format', 'format source file in place')
  .option('--indent-size <n>', 'indentation size for formatter (default: 2)', parseInt)
  .option('--indent-char <char>', 'indentation character for formatter (default: space)')
  .option('--max-line-length <n>', 'max line length before breaking (default: 120)', parseInt)
  
  
program.parse(process.argv);

const options = program.opts();

if (!process.argv.slice(2).length || !options.input) {
  program.outputHelp();
  process.exit(0);
}

async function execute() {
  // Load blop.config.js, walking up from the input file's directory.
  // CLI flags take precedence over config file values.
  const fileConfig = await loadConfig(options.input);

  // Merge: config file provides defaults, CLI flags override
  const runtimeConfig = {
    ...fileConfig,
    ...(options.inference != null && { inference: !!options.inference }),
    ...(options.sourceMap  != null && { sourceMap:  !!options.sourceMap  }),
  };

  if (options.input) {
    // ── DIRECTORY INPUT ──────────────────────────────────────────────────────
    const stat = fs.statSync(options.input, { throwIfNoEntry: false });
    if (stat && stat.isDirectory()) {
      if (!options.format) {
        console.error(`${COLORS.RED}Error:${COLORS.RESET} Directory input is only supported with the --format flag`);
        process.exit(1);
      }
      const files = findBlopFiles(options.input);
      if (files.length === 0) {
        console.log(`${COLORS.GREEN}[blop]${COLORS.RESET} No .blop files found in ${options.input}`);
        return;
      }
      const formatOptions = {
        indentSize:    options.indentSize    ?? fileConfig.formatter?.indentSize,
        indentChar:    options.indentChar    ?? fileConfig.formatter?.indentChar,
        maxLineLength: options.maxLineLength ?? fileConfig.formatter?.maxLineLength,
      };
      for (const file of files) {
        formatFile(file, formatOptions);
      }
      return;
    }

    // ── SINGLE FILE INPUT ────────────────────────────────────────────────────
    const source = fs.readFileSync(options.input);

    if (options.format) {
      formatFile(options.input, {
        // CLI flags win; fall back to config file formatter section
        indentSize:    options.indentSize    ?? fileConfig.formatter?.indentSize,
        indentChar:    options.indentChar    ?? fileConfig.formatter?.indentChar,
        maxLineLength: options.maxLineLength ?? fileConfig.formatter?.maxLineLength,
      });
      return;
    }

    try {
      const result = compileSource(source.toString(), options.input, !!options.inference, runtimeConfig);
      
      // If validate flag is set, just report success and exit
      if (options.validate) {
        console.log(`${COLORS.GREEN}✓${COLORS.RESET} ${options.input} is valid`);
        return;
      }

      if (options.sourceMap || runtimeConfig.sourceMap) {
        const map = Buffer.from(JSON.stringify(result.sourceMap)).toString('base64');
        const prefix = '//# sourceMappingURL=data:application/json;charset=utf8;base64,';
        const inlineSourceMap = prefix + map;
        result.code += inlineSourceMap;
      }

      if (options.execute) {
        const script = new vm.Script(result.code);
        const sandbox = { require, module, console };
        vm.createContext(sandbox);
        script.runInContext(sandbox);
        return;
      }

      if (options.output) {
        fs.writeFile(options.output, result.code, (err) => {
          if (err) throw err;
          console.log(`${COLORS.GREEN}[blop]${COLORS.RESET} ${options.output} has been written`);
        });
      } else {
        console.log(result.code);
      }
    } catch (error) {
      // For validate mode, report the error and exit with code 1
      if (options.validate) {
        console.error(`${COLORS.RED}✗${COLORS.RESET} ${options.input} has errors`);
        process.exit(1);
      }
      throw error;
    }
  } else {
    console.error(`${COLORS.RED}Error:${COLORS.RESET} No input file specified`);
    process.exit(1);
  }
}

await execute();
