module.exports = {
  "extends": "eslint:recommended",
  "env" : {
    "node" : true,
    "es6": true,
  },
  "globals": {
    "window": true,
  },
  "rules": {
    "no-plusplus": "off",
    "no-unused-expressions": "off",
    "quote-props": "off",
    "camelcase": "off",
    "no-underscore-dangle": "off",
    "no-param-reassign": "off",
    "no-shadow": "off",
    // for the generated parser
    "consistent-return": "off",
    "object-property-newline": "off",
    "dot-notation": "off",
    "no-use-before-define": "off",
    "no-console": ["error", { allow: ["log", "error", "warn"] }]
  },
  "plugins": [
    "ie11"
  ]
};