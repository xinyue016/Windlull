/* 情绪轨迹：比较基线和当前状态 */
(() => {
  'use strict';

  const baseline = { state: null, samples: [] };

  const score = (value) => (Number.isFinite(value) ? value : 0);

  const setBaseline = (analysis) => {
    baseline.state = { ...analysis };
    baseline.samples = [{ valence: analysis.valence, arousal: analysis.arousal }];
  };

  const evaluate = (analysis, selfReport = 0) => {
    if (!baseline.state) return { trend: 'stable', valenceDelta: 0, arousalDelta: 0, score: 0, confidence: 0.2 };
    const current = baseline.samples.reduce((sum, item) => sum + item.valence, 0) / baseline.samples.length;
    const start = score(baseline.state.valence);
    const valenceDelta = current - start;
    const arousalDelta = analysis.arousal - score(baseline.state.arousal);
    const negative = analysis.risk === 'high'
      ? -1
      : valenceDelta * 0.62 - Math.max(0, arousalDelta) * 0.16 + selfReport * 0.08;
    let trend = 'stable';
    if (negative >= 0.08) trend = 'improved';
    else if (negative >= 0.025) trend = 'slightly_improved';
    else if (negative <= -0.08) trend = 'worse';
    else if (negative <= -0.025) trend = 'slightly_worse';
    return {
      trend,
      valenceDelta: Number(valenceDelta.toFixed(3)),
      arousalDelta: Number(arousalDelta.toFixed(3)),
      score: Number(negative.toFixed(3)),
      confidence: Number(Math.min(0.88, 0.46 + Math.abs(valenceDelta) * 0.5 + Math.abs(selfReport) * 0.05).toFixed(3))
    };
  };

  const next = (analysis, selfReport = 0) => {
    if (!baseline.state) setBaseline(analysis);
    baseline.samples.push({ valence: analysis.valence, arousal: analysis.arousal });
    baseline.samples = baseline.samples.slice(-6);
    return evaluate(analysis, selfReport);
  };

  const reset = () => {
    baseline.state = null;
    baseline.samples = [];
  };

  const getState = () => ({
    state: baseline.state ? { ...baseline.state } : null,
    samples: baseline.samples.map((item) => ({ ...item }))
  });

  const restore = (saved) => {
    if (!saved || !saved.state) return;
    baseline.state = { ...saved.state };
    baseline.samples = Array.isArray(saved.samples) ? saved.samples.slice(-6).map((item) => ({ ...item })) : [];
  };

  window.AgentTrendTracker = { setBaseline, next, evaluate, reset, getState, restore };
})();
