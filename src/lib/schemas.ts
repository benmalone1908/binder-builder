import { z } from "zod";

export const setFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  year: z.coerce.number().int().min(1900, "Year must be 1900 or later").max(2100, "Year must be 2100 or earlier"),
  brand: z.string().min(1, "Brand is required"),
  product_line: z.string().min(1, "Product line is required"),
  set_type: z.enum(["base", "insert", "rainbow", "multi_year_insert"]),
  insert_set_name: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
});

export type SetFormValues = z.infer<typeof setFormSchema>;
