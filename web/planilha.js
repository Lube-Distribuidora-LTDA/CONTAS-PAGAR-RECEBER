/* =============================================================================
 * planilha.js — gera um .xlsx de verdade, no navegador, sem biblioteca (padrão da casa: um .xlsx é um ZIP
 * com alguns XML dentro). Versão do Contas a Pagar e Receber (2026-11-09), pedida pelo Júlio para o
 * controller: "exportar para Excel formatada com os números que forem feitos os filtros, tudo centralizado
 * e bonito".
 *
 * O que sai pronto:
 *   · faixa da Lube no topo (azul-marinho, título em dourado, a logo, filete vermelho da marca);
 *   · os filtros aplicados, escritos por extenso (quem recebe sabe que é um recorte);
 *   · os totais da rotina num bloco de cartões, com formato nativo de moeda;
 *   · a tabela com cabeçalho congelado e filtro automático, TUDO CENTRALIZADO;
 *   · moeda (negativo em vermelho), data, código sem separador de milhar e inteiro com formato nativo do
 *     Excel: número é número, dá para somar, ordenar e filtrar do outro lado;
 *   · linhas alternadas e linha de TOTAL nas colunas de valor.
 *
 * Uso: Planilha.baixar({ arquivo, titulo, subtitulo, aba, filtros: [[rótulo, valor]], resumo: [[rótulo, valor, tipo]],
 *                        colunas: [{ titulo, tipo, somar, valor(linha) }], linhas, rodape }) → Promise
 *   tipo: texto | moeda | inteiro | codigo | data | percentual (0–100) | decimal | decimal6
 * ========================================================================== */
(function () {
"use strict";

/* ------------------------------ ZIP (comprimido pelo navegador; sem o deflate, guarda sem comprimir) ------------------------------ */
var CRC = (function () { var t = new Uint32Array(256); for (var i = 0; i < 256; i++) { var c = i; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; } return t; })();
function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function bytes(s) { return new TextEncoder().encode(s); }
function comprimir(dados) {
  // 6 mil linhas viravam 4,9 MB sem compressão (2026-11-09); com o deflate do navegador, cerca de um décimo
  if (typeof CompressionStream === "undefined") return Promise.resolve(null);
  try {
    return new Response(new Blob([dados]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); }, function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}
function zip(arqs) {
  var itens = arqs.map(function (a) { var d = a.bytes || bytes(a.conteudo); return { nome: bytes(a.nome), dados: d, crc: crc32(d) }; });
  return Promise.all(itens.map(function (it) { return comprimir(it.dados); })).then(function (comp) {
    var partes = [], central = [], desl = 0;
    itens.forEach(function (it, k) {
      var z = comp[k] && comp[k].length < it.dados.length ? comp[k] : null, metodo = z ? 8 : 0, gravado = z || it.dados;
      var lo = new DataView(new ArrayBuffer(30));
      lo.setUint32(0, 0x04034b50, true); lo.setUint16(4, 20, true); lo.setUint16(6, 0x0800, true); lo.setUint16(8, metodo, true);
      lo.setUint32(14, it.crc, true); lo.setUint32(18, gravado.length, true); lo.setUint32(22, it.dados.length, true); lo.setUint16(26, it.nome.length, true);
      partes.push(new Uint8Array(lo.buffer), it.nome, gravado);
      var ce = new DataView(new ArrayBuffer(46));
      ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(8, 0x0800, true); ce.setUint16(10, metodo, true);
      ce.setUint32(16, it.crc, true); ce.setUint32(20, gravado.length, true); ce.setUint32(24, it.dados.length, true); ce.setUint16(28, it.nome.length, true); ce.setUint32(42, desl, true);
      central.push(new Uint8Array(ce.buffer), it.nome);
      desl += 30 + it.nome.length + gravado.length;
    });
    var tc = central.reduce(function (s, p) { return s + p.length; }, 0);
    var fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, itens.length, true); fim.setUint16(10, itens.length, true); fim.setUint32(12, tc, true); fim.setUint32(16, desl, true);
    var todas = partes.concat(central, [new Uint8Array(fim.buffer)]), tot = todas.reduce(function (s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(tot), pos = 0; todas.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  });
}

/* ------------------------------ XML e célula ------------------------------ */
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
function col(n) { var s = ""; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; } return s; }
function serialData(v) {
  if (v == null || v === "") return null;
  var d = (v instanceof Date) ? v : new Date(String(v).slice(0, 10) + "T12:00:00");
  if (isNaN(d)) return null;
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

/* ------------------------------ estilos ------------------------------ */
var NAVY = "FF0D1830", NAVY2 = "FF132242", OURO = "FFE9C877", VERM = "FFE5202C";
var FONTES = [
  { tam: 10, cor: "FF1B2537" },                                   // 0 base
  { tam: 10, cor: "FF1B2537", b: 1 },                             // 1 base negrito
  { tam: 18, cor: OURO, b: 1, nome: "Segoe UI Semibold" },        // 2 título
  { tam: 10, cor: "FFDCE4F5" },                                   // 3 subtítulo
  { tam: 10, cor: "FFFFFFFF", b: 1 },                             // 4 cabeçalho
  { tam: 10, cor: "FF3C4F7C" },                                   // 5 filtro
  { tam: 8.5, cor: "FF657AA8", b: 1 },                            // 6 rótulo de seção / cartão
  { tam: 14, cor: "FF0D1830", b: 1 },                             // 7 valor do cartão
  { tam: 10.5, cor: "FF0D1830", b: 1 },                           // 8 total
  { tam: 9, cor: "FF8A97B0", i: 1 }                               // 9 rodapé
];
var FUNDOS = [null, null, NAVY, "FFF4F7FB", NAVY2, "FFF7E7BE", VERM, "FFF7F9FD", "FFFFFFFF"];
/* SEM CÉLULA MESCLADA (2026-11-10): o Júlio copiava só algumas colunas (Ctrl+clique) para outra planilha e o Excel dizia
   "Esta ação não funcionará em várias seleções" — a mesclagem do título, dos filtros e dos cartões atravessava as colunas.
   As faixas e os cartões agora usam "Centralizar na seleção" (centerContinuous): mesma cara, nenhuma célula mesclada.
   O cartão desenha a borda só por fora (começo, meio e fim). */
var CARTAO = "FFD7DEF0";
var BORDAS = [
  null,
  { l: "FFE2E8F0", r: "FFE2E8F0", t: "FFE2E8F0", b: "FFE2E8F0" },                  // 1 grade suave
  { l: "FF2A3F6E", r: "FF2A3F6E", t: "FF2A3F6E", b: OURO, espB: "medium" },        // 2 cabeçalho
  { l: "FFE2C98A", r: "FFE2C98A", t: NAVY, espT: "double", b: "FFE2C98A" },        // 3 total (coluna somada)
  { l: CARTAO, r: CARTAO, t: CARTAO, b: CARTAO },                                  // 4 cartão de uma coluna
  { l: CARTAO, t: CARTAO, b: CARTAO },                                             // 5 cartão: começo
  { t: CARTAO, b: CARTAO },                                                        // 6 cartão: meio
  { r: CARTAO, t: CARTAO, b: CARTAO },                                             // 7 cartão: fim
  { t: NAVY, espT: "double", b: "FFE2C98A" }                                       // 8 total: a faixa do rótulo, sem linha no meio
];
var FMT = {
  moeda: { id: 164, c: '"R$" #,##0.00;[Red]-"R$" #,##0.00' },
  percentual: { id: 165, c: "0.00%" },
  inteiro: { id: 166, c: "#,##0" },
  data: { id: 167, c: "dd/mm/yyyy" },
  codigo: { id: 168, c: "0" },
  decimal: { id: 169, c: "#,##0.00" },
  decimal6: { id: 170, c: "#,##0.000000" }
};
var TIPOS = ["texto", "moeda", "inteiro", "codigo", "data", "percentual", "decimal", "decimal6"];
/* [fonte, fundo, borda, formato, quebra, faixa] — tudo centralizado (pedido do Júlio); faixa = centralizar na seleção */
var ESTILOS = [], IDX = {};
function est(fonte, fundo, borda, fmt, quebra, faixa) {
  var k = [fonte, fundo, borda, fmt || "", quebra ? 1 : 0, faixa ? 1 : 0].join("|");
  if (IDX[k] == null) { IDX[k] = ESTILOS.length; ESTILOS.push([fonte, fundo, borda, fmt || null, quebra ? 1 : 0, faixa ? 1 : 0]); }
  return IDX[k];
}
est(0, 0, 0);                                                    // 0 base (tem que ser o primeiro)
var S_TIT = est(2, 2, 0, null, 0, 1), S_SUB = est(3, 2, 0, null, 0, 1), S_FILETE = est(0, 6, 0, null, 0, 1);
var S_FILTRO = est(5, 0, 0, null, 0, 1), S_SECAO = est(6, 0, 0, null, 0, 1), S_LINHA_TOT = est(7, 7, 0, null, 0, 1);
var S_RODAPE = est(9, 0, 0, null, 0, 1), S_CAB = est(4, 4, 2, null, 1, 0);
/* cartão: borda pela posição da coluna no cartão (0 só uma coluna, 1 começo, 2 meio, 3 fim) */
function sCartao(fonte, fmt, pos) { return est(fonte, 7, [4, 5, 6, 7][pos], fmt, 0, 1); }
function eDado(tipo, alt) { return est(0, alt ? 3 : 0, 1, tipo === "texto" || TIPOS.indexOf(tipo) < 0 ? null : tipo); }
var S_TOT_ROT = est(8, 5, 8, null, 0, 1);                        // o rótulo do total, centralizado até a 1ª coluna somada
function sTot(fmt) { return est(8, 5, 3, fmt); }

function xmlEstilos() {
  var nf = Object.keys(FMT).map(function (k) { return '<numFmt numFmtId="' + FMT[k].id + '" formatCode="' + esc(FMT[k].c) + '"/>'; }).join("");
  var fo = FONTES.map(function (f) { return "<font>" + (f.b ? "<b/>" : "") + (f.i ? "<i/>" : "") + '<sz val="' + f.tam + '"/><color rgb="' + f.cor + '"/><name val="' + (f.nome || "Segoe UI") + '"/></font>'; }).join("");
  var fi = FUNDOS.map(function (c, i) {
    if (i === 0) return '<fill><patternFill patternType="none"/></fill>';
    if (i === 1) return '<fill><patternFill patternType="gray125"/></fill>';
    return '<fill><patternFill patternType="solid"><fgColor rgb="' + c + '"/><bgColor indexed="64"/></patternFill></fill>';
  }).join("");
  var bo = BORDAS.map(function (b) {
    if (!b) return "<border><left/><right/><top/><bottom/><diagonal/></border>";
    function lado(n, cor, esp) { return cor ? "<" + n + ' style="' + (esp || "thin") + '"><color rgb="' + cor + '"/></' + n + ">" : "<" + n + "/>"; }
    return "<border>" + lado("left", b.l) + lado("right", b.r) + lado("top", b.t, b.espT) + lado("bottom", b.b, b.espB) + "<diagonal/></border>";
  }).join("");
  var xf = ESTILOS.map(function (e) {
    return '<xf numFmtId="' + (e[3] ? FMT[e[3]].id : 0) + '" fontId="' + e[0] + '" fillId="' + e[1] + '" borderId="' + e[2] +
      '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="' +
      (e[5] ? "centerContinuous" : "center") + '" vertical="center"' + (e[4] ? ' wrapText="1"' : "") + "/></xf>";
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="' + Object.keys(FMT).length + '">' + nf + "</numFmts>" +
    '<fonts count="' + FONTES.length + '">' + fo + "</fonts>" + '<fills count="' + FUNDOS.length + '">' + fi + "</fills>" +
    '<borders count="' + BORDAS.length + '">' + bo + "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + ESTILOS.length + '">' + xf + "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

function cel(ref, s, v, n) {
  if (v == null || v === "") return '<c r="' + ref + '" s="' + s + '"/>';
  if (n) return '<c r="' + ref + '" s="' + s + '"><v>' + v + "</v></c>";
  return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
}
function numerico(tipo, v) {
  if (v == null || v === "" || (typeof v === "number" && isNaN(v))) return null;
  var x = Number(v); if (!isFinite(x)) return null;
  if (tipo === "moeda" || tipo === "decimal") return Math.round(x * 100) / 100;
  if (tipo === "decimal6") return Math.round(x * 1e6) / 1e6;
  if (tipo === "inteiro" || tipo === "codigo") return Math.round(x);
  if (tipo === "percentual") return Math.round(x * 1e6) / 1e8;
  return x;
}

/* ------------------------------ a logo ------------------------------ */
var logoCache = null;
function carregarLogo() {
  if (logoCache) return Promise.resolve(logoCache);
  return fetch("logo-lube.png").then(function (r) { if (!r.ok) throw new Error("sem logo"); return r.arrayBuffer(); }).then(function (ab) {
    var b = new Uint8Array(ab), dv = new DataView(ab);
    if (b[1] !== 0x50 || b[2] !== 0x4E || b[3] !== 0x47) throw new Error("logo não é PNG");
    logoCache = { bytes: b, w: dv.getUint32(16), h: dv.getUint32(20) };
    return logoCache;
  }).catch(function () { return null; });
}

/* ------------------------------ a planilha ------------------------------ */
function gerar(cfg, logo) {
  var C = cfg.colunas, linhas = cfg.linhas || [], nC = Math.max(C.length, 4), ult = col(nC);
  var lin = 1, xml = [];
  function row(n, alt, cels) { xml.push('<row r="' + n + '"' + (alt ? ' ht="' + alt + '" customHeight="1"' : "") + ">" + cels.join("") + "</row>"); }
  /* faixa de lado a lado: o texto na 1ª célula, as outras vazias com o mesmo estilo (centralizar na seleção, sem mesclar) */
  function faixa(n, alt, estilo, texto) {
    var cs = []; for (var c = 1; c <= nC; c++) cs.push(cel(col(c) + n, estilo, c === 1 ? texto : ""));
    row(n, alt, cs);
  }

  /* faixa da Lube */
  faixa(lin++, 36, S_TIT, cfg.titulo || "Relatório");
  faixa(lin++, 22, S_SUB, "LUBE DISTRIBUIDORA LTDA" + (cfg.subtitulo ? "  ·  " + cfg.subtitulo : "") + "  ·  gerado em " + new Date().toLocaleString("pt-BR"));
  faixa(lin++, 4, S_FILETE, "");
  lin++;

  /* filtros aplicados */
  var F = cfg.filtros || [];
  faixa(lin++, 18, S_SECAO, "FILTROS APLICADOS");
  if (!F.length) faixa(lin++, null, S_FILTRO, "Nenhum filtro: todos os títulos em aberto da rotina, todas as filiais");
  F.forEach(function (f) { faixa(lin++, null, S_FILTRO, f[0] + ":  " + f[1]); });
  lin++;

  /* totais da rotina em cartões */
  var R = (cfg.resumo || []).filter(function (r) { return r && r[0]; });
  if (R.length && R.length > nC) {
    // poucas colunas para um cartão por total: um total por linha, centralizado
    faixa(lin++, 18, S_SECAO, "TOTAIS");
    R.forEach(function (r) {
      var v = r[2] === "moeda" ? Number(r[1]).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : r[2] === "inteiro" ? Number(r[1]).toLocaleString("pt-BR") : r[1];
      faixa(lin++, 20, S_LINHA_TOT, r[0] + ":  " + v);
    });
    lin++;
  } else if (R.length) {
    faixa(lin++, 18, S_SECAO, "TOTAIS");
    var nCart = R.length, por = Math.max(1, Math.floor(nC / nCart)), rot = [], val = [], ini = 1;
    R.forEach(function (r, i) {
      var fim = i === nCart - 1 ? nC : Math.min(nC, ini + por - 1);
      if (ini > nC) return;
      var fmt = r[2] === "moeda" || r[2] === "inteiro" ? r[2] : null, v = fmt ? numerico(r[2], r[1]) : r[1];
      for (var c = ini; c <= fim; c++) {
        var pos = ini === fim ? 0 : c === ini ? 1 : c === fim ? 3 : 2;
        rot.push(cel(col(c) + lin, sCartao(6, null, pos), c === ini ? String(r[0]).toUpperCase() : ""));
        val.push(cel(col(c) + (lin + 1), sCartao(7, fmt, pos), c === ini ? v : "", c === ini && fmt && v != null));
      }
      ini = fim + 1;
    });
    row(lin, 20, rot); row(lin + 1, 30, val); lin += 3;
  }

  /* cabeçalho */
  var lCab = lin;
  row(lin, 32, C.map(function (c, i) { return cel(col(i + 1) + lin, S_CAB, c.titulo); }));
  lin++;

  /* dados */
  var soma = C.map(function () { return 0; });
  linhas.forEach(function (l, idx) {
    var alt = idx % 2 === 1;
    row(lin, null, C.map(function (c, i) {
      var ref = col(i + 1) + lin, v = c.valor(l, idx);
      if (c.tipo === "texto" || TIPOS.indexOf(c.tipo) < 0) return cel(ref, eDado("texto", alt), v == null ? "" : String(v));
      if (c.tipo === "data") return cel(ref, eDado("data", alt), serialData(v), true);
      var x = numerico(c.tipo, v);
      if (x != null && c.somar) soma[i] += x;
      return cel(ref, eDado(c.tipo, alt), x, x != null);
    }));
    lin++;
  });
  var ultDado = lin - 1;

  /* total: o rótulo centralizado da 1ª coluna até antes da 1ª coluna somada (sem mesclar) */
  if (linhas.length) {
    var somada = function (c) { return c.somar && (c.tipo === "moeda" || c.tipo === "decimal" || c.tipo === "inteiro"); };
    var j0 = C.findIndex(somada); if (j0 < 1) j0 = j0 === 0 ? 1 : C.length;
    row(lin, 24, C.map(function (c, i) {
      var ref = col(i + 1) + lin;
      if (i === 0) return cel(ref, S_TOT_ROT, "TOTAL  ·  " + linhas.length.toLocaleString("pt-BR") + (linhas.length === 1 ? " título" : " títulos"));
      if (i < j0) return cel(ref, S_TOT_ROT, "");
      if (somada(c) && c.tipo !== "inteiro") return cel(ref, sTot(c.tipo), Math.round(soma[i] * 100) / 100, true);
      if (somada(c)) return cel(ref, sTot("inteiro"), soma[i], true);
      return cel(ref, sTot(null), "");
    }));
    lin++;
  }
  lin++;
  faixa(lin, 30, S_RODAPE, cfg.rodape || "Gerado pelo painel Contas a Pagar e Receber · Lube Distribuidora · dado do WinThor, ao vivo pelo AGENTE LUBE");

  /* larguras pelo conteúdo */
  var larg = C.map(function (c, i) {
    var m = Math.min(String(c.titulo).length, 18), am = Math.min(linhas.length, 500);
    for (var k = 0; k < am; k++) {
      var v = c.valor(linhas[k], k), t;
      if (c.tipo === "moeda" || c.tipo === "decimal") t = String(Math.round(Math.abs(Number(v) || 0))).length + 7;
      else if (c.tipo === "data") t = 11; else t = String(v == null ? "" : v).length;
      if (t > m) m = t;
    }
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Math.min(Math.max(m + 4, 11), 54) + '" customWidth="1"/>';
  });
  for (var k = C.length + 1; k <= nC; k++) larg.push('<col min="' + k + '" max="' + k + '" width="14" customWidth="1"/>');

  var temLogo = !!logo;
  var ws = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + ult + lin + '"/>' +
    '<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><pane ySplit="' + lCab + '" topLeftCell="A' + (lCab + 1) +
    '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A' + (lCab + 1) + '" sqref="A' + (lCab + 1) + '"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="18" customHeight="1"/><cols>' + larg.join("") + "</cols><sheetData>" + xml.join("") + "</sheetData>" +
    (linhas.length ? '<autoFilter ref="A' + lCab + ":" + col(C.length) + ultDado + '"/>' : "") +
    '<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    (temLogo ? '<drawing r:id="rId1"/>' : "") + "</worksheet>";

  var aba = String(cfg.aba || "Dados").slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, " ");
  var arqs = [
    { nome: "[Content_Types].xml", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      (temLogo ? '<Default Extension="png" ContentType="image/png"/>' : "") +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      (temLogo ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : "") + "</Types>" },
    { nome: "_rels/.rels", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nome: "xl/workbook.xml", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + esc(aba) + '" sheetId="1" r:id="rId1"/></sheets>' +
      (linhas.length ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + esc(aba) + "'!$A$" + lCab + ":$" + col(C.length) + "$" + ultDado + "</definedName>" +
        '<definedName name="_xlnm.Print_Titles" localSheetId="0">\'' + esc(aba) + "'!$" + lCab + ":$" + lCab + "</definedName></definedNames>" : "") + "</workbook>" },
    { nome: "xl/_rels/workbook.xml.rels", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nome: "xl/styles.xml", conteudo: xmlEstilos() },
    { nome: "xl/worksheets/sheet1.xml", conteudo: ws }
  ];
  if (temLogo) {
    var hPx = 50, wPx = Math.round(logo.w * hPx / logo.h), EMU = 9525;
    arqs.push({ nome: "xl/worksheets/_rels/sheet1.xml.rels", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>' });
    arqs.push({ nome: "xl/drawings/_rels/drawing1.xml.rels", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>' });
    arqs.push({ nome: "xl/drawings/drawing1.xml", conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>' + (10 * EMU) + '</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>' + (8 * EMU) + '</xdr:rowOff></xdr:from>' +
      '<xdr:ext cx="' + (wPx * EMU) + '" cy="' + (hPx * EMU) + '"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo Lube"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
      '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
      '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + (wPx * EMU) + '" cy="' + (hPx * EMU) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>' });
    arqs.push({ nome: "xl/media/image1.png", bytes: logo.bytes });
  }
  return zip(arqs);
}

function baixar(cfg) {
  return carregarLogo().then(function (logo) { return gerar(cfg, logo); }).then(function (b) {
    var blob = new Blob([b], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = cfg.arquivo;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
}

window.Planilha = { gerar: gerar, baixar: baixar };
})();
