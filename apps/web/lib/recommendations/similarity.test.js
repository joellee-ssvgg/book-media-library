import { describe, expect, it } from "vitest";
import { similarityScore, rankSimilar } from "./similarity";

const dune = { workId: "dune", title: "Dune", genres: ["scifi", "science", "fantasy"], subjects: ["space", "desert"] };
const scienceOfDune = { workId: "sod", title: "The Science of Dune", genres: ["science", "scifi", "essay"], subjects: ["space"] };
const pragmatic = { workId: "prag", title: "The Pragmatic Programmer", genres: ["technology", "business"], subjects: ["software"] };
const programmingRuby = { workId: "ruby", title: "Programming Ruby", genres: ["technology"], subjects: ["software", "ruby"] };
const janeEyre = { workId: "jane", title: "Jane Eyre", genres: ["romance", "classics"], subjects: ["governess"] };

describe("similarityScore", () => {
  it("counts shared genres and subjects", () => {
    const s = similarityScore(dune, scienceOfDune);
    expect(s.genreScore).toBe(2); // scifi + science
    expect(s.subjectScore).toBe(1); // space
    expect(s.sharedGenres.sort()).toEqual(["science", "scifi"]);
    expect(s.total).toBeCloseTo(2 + 0.25);
  });

  it("is zero when nothing overlaps", () => {
    const s = similarityScore(dune, janeEyre);
    expect(s.genreScore).toBe(0);
    expect(s.total).toBe(0);
  });
});

describe("rankSimilar", () => {
  const corpus = [dune, scienceOfDune, pragmatic, programmingRuby, janeEyre];

  it("ranks the strongest genre overlap first and excludes the target itself", () => {
    const out = rankSimilar(dune, corpus);
    expect(out.map((x) => x.workId)).toEqual(["sod"]); // only The Science of Dune shares a genre
  });

  it("finds tech neighbours for the programming book", () => {
    const out = rankSimilar(pragmatic, corpus);
    expect(out.map((x) => x.workId)).toEqual(["ruby"]);
  });

  it("requires at least one shared genre by default", () => {
    expect(rankSimilar(janeEyre, corpus)).toEqual([]);
  });

  it("dedupes corpus by workId and respects limit", () => {
    const dupes = [scienceOfDune, scienceOfDune, programmingRuby];
    const out = rankSimilar(dune, dupes, { limit: 5 });
    expect(out.filter((x) => x.workId === "sod")).toHaveLength(1);
  });
});
