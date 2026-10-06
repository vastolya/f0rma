/**
 * Структурированные данные schema.org для Google и Яндекса.
 * `<` экранируем, чтобы строка из данных не могла закрыть тег script.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
