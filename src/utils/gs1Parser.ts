export interface ParsedGS1 {
  gtin: string;
  lote?: string;
  validade?: string; // Formato DD/MM/AAAA
  isGS1: boolean;
  raw: string;
}

/**
 * Converte data no formato AAMMDD para DD/MM/AAAA
 */
function formatGS1Date(dateStr: string): string {
  if (dateStr.length === 6) {
    const yy = dateStr.substring(0, 2);
    const mm = dateStr.substring(2, 4);
    const dd = dateStr.substring(4, 6);
    return `${dd}/${mm}/20${yy}`;
  }
  return dateStr;
}

function cleanGtin(gtin: string): string {
  return gtin.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}

/**
 * Processa uma string lida de código de barras e extrai dados de padrão GS1
 * suportando os formatos GS1-128 e GS1 DataMatrix (com ou sem parênteses).
 */
export function parseGS1(rawCode: string): ParsedGS1 {
  let cleanCode = rawCode.trim();
  const hasGs1SymbologyIdentifier = /^\](?:d2|C1)/i.test(cleanCode);

  // 0. Limpeza de prefixos de simbologia de leitor e caracteres de controle do início da string
  // Remove prefixos ISO/IEC 15424 comuns, como ]d2 (DataMatrix) ou ]C1 (GS1-128)
  cleanCode = cleanCode.replace(/^\][a-zA-Z0-9]{2}/, "");
  // Remove todos os caracteres invisíveis de controle ASCII (incluindo o Group Separator \x1d / ascii 29 / FNC1) do início
  cleanCode = cleanCode.replace(/^[\x00-\x1F\x7F-\x9F]+/, "");

  // 1. Padrão com parênteses literais explicados, ex: (01)07891234567890(17)261231(10)LOTE123
  if (cleanCode.includes("(01)") || cleanCode.includes("(17)") || cleanCode.includes("(10)")) {
    let gtin = "";
    let lote = "";
    let validade = "";

    const regex = /\((\d{2})\)([^()]+)/g;
    let match;
    while ((match = regex.exec(cleanCode)) !== null) {
      const ai = match[1];
      const val = match[2];
      if (ai === "01") {
        gtin = val;
      } else if (ai === "17") {
        validade = formatGS1Date(val);
      } else if (ai === "10") {
        lote = val;
      }
    }

    if (gtin) {
      return {
        gtin: cleanGtin(gtin),
        lote: lote || undefined,
        validade: validade || undefined,
        isGS1: true,
        raw: cleanCode,
      };
    }
  }

  // 2. Padrão colado sem parênteses (comum em DataMatrix de câmera)
  // Geralmente inicia com "01" e tem o GTIN de 14 dígitos em seguida
  const gs1WithoutParentheses = cleanCode.match(/^01(\d{14})([\s\S]*)$/);
  const gs1Remainder = gs1WithoutParentheses?.[2] ?? "";
  const looksLikeGs1 = Boolean(
    gs1WithoutParentheses &&
    (
      hasGs1SymbologyIdentifier ||
      gs1Remainder.length === 0 ||
      gs1Remainder.startsWith("\x1d") ||
      /^(?:10|11|13|15|17|21|30|37)/.test(gs1Remainder)
    )
  );

  if (gs1WithoutParentheses && looksLikeGs1) {
    const gtin = gs1WithoutParentheses[1];
    let rest = gs1Remainder;
    let lote = "";
    let validade = "";

    let i = 0;
    while (i < rest.length) {
      // Pula caracteres de controle / separador FNC1
      const charCode = rest.charCodeAt(i);
      if (charCode === 29 || rest[i] === "\x1d" || rest[i] === "\u001d") {
        i++;
        continue;
      }

      const next2 = rest.substring(i, i + 2);
      if (next2 === "17") {
        // AI 17: Validade (6 caracteres: AAMMDD)
        const dateVal = rest.substring(i + 2, i + 8);
        validade = formatGS1Date(dateVal);
        i += 8;
      } else if (next2 === "10") {
        // AI 10: Lote (tamanho variável, até separador ou final da string)
        const lotePart = rest.substring(i + 2);
        
        // Encontra o separador FNC1 (\x1d) se houver
        const fnc1Index = lotePart.indexOf("\x1d");
        const fnc1IndexUnicode = lotePart.indexOf("\u001d");
        const sepIndex = fnc1Index >= 0 ? fnc1Index : fnc1IndexUnicode;

        if (sepIndex >= 0) {
          lote = lotePart.substring(0, sepIndex);
          rest = lotePart.substring(sepIndex); // Avança o processamento
          i = 0;
        } else {
          lote = lotePart;
          break; // Fim da string
        }
      } else {
        i++;
      }
    }

    return {
      gtin: cleanGtin(gtin),
      lote: lote || undefined,
      validade: validade || undefined,
      isGS1: true,
      raw: cleanCode,
    };
  }

  // 3. Retorno fallback para código de barras simples (EAN-13, EAN-8, etc.)
  return {
    gtin: cleanCode,
    isGS1: false,
    raw: cleanCode,
  };
}
