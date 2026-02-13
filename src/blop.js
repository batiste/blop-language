#! /usr/bin/env node

const program = require('commander');
const fs = require('fs');
const vm = require('vm');
const { compileSource } = require('./compile');
const { COLORS } = require('./constants');

program
  .version('0.1.0')
  .option('-i, --input <file>', 'file input')
  .option('-o, --output <file>', 'file output')
  .option('-e, --execute', 'execute the input')
  .option('-r, --resolve', 'resolve import statements')
  .option('-s, --sourceMap', 'add source maps')
  .parse(process.argv);

if (!process.argv.slice(2).length || !program.input) {
  program.outputHelp();
}

function execute() {
  if (program.input) {
    const source = fs.readFileSync(program.input);
    const result = compileSource(source.toString(), 'node', program.input, program.sourceMap, program.resolve);

    if (program.sourceMap) {
      const map = Buffer.from(JSON.stringify(result.sourceMap)).toString('base64');
      const prefix = '//# sourceMappingURL=data:application/json;charset=utf8;base64,';
      const inlineSourceMap = prefix + map;
      result.code += inlineSourceMap;
    }

    if (program.execute) {
      const script = new vm.Script(result.code);
      const sandbox = { require, module, console };
      vm.createContext(sandbox);
      script.runInContext(sandbox);
      return;
    }

    if (program.output) {
      fs.writeFile(program.output, result.code, (err) => {
        if (err) throw err;
        console.log(`${COLORS.GREEN}[blop]${COLORS.RESET} ${program.output} has been written`);
      });
    } else {
      console.log(result.code);
    }
  }
}

execute();
