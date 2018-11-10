// this function is now integrated into the meta parser generator

"use strict";

function tokenize(tokenDef, input) {
    var keys = Object.keys(tokenDef);
    var stream = [], lastToken, i, key, candidate=null, match, token;
    var len = input.length;
    var char = 0;
    var index = 0;
    for(i=0; i<keys.length; i++) {
      key = keys[i];
      if((/\:|\?/g).test(key)) {
        throw new Error('Reserved word in token name')
      }
    }

    while(char < len) {

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
          lastToken = {type:key, value:candidate, start:char, index, len:candidate.length};
          stream.push(lastToken);
          index++;
          char += candidate.length;
          input = input.substr(candidate.length);
        } else {
          if(stream.length === 0) {
            throw new Error("Tokenizer error: total match failure");
          }
          var msg = "Tokenizer error, no matching token found";
          if(lastToken) {
            msg += "\n" + "Before token of type " + lastToken.type + ": " + lastToken.value;
          }
          throw new Error(msg);
        }
    }
    stream.push({type:'EOS', value:'<End Of Stream>', start:char, index, len:0});
    return stream;
}

module.exports = {
    tokenize: tokenize
};
