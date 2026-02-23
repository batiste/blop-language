#! /usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import vm from 'vm';
import { compileSource } from './compile.js';
import { COLORS } from './constants.js';
import { format } from './formatter/index.js';

program
  .version('0.1.0')
  .option('-i, --input <file>', 'file input')
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

function execute() {
  if (options.input) {
    const source = fs.readFileSync(options.input);

    if (options.format) {
      const formatted = format(source.toString(), {
        indentSize: options.indentSize,
        indentChar: options.indentChar,
        maxLineLength: options.maxLineLength,
      });
      fs.writeFileSync(options.input, formatted);
      console.log(`${COLORS.GREEN}[blop]${COLORS.RESET} ${options.input} formatted`);
      return;
    }

    try {
      const result = compileSource(source.toString(), options.input, options.sourceMap, options.resolve, options.inference);
      
      // If validate flag is set, just report success and exit
      if (options.validate) {
        console.log(`${COLORS.GREEN}✓${COLORS.RESET} ${options.input} is valid`);
        return;
      }

      if (options.sourceMap) {
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

execute();
