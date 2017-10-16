const Chain = require('markov-chains').default;
const fs = require('fs')

const corpus = JSON.parse(fs.readFileSync('./allMessages.json'));

function parseCorpus() {
    // read JSON corpus from file
    // parse corpus
    let terminals = new Set();
    let starts = [];
    let relationships = {};

    for (let i = 0; i < this.corpus.length; i++) {
      const words = this.corpus[i].split(' ')
      terminals.add([words[words.length-1]]);
      starts.push(words[0]);
      for (let j = 0; j < words.length - 1; j++) {
        if(!relationships[words[j]] || 
          (relationships[words[j]] && !(relationships[words[j]].indexOf(words[j+1]) >= 0))
        ) {
          if (relationships.hasOwnProperty(words[j])) {
            relationships[words[j]].push(words[j+1]);
          } else {
            relationships[words[j]] = [words[j+1]];
          }
        }
      }
    }

    this.terminals = terminals;
    this.starts = starts;
    this.relationships = relationships;
  }

const stuff = new Chain([corpus])
const sentence = stuff.walk();

console.log(sentence);
