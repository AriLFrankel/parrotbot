const fs = require('fs');
const fetch = require('isomorphic-unfetch');

require('dotenv').config();

class Chadbot {

  constructor() {
    this.relationships = {};
    this.terminals = new Set();
    this.starts = [];
    this.userIdsMap = {
      ariCreatorCircle: process.env.ariCreatorCircle,
      chadConcierge: process.env.chadConcierge,
      jacobConcierge: process.env.jacobConcierge,
      bradConcierge: process.env.bradConcierge,
    };
    this.channelsMap = {
      conciergeCompanyWide: process.env.conciergeCompanyWide,
      creatorCircleGeneral: process.env.creatorCircleGeneral,
      conciergeProductTeam: process.env.conciergeProductTeam,
    };
  }

  async getUsers (userName) {
    const users = await fetch(`https://slack.com/api/users.list?token=${process.env.CONCIERGE_BOT_TOKEN}&pretty=1`);
    const userIds = await users.json().then(json => json.members.find(member => member.name.includes(userName)));
    return userIds;
  };

  async storeMessages() {
    try {
    const allMessages = [];
    const userId = this.userIdsMap.jacobConcierge;
    const channels = [this.channelsMap.conciergeCompanyWide, this.channelsMap.conciergeProductTeam];
    // fetch all of user's messages
    for (const channel of channels) {
      const eventsAndMessages = await fetch(`https://slack.com/api/channels.history?token=${process.env.CONCIERGE_BOT_TOKEN}&channel=${channel}&count=10000&pretty=1`);
      const json = await eventsAndMessages.json();
      if(!json.ok) throw new Error('bad response');

      const messages = json.messages
        .filter(message => message.type === 'message' && message.text.length)
        .map(message => message.text.replace(/<.*?>/, ''));
      
      allMessages.push(...messages)
    }
    // write JSON to file
    return fs.writeFileSync('allMessages.json', JSON.stringify(allMessages)); 
    } catch (err) {
      console.error(err);
    }
  }

  makeRandomChoice (array) {
    return array[Math.floor(array.length * Math.random())]
  }

  async parseCorpus() {
    // read JSON corpus from file
    this.corpus = JSON.parse(fs.readFileSync('allMessages.json'));
    // parse corpus
    let terminals = new Set();
    let starts = [];
    let relationships = {};

    for (let i = 0; i < this.corpus.length; i++) {
      const words = this.corpus[i].split(' ');
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

  createMessage(maxLength = 20, minLength = 3) {
    const { starts, terminals, relationships } = this;
    // start a sentence with a random choice from the starts
    let currentWord = this.makeRandomChoice(starts)
    let nextWord;
    let victory = false
    const sentence = [currentWord];

    // continue adding randomly chosen follower words
    // until a terminating word is found and minimum length has been reached
    while(relationships.hasOwnProperty(currentWord)) {
      nextWord = this.makeRandomChoice(relationships[currentWord]);
      sentence.push(nextWord);
      currentWord = nextWord;
      if(this.terminals.has(currentWord) || sentence.length >= maxLength) {
        break;
      }
    }
    // recurse if not long enough of a sentence
    if (!sentence.length >= minLength) return this.createMessage(maxLength, minLength);

    return sentence.join(' ');
  }
};

module.exports = new Chadbot();