/**
 * /api/titulo — a tela de um título, lida na hora do banco (o agente mantém do WinThor):
 *   ?t=p&r=<Núm. Lanc.>                 717: o lançamento e o desdobramento dele (contas.detalhe_pagar)
 *   ?t=r&nt=<Num.Trans.Venda>&p=<Prest> 1240: a duplicata e as abas da tela do título (contas.detalhe_receber)
 */
"use strict";
const { consultar, json, semConfiguracao, erroBanco } = require("./_db");

module.exports = async function handler(req, res) {
  if (semConfiguracao(res)) return;
  try {
    const q = new URL(req.url, "http://x").searchParams;
    const t = q.get("t");
    let r;
    if (t === "p") {
      const recnum = q.get("r");
      if (!/^\d{1,15}$/.test(recnum || "")) return json(res, 400, { erro: "parametro", mensagem: "Informe o número do lançamento (r)." });
      r = await consultar("SELECT contas.detalhe_pagar($1::bigint) AS j", [recnum]);
    } else if (t === "r") {
      const nt = q.get("nt"), p = q.get("p");
      if (!/^-?\d{1,15}$/.test(nt || "") || !/^[\w\-]{1,10}$/.test(p || "")) return json(res, 400, { erro: "parametro", mensagem: "Informe a transação de venda (nt) e a prestação (p)." });
      r = await consultar("SELECT contas.detalhe_receber($1::bigint, $2::text) AS j", [nt, p]);
    } else {
      return json(res, 400, { erro: "parametro", mensagem: "Use t=p (contas a pagar) ou t=r (contas a receber)." });
    }
    const j = (r.rows[0] || {}).j;
    if (!j || !j.t) return json(res, 404, { erro: "nao_encontrado", mensagem: "Título não encontrado: foi excluído no WinThor ou é um pagamento anterior a 2011." });
    json(res, 200, j);
  } catch (e) {
    erroBanco(res, e);
  }
};
