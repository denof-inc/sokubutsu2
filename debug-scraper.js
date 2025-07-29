const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://www.athome.co.jp/buy_other/hiroshima/list/?pref=34&basic=kp401,kp522,kt201,kf201,ke001,kn001,kj001&tsubo=0&tanka=0&kod=&q=1&sort=33&limit=30';
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  // デバッグ情報
  console.log('Total property elements:', $('[class*="property"]').length);
  console.log('---');
  
  $('[class*="property"]').each((i, el) => {
    if (i < 3) {
      const $el = $(el);
      console.log(`\nElement ${i}:`);
      console.log('Tag:', $el.prop('tagName'));
      console.log('Class:', $el.attr('class'));
      console.log('HTML:', $el.html().substring(0, 200));
      console.log('Text:', $el.text().substring(0, 200).replace(/\s+/g, ' ').trim());
      
      // 物件情報を探す
      const title = $el.find('a').first().text().trim();
      const price = $el.text().match(/[0-9,]+万円/)?.[0] || '';
      console.log('Title from a:', title);
      console.log('Price from regex:', price);
    }
  });
}

test().catch(console.error);