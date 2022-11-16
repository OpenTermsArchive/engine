import fs from 'fs';

import { parser } from 'keep-a-changelog';

// Parse a changelog file
const changelog = parser(fs.readFileSync('CHANGELOG.md', 'UTF-8'));

// Generate the new changelog string
console.log(changelog.toString());
