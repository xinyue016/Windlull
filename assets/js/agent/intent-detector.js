/* 先识别对话意图，避免把问候、感谢、告别误当成情绪倾诉 */
(() => {
  'use strict';

  const normalize = (text) => String(text || '').trim().replace(/[，。！？、,.!?～~]/g, '');
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const storyPieces = {
    heroes: ['一只总把雨声装进口袋的小刺猬', '住在旧钟表里的月亮兔', '喜欢收集晚霞的纸船', '一只害怕打雷的小狐狸', '会替人保管秘密的陶罐'],
    places: ['旧车站旁的小屋', '长满蒲公英的山坡', '只剩一盏路灯的街道', '湖边废弃的候车亭', '一座很小的玻璃温室'],
    problems: ['它把一封准备寄出的信弄丢了', '它连续几晚都听见同一个轻轻的敲门声', '它害怕第二天醒来时一切都变了', '它一直找不到让自己安心的声音', '它不知道该怎么向朋友说出抱歉'],
    helpers: ['一只爱收集晨光的蜗牛', '会折纸鹤的邮差', '一棵只在夜里说话的树', '一只总慢半拍的小狗', '住在风铃里的老奶奶'],
    actions: ['它们没有急着解决问题，只是一起坐了一会儿', '它们沿着露水留下的银线慢慢寻找', '它们把担心写在纸上，再折成一只小船', '它们决定先完成最小的一步，其他事情明天再说', '它们把灯调暗，认真听完彼此没说完的话'],
    endings: ['后来问题没有一下子消失，但那个夜晚不再那么难熬。', '最后它发现，真正让它安心的不是答案，而是有人愿意陪它等一等。', '第二天醒来，事情还是原来的样子，可它已经能迈出更小、更稳的一步。', '它把这段经历记了下来，留给以后偶尔也会害怕的自己。']
  };

  const tellStory = () => {
    const hero = pick(storyPieces.heroes);
    const place = pick(storyPieces.places);
    const problem = pick(storyPieces.problems);
    const helper = pick(storyPieces.helpers);
    const action = pick(storyPieces.actions);
    const ending = pick(storyPieces.endings);
    return `${hero}住在${place}。有一天，${problem}。它遇见了${helper}。${action}。${ending}`;
  };

  const patterns = [
    {
      type: 'greeting',
      test: /^(你好|您好|嗨|哈喽|hello|hi|在吗|在不在|早上好|上午好|下午好|晚上好|我又来了)[啊呀哦呢嘛]*$/i,
      replies: ['你好呀，我在这里。今天想聊点什么？', '嗨，我在。你慢慢说，我听着。', '你好呀。今天过得怎么样？']
    },
    {
      type: 'thanks',
      test: /^(谢谢|谢谢你|感谢|谢啦|辛苦了|明白了|知道了)[啊呀啦]*$/,
      replies: ['不客气，我会在这里。还有什么想说的吗？', '不用谢，能陪到你就好。']
    },
    {
      type: 'farewell',
      test: /^(再见|拜拜|晚安|先这样|下次聊|我走了)[啊呀啦]*$/,
      replies: ['好，今天辛苦了。需要我的时候再回来。', '晚安，先好好休息。']
    },
    {
      type: 'identity',
      test: /^(你是谁|你叫什么|你是什么|介绍一下你自己)$/,
      replies: ['我是运行在这台设备里的情绪搭子。会听你说，也会在本地识别情绪和推荐放松方式，不会把内容上传。']
    },
    {
      type: 'capability',
      test: /^(你能做什么|你可以做什么|你会什么|怎么用|能帮我什么)$/,
      replies: ['你可以跟我说最近遇到的烦恼。我会在本地识别情绪、给出安慰和建议，也可以推荐适合的放松小游戏。']
    },
    {
      type: 'boredom',
      test: /^(好|有点|很|太|特别)?无聊(啊|呀|哦|呢|死了|得很)?$|^(没事干|不知道干嘛|好闲|闲得慌)$/,
      replies: ['无聊的时候，想找点轻松的事做，还是只是随口感叹一下？', '那要不要随便挑个小游戏玩一会儿？不用认真，玩两分钟也行。', '好，那我们先不分析情绪。你想聊天、听点声音，还是找个小游戏玩玩？']
    },
    {
      type: 'casual',
      test: /^(嗯|哦|好吧|好的|哈哈|嘿嘿|随便聊聊|在干嘛|没什么)$/,
      replies: ['嗯，我在。想说什么都可以。', '好呀，那我们随便聊聊。你今天最想提起的是哪件事？']
    },
    {
      type: 'assistant_status',
      test: /^(你在干嘛|你在做什么|你现在在做什么|你忙吗|你在吗)$/,
      replies: ['我在陪着你呀。你想随便聊聊，还是有件事想说说？', '我在这里听你说话。你想轻松聊几句，还是说说最近的事？']
    },
    {
      type: 'chat_invite',
      test: /^(陪我聊聊|聊聊天|陪我说话|随便聊会儿|想聊聊|说说话)$/,
      replies: ['好啊，今天想聊轻松一点的，还是最近有什么压着你？', '可以呀，我们慢慢聊。你最近最常想起的是什么？']
    },
    {
      type: 'story',
      test: /^(你)?(能不能|可不可以)?(给我)?(讲|说)(一个|个|段)?故事(吧|好不好|可以吗|行吗)?$|^讲个故事(给我听)?$/,
      replies: []
    },
    {
      type: 'joke',
      test: /^(你)?(能不能|可不可以)?(给我)?(讲|说)(一个|个)?笑话(吧|好不好|可以吗|行吗)?$/,
      replies: ['为什么云朵不爱吵架？因为它一生气就会变成乌云，自己也开心不起来。', '小海豚去考试，为什么带了铅笔和游泳圈？因为怕题目太深。']
    }
  ];

  const detect = (text, context = {}) => {
    const normalized = normalize(text);
    const recommendation = context.recommendation || null;
    const waitingMatch = normalized.match(/还有\s*([0-9一二三四五六七八九十两半几]+)\s*(分钟|小时|个小时)\s*(才|就)?\s*(上课|下课|开会|考试|出门|下班|到点)/);
    if (waitingMatch) {
      const amount = waitingMatch[1];
      const unit = waitingMatch[2];
      const event = waitingMatch[4];
      return {
        type: 'waiting_context',
        reply: pick([
          `还有${amount}${unit}才${event}，这段时间可以先缓一缓，不用急着做什么。`,
          `${amount}${unit}不算太长，先让自己安静一会儿，等${event}的时候再说。`,
          `那正好利用这${amount}${unit}松一下，什么也不用完成。`
        ])
      };
    }
    if (/^(快|马上|就要)?(上课|下课|开会|考试|出门|下班)了$/.test(normalized)) {
      return {
        type: 'upcoming_event',
        reply: pick(['那就先准备一下，等忙完再接着说也可以。', '好，那一会儿结束了再回来，我在这里。', '先去忙吧，不用急着现在把所有话说完。'])
      };
    }
    if (context.lastIntent === 'game_request') {
      if (/^(想安静|安静一点|静一点|想静静)$/.test(normalized)) {
        return { type: 'game_choice', reply: '那就试试静心流沙吧。不用操作太多，看细沙慢慢落下就好；想更专注一点也可以去敲木鱼。' };
      }
      if (/^(想解压|解压|想释放|动手|发泄一下)$/.test(normalized)) {
        return { type: 'game_choice', reply: '那更适合脆皮捏捏乐。可以慢慢浸蜡，再从边缘一点点捏碎，比较适合把压力释放出来。' };
      }
      if (/^(轻松一点|想轻松|随便|都行|随便玩一个|听你的)$/.test(normalized)) {
        return { type: 'game_choice', reply: '那就先去敲木鱼吧，点一下就会响，不需要学规则。玩一会儿觉得不合适，再换别的也可以。' };
      }
    }
    if (context.lastAnalysis && /^(嗯+[\s，、]*)?(一点点吧?|有一点点?吧?|还好|还行|是的|对|差不多)$|^嗯+$/.test(normalized)) {
      const positive = Number(context.lastAnalysis.valence) > 0.12;
      const previousReply = context.previousReply || '';
      const positiveReplies = [
        '一点点也算数，不用急着让自己马上完全恢复。',
        '能维持住这一点轻松，就已经很好了。',
        '不用把好转变成新的任务，保持现在这样就行。'
      ];
      const negativeReplies = [
        '嗯，我听到了。我们先不用急着往前走。',
        '一点点变化也值得记住，不需要现在就变好。',
        '好，我先陪你停在这里，不急着找答案。'
      ];
      const pool = positive ? positiveReplies : negativeReplies;
      const fresh = pool.filter((item) => !previousReply.includes(item));
      return {
        type: 'mild_ack',
        reply: (fresh.length ? fresh : pool)[0]
      };
    }
    if (context.lastAnalysis && /^(怎么办|我该怎么办|我该怎么做|给点建议|给个建议|有什么建议|给我个建议|建议呢|有什么办法|怎么缓解|帮我分析)$/.test(normalized)) {
      return { type: 'advice_followup', reply: '' };
    }
    if (/^(什么|哪个|啥)(游戏|小游戏)|^(玩什么|推荐了什么|你说的游戏是什么|是哪个游戏)$/.test(normalized)) {
      return {
        type: 'recommendation_info',
        reply: recommendation
          ? `我刚刚推荐的是「${recommendation.name}」。${recommendation.reason}大概 ${recommendation.duration}，点下面的“去${recommendation.name}”就能进入。`
          : '我还没有具体推荐游戏。你可以先告诉我现在更想放松、转移注意力，还是想找个东西玩一会儿。'
      };
    }
    if (recommendation && /^(怎么玩|在哪里玩|在哪玩|入口在哪|怎么进去)$/.test(normalized)) {
      return {
        type: 'recommendation_help',
        reply: `点下面的“去${recommendation.name}”就能直接进入。${recommendation.reason}`
      };
    }
    if (recommendation && /^(还有别的|换个游戏|其他游戏|还有吗|不想玩这个)$/.test(normalized)) {
      return {
        type: 'recommendation_alternative',
        reply: `刚才推荐的是「${recommendation.name}」。如果不想玩这个，也可以去游戏页看看敲木鱼、静心流沙、果冻工坊和脆皮捏捏乐，选一个现在最不费力的。`
      };
    }
    if (/^(我想玩游戏|想玩游戏|我想玩点什么|推荐个游戏|推荐一个游戏|找个游戏玩|有什么游戏|有什么游戏可以玩|有什么好玩(的|的东西)?(吗|啊|呀|呢)?|有什么可以玩(的)?(吗|啊|呀|呢)?|能玩什么(呀|啊)?|推荐点好玩(的)?|推荐好玩(的)?)$/.test(normalized)) {
      return {
        type: 'game_request',
        reply: '有呀。想安静一点可以玩敲木鱼或静心流沙；想动手解压可以选脆皮捏捏乐；想轻松一点可以做果冻。你现在更想安静、解压，还是随便玩一个？'
      };
    }
    if (normalized.length <= 30 && /(讲|说|来).*(故事|笑话)/.test(normalized)) {
      if (normalized.includes('笑话')) return { type: 'joke', reply: pick(['为什么云朵不爱吵架？因为它一生气就会变成乌云，自己也开心不起来。', '小海豚去考试，为什么带了铅笔和游泳圈？因为怕题目太深。']) };
      return { type: 'story', reply: tellStory() };
    }
    for (const pattern of patterns) {
      if (pattern.test.test(normalized)) return { type: pattern.type, reply: pattern.type === 'story' ? tellStory() : pick(pattern.replies) };
    }
    return { type: 'emotion', reply: '' };
  };

  const generalReply = (text, previousReply = '') => {
    const isQuestion = /[?？]|吗|呢|什么|怎么|为什么|哪/.test(text);
    const replies = isQuestion
      ? [
          '这个问题可以慢慢聊。你想听直接一点的回答，还是随便说说？',
          '可以呀，我们聊聊这个。你更在意其中哪一部分？',
          '我知道你想问这个。先说说你最想弄明白的是什么？'
        ]
      : [
          '嗯，我在听。你可以继续说，也可以随时换个话题。',
          '好呀，我们就随便聊，不用急着得出什么结论。',
          '我听见了。这个话题可以继续，也可以聊点轻松的。'
        ];
    const fresh = replies.filter((reply) => !previousReply.includes(reply));
    return (fresh.length ? fresh : replies)[0];
  };

  window.AgentIntentDetector = { detect, generalReply };
})();
