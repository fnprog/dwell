export interface Env {
  nodeEnv: string;
  port: number;
  /** Real PostgreSQL in production. When unset, local dev uses an embedded database. */
  databaseUrl: string | undefined;
  /** Folder for the embedded dev database. */
  devDataDir: string;
  jwtSecret: string;
  corsOrigin: string | undefined;
  /** Folder with the built web app, served by the API in production. */
  webDist: string | undefined;
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  } | null;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const jwtSecret = source.JWT_SECRET;
  if (!jwtSecret && nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!source.DATABASE_URL && nodeEnv === 'production') {
    // The embedded database lives on the container's disk and would be lost on redeploy.
    throw new Error('DATABASE_URL is required in production');
  }
  if (jwtSecret && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = source;
  const r2 =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
      ? {
          accountId: R2_ACCOUNT_ID,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          bucket: R2_BUCKET,
        }
      : null;

  return {
    nodeEnv,
    port: Number(source.PORT ?? 8787),
    databaseUrl: source.DATABASE_URL,
    devDataDir: source.DEV_DATA_DIR ?? './data/pglite',
    // A fixed dev secret is fine on a laptop; production refuses to start without a real one.
    jwtSecret: jwtSecret ?? 'dev-only-secret-change-me-dev-only-secret',
    corsOrigin: source.CORS_ORIGIN,
    webDist: source.WEB_DIST,
    r2,
  };
}
