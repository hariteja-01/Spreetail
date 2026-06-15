// @ts-nocheck
import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrate: {
    connection: {
      url: process.env.DATABASE_URL,
    },
  },
});
