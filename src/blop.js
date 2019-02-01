#! /usr/bin/env node

const program = require('commander');
const fs = require('fs');
const { compileFile } = require('./compile');

const GREEN = '\x1b[32m';
const NC = '\x1B[0m';

program
  .version('0.1.0')
  .option('-i, --input <file>', 'file input')
  .option('-o, --output <file>', 'file output')
  .option('-r, --resolve', 'resolve import statements')
  .parse(process.argv);

if (!process.argv.slice(2).length || !program.input) {
  program.outputHelp();
}

if (program.input) {
  const source = fs.readFileSync(program.input);
  const filename = program.resolve ? program.input : false;
  const output = compileFile(source.toString(), 'node', filename);
  if (program.output) {
    fs.writeFile(program.output, output, (err) => {
      if (err) throw err;
      console.log(`${GREEN}[blop]${NC} ${program.output} has been written`);
    });
  } else {
    console.log(output);
  }
}
