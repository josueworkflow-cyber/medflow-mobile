import assert from "node:assert/strict";
import test from "node:test";

import { parseGS1 } from "./gs1Parser.ts";

test("preserva EAN-8, UPC-A, EAN-13 e GTIN-14 simples", () => {
  for (const codigo of [
    "12345670",
    "123456789012",
    "7896006219149",
    "07896006219149",
  ]) {
    assert.equal(parseGS1(codigo).gtin, codigo);
    assert.equal(parseGS1(codigo).isGS1, false);
  }
});

test("extrai GTIN, validade e lote de GS1 com parenteses", () => {
  assert.deepEqual(
    parseGS1("(01)07896006219149(17)271231(10)LOTE123"),
    {
      gtin: "07896006219149",
      validade: "31/12/2027",
      lote: "LOTE123",
      isGS1: true,
      raw: "(01)07896006219149(17)271231(10)LOTE123",
    },
  );
});

test("remove prefixo de simbologia e le GS1 sem parenteses", () => {
  const parsed = parseGS1("]d201078960062191491727123110LOTE123");

  assert.equal(parsed.gtin, "07896006219149");
  assert.equal(parsed.validade, "31/12/2027");
  assert.equal(parsed.lote, "LOTE123");
  assert.equal(parsed.isGS1, true);
});

test("nao trunca codigo Code 128 interno que apenas comeca com 01", () => {
  const codigo = "0112345678901234ABC";

  assert.deepEqual(parseGS1(codigo), {
    gtin: codigo,
    isGS1: false,
    raw: codigo,
  });
});
