/**
 * /api/versao — o que há de novo, numa consulta pequena e sem cache:
 *   versao    a versão do sistema 'contas': o AGENTE LUBE troca toda vez que grava algo novo do WinThor (em aberto,
 *             pago, recebido); a tela pergunta de 15 em 15 s e, se mudou, refaz a consulta que está na tela
 *   agente    o agente está ligado? (batimento com menos de 3 minutos) e quando ele leu cada fluxo pela última vez
 *   pedido    com ?pedido=<id>: como está o pedido de leitura do WinThor (botão Atualizar ou o
 *             "Buscar no WinThor" da tela do título)
 */
"use strict";
const { consultar, json, semConfiguracao, erroBanco } = require("./_db");

const SQL =
  `SELECT (SELECT versao FROM agente.sistema WHERE sistema = 'contas') AS versao,
          (SELECT mudou_em FROM agente.sistema WHERE sistema = 'contas') AS mudou_em,
          b.visto AS agente_visto, coalesce(b.ligado, false) AS agente_ligado,
          (SELECT json_object_agg(fluxo, json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status))
             FROM agente.estado WHERE fluxo LIKE 'contas.%') AS fluxos,
          p.id AS pedido_id, p.status AS pedido_status, p.mensagem AS pedido_mensagem, p.detalhe AS pedido_detalhe,
          p.segundos AS pedido_segundos, p.atendido_em AS pedido_atendido_em
     FROM (SELECT 1) x
     LEFT JOIN (SELECT max(visto_em) AS visto, bool_or(ligado) AS ligado FROM agente.batimento
                 WHERE visto_em > now() - interval '3 minutes') b ON true
     LEFT JOIN agente.pedido p ON p.id = $1 AND p.sistema = 'contas'`;

module.exports = async function handler(req, res) {
  if (semConfiguracao(res)) return;
  try {
    const bruto = new URL(req.url, "http://x").searchParams.get("pedido");
    const pedido = /^\d{1,15}$/.test(bruto || "") ? bruto : null;
    const l = (await consultar(SQL, [pedido])).rows[0] || {};
    const fluxos = l.fluxos || {};
    // a hora da tela é a leitura mais recente dos títulos de cada rotina (em aberto e pagos, de minuto em minuto)
    const lido = (...fs) => fs.map((f) => (fluxos[f] || {}).lido_em).filter(Boolean).sort().pop() || null;
    const out = {
      versao: l.versao || null, mudou_em: l.mudou_em || null,
      agente: { vivo: !!(l.agente_visto && l.agente_ligado), visto_em: l.agente_visto || null,
                lido: { pagar: lido("contas.pagar", "contas.pagar_pago"), receber: lido("contas.receber", "contas.receber_pago") }, fluxos },
    };
    if (pedido) {
      out.pedido = l.pedido_id ? { id: Number(l.pedido_id), status: l.pedido_status, mensagem: l.pedido_mensagem,
        detalhe: l.pedido_detalhe, segundos: l.pedido_segundos == null ? null : Number(l.pedido_segundos), atendido_em: l.pedido_atendido_em } : null;
    }
    json(res, 200, out);
  } catch (e) {
    erroBanco(res, e);
  }
};
