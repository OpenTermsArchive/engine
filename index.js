import { updateTerms } from './src/index.js';

(async () => {
  try {
    await updateTerms();
  } catch (e) {
    console.log(e);
  }
})();
