module.exports = {
  "extends": "airbnb-base",
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
    "no-use-before-define": "off"
  },
  "plugins": [
    "ie11"
  ]
};