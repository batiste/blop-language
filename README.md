# The blop language

<img src="/img/blop.png" width="120">

Blop is a turing complete language that natively and elegantly generates Virtual DOM using a familiar HTML like syntax. Unlike JSX you are not limited to expressions and can use the full power of the language to generate Virtual DOM.
You can mix any statement, expressions, and HTML like syntax within the same function.

The HTML tags written with blop are converted into Virtual DOM nodes using the [snabbdom](https://github.com/snabbdom/snabbdom/) library.

The Blop language compiles to ES6 compliant JavaScript. The language is mostly self contained and has very few dependencies.

[Blop language syntax reference](https://github.com/batiste/blop-language/wiki/Blop-language-syntax-reference)

<img src="/img/carbon.png" width="600">

[![Edit blop-language](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/batiste/blop-language/tree/master/)

## Language features

  * Virtual DOM generation is natively supported by the language.
  * Fast compilation (+30'000 lines by second).
  * A linter is integrated into the language: no linter debate.
  * Good integration with Visual Studio Code: linter and syntactic coloration.
  * Source maps.
  * Server Side Rendering in the example.
  * Type annotation with very basic type inference warnings.
  * Similar syntax and features than ES6.

## Language features missing

  * The language is still in beta

## Installation

    npm install blop-language

Or if you want to use the development version with examples

    git clone this repo
    npm install
    npm start
    open http://localhost:3000

## Command line usage

To convert a single file

    blop -i input.blop -o output.js

## Configure Webpack loader for blop

Add this rule into your `webpack.config.js`

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.blop$/,
        use: [
          {
            loader: 'blop-language/loader',
            options: {debug: false}
          }
        ]
      }
    ]
  }
};
```

## Configure Jest for blop

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: [
    'blop',
    'js',
  ],
  testMatch: ['**/*.test.blop'],
  transform: {
    '^.+\\.blop$': 'blop-language/jest-transform',
  },
};
```

## Install Visual Studio Code extensions

### Install them though visualstudio marketplace.

vscode will prompt you to install the extenstion when you open a `.blop` file

Here is a link to the extensions on the visualstudio marketplace

 Install the extensions https://marketplace.visualstudio.com/search?term=blop&target=VSCode&category=All%20categories&sortBy=Relevance

<img src="/img/extensions.png" width="600">

### Install them throught github

If you cloned the repository, it is has simple has creating a symbolic link
to your `~/.vscode/extensions` directory. This function will do it
for you:

    cd blop-language/
    npm run link-extensions

Relaunch vscode and open a `.blop` file to see if the linter and coloration work

<img src="/img/example.png" width="600">
