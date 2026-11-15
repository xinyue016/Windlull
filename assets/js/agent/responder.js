/* 本地动态回复生成：引用用户原话，按情绪、强度、需要和知识组合，不直接挑选整段固定回答 */
(() => {
  'use strict';

  const taxonomy = new Map(window.EMOTION_AGENT_DATA.taxonomy.categories.map((item) => [item.id, item]));

  const nuance = {
    calm: '一种终于能稍微慢下来、让身体松一点的感觉',
    joy: '一种愿意让好事在心里多停留一会儿的轻快',
    satisfaction: '一种看见自己确实做到了一些事情的踏实',
    gratitude: '一种被接住、被看见的暖意',
    hope: '一种开始能看见方向的感觉',
    anticipation: '一种对接下来发生的事情有所期待的感觉',
    anxiety: '一种脑子一直没法真正停下来的紧绷',
    stress: '一种被许多事情同时推着走的重负',
    anger: '一种边界被碰到后的强烈反应',
    annoyance: '一种持续被打扰、很难安静下来的消耗',
    fear: '一种身体先进入防备状态的不安',
    sadness: '一种很沉、需要慢慢被接住的难过',
    disappointment: '一种期待落空后的挫败',
    grievance: '一种没有被理解、没有被公平对待的酸涩',
    loneliness: '一种想被靠近却暂时没有连接的孤单',
    fatigue: '一种已经撑了很久、身体和心都在要求休息的累',
    self_blame: '一种把责任都压回自己身上的严厉',
    shame: '一种很想躲起来、害怕被看见的紧绷',
    helplessness: '一种想用力却找不到着力点的无力',
    despair: '一种很难看到出口的沉重',
    jealousy: '一种被比较和不甘心牵住的感觉',
    disgust: '一种很想把某件事推开的排斥',
    confusion: '一种还没找到线索的混乱',
    surprise: '一种节奏突然被打乱的意外感',
    boredom: '一种暂时没有东西能提起兴趣的空荡',
    neutral: '一种暂时还说不清楚的感受'
  };

  const openerFrames = [
    '听起来像是{nuance}。',
    '现在的状态更像是{nuance}。',
    '我能理解，{nuance}确实会让人很消耗。',
    '这听起来确实是{nuance}。',
    '能感觉到，你现在正处在{nuance}里。',
    '{nuance}，不需要马上被处理好。',
    '这份状态听起来更像是{nuance}。',
    '我能感觉到这背后的分量，像是{nuance}。'
  ];

  const intensityLines = [
    '这份感受现在还比较轻，但已经在影响你',
    '这份感受已经占用了你不少注意力',
    '这份感受现在很重，继续硬撑会消耗更多',
    '它不是一点点不舒服，而是已经压到你身上了'
  ];

  const trendFrames = {
    improved: ['和刚才相比，你的表达里多了一点松动。', '我能感觉到，你现在比开头时稍微有余地了一点。'],
    slightly_improved: ['和刚才相比，好像缓下来了一点点。', '这次说起来时，紧绷感比刚才轻了一些。'],
    worse: ['和刚才相比，这件事正在变得更沉，不需要现在逼自己全部解决。', '我注意到这轮比刚才更重，我们可以把步子再放小。'],
    slightly_worse: ['这次听起来比刚才更压人一些。', '我听到紧绷感比上一轮多了一点。']
  };

  const adviceFrames = [
    '现在不用把全部解决。{suggestion}',
    '如果只留一个很小的动作，可以从这里开始：{suggestion}',
    '比起逼自己马上恢复，更实际的是：{suggestion}',
    '先给自己一个低一点的起点：{suggestion}',
    '你可以只做半步就够了：{suggestion}',
    '接下来这一分钟，不需要做别的，只试试：{suggestion}',
    '不用等到状态很好才开始，先这样试一下：{suggestion}',
    '把今天的要求再降一点：{suggestion}'
  ];

  const questionFrames = {
    listen: [
      '你现在更希望我安静陪着，还是继续听你往下说？',
      '这件事里，最希望有人理解你的是哪一部分？',
      '如果不用马上解决，你最想先把哪句话说出来？'
    ],
    advice: [
      '如果只处理眼前这一小步，你想先从哪件事开始？',
      '这些办法里，哪一个现在做起来阻力最小？',
      '你希望我给你一个很具体的步骤，还是先一起把问题理清？'
    ],
    distraction: [
      '你想先缓一缓，还是一起拆出一个马上能做的动作？',
      '现在给你一分钟停下，会不会比继续硬撑更有用？',
      '要不要先把注意力从那件事上移开一小会儿？'
    ],
    general: [
      '此刻最需要的是被理解，还是需要一点具体方向？',
      '这件事里，最让你难受的是哪一部分？',
      '你愿意再多说一点刚才那个瞬间吗？'
    ]
  };

  const gameFrames = [
    '如果你愿意，可以试试「{name}」。{reason}大约 {duration}。',
    '现在也可以先去「{name}」待一会儿，不需要做得多好。{reason}',
    '如果暂时不想继续分析，可以先去「{name}」。{reason}给自己{duration}的空隙就够。',
    '要不要把注意力先交给「{name}」？{reason}',
    '等你想换一种方式缓一缓时，可以点「{name}」。{reason}'
  ];

  const watchLines = [
    '如果这种状态继续加重，或者你担心自己会失去控制，请尽快联系一个可信任的人陪你。',
    '如果接下来情况更糟，不要一个人扛，找一个现实中能联系到的人告诉你现在的状态。'
  ];

  const closingFrames = [
    '慢慢来，我们只看眼前这一步。',
    '你不需要一次把所有事情处理好。',
    '能说出来，已经是在为自己留一点空间。',
    '这一刻不用逼自己马上振作。',
    '先把今天过到下一步，就已经够了。'
  ];

  const listeningLines = [
    '你可以继续慢慢说，我不急着给结论。',
    '这些感受不需要马上被整理得很清楚。',
    '我在听，你可以按照自己的节奏说。',
    '听起来这些事已经在你心里放了一段时间。',
    '先不用急着找解决办法，我会把这段话好好接住。',
    '你不用在这里表现得很镇定，难受就是难受。'
  ];

  const positiveListeningLines = [
    '一点点好转也算数，不用急着让自己马上完全恢复。',
    '先让这点轻松多停留一会儿，不用急着证明自己已经没事。',
    '能比之前好一点，说明你已经在慢慢调整了。',
    '这个变化不需要很大，只要比之前松一点就值得被看见。',
    '先按现在的节奏来，不需要马上回到最好的状态。'
  ];

  const hash = (text) => {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return Math.abs(value);
  };

  const choose = (list, seed) => list[hash(seed) % list.length];

  const intensityLine = (analysis, variant) => choose(intensityLines, analysis.primary + analysis.intensity + variant);

  const buildCandidate = (context, variant) => {
    const { analysis, trend, knowledge, recommendation, text, previousTrend, turnCount, recentReplies, forceAdvice } = context;
    if (analysis.risk === 'high') {
      return '我很在意你刚才说的话。现在最重要的不是分析原因，而是先保证你此刻的安全。请先离开可能伤害自己的物品或地点，马上联系一个能来到你身边的人，明确告诉对方：“我现在可能不安全，需要你陪我。”如果你已经准备伤害自己，请立即联系当地急救或紧急援助。你不需要一个人扛这一刻。';
    }

    const seed = analysis.primary + String(turnCount) + String(variant) + String(text).slice(0, 12);
    const opener = choose(openerFrames, seed + 'open')
      .replaceAll('{nuance}', nuance[analysis.primary] || nuance.neutral)
      .replaceAll('{intensityLine}', intensityLine(analysis, variant));
    const parts = [opener];

    const primaryGroup = taxonomy.get(analysis.primary)?.group || 'mixed';
    if (analysis.secondaryName && analysis.intensity >= 6 && primaryGroup !== 'positive') {
      parts.push(choose([
        '里面也夹着一点' + analysis.secondaryName + '。',
        '除了这份主要感受，我还听到一点' + analysis.secondaryName + '。',
        '它看起来不是单一的情绪，' + analysis.secondaryName + '也在里面。'
      ], seed + 'secondary'));
    }

    if (trend && previousTrend && trend.trend !== previousTrend && trendFrames[trend.trend]) {
      parts.push(choose(trendFrames[trend.trend], seed + 'trend'));
    }

    const includeAdvice = Boolean(forceAdvice) || analysis.need === 'advice' || analysis.need === 'distraction';
    const usedAdvice = (recentReplies || []).join('');
    const freshKnowledge = knowledge.filter((item) => !usedAdvice.includes(item.suggestion));
    const knowledgeItem = includeAdvice ? (freshKnowledge[0] || knowledge[0] || null) : null;
    if (knowledgeItem) {
      parts.push(choose(adviceFrames, seed + 'advice').replace('{suggestion}', knowledgeItem.suggestion));
    }

    if (analysis.risk === 'watch') parts.push(choose(watchLines, seed + 'watch'));

    const includeGameText = recommendation && analysis.risk === 'low' && !forceAdvice && analysis.need === 'distraction';
    const needsClarification = !forceAdvice && (
      analysis.need === 'advice' ||
      analysis.primary === 'confusion' ||
      (!analysis.matchedTerms.length && analysis.primary === 'neutral')
    );
    if (includeGameText) {
      parts.push(choose(gameFrames, seed + 'game')
        .replaceAll('{name}', recommendation.name)
        .replaceAll('{reason}', recommendation.reason)
        .replaceAll('{duration}', recommendation.duration));
    } else if (needsClarification) {
      const pool = questionFrames[analysis.need] || questionFrames.general;
      parts.push(choose(pool, seed + 'question'));
    } else if (analysis.need === 'listen') {
      const listeningPool = primaryGroup === 'positive' ? positiveListeningLines : listeningLines;
      const freshListening = listeningPool.filter((line) => !(opener.includes('听起来') && line.includes('听起来')));
      parts.push(choose(freshListening.length ? freshListening : listeningPool, seed + 'listen'));
    }

    if (turnCount >= 4 && hash(seed + 'closing') % 100 < 14) parts.push(choose(closingFrames, seed + 'closing'));
    return parts.join('');
  };

  const bigrams = (text) => {
    const normalized = String(text || '').replace(/\s+/g, '');
    const result = new Set();
    for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
    return result;
  };

  const similarity = (left, right) => {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    a.forEach((item) => { if (b.has(item)) overlap += 1; });
    return overlap / Math.max(a.size, b.size);
  };

  const compose = (context) => {
    if (context.analysis.risk === 'high') return buildCandidate(context, 0);
    const candidates = Array.from({ length: 7 }, (_, index) => buildCandidate(context, index));
    const recent = Array.isArray(context.recentReplies) ? context.recentReplies : [];
    let best = candidates[0];
    let bestPenalty = Infinity;
    candidates.forEach((candidate) => {
      const penalty = recent.reduce((sum, reply) => sum + similarity(candidate, reply), 0) + similarity(candidate, context.previousReply || '') * 0.4;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = candidate;
      }
    });
    return best;
  };

  window.AgentResponder = { compose };
})();
