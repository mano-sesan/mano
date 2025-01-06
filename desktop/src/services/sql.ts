import Database from "@tauri-apps/plugin-sql";

export let db: Database;
Database.load("sqlite:mydatabase.db").then((d) => {
  db = d;
});

const batchSize = 500;

export async function sqlDeleteIds({ table, ids }: { table: string; ids: string[] }) {
  await db.execute(`DELETE FROM "${table}" WHERE id IN (${ids.map((id) => `'${id}'`).join(", ")})`);
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
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const prepared = (prepare ? await prepare(batch) : batch).filter((x) => x);
    const keys = Object.keys(values(batch[0]));
    const oneLinePlaceholders = Array(keys.length).fill("?").join(", ");
    const placeholders = Array(batch.length).fill(`(${oneLinePlaceholders})`).join(", ");
    await db.execute(
      `INSERT INTO "${table}" (${keys.join(", ")}) VALUES ${placeholders}`,
      prepared.flatMap((x) => Object.values(values(x)))
    );
    if (after) await after(prepared);
  }
}

export async function sqlSelect<T>(query: string, bindValues?: unknown[]): Promise<T> {
  const res = db.select<T>(query, bindValues);
  return res;
}
