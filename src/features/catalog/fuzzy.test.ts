import { fuzzyMatches, normalizeSearchText } from "@/features/catalog/fuzzy";

const PRODUCT = "Airflow Stringer Tank airflow-stringer-tank Breathable training vest";

describe("normalizeSearchText", () => {
  it("folds case, accents and punctuation into word breaks", () => {
    expect(normalizeSearchText("Café—Tee's / 2")).toBe("cafe tee s 2");
  });
});

describe("fuzzyMatches", () => {
  it("matches an empty query against anything", () => {
    expect(fuzzyMatches("", PRODUCT)).toBe(true);
    expect(fuzzyMatches("   ", PRODUCT)).toBe(true);
  });

  it("matches exact and partial words", () => {
    expect(fuzzyMatches("stringer", PRODUCT)).toBe(true);
    expect(fuzzyMatches("string", PRODUCT)).toBe(true);
  });

  it("ignores word order", () => {
    expect(fuzzyMatches("tank airflow", PRODUCT)).toBe(true);
  });

  it("forgives a typo in a long word", () => {
    expect(fuzzyMatches("stringr", PRODUCT)).toBe(true);
    expect(fuzzyMatches("airflowe", PRODUCT)).toBe(true);
  });

  it("reads a hyphenated handle as words", () => {
    expect(fuzzyMatches("airflow stringer tank", "airflow-stringer-tank")).toBe(true);
  });

  it("requires every query word to land", () => {
    expect(fuzzyMatches("airflow hoodie", PRODUCT)).toBe(false);
  });

  it("gives short words no typo budget", () => {
    // "tee" is one edit from "tea", "ten", "the" — tolerating that matches half a catalogue.
    expect(fuzzyMatches("tee", "Airflow Tank")).toBe(false);
  });

  it("rejects keyboard mash", () => {
    expect(fuzzyMatches("dsadasd", PRODUCT)).toBe(false);
  });
});
