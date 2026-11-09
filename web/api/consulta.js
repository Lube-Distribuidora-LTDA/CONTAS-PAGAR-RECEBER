/**
 * /api/consulta (POST, JSON) — a tela inteira sai daqui, feita no banco (contas.consulta):
 *   acao lista    a página (ordem, deslocamento, tamanho) e os totais do recorte, com o que os filtros de saída deixam fora
 *   acao valores  a lista de valores de uma coluna, já filtrada pelas outras (o filtro do Excel), com a busca escrita
 *   acao opcoes   as filiais
 * O corpo é o pedido da tela: status (aberto, pago, todos), período, busca, filtros das colunas, "mostrar". O SQL só
 * usa colunas de uma lista fixa (contas.colunas) e põe o valor do usuário entre aspas; aqui só se limita o tamanho.
 */
"use strict";
const { consultar, json, semConfiguracao, erroBanco } = require("./_db");

function lerCorpo(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
  return new Promise((ok, falha) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 200000) { falha(new Error("pedido grande demais")); req.destroy(); } });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { falha(e); } });
    req.on("error", falha);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erro: "metodo", mensagem: "Use POST." }, { Allow: "POST" });
  if (semConfiguracao(res)) return;
  let p;
  try { p = await lerCorpo(req); } catch (e) { return json(res, 400, { erro: "pedido", mensagem: "Pedido inválido." }); }
  if (!p || typeof p !== "object" || Array.isArray(p)) return json(res, 400, { erro: "pedido", mensagem: "Pedido inválido." });
  const texto = JSON.stringify(p);
  if (texto.length > 100000) return json(res, 413, { erro: "pedido", mensagem: "Filtros demais de uma vez: tire alguns e tente de novo." });
  try {
    const r = await consultar("SELECT contas.consulta($1::jsonb) AS j", [texto]);
    json(res, 200, (r.rows[0] || {}).j || {});
  } catch (e) {
    if (/coluna desconhecida|campo desconhecido|tipo de coluna|invalid input syntax/i.test(String(e && e.message))) {
      return json(res, 400, { erro: "pedido", mensagem: "Filtro inválido: " + String(e.message).replace(/^.*?: /, "") });
    }
    erroBanco(res, e);
  }
};
