// 把各来源（OpenLibrary subjects / Google Books BISAC categories / TMDB genres）
// 返回的原始标签清洗、去噪，并映射到规范类型（lib/recommendations/genres.js）。
//
// 设计见对话：两层模型——规范类型（骨架，进 GENRES 表）+ 自由标签（长尾，清洗后保留）。

import { ALIAS_TO_GENRE } from "@/lib/recommendations/genres";

const MAX_SUBJECTS = 40;

// 垃圾标签：索书号、杜威号、馆藏/格式/营销/翻译标记等，直接丢弃。
const JUNK_PATTERNS = [
  /^[a-z]{1,3}\s?\d/i, // 索书号 e.g. "qa76.6 .h857 1999"
  /^\d{3}(\.\d+)?$/, // 杜威号 e.g. "005.1"
  /translations? into/i,
  /\blanguage (books|materials)\b/i,
  /\blarge type\b/i,
  /\baccessible book\b/i,
  /\bprotected daisy\b/i,
  /\bin library\b/i,
  /\bcliffs?\s?notes\b/i,
  /\bstaff picks\b/i,
  /\bbestseller\b/i,
  /\breviewed\b/i,
  /^nyt[:=]/i,
  /\bnyt:/i,
  /=\d{4}-\d{2}-\d{2}/, // 带日期的榜单标记
  /\bopen library\b/i,
  /\bspecimens?\b/i,
  /\breading level\b/i,
];

/** 归一单个标签：去引号/多余标点、压空格、转小写。返回 "" 表示应丢弃。 */
export function normalizeSubject(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim().replace(/["“”']/g, "").replace(/\s+/g, " ").trim();
  // 剥掉 ", fiction" / "fiction," 之类的虚构包装，保留核心词
  s = s.replace(/,?\s*fiction\s*$/i, "").replace(/^fiction\s*[,:]\s*/i, "").trim();
  return s.toLowerCase();
}

/** 是否为应丢弃的垃圾标签。 */
export function isJunkSubject(normalized) {
  if (!normalized || normalized.length < 2 || normalized.length > 60) return true;
  return JUNK_PATTERNS.some((re) => re.test(normalized));
}

// 把单个原始标签拆成候选 token：BISAC 按 "/" 分层，逗号分隔的也拆开。
function tokenize(normalized) {
  return normalized
    .split(/\s*[/,]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part !== "general");
}

/**
 * 清洗一组原始标签 → 去噪、去重、限量的"自由标签"列表（小写）。
 */
export function cleanSubjects(rawList) {
  const seen = new Set();
  const out = [];
  for (const raw of rawList ?? []) {
    const norm = normalizeSubject(raw);
    if (isJunkSubject(norm)) continue;
    for (const token of tokenize(norm)) {
      if (isJunkSubject(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= MAX_SUBJECTS) return out;
    }
  }
  return out;
}

// 单个清洗后 token → 规范类型 id（命中第一个别名即返回）。
function tokenToGenre(token) {
  for (const [alias, genreId] of ALIAS_TO_GENRE) {
    const hit = alias.length <= 3 ? token === alias : token.includes(alias);
    if (hit) return genreId;
  }
  return null;
}

/**
 * 一组原始标签 → 去重的规范类型 id 列表（用于推荐/筛选的骨架层）。
 */
export function subjectsToGenreIds(rawList) {
  const cleaned = cleanSubjects(rawList);
  const ids = new Set();
  for (const token of cleaned) {
    const id = tokenToGenre(token);
    if (id) ids.add(id);
  }
  return [...ids];
}
