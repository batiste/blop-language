# The blop language

<img src="/img/blop.png" width="120">

Blop natively understand nested HTML tags and components. Unlike JSX you are not limited to expressions. 
You can mix any statement, expressions, and HTML tags within the same function.

The HTML tags and components are converted into virtual DOM nodes using the [snabbdom](https://github.com/snabbdom/snabbdom/) library.

Blop compiles to ES6 using a compiler that is generated using a grammar and token definition.

<img src="/img/carbon.png" width="800">

## Language features

  * Virtual DOM generation is natively supported by the language.
  * Fast compilation (+30'000 lines by second).
  * A linter is integrated into the language: no linter debate.
  * Integration with Visual Studio Code: linter and syntactic coloration.
  * Similar syntax and features than ES6.
  * Server Side Rendering in the example.

## Language features missing

  * No real type checking (but type annotation is possible)
  * The language is still in beta

## Installation

    npm install blop-language

Or if you want to use the development version with examples

    git clone this repo
    npm install
    npm run start
    open http://localhost:9000

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
