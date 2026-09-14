import type { JsonLdObject } from "@/lib/structured-data";

/**
 * Renders one schema.org block. `<` is escaped so a product title containing
 * `</script>` cannot break out of the script element.
 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", "\\u003c") }}
    />
  );
}
