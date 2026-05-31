import { describe, it, expect } from "vitest";
import { cleanSubjects, subjectsToGenreIds, normalizeSubject, isJunkSubject } from "@/lib/recommendations/subjects";

// 真实 Open Library subjects 样本（对话中实拉）。
const SAPIENS = [
  "Technology and civilization", "Human beings", "Historical Chronology", "Historia universal",
  "Historia", "Civilization", "World history", "History", "Non-Fiction", "Science",
  "SCIENCE / Life Sciences / General", "SCIENCE / Life Sciences / Evolution",
  "nyt:combined-print-and-e-book-nonfiction=2015-03-01", "New York Times bestseller",
  "Life Sciences", "Evolution",
];
const JANE_EYRE = [
  "Fiction", "Romance", 'Historical"', "Man-woman relationships, fiction", "Orphans, fiction",
  "Gothic fiction", "Literature", "Classic Literature", "Open Library Staff Picks", "Juvenile fiction",
];
const CIEN_ANOS = [
  "Spanish language books", "Fiction", "magic realism", "Magic realism (Literature)",
  "Translations into Russian", "Cliffs Notes", "Large type books", "Latin American fiction",
];
const PRAGMATIC = ["Computer programming", "Vocational education", "Qa76.6 .h857 1999", "005.1"];
const THREE_BODY = ["Fiction, science fiction, general"];

describe("subject cleaning", () => {
  it("丢弃索书号/杜威号/营销/翻译等垃圾", () => {
    const cleaned = cleanSubjects([...SAPIENS, ...PRAGMATIC, ...CIEN_ANOS]);
    expect(cleaned).not.toContain("005.1");
    expect(cleaned).not.toContain("qa76.6 .h857 1999");
    expect(cleaned).not.toContain("new york times bestseller");
    expect(cleaned.some((s) => s.startsWith("nyt:"))).toBe(false);
    expect(cleaned.some((s) => s.includes("translations into"))).toBe(false);
    expect(cleaned).not.toContain("cliffs notes");
    expect(cleaned).not.toContain("large type books");
  });

  it("剥掉 \", fiction\" 包装与残引号", () => {
    expect(normalizeSubject("Man-woman relationships, fiction")).toBe("man-woman relationships");
    expect(normalizeSubject('Historical"')).toBe("historical");
    expect(isJunkSubject("005.1")).toBe(true);
  });
});

describe("subject → 规范类型", () => {
  it("Sapiens → 历史 + 科普 + 社科", () => {
    const g = subjectsToGenreIds(SAPIENS);
    expect(g).toContain("history");
    expect(g).toContain("science");
    expect(g).toContain("social_science");
  });
  it("Jane Eyre → 爱情 + 推理悬疑(gothic) + 经典", () => {
    const g = subjectsToGenreIds(JANE_EYRE);
    expect(g).toContain("romance");
    expect(g).toContain("mystery");
    expect(g).toContain("classics");
  });
  it("百年孤独 → 奇幻(magic realism)", () => {
    expect(subjectsToGenreIds(CIEN_ANOS)).toContain("fantasy");
  });
  it("务实程序员 → 计算机", () => {
    expect(subjectsToGenreIds(PRAGMATIC)).toContain("technology");
  });
  it("三体(BISAC 串) → 科幻", () => {
    expect(subjectsToGenreIds(THREE_BODY)).toContain("scifi");
  });
});
