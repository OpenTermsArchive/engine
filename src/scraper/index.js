import fetch from 'node-fetch';

const LANGUAGE = 'en'

export default function scrape(url) {
  return fetch(url, {
      headers: {'Accept-Language': LANGUAGE}
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
      }
      return response.blob();
    }).then(function(response) {
      return response.text();
    });
}
