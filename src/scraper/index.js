import fetch from 'node-fetch';

const headers = new fetch.Headers({
  'Accept-Language': 'en',
});


export function scrape(url) {
  return fetch(url, headers)
    .then(function(response) {
      if (!response.ok) {
        throw new Error(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
      }
      return response.blob();
    })
    .then(function(response) {
      return response.text();
    });
}
