function getWords(str) {
  // states:
  // inTag
  // inSpace
  // inWord
  // when coming out of word, or when at the end, pushWord.
  let state = 'unknown';
  let thisWordStart;
  const words = [];
  function pushWord(endPos) {
    const text = str.substring(thisWordStart, endPos);
    const lower = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower.length) {
      words.push({
        start: thisWordStart,
        end: endPos,
        text,
        lower
      });
    }
  }
  for (let i = 0; i < str.length; i++) {
    if (state === 'in-tag') {
      if (str[i] === '>') {
        state = 'unknown';
      }
    } else {
      const newState = (str[i].match(/[a-zA-Z]/) === null ? 'in-space' : 'in-word');
      if (state === 'in-word' && newState === 'in-space') {
        pushWord(i);
      }
      if (state !== 'in-word' && newState === 'in-word') {
        thisWordStart = i;
      }
      state = newState;
    }
  }
  if (state === 'in-word') {
    pushWord(str.length);
  }
  // console.log(words.map(word => word.lower));
  return words;
}

function wordsLineUp(quoteWords, paragraphWords) {
  let quotePointer = 0;
  let paragraphPointer = 0;
  do {
    if (paragraphPointer >= paragraphWords.length) {
      return false;
    }
    if (quoteWords[quotePointer] === paragraphWords[paragraphPointer]) {
      // console.log('in step', quotePointer, paragraphPointer, quoteWords[quotePointer]);
      quotePointer++;
      paragraphPointer++;
    } else if ((quotePointer + 1 < quoteWords.length) && (quoteWords[quotePointer + 1] === paragraphWords[paragraphPointer])) {
      // console.log('skipping in quote', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1]);
      quotePointer += 2;
      paragraphPointer++;
    } else if ((paragraphPointer + 1 < paragraphWords.length) && (quoteWords[quotePointer] === paragraphWords[paragraphPointer + 1])) {
      // console.log('skipping in paragraph', quotePointer, paragraphPointer, paragraphWords[paragraphPointer], quoteWords[quotePointer]);
      quotePointer++;
      paragraphPointer += 2;
    } else if ((quotePointer + 1 < quoteWords.length) && (paragraphPointer + 1 < paragraphWords.length) && (quoteWords[quotePointer + 1] === paragraphWords[paragraphPointer + 1])) {
      // console.log('skipping in both', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1], paragraphWords[paragraphPointer], paragraphWords[paragraphPointer + 1]);
      quotePointer += 2;
      paragraphPointer += 2;
    } else {
      // console.log('fork', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1], paragraphWords[paragraphPointer], paragraphWords[paragraphPointer + 1]);
      return false;
    }
  } while (quotePointer < quoteWords.length);
  return paragraphPointer;
}

function findQuote(quoteWords, documentWords) {
  // console.log('Finding quote', quoteWords);
  let searchStart = 0;
  let startWord;
  do {
    startWord = documentWords.indexOf(quoteWords[0], searchStart);
    // console.log('Found start word!', quoteWords[0], startWord);
    const endWordInParagraph = wordsLineUp(quoteWords, documentWords.slice(startWord));
    if (endWordInParagraph !== false) {
      // console.log('Found', quoteWords[0], startWord);
      return {
        startWord,
        endWordInParagraph
      };
    }
    searchStart = startWord + 1;
  } while (startWord !== -1);
  // throw new Error('quote not found!');
  // console.log('quote not found');
  return {
    startWord: false,
    endWordInParagraph: false
  };
}

export async function checkQuotes(docId, psqlClient, userId) {
  const queryTemplate1 = 'SELECT text FROM documents WHERE id = $1::int';
  const contentResult = await psqlClient.query(queryTemplate1,
    [ docId ]);
  const content = contentResult.rows[0].text;

  const queryTemplate2 = 'SELECT p."id", p."quoteText", p."quoteStart", p."quoteEnd", p."status" FROM points p INNER JOIN documents d ON p.document_id=d.id '
    + 'WHERE d.id = $1::int AND (p."status" = \'approved\' OR p."status" = \'pending\' OR p."status" = \'approved-not-found\' OR p."status" = \'pending-not-found\')';
  const pointsAffected = await psqlClient.query(queryTemplate2,
    [ docId ]);
  // const pointsAffected = {
  //   rows: [
  //     {
  //       quoteText: 'We believe you should always know what data we collect'
  //     }
  //   ]
  // };
  // console.log(pointsAffected);
  if (content === null) {
    console.log(docId, 'Document content is null');
    return;
  }
  const words = getWords(content);
  const promises = pointsAffected.rows.map(async row => {
    const newValues = {
      status: row.status
    };
    let found = false;
    const exactMatchPos = content.indexOf(row.quoteText);
    if (exactMatchPos !== -1) {
      // console.log(row.id, 'Exact quote match');
      newValues.quoteStart = exactMatchPos;
      newValues.quoteEnd = exactMatchPos + row.quoteText.length;
      newValues.quoteText = row.quoteText;
      found = true;
    } else {
      const { startWord, endWordInParagraph } = findQuote(getWords(row.quoteText).map(word => word.lower), words.map(word => word.lower));
      if (startWord) {
        // const endWord = startWord + endWordInParagraph;
        newValues.quoteStart = words[startWord].start;
        newValues.quoteEnd = words[startWord + endWordInParagraph - 1].end;
        newValues.quoteText = content.substring(newValues.quoteStart, newValues.quoteEnd);
        found = true;
      }
    }
    if (found) {
      // console.log('found', row.id, newValues);
      if (newValues.status === 'approved-not-found') {
        newValues.status = 'approved';
      }
      if (newValues.status === 'pending-not-found') {
        newValues.status = 'pending';
      }
      const changed = [];
      [ 'quoteText', 'quoteStart', 'quoteEnd', 'status' ].forEach(field => {
        if (newValues[field] !== row[field]) {
          changed.push(field);
        }
      });
      if (changed.length) {
        console.log(row.id, '!!! Found again, changing status');
        await psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ `Found quote, changed: ${changed.join(' ')}`, row.id, userId ]);
        const queryTemplate = 'UPDATE points SET "quoteText" = $1::text, "quoteStart" = $2::int, "quoteEnd" = $3::int, "status" = $4::text WHERE "id" = $5::int';
        await psqlClient.query(queryTemplate, [ newValues.quoteText, newValues.quoteStart, newValues.quoteEnd, newValues.status, row.id ]);
        // console.log(queryResult);
      } else {
        console.log(row.id, 'nothing changed, still OK', exactMatchPos);
      }
    } else {
      if (newValues.status === 'approved') {
        newValues.status = 'approved-not-found';
      }
      if (newValues.status === 'pending') {
        newValues.status = 'pending-not-found';
      }
      if (newValues.status !== row.status) {
        console.log(row.id, '!!! not found, changing status');
        await psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Quote not found', row.id, userId ]);
        const queryTemplate = 'UPDATE points SET "status" = $1::text WHERE id = $2::int';
        await psqlClient.query(queryTemplate, [ newValues.status, row.id ]);
      } else {
        console.log(row.id, 'nothing changed, still not OK');
      }
    }
  });
  await Promise.all(promises);
}

export async function updateEtoCrawl(docId, content, psqlClient, userId) {
  // console.log('updateEtoCrawl', docId, content, psqlClient, userId);
  await psqlClient.query('INSERT INTO document_comments (summary, document_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Updated crawl using tosback-crawler', docId, userId ]);
  await psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE id = $2::int',
    [ content, docId ]);
  // console.log(res);
}
