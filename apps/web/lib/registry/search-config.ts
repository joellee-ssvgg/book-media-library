import type { SearchTextConfig } from "./types";

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
const LATIN_REGEX = /[a-zA-Z]/;

function countNonWhitespaceCharacters(text: string) {
  return Array.from(text).filter((char) => /\S/.test(char)).length;
}

export function pickSearchConfigByCJKRatio(text: string): SearchTextConfig {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return "simple";
  }

  const countableLength = countNonWhitespaceCharacters(trimmed);

  if (countableLength === 0) {
    return "simple";
  }

  const cjkMatches = trimmed.match(CJK_REGEX)?.length ?? 0;
  const ratio = cjkMatches / countableLength;

  if (ratio >= 0.3) {
    return "chinese_jieba";
  }

  if (LATIN_REGEX.test(trimmed)) {
    return "english";
  }

  return "simple";
}
