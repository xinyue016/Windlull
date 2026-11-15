/* 根据情绪状态推荐小游戏 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  const rules = data.gameRules;

  const recommend = (analysis) => {
    if (analysis.risk !== 'low') return null;
    if (['calm', 'joy', 'satisfaction', 'gratitude', 'hope', 'anticipation'].includes(analysis.primary)) return null;
    const candidates = [];
    rules.rules.forEach((rule) => {
      const primaryMatch = rule.emotions.includes(analysis.primary);
      const secondaryMatch = analysis.secondary && rule.emotions.includes(analysis.secondary);
      if (!primaryMatch && !secondaryMatch) return;
      if (Number.isFinite(rule.arousalMin) && analysis.arousal < rule.arousalMin) return;
      if (Number.isFinite(rule.arousalMax) && analysis.arousal > rule.arousalMax) return;
      candidates.push({ ...rule, score: rule.priority + (primaryMatch ? 3 : 0) });
    });
    candidates.sort((left, right) => right.score - left.score);
    const selected = candidates[0];
    if (!selected || selected.game === null) return null;
    const game = rules.games[selected.game];
    return game ? { id: selected.game, ...game } : null;
  };

  window.AgentRecommender = { recommend };
})();
