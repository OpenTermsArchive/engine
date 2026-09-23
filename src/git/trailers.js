export function parseTrailers(message) {
  const trailers = {};

  const sections = message.split(/\n\n+/);
  const trailersSection = sections[sections.length - 1];

  if (!trailersSection.includes(':')) {
    return trailers;
  }

  const validTrailerKeyRegex = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*:$/; // Accepts either a single word or multiple words separated by dashes

  for (const line of trailersSection.split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine) { // Skip empty lines
      continue;
    }

    const colonIndex = trimmedLine.indexOf(':');

    if (colonIndex === -1) { // Skip lines without a colon
      continue;
    }

    const key = trimmedLine.slice(0, colonIndex + 1);
    const value = trimmedLine.slice(colonIndex + 1).trim();

    if (validTrailerKeyRegex.test(key) && value) {
      const keyWithoutColon = key.slice(0, -1);

      trailers[keyWithoutColon.toLowerCase()] = value;
    }
  }

  return trailers;
}

export function formatTrailers(trailers) {
  if (Object.keys(trailers).length === 0) {
    return '';
  }

  return Object.entries(trailers)
    .filter(([ , value ]) => value !== '')
    .map(([ key, value ]) => `${key[0].toUpperCase() + key.slice(1).toLowerCase()}: ${value}`)
    .join('\n');
}
