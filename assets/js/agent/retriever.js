/* 本地轻量 RAG：知识条目检索 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  const entries = data.knowledge.entries;
  const word2vec = window.AgentWord2Vec;
  const tokenizer = window.AgentTokenizer;

  const retrieve = (text, analysis, limit = 2) => {
    const normalized = tokenizer.normalize(text);
    const tokens = tokenizer.tokenize(normalized);
    const ranked = entries.map((entry) => {
      let score = 0;
      if (entry.emotions.includes(analysis.primary)) score += 4.2;
      if (analysis.secondary && entry.emotions.includes(analysis.secondary)) score += 1.0;
      for (const keyword of entry.keywords) {
        if (normalized.includes(keyword)) score += 1.5;
      }
      const semantic = word2vec.similarity(tokens, [entry.title, ...entry.keywords]);
      score += Math.max(0, semantic) * 0.8;
      return { ...entry, score: Number(score.toFixed(3)) };
    }).sort((left, right) => right.score - left.score);
    return ranked.filter((entry) => entry.score > 0.15).slice(0, limit);
  };

  window.AgentRetriever = { retrieve };
})();
