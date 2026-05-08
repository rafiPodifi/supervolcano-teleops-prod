import { Pool, type QueryResult } from "pg";

let cachedPool: Pool | null = null;

const getPool = (): Pool => {
  if (cachedPool) return cachedPool;

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.svdb_POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error("Missing database URL environment variable (DATABASE_URL)");
  }

  const isUnixSocket = /[?&]host=\/cloudsql\//.test(databaseUrl);

  console.log(
    "[DB] Connecting to:",
    isUnixSocket
      ? databaseUrl.match(/host=(\/cloudsql\/[^&]+)/)?.[1] || "cloudsql-socket"
      : databaseUrl.split("@")[1]?.split("/")[0] || "unknown host",
  );

  cachedPool = new Pool({
    connectionString: databaseUrl,
    ssl: isUnixSocket ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  return cachedPool;
};

const runTemplate = async (
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult> => {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return getPool().query(text, values as unknown[]);
};

export const sql = Object.assign(runTemplate, {
  query: async (queryText: string, params?: unknown[]) => {
    const result = await getPool().query(queryText, params as unknown[]);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  },
});
