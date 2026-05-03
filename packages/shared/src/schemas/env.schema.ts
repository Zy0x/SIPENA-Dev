import { z } from "zod";

export const providerSchema = z.enum(["supabase", "http", "mock"]);
