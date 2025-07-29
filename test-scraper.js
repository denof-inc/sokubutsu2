const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const response = await axios.get('https://www.athome.co.jp/buy_other/hiroshima/list/?pref=34&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1&sort=33&limit=30');
    const $ = cheerio.load(response.data);
    
    console.log('HTML length:', response.data.length);
    console.log('Title:', $('title').text());
    
    // athome-で始まる要素を探す
    const customElements = $('*').filter((i, el) => el.name && el.name.startsWith('athome-'));
    console.log('athome- elements:', customElements.length);
    if (customElements.length > 0) {
      customElements.each((i, el) => {
        if (i < 5) console.log('  -', el.name);
      });
    }
    
    // 物件に関連しそうなクラスを探す
    const searchTerms = ['property', 'bukken', 'item', 'object', 'list', 'result'];
    console.log('\nSearching for property-related classes:');
    
    searchTerms.forEach(term => {
      const elements = $(`[class*="${term}"]`);
      if (elements.length > 0) {
        console.log(`\nElements with "${term}": ${elements.length}`);
        elements.each((i, el) => {
          if (i < 3) {
            const className = $(el).attr('class');
            const text = $(el).text().substring(0, 50);
            console.log(`  - ${el.name}.${className} => "${text}..."`);
          }
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();