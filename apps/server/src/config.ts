import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_DIR: z.string().default("./data"),
  JWT_SECRET: z.string().min(16).default("mymuse-demo-jwt-secret-2026"),
  AUTH_REQUIRED: z
    .string()
    .transform((value) => value.toLowerCase() !== "false")
    .default("true"),
  STORAGE_DRIVER: z.enum(["postgres", "file"]).default("postgres"),
  DATABASE_URL: z.string().default("postgres://mymuse:mymuse@127.0.0.1:5432/mymuse")
});

export type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = envSchema.parse(process.env);
