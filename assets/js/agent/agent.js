/* 纯前端情绪智能体总入口 */
(() => {
  'use strict';

  const STATE_KEY = 'emotion-atlas-agent-memory';
  const analyzer = window.AgentEmotionAnalyzer;
  const trendTracker = window.AgentTrendTracker;
  const retriever = window.AgentRetriever;
  const responder = window.AgentResponder;
  const recommender = window.AgentRecommender;
  const intentDetector = window.AgentIntentDetector;
  let turnCount = 0;
  let smallTalkCount = 0;
  let lastIntent = null;
  let lastResult = null;
  let recentReplies = [];

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      turnCount = Number(saved.turnCount) || 0;
      smallTalkCount = Number(saved.smallTalkCount) || 0;
      lastIntent = saved.lastIntent || null;
      recentReplies = Array.isArray(saved.recentReplies) ? saved.recentReplies.slice(-4) : [];
      if (saved.baseline && trendTracker.restore) trendTracker.restore(saved.baseline);
      if (saved.lastResult) lastResult = saved.lastResult;
    } catch (_) { /* local storage disabled */ }
  };

  const saveState = () => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        turnCount,
        smallTalkCount,
        lastIntent,
        recentReplies,
        baseline: trendTracker.getState ? trendTracker.getState() : null,
        lastResult
      }));
    } catch (_) { /* storage disabled */ }
  };

  const process = (text, selfReport = 0) => {
    const intent = intentDetector.detect(text, {
      recommendation: lastResult ? lastResult.recommendation : null,
      lastAnalysis: lastResult ? lastResult.analysis : null,
      previousReply: lastResult ? lastResult.reply : '',
      lastIntent
    });
    if (intent.type === 'advice_followup' && lastResult) {
      const analysis = { ...lastResult.analysis, need: 'advice' };
      const knowledge = retriever.retrieve(text + ' ' + analysis.primaryName, analysis);
      const reply = responder.compose({
        analysis,
        trend: lastResult.trend,
        knowledge,
        recommendation: lastResult.recommendation,
        text,
        previousTrend: lastResult.trend?.trend || null,
        previousReply: lastResult.reply,
        recentReplies,
        turnCount,
        forceAdvice: true
      });
      recentReplies = [reply, ...recentReplies].slice(0, 4);
      turnCount += 1;
      smallTalkCount += 1;
      lastIntent = intent.type;
      saveState();
      return {
        intent: intent.type,
        internalOnly: true,
        analysis: null,
        trend: null,
        knowledge: knowledge.map((item) => ({ id: item.id, title: item.title, score: item.score })),
        recommendation: lastResult.recommendation,
        reply,
        turnCount
      };
    }
    if (intent.type !== 'emotion') {
      turnCount += 1;
      smallTalkCount += 1;
      lastIntent = intent.type;
      saveState();
      return {
        intent: intent.type,
        internalOnly: true,
        analysis: null,
        trend: null,
        knowledge: [],
        recommendation: null,
        reply: intent.reply,
        turnCount
      };
    }
    const previous = lastResult ? lastResult.analysis : null;
    const previousTrend = lastResult ? lastResult.trend?.trend : null;
    const previousReply = lastResult ? lastResult.reply : '';
    let analysis = analyzer.analyze(text);
    if (previous && analysis.need !== 'listen' && !analysis.matchedTerms.length) {
      analysis = {
        ...analysis,
        primary: previous.primary,
        primaryName: previous.primaryName,
        secondary: previous.secondary,
        secondaryName: previous.secondaryName,
        intensity: previous.intensity,
        valence: previous.valence,
        arousal: previous.arousal,
        dominance: previous.dominance,
        isEmotional: true
      };
    }
    if (!analysis.isEmotional && analysis.need === 'listen') {
      const reply = intentDetector.generalReply(text, previousReply);
      recentReplies = [reply, ...recentReplies].slice(0, 4);
      turnCount += 1;
      smallTalkCount += 1;
      lastIntent = 'general_chat';
      saveState();
      return {
        intent: 'general_chat',
        internalOnly: true,
        analysis: null,
        trend: null,
        knowledge: [],
        recommendation: null,
        reply,
        turnCount
      };
    }
    const trend = trendTracker.next(analysis, Number(selfReport) || 0);
    const knowledge = retriever.retrieve(text, analysis);
    const recommendation = analysis.need === 'distraction' ? recommender.recommend(analysis) : null;
    const reply = responder.compose({
      analysis,
      trend,
      knowledge,
      recommendation,
      text,
      previousTrend,
      previousReply,
      recentReplies,
      turnCount
    });
    recentReplies = [reply, ...recentReplies].slice(0, 4);
    turnCount += 1;
    lastIntent = 'emotion';
    lastResult = {
      intent: 'emotion',
      analysis,
      trend,
      knowledge: knowledge.map((item) => ({ id: item.id, title: item.title, score: item.score })),
      recommendation,
      reply,
      turnCount
    };
    saveState();
    return lastResult;
  };

  const reset = () => {
    turnCount = 0;
    smallTalkCount = 0;
    lastIntent = null;
    lastResult = null;
    recentReplies = [];
    trendTracker.reset();
    try { localStorage.removeItem(STATE_KEY); } catch (_) { /* storage disabled */ }
  };

  const getLastResult = () => lastResult;
  const applySelfReport = (value) => {
    if (!lastResult) return null;
    const trend = trendTracker.evaluate(lastResult.analysis, Number(value) || 0);
    lastResult = { ...lastResult, trend };
    saveState();
    return lastResult;
  };
  loadState();
  window.AgentEngine = { process, reset, getLastResult, applySelfReport };
})();
