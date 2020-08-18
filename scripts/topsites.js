import * as fs from 'fs';
import fetch from '../src/fetcher/index.js';
import filter from '../src/filter/index.js';
import { readExistingServices, process } from './tosback-import.js';

const TOP_SITES = [
  'google.com',
  'youtube.com',
  'baidu.com',
  'qq.com',
  'facebook.com',
  'sohu.com',
  'taobao.com',
  '360.cn',
  'amazon.com',
  'jd.com',
  'yahoo.com',
  'wikipedia.org',
  'sina.com.cn',
  'weibo.com',
  'reddit.com',
  'live.com',
  'zoom.us',
  'netflix.com',
  'xinhuanet.com',
  'okezone.com',
  'instagram.com',
  'microsoft.com',
  'vk.com',
  'myshopify.com',
  'alipay.com',
  'office.com',
  'csdn.net',
  'twitch.tv',
  'yahoo.co.jp',
  'bongacams.com',
  'panda.tv',
  'zhanqi.tv',
  'google.com.hk',
  'bing.com',
  'aliexpress.com',
  'ebay.com',
  'naver.com',
  'amazon.in',
  'china.com.cn',
  'microsoftonline.com',
  'blogspot.com',
  'stackoverflow.com',
  'tianya.cn',
  'twitter.com',
  'amazon.co.jp',
  'google.co.in',
  'tribunnews.com'
];

const serviceDomains = {
  Blogspot: 'blogspot.com',
  Google: [ 'google.com', 'google.com.hk', 'google.co.in' ],
  Youtube: [ 'youtube.com' ],
  Yahoo: [ 'yahoo.com', 'yahoo.co.jp' ]
};

const anchors = [
  'Privacy',
  'Voorwaarden',
  'Copyright',
  'Terms',
  'Policy & Safety',
  'Conditions of Use',
  'Privacy Notice',
  'Interest-Based Ads',
  'Shipping Rates & Policies',
  'Content policy',
  'Privacy policy',
  'Mod policy'
];

function domainToService(domain) {
  const found = Object.keys(serviceDomains).find(i => (serviceDomains[i].indexOf(domain) !== -1));
  return found || domain.split('.')[0];
}

const ignoreAnchors = fs.readFileSync('./data/ignoreAnchors.txt').toString().split('\n');

const docs = [];

function reportAnchors(markdown) {
  const matches = markdown.matchAll(new RegExp('\\[(.*?)\\]\\((.*?)\\)', 'g'));
  for (const match of matches) {
    if (match[1].length < 200 && anchors.indexOf(match[1]) === -1 && ignoreAnchors.indexOf(match[1]) === -1) {
      console.log(match[1]);
      ignoreAnchors.push(match[1]);
    }
  }
}

function extractAnchors(markdown, service) {
  anchors.forEach(anchor => {
    const match = markdown.match(new RegExp(`\\[${anchor}\\]\\((.*?)\\)`));
    if (match) {
      const url = match[1].split(' ')[0];
      docs.push({
        service,
        anchor,
        url
      });
      console.log(service, anchor, url);
    }
  });
}

async function crawlDoc({ service, anchor, url }) {
  console.log('crawlDoc', { service, anchor, url });
  try {
    process(service, anchor, url, undefined, 'https://www.alexa.com/topsites');
  } catch (e) {
    console.error('Failed to process', { service, anchor, url });
  }
}

async function crawlMainPage(domain) {
  try {
    const location = `https://${domain}/`;
    const html = await fetch(location);
    const markdown = await filter(html, { fetch: location, select: 'body' }, []);
    reportAnchors(markdown);
    const service = domainToService(domain);
    extractAnchors(markdown, service);
  } catch (e) {
    console.error('Failed to crawl main page of', domain);
  }
}
async function run() {
  await Promise.all(TOP_SITES.map(crawlMainPage));
  await readExistingServices();
  await Promise.all(docs.map(crawlDoc));
}
run();
