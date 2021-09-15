import axios from 'axios';
const CACHE_PERIOD = 24 * 60 * 60 * 1000;
let listLastUpdated = null;
let proxies = [];

const random = (mn, mx) => Math.random() * (mx - mn) + mn;
const arrayRandom = (array) => array[Math.floor(random(1, array.length)) - 1];

// https://github.com/clarketm/proxy-list
const proxyUrl = 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt';

export const getProxies = async () => {
  if (
    listLastUpdated &&
    new Date().getTime() - listLastUpdated.getTime() >= CACHE_PERIOD &&
    proxies.length > 0
  ) {
    return proxies;
  }

  try {
    const { data } = await axios.get(proxyUrl);
    const match = data.match(/\d+\.\d+\.\d+\.\d+:\d+/gim);
    proxies = match.map((proxy) => `http://${proxy}`);
    listLastUpdated = new Date();
  } catch (e) {
    console.error('Could not get proxies', e.toString());
  }

  return proxies;
};

export const getRandomProxy = async () => {
  return arrayRandom(await getProxies());
};
