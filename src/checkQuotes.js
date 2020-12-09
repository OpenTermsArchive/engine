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
  const queryTemplate1 = 'SELECT text FROM documents WHERE id = $1:int';
  const contentResult = await psqlClient.query(queryTemplate1,
    [ docId ]);
  const { content } = contentResult.rows[0];

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
  const words = getWords(content);
  const promises = pointsAffected.rows.map(async row => {
    const { startWord, endWordInParagraph } = findQuote(getWords(row.quoteText).map(word => word.lower), words.map(word => word.lower));
    let newStatus = row.status;
    if (startWord) {
      // const endWord = startWord + endWordInParagraph;
      const quoteStart = words[startWord].start;
      const quoteEnd = words[startWord + endWordInParagraph - 1].end;
      const quoteText = content.substring(quoteStart, quoteEnd);
      console.log('found', {
        id: row.id,
        quoteText,
        // quoteStartWord: startWord,
        // quoteEndWord: endWord,
        quoteStart,
        quoteEnd
      });
      if (newStatus === 'approved-not-found') {
        newStatus = 'approved';
      }
      if (newStatus === 'pending-not-found') {
        newStatus = 'pending';
      }
      await psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Found quote', row.id, userId ]);
      const queryTemplate = 'UPDATE points SET "quoteText" = $1::text, "quoteStart" = $2::int, "quoteEnd" = $3::int, "status" = $4::text WHERE "id" = $5::int';
      const queryResult = await psqlClient.query(queryTemplate, [ quoteText, quoteStart, quoteEnd, newStatus, row.id ]);
      console.log(queryResult);
    } else {
      if (newStatus === 'approved') {
        newStatus = 'approved-not-found';
      }
      if (newStatus === 'pending') {
        newStatus = 'pending-not-found';
      }
      console.log('not found', row);
      await psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Quote not found', row.id, userId ]);
      const queryTemplate = 'UPDATE points SET "status" = $1::text WHERE id = $2::int';
      const queryResult = await psqlClient.query(queryTemplate, [ newStatus, row.id ]);
      console.log(queryResult);
    }
  });
  await Promise.all(promises);
}

export async function updateEtoCrawl(docId, content, psqlClient, userId) {
  await psqlClient.query('INSERT INTO document_comments (summary, document_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Updated crawl using tosback-crawler', docId, userId ]);
  await psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE id = $2::int',
    [ content, docId ]);
  // console.log(res);
}
