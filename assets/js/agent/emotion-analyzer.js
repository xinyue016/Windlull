/* 本地情绪分析：词典匹配 + word2vec 辅助 + VAD 分数 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  const taxonomy = new Map(data.taxonomy.categories.map((item) => [item.id, item]));
  const lexicon = data.lexicon;
  const word2vec = window.AgentWord2Vec;
  const tokenizer = window.AgentTokenizer;

  const INTENSIFIER_WEIGHT = 1.28;
  const DIMINISHER_WEIGHT = 0.78;
  const NEGATION_WEIGHT = -0.82;
  const MAX_CONTEXT_DISTANCE = 8;

  const phraseCategory = (term) => {
    for (const [category, terms] of Object.entries(lexicon.categories)) {
      if (terms.includes(term)) return category;
    }
    return null;
  };

  const contextModifier = (text, match) => {
    const before = text.slice(Math.max(0, match.index - MAX_CONTEXT_DISTANCE), match.index);
    let weight = 1;
    if (lexicon.intensifiers.some((word) => before.includes(word))) weight *= INTENSIFIER_WEIGHT;
    if (lexicon.diminishers.some((word) => before.includes(word))) weight *= DIMINISHER_WEIGHT;
    const prefix = before.replace(/\s+$/g, '');
    if (lexicon.negations.some((word) => prefix.endsWith(word))) weight *= NEGATION_WEIGHT;
    return weight;
  };

  const riskLevel = (text) => {
    if (lexicon.risk.high.some((term) => text.includes(term))) return 'high';
    if (lexicon.risk.watch.some((term) => text.includes(term))) return 'watch';
    return 'low';
  };

  const supportNeed = (text) => {
    for (const [need, terms] of Object.entries(lexicon.support_needs)) {
      if (terms.some((term) => text.includes(term))) return need;
    }
    return 'listen';
  };

  const analyze = (text) => {
    const normalized = tokenizer.normalize(text);
    const scores = Object.fromEntries(Object.keys(lexicon.categories).map((id) => [id, 0]));
    const matchedTerms = [];
    const matches = tokenizer.findTermMatches(normalized);
    for (const match of matches) {
      if (scores[match.category] === undefined) continue;
      const weight = contextModifier(normalized, match);
      const termWeight = 1 + Math.min(0.65, Math.max(0, match.term.length - 2) * 0.08);
      scores[match.category] += weight * termWeight;
      matchedTerms.push({ category: match.category, term: match.term, weight });
    }

    const tokens = tokenizer.tokenize(normalized);
    const classifier = window.AgentEmotionClassifier
      ? window.AgentEmotionClassifier.classify(normalized)
      : { probabilities: {}, margin: 0, confidence: 0 };
    for (const category of Object.keys(scores)) {
      const anchorWords = lexicon.categories[category].slice(0, 12);
      const semantic = word2vec.similarity(tokens, anchorWords);
      const classifierScore = Number(classifier.probabilities[category] || 0);
      scores[category] += semantic * 1.05 + classifierScore * 1.8;
    }

    let ranked = Object.entries(scores)
      .map(([id, score]) => ({ id, score }))
      .sort((left, right) => right.score - left.score);
    let primary = ranked[0];
    if (!matchedTerms.length && primary.score - ranked[1].score < 0.24) {
      primary = { id: 'neutral', score: Math.max(primary.score, scores.neutral) };
      ranked = [primary, ...ranked.filter((item) => item.id !== 'neutral')];
    }
    const top = taxonomy.get(primary.id) || taxonomy.get('neutral');
    const second = ranked[1];
    const secondaryCategory = second ? taxonomy.get(second.id) : null;
    const groupCompatible = secondaryCategory && (
      top.group === 'mixed' || secondaryCategory.group === 'mixed' || secondaryCategory.group === top.group
    );
    const secondary = second && second.score > 0.16 && groupCompatible && second.id !== 'neutral' ? secondaryCategory : null;
    const positiveScore = ranked
      .filter((item) => taxonomy.get(item.id)?.group === 'positive')
      .reduce((sum, item) => sum + Math.max(0, item.score), 0);
    const negativeScore = ranked
      .filter((item) => taxonomy.get(item.id)?.group === 'negative')
      .reduce((sum, item) => sum + Math.max(0, item.score), 0);
    const totalScore = positiveScore + negativeScore;
    const lexicalConfidence = totalScore > 0
      ? Math.abs(primary.score) / Math.max(0.5, ranked.slice(0, 3).reduce((sum, item) => sum + Math.max(0, item.score), 0))
      : 0.2;
    const intensity = Math.max(1, Math.min(10, 1 + Math.round(Math.min(9, Math.max(0, primary.score) * 1.5))));
    const valence = totalScore > 0
      ? (positiveScore - negativeScore) / totalScore * 0.72 + top.valence * 0.28
      : 0;
    const arousal = top.arousal;
    const confidence = Math.max(0.2, Math.min(0.94, 0.34 + lexicalConfidence * 0.32 + classifier.margin * 1.1 + (matchedTerms.length ? 0.1 : 0)));

    const risk = riskLevel(normalized);
    const nonNeutralMatches = matchedTerms.filter((item) => item.category !== 'neutral').length;
    const isEmotional = risk !== 'low' || nonNeutralMatches > 0 || (top.group !== 'mixed' && classifier.margin > 0.18);

    return {
      primary: top.id,
      primaryName: top.name,
      secondary: secondary ? secondary.id : null,
      secondaryName: secondary ? secondary.name : null,
      intensity,
      valence: Number(valence.toFixed(3)),
      arousal: Number(arousal.toFixed(3)),
      dominance: top.dominance,
      confidence: Number(confidence.toFixed(3)),
      risk,
      need: supportNeed(normalized),
      isEmotional,
      emotionalMatchCount: nonNeutralMatches,
      classifierMargin: Number(classifier.margin.toFixed(3)),
      scores,
      matchedTerms,
      tokens
    };
  };

  window.AgentEmotionAnalyzer = { analyze };
})();
