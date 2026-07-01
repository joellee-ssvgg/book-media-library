// 库内「更像这本」相似度：以规范类型(genres)重合为主信号，自由标签(subjects)做次级加权。
// 纯函数，便于单测；输入的 item 形如 { workId, title, genres:[], subjects:[] }。

function toSet(arr) {
  return new Set(Array.isArray(arr) ? arr : []);
}

function intersection(targetSet, candidateArr) {
  const out = [];
  if (!Array.isArray(candidateArr)) return out;
  for (const x of candidateArr) {
    if (targetSet.has(x)) out.push(x);
  }
  return out;
}

const SUBJECT_WEIGHT = 0.25; // subjects 是噪声更大的长尾，权重远低于规范类型

// 计算 candidate 相对 target 的相似度。genreScore = 共享规范类型数（强信号），
// subjectScore = 共享自由标签数（弱信号），total 用于排序。
export function similarityScore(target, candidate) {
  const sharedGenres = intersection(toSet(target?.genres), candidate?.genres);
  const sharedSubjects = intersection(toSet(target?.subjects), candidate?.subjects);
  const genreScore = sharedGenres.length;
  const subjectScore = sharedSubjects.length;
  return {
    genreScore,
    subjectScore,
    sharedGenres,
    total: genreScore + subjectScore * SUBJECT_WEIGHT,
  };
}

// 在 corpus 里找出和 target 最像的若干项（默认要求至少共享 1 个规范类型）。
// 按 workId 去重、排除 target 自身，按 total → genreScore → 标题 排序。
export function rankSimilar(target, corpus, options = {}) {
  const { limit = 6, minGenreOverlap = 1 } = options;
  const targetId = target?.workId;
  const seen = new Set();
  const scored = [];
  for (const candidate of corpus ?? []) {
    if (!candidate || !candidate.workId) continue;
    if (candidate.workId === targetId || seen.has(candidate.workId)) continue;
    seen.add(candidate.workId);
    const score = similarityScore(target, candidate);
    if (score.genreScore < minGenreOverlap) continue;
    scored.push({ ...candidate, ...score });
  }
  scored.sort(
    (a, b) =>
      b.total - a.total ||
      b.genreScore - a.genreScore ||
      String(a.title ?? "").localeCompare(String(b.title ?? ""))
  );
  return scored.slice(0, limit);
}
