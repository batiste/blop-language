# The blop language

The blop language ressembles modern JavaScript and offers JSX like features.

It has the advantage to fully integrate the HTML tags into the language and you are not limited to expressions. You can mix any statement within a function as HTML tags can be statements as well as expressions.

It compiles to javascript using a compiler that is generated using a grammar and token definition.

<img src="/img/carbon.png" width="800">

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
            loader: 'blop-language/src/loader',
            options: {debug: false}
          }
        ]
      }
    ]
  }
}
```

## Install Visual Studio Code extensions

### Install them though visualstudio marketplace.

vscode will prompt you to install the extenstion when you open a `.blop` file

Here is a link to the extensions on the visualstudio marketplace

 Install the extensions https://marketplace.visualstudio.com/search?term=blop&target=VSCode&category=All%20categories&sortBy=Relevance


### Install them throught github

If you cloned the repository, it is has simple has creating a symbolic link
to your `~/.vscode/extensions` directory. This function will do it
for you:

    cd blop-language/
    npm run link-extensions

Relaunch vscode and open a `.blop` file to see if the linter and coloration work

 ![Code example](/img/example.png)
