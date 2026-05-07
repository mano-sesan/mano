import { describe, it, expect } from "vitest";
import { mergeHistory } from "@/services/historyMerge";

const entry = (date: string, user: string, data: Record<string, any> = {}) => ({ date, user, data });

describe("mergeHistory", () => {
  it("retourne [] quand local et server sont vides", () => {
    expect(mergeHistory([], [])).toEqual([]);
  });

  it("dédupe par contenu : entrées partagées non doublées", () => {
    const e = entry("2026-01-01", "u1", { name: { oldValue: "A", newValue: "B" } });
    expect(mergeHistory([e], [e])).toEqual([e]);
  });

  it("union des entrées différentes (local-only + server-only)", () => {
    const eServer = entry("2026-01-02T00:00:00Z", "u-online", { name: { oldValue: "A", newValue: "B" } });
    const eLocal = entry("2026-01-03T00:00:00Z", "u-offline", { name: { oldValue: "B", newValue: "C" } });
    const result = mergeHistory([eLocal], [eServer]);
    expect(result).toHaveLength(2);
    // tri par date desc → eLocal en premier (plus récent)
    expect(result[0]).toEqual(eLocal);
    expect(result[1]).toEqual(eServer);
  });

  it("entrées partagées entre local et server : pas de duplication", () => {
    const shared = entry("2026-01-01T00:00:00Z", "u-shared", {});
    const eOnline = entry("2026-01-02T00:00:00Z", "u-online", {});
    const eOffline = entry("2026-01-03T00:00:00Z", "u-offline", {});
    const result = mergeHistory([shared, eOffline], [shared, eOnline]);
    expect(result).toHaveLength(3);
    expect(result.filter((e) => e.user === "u-shared")).toHaveLength(1);
  });

  it("tri par date décroissante", () => {
    const e1 = entry("2026-01-01T00:00:00Z", "u", {});
    const e2 = entry("2026-02-01T00:00:00Z", "u", {});
    const e3 = entry("2026-03-01T00:00:00Z", "u", {});
    const result = mergeHistory([e1], [e3, e2]);
    expect(result.map((e) => e.date)).toEqual(["2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z"]);
  });

  it("entrées sans date triées en queue", () => {
    const eDated = entry("2026-01-01T00:00:00Z", "u", {});
    const eUndated = { user: "u", data: {} };
    const result = mergeHistory([eUndated], [eDated]);
    expect(result[0]).toEqual(eDated);
    expect(result[1]).toEqual(eUndated);
  });

  it("undefined gérés sans crash", () => {
    expect(mergeHistory(undefined as any, undefined as any)).toEqual([]);
  });
});
