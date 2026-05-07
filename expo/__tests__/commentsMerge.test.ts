import { describe, it, expect } from "vitest";
import { mergeComments } from "@/services/commentsMerge";
import type { CommentInstance } from "@/types/comment";

const cmt = (id: string, overrides: Partial<CommentInstance> = {}): CommentInstance => ({
  _id: id,
  comment: `comment ${id}`,
  team: "team-1",
  user: "user-1",
  organisation: "org-1",
  ...overrides,
});

const offlineTag = (c: CommentInstance): CommentInstance => ({ ...c, _offlineAdded: true });

describe("mergeComments", () => {
  it("retourne [] quand local et server sont vides", () => {
    expect(mergeComments([], [])).toEqual([]);
  });

  it("retourne le serveur quand local est vide", () => {
    const server = [cmt("a")];
    expect(mergeComments([], server)).toEqual(server);
  });

  it("garde un ajout offline taggé absent du serveur (et strippe le flag)", () => {
    const result = mergeComments([offlineTag(cmt("a"))], []);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("a");
    expect("_offlineAdded" in result[0]).toBe(false);
  });

  it("union dédupliquée par _id", () => {
    const local = [cmt("a"), offlineTag(cmt("b"))];
    const server = [cmt("a"), cmt("c")];
    const result = mergeComments(local, server);
    const ids = result.map((c) => c._id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("drop un commentaire local non-taggé absent du serveur (présumé supprimé en ligne)", () => {
    const local = [cmt("a")];
    const server: CommentInstance[] = [];
    expect(mergeComments(local, server)).toEqual([]);
  });

  it("server gagne pour un commentaire présent des deux côtés", () => {
    const local = [cmt("a", { comment: "local version" })];
    const server = [cmt("a", { comment: "server version" })];
    const result = mergeComments(local, server);
    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe("server version");
  });

  it("strippe le flag même s'il fuite côté serveur (defense-in-depth)", () => {
    const server = [{ ...cmt("a"), _offlineAdded: true }];
    const result = mergeComments([], server);
    expect("_offlineAdded" in result[0]).toBe(false);
  });

  it("undefined gérés sans crash", () => {
    expect(mergeComments(undefined as any, undefined as any)).toEqual([]);
  });
});
