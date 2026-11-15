/* 轻量字符 n-gram 朴素贝叶斯情绪分类器：无模型下载，启动即用 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  const lexicon = data.lexicon.categories;
  const vocabulary = new Set();
  const models = {};

  const features = (text) => {
    const normalized = String(text || '').replace(/\s+/g, '');
    const result = new Set();
    for (let index = 0; index < normalized.length; index += 1) {
      result.add('1:' + normalized[index]);
      if (index + 1 < normalized.length) result.add('2:' + normalized.slice(index, index + 2));
      if (index + 2 < normalized.length) result.add('3:' + normalized.slice(index, index + 3));
    }
    return [...result];
  };

  Object.entries(lexicon).forEach(([category, terms]) => {
    const counts = new Map();
    let total = 0;
    terms.forEach((term) => {
      features(term).forEach((feature) => {
        counts.set(feature, (counts.get(feature) || 0) + 1);
        total += 1;
        vocabulary.add(feature);
      });
    });
    models[category] = { counts, total };
  });

  const classify = (text) => {
    const inputFeatures = features(text);
    const scores = {};
    for (const [category, model] of Object.entries(models)) {
      let logScore = Math.log(1 / Object.keys(models).length);
      for (const feature of inputFeatures) {
        const count = model.counts.get(feature) || 0;
        logScore += Math.log((count + 0.35) / (model.total + vocabulary.size * 0.35));
        if (!count) logScore -= 0.012;
      }
      scores[category] = logScore;
    }
    const max = Math.max(...Object.values(scores));
    const probabilities = {};
    let total = 0;
    for (const [category, value] of Object.entries(scores)) {
      const exp = Math.exp(value - max);
      probabilities[category] = exp;
      total += exp;
    }
    for (const category of Object.keys(probabilities)) probabilities[category] /= total;
    const ranked = Object.entries(probabilities).sort((left, right) => right[1] - left[1]);
    return {
      primary: ranked[0][0],
      probabilities,
      margin: ranked[0][1] - ranked[1][1],
      confidence: ranked[0][1]
    };
  };

  window.AgentEmotionClassifier = { classify, vocabularySize: vocabulary.size };
})();
