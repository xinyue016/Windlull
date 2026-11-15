/* 中文分词与词典短语补充 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  const lexicon = data.lexicon;
  const phrases = [...new Set(Object.values(lexicon.categories).flat())]
    .sort((left, right) => right.length - left.length);
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
    : null;

  const normalize = (text) => String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：,.!?;:（）()【】\[\]“”"']/g, ' ')
    .trim();

  const tokenize = (text) => {
    const normalized = normalize(text);
    const tokens = [];
    if (segmenter) {
      for (const item of segmenter.segment(normalized)) {
        if (item.isWordLike) tokens.push(item.segment);
      }
    } else {
      tokens.push(...normalized.split(' ').filter(Boolean));
    }

    for (const phrase of phrases) {
      if (normalized.includes(phrase) && !tokens.includes(phrase)) tokens.push(phrase);
    }
    return [...new Set(tokens)];
  };

  const findTermMatches = (text) => {
    const normalized = normalize(text);
    const matches = [];
    for (const category of Object.keys(lexicon.categories)) {
      for (const term of lexicon.categories[category]) {
        let start = 0;
        while (start < normalized.length) {
          const index = normalized.indexOf(term, start);
          if (index < 0) break;
          matches.push({ category, term, index, end: index + term.length });
          start = index + Math.max(1, term.length);
        }
      }
    }
    return matches.sort((left, right) => left.index - right.index || right.term.length - left.term.length);
  };

  window.AgentTokenizer = { normalize, tokenize, findTermMatches };
})();
