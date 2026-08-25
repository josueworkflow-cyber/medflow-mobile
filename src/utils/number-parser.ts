/**
 * Converte entradas de texto (incluindo formato brasileiro com vírgula) para número decimal de forma segura.
 * Exemplos:
 *  - "10,50" -> 10.5
 *  - "1.250,50" -> 1250.5
 *  - "10.50" -> 10.5
 *  - "0" -> 0
 *  - "" | undefined | null -> undefined
 *  - "abc" -> undefined
 */
export function parseDecimalInput(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const str = String(value).trim();
  if (!str) return undefined;

  // Se contiver vírgula, assume formato brasileiro (ex: 1.250,50 ou 10,5)
  if (str.includes(",")) {
    const normalized = str.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  // Caso seja número com ponto ou inteiro
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Converte entrada de texto para número inteiro.
 */
export function parseIntegerInput(value: string | number | null | undefined): number | undefined {
  const dec = parseDecimalInput(value);
  if (dec === undefined) return undefined;
  return Math.trunc(dec);
}
