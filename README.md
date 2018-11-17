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
                }]
            }
            ]
        }
    }
´´´
    

## Install vscode extensions

If you cloned the repository, it is has simple has creating a simbolic link
to your `~/.vscode/extensions` directory. This convenient function will do it
for you:

    cd blop-language/
    npm run link-extensions

 ![Code example](/img/example.png)

 # Vscode extension

 You can install the extension from the store but there is not guarantee the
 extensions will be fresh at this point.

 Install the extensions https://marketplace.visualstudio.com/search?term=blop&target=VSCode&category=All%20categories&sortBy=Relevance

 ![Extensions](/img/extensions.png)
