# The blop language

<img src="/img/blop.png" width="120">

Blop is a language for the Web that can natively generates Virtual DOM trees using a familiar HTML like syntax. The Blop language compiles to ES6 compliant JavaScript. The language is mostly self contained and has very few dependencies.

Unlike JSX Blop is not limited to expressions and can use the full power of the language to generate Virtual DOM nodes.
You can mix any statement, expressions, and HTML like syntax within the same function.
Blop is using [snabbdom](https://github.com/snabbdom/snabbdom/) library to generate the Virtual DOM trees.

The blop runtime also comes with a Component and Lifecycle system.

[Example project from this repository](https://batiste.github.io/blop/example/)

State management and routing can be up to you, but 2 small libraries provide the basics to get started

 * [A state managment system based on Proxies](https://github.com/batiste/blop-language/wiki/State-management)
 * [A routing system](https://github.com/batiste/blop-language/wiki/Routing)
 
 <img src="/img/carbon.png" width="700">
 
 ## How to get get started
 
 * [Documentation](https://github.com/batiste/blop-language/wiki)
 * [Install the example application](https://github.com/batiste/blop-language/wiki/Install-the-example-application)
 * [Blop language syntax reference](https://github.com/batiste/blop-language/wiki/Blop-language-syntax-reference)
 * [How do Blop Components work?](https://github.com/batiste/blop-language/wiki/Components)

## Language features

  * Virtual DOM generation is natively supported by the language.
  * Fast compilation (+30'000 lines by second).
  * A linter is integrated into the language: no linter debate.
  * Good integration with Visual Studio Code: linter and syntactic coloration.
  * Source maps.
  * Server Side Rendering in the example.
  * Hot module reloading in the example (HMR)
  * Type annotation with very basic type inference warnings.
  * Similar syntax and features than ES6.
  * 100% Webpack and Jest compatible
  * Very small payload size for Snabbdom and Blop runtime: Parsed size: ~20KB, Gzipped: ~7KB

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
            loader: 'blop-language/src/loader',
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
    '^.+\\.blop$': 'blop-language/src/jest',
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
