import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "@tauri-apps/api/core";

export let db: Database;
if (isTauri()) {
  Database.load("sqlite:mydatabase.db").then((d) => {
    db = d;
  });
}

const batchSize = 500;

export async function sqlDeleteIds({ table, ids, column = "id" }: { table: string; ids: string[]; column?: string }) {
  console.log("sqlDeleteIds", table, ids.length);
  await db.execute(`DELETE FROM "${table}" WHERE "${column}" IN (${ids.map((id) => `'${id}'`).join(", ")})`);
}

export async function sqlInsertBatch<
  T extends Record<string, string | number | null | string[]>,
  U extends Record<string, string | number | null | string[]>,
>({
  table,
  data,
  prepare,
  values,
  after,
}: {
  table: string;
  data: T[];
  prepare?: (items: T[]) => Promise<U[]>;
  values: (x: U | T) => unknown;
  after?: (data: (U | T)[]) => Promise<void>;
}) {
  console.log("sqlInsertBatch", table, data.length);
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const prepared = (prepare ? await prepare(batch) : batch).filter((x) => x);
    const keys = Object.keys(values(batch[0]));
    const oneLinePlaceholders = Array(keys.length).fill("?").join(", ");
    const placeholders = Array(batch.length).fill(`(${oneLinePlaceholders})`).join(", ");
    await db.execute(
      `INSERT INTO "${table}" ("${keys.join('", "')}") VALUES ${placeholders}`,
      prepared.flatMap((x) => Object.values(values(x)))
    );
    if (after) await after(prepared);
  }
}

export async function sqlSelect<T>(query: string, bindValues?: unknown[]): Promise<T> {
  console.log("sqlSelect", query);
  const res = db.select<T>(query, bindValues);
  return res;
}

export async function sqlExecute(query: string, bindValues?: unknown[]): Promise<void> {
  console.log("sqlExecute", query);
  await db.execute(query, bindValues);
}

export function fieldToSqliteValue(field: { type: string; original_id: string }, value: string) {
  if (field.type === "yes-no") {
    if (value === "Oui") return 1;
    if (value === "Non") return 0;
    return null;
  }
  if (field.type === "boolean") {
    if (value) return 1;
    return 0;
  }
  return value;
}
