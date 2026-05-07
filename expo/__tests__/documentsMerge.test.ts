import { describe, it, expect } from "vitest";
import { mergeDocuments } from "@/services/documentsMerge";
import type { Document, Folder } from "@/types/document";

type DocOrFolder = Document | Folder;

const doc = (id: string, overrides: Partial<Document> = {}): Document => ({
  _id: id,
  name: `${id}.txt`,
  group: undefined,
  encryptedEntityKey: "k",
  createdAt: new Date("2026-01-01"),
  createdBy: "u",
  downloadPath: `/path/${id}`,
  file: { originalname: `${id}.txt`, filename: id, size: 1, encoding: "7bit", mimetype: "text/plain" },
  parentId: undefined,
  position: 0,
  type: "document",
  ...overrides,
});

const folder = (id: string, overrides: Partial<Folder> = {}): Folder => ({
  _id: id,
  name: `Folder ${id}`,
  createdAt: new Date("2026-01-01"),
  createdBy: "u",
  parentId: undefined,
  position: 0,
  type: "folder",
  ...overrides,
});

const offlineTag = <T extends DocOrFolder>(item: T): T => ({ ...item, _offlineAdded: true });

describe("mergeDocuments", () => {
  it("retourne [] quand local et server sont vides", () => {
    expect(mergeDocuments([], [])).toEqual([]);
  });

  it("retourne le serveur quand local est vide", () => {
    const server = [doc("a")];
    expect(mergeDocuments([], server)).toEqual(server);
  });

  it("garde un ajout offline taggé absent du serveur (et strippe le flag)", () => {
    const result = mergeDocuments([offlineTag(doc("a"))], []);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("a");
    expect("_offlineAdded" in result[0]).toBe(false);
  });

  it("union dédupliquée par _id : ajouts offline + ajouts en ligne coexistent", () => {
    const local = [doc("a"), offlineTag(doc("b"))];
    const server = [doc("a"), doc("c")];
    const result = mergeDocuments(local, server);
    const ids = result.map((d) => d._id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
    expect(result.find((d) => d._id === "b")).not.toHaveProperty("_offlineAdded");
  });

  it("drop un item local non-taggé absent du serveur (présumé supprimé en ligne)", () => {
    const local = [doc("a")];
    const server: DocOrFolder[] = [];
    expect(mergeDocuments(local, server)).toEqual([]);
  });

  it("intact côté serveur + ajout offline taggé : les deux survivent", () => {
    const local = [doc("a"), offlineTag(doc("b"))];
    const server = [doc("a")];
    const result = mergeDocuments(local, server);
    expect(result).toHaveLength(2);
    expect(result.find((d) => d._id === "a")).toBeDefined();
    expect(result.find((d) => d._id === "b")).toBeDefined();
  });

  it("garde le parentId quand le dossier parent existe côté serveur", () => {
    const local = [offlineTag(doc("a", { parentId: "F" }))];
    const server = [folder("F")];
    const result = mergeDocuments(local, server);
    const a = result.find((d) => d._id === "a")!;
    expect(a.parentId).toBe("F");
  });

  it("re-parentage : doc taggé sous un dossier non-taggé supprimé en ligne → racine", () => {
    // F existait avant l'offline (non taggé), supprimé en ligne. A créé offline (taggé) sous F.
    const local: DocOrFolder[] = [folder("F"), offlineTag(doc("a", { parentId: "F" }))];
    const server: DocOrFolder[] = [];
    const result = mergeDocuments(local, server);
    // F non taggé absent du serveur → droppé. A taggé → réinjecté. Parent disparu → racine.
    expect(result).toHaveLength(1);
    const a = result.find((d) => d._id === "a")!;
    expect(a._id).toBe("a");
    expect(a.parentId).toBeUndefined();
  });

  it("aucune duplication quand un item est dans local et server avec le même _id", () => {
    const local = [doc("a", { name: "local.txt" })];
    const server = [doc("a", { name: "server.txt" })];
    const result = mergeDocuments(local, server);
    expect(result).toHaveLength(1);
    // server gagne pour les items des deux côtés
    expect(result[0].name).toBe("server.txt");
  });

  it("strippe le flag _offlineAdded même si présent sur un item côté serveur (defense-in-depth)", () => {
    const server = [{ ...doc("a"), _offlineAdded: true } as Document];
    const result = mergeDocuments([], server);
    expect(result).toHaveLength(1);
    expect("_offlineAdded" in result[0]).toBe(false);
  });

  it("dossier ajouté offline + doc enfant ajouté offline : la hiérarchie est conservée", () => {
    const local = [offlineTag(folder("F")), offlineTag(doc("a", { parentId: "F" }))];
    const server: DocOrFolder[] = [];
    const result = mergeDocuments(local, server);
    expect(result).toHaveLength(2);
    const a = result.find((d) => d._id === "a")!;
    expect(a.parentId).toBe("F");
  });

  it("undefined en entrée gérés sans crash", () => {
    expect(mergeDocuments(undefined as any, undefined as any)).toEqual([]);
  });
});
