import mergeItems from "@/utils/mergeItems";
import { describe, it, expect } from "vitest";

type Item = { _id?: string; deletedAt?: any; name?: string; tag?: string };

describe("mergeItems", () => {
  it("retourne les old items quand new est vide", () => {
    const old: Item[] = [
      { _id: "a", name: "A" },
      { _id: "b", name: "B" },
    ];
    expect(mergeItems(old, [])).toEqual(old);
  });

  it("retourne les new items quand old est vide", () => {
    const newItems: Item[] = [{ _id: "a", name: "A" }];
    expect(mergeItems<Item>([], newItems)).toEqual(newItems);
  });

  it("new items remplacent les old items quand _id correspond", () => {
    const old: Item[] = [{ _id: "a", name: "Old A" }];
    const newItems: Item[] = [{ _id: "a", name: "New A" }];
    const result = mergeItems(old, newItems);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("New A");
  });

  it("conserve les old items dont le _id n'est pas dans new", () => {
    const old: Item[] = [
      { _id: "a", name: "A" },
      { _id: "b", name: "B" },
    ];
    const newItems: Item[] = [{ _id: "a", name: "A updated" }];
    const result = mergeItems(old, newItems);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i._id === "a")?.name).toBe("A updated");
    expect(result.find((i) => i._id === "b")?.name).toBe("B");
  });

  it("exclut les new items avec deletedAt (suppression côté serveur)", () => {
    const old: Item[] = [{ _id: "a", name: "A" }];
    const newItems: Item[] = [{ _id: "a", name: "A", deletedAt: "2026-01-01" }];
    expect(mergeItems(old, newItems)).toEqual([]);
  });

  it("exclut les old items avec deletedAt", () => {
    const old: Item[] = [
      { _id: "a", name: "A", deletedAt: "2026-01-01" },
      { _id: "b", name: "B" },
    ];
    const result = mergeItems(old, []);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("b");
  });

  it("un new deletedAt l'emporte sur l'old non-deleted (pas de zombie)", () => {
    const old: Item[] = [{ _id: "a", name: "A" }];
    const newItems: Item[] = [{ _id: "a", deletedAt: "2026-01-01" }];
    expect(mergeItems(old, newItems)).toEqual([]);
  });

  it("applique formatNewItemsFunction uniquement sur les new items", () => {
    const old: Item[] = [{ _id: "a", name: "Old", tag: "old-tag" }];
    const newItems: Item[] = [{ _id: "b", name: "B" }];
    const result = mergeItems(old, newItems, {
      formatNewItemsFunction: (item) => ({ ...item, tag: "formatted" }),
    });
    expect(result.find((i) => i._id === "a")?.tag).toBe("old-tag");
    expect(result.find((i) => i._id === "b")?.tag).toBe("formatted");
  });

  it("filterNewItemsFunction retournant false → item exclu", () => {
    const newItems: Item[] = [
      { _id: "a", name: "keep" },
      { _id: "b", name: "drop" },
    ];
    const result = mergeItems<Item>([], newItems, {
      filterNewItemsFunction: (item) => item.name !== "drop",
    });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("a");
  });

  it("filter ET format : filter d'abord, format ensuite", () => {
    const newItems: Item[] = [
      { _id: "a", name: "keep" },
      { _id: "b", name: "drop" },
    ];
    const result = mergeItems<Item>([], newItems, {
      filterNewItemsFunction: (item) => item.name !== "drop",
      formatNewItemsFunction: (item) => ({ ...item, tag: "fmt" }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("fmt");
  });

  it("ordre du résultat : old items conservés en premier, puis new items", () => {
    const old: Item[] = [{ _id: "a", name: "A" }];
    const newItems: Item[] = [{ _id: "b", name: "B" }];
    const result = mergeItems(old, newItems);
    expect(result.map((i) => i._id)).toEqual(["a", "b"]);
  });

  it("ne crashe pas avec des items sans _id", () => {
    const old: Item[] = [{ name: "noid" } as Item];
    const newItems: Item[] = [{ name: "alsonoid" } as Item];
    expect(() => mergeItems(old, newItems)).not.toThrow();
  });

  it("default newItems = [] : signature avec un seul argument", () => {
    const old: Item[] = [{ _id: "a", name: "A" }];
    expect(mergeItems(old)).toEqual(old);
  });
});
