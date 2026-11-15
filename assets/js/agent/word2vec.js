/* 纯前端 word2vec 读取与余弦相似度 */
(() => {
  'use strict';

  const data = window.EMOTION_AGENT_DATA;
  if (!data || !data.word2vec) throw new Error('情绪智能体数据未加载');

  const { vocab, dimensions, count, vectorsBase64 } = data.word2vec;
  const binary = atob(vectorsBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const vectors = new Float32Array(bytes.buffer);
  if (vectors.length !== count * dimensions) throw new Error('word2vec 向量尺寸不匹配');

  const getVector = (word) => {
    const index = vocab[word];
    if (!Number.isInteger(index)) return null;
    return vectors.subarray(index * dimensions, (index + 1) * dimensions);
  };

  const cosine = (left, right) => {
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }
    const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
    return denominator ? dot / denominator : 0;
  };

  const average = (words) => {
    const found = words.map(getVector).filter(Boolean);
    if (!found.length) return null;
    const result = new Float32Array(dimensions);
    found.forEach((vector) => {
      for (let index = 0; index < dimensions; index += 1) result[index] += vector[index];
    });
    for (let index = 0; index < dimensions; index += 1) result[index] /= found.length;
    return result;
  };

  window.AgentWord2Vec = {
    dimensions,
    vocabularySize: Object.keys(vocab).length,
    hasWord: (word) => Number.isInteger(vocab[word]),
    getVector,
    cosine,
    average,
    similarity(leftWords, rightWords) {
      const left = average(Array.isArray(leftWords) ? leftWords : [leftWords]);
      const right = average(Array.isArray(rightWords) ? rightWords : [rightWords]);
      return left && right ? cosine(left, right) : 0;
    }
  };
})();
