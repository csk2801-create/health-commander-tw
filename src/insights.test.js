import { describe, expect, it } from "vitest";
import { buildDailySummary, chartSeries, completionScore } from "./insights.js";
import { createEmptyRecord } from "./storage.js";

describe("Health Commander insights", () => {
  it("builds a Traditional Chinese daily summary with local-only limitation", () => {
    const record = createEmptyRecord("2026-08-01");
    record.morningWeight = "84.2";
    record.eveningWeight = "83.9";
    record.waist = "91";
    record.water = "2200";
    record.knee = "正常";
    record.note = "跑步 30 分鐘";
    const summary = buildDailySummary(record, [record]);
    expect(summary).toContain("每日摘要");
    expect(summary).toContain("Apple Health 自動同步已預留但尚未啟用");
  });

  it("creates 7 and 30 day chart slices from latest records", () => {
    const records = Array.from({ length: 35 }, (_, index) => {
      const record = createEmptyRecord(`2026-07-${String(index + 1).padStart(2, "0")}`);
      record.eveningWeight = String(90 - index / 10);
      record.waist = String(96 - index / 20);
      record.water = String(1800 + index * 10);
      return record;
    });
    expect(chartSeries(records, 7)).toHaveLength(7);
    expect(chartSeries(records, 30)).toHaveLength(30);
  });

  it("scores completion from core fields and media", () => {
    const record = createEmptyRecord("2026-08-01");
    record.morningWeight = "84";
    record.eveningWeight = "83.7";
    record.waist = "90";
    record.water = "2400";
    record.note = "ok";
    record.meals.breakfast = [{ id: "1" }];
    expect(completionScore(record)).toBeGreaterThan(70);
  });
});
