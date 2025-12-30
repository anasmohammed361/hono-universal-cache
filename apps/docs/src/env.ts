import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables
   * Not available on the client
   */
  server: {},

  /**
   * Client-side environment variables
   * Must be prefixed with NEXT_PUBLIC_
   */
  client: {
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string(),
  },

  /**
   * Runtime environment variables
   * For Next.js >= 13.4.4, only client vars need to be specified
   */
  experimental__runtimeEnv: {
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },

  /**
   * Skip validation during build if env vars aren't available
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
