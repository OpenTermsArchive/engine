import fetch from 'node-fetch';

const LANGUAGE = 'en'

export default async function scrape(url) {
  const response = await fetch(url, {
    headers: {'Accept-Language': LANGUAGE}
  });

  if (!response.ok) {
    throw new Error(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
  }

  const blob = await response.blob();

  return blob.text();
}

