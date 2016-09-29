
"use strict";

function tokenize(tokenDef, input) {
    var keys = Object.keys(tokenDef);
    var stream = [], lastToken, i, key, candidate=null, match, token;
    var len = input.length;
    var index = 0;

    while(index < len) {

        for(i=0; i<keys.length; i++) {
          key = keys[i];
          token = tokenDef[key];
          if(token.func) {
            match = token.func(input, stream);
            if(match !== undefined) {
              candidate = match;
              break;
            }
          } else if(token.reg) {
            match = input.match(token.reg);
            if(match !== null) {
              candidate = match[0];
              break;
            }
          } else if(token.str) {
            match = input.indexOf(token.str);
            if(match === 0) {
              candidate = token.str;
              break;
            }
          } else {
            throw new Error("Tokenizer error: Invalid token " + key + " without a reg, str or func property");
          }
        }

        if(candidate !== null) {
          lastToken = {type:key, value:candidate, index:index};
          stream.push(lastToken);
          index += candidate.length;
          input = input.substr(candidate.length);
        } else {
          if(stream.length === 0) {
            throw new Error("Tokenizer error: total match failure");
          }
          if(lastToken) {
            lastToken.pointer += lastToken.value.length;
          }
          var msg = "Tokenizer error, no matching token found";
          if(lastToken) {
            msg += "\n" + "Before token of type " + lastToken.type + ": " + lastToken.value;
          }
          throw new Error(msg);
        }
    }
    stream.push({type:'EOS', value:'', index:index});
    return stream;
}

module.exports = {
    tokenize: tokenize
};