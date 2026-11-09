"""
SO LEITURA. Confere, no mesmo instante, o que a tela soma contra o WinThor (2026-11-09):

  1. Pagos (717) e recebidos (1240) desde 2011, ano a ano: quantidade, valor e valor pago.
       WinThor: PCLANC com DTPAGTO, VPAGO <> 0 e as contas de fora do PCCONSUM (regra "contas pagas" da 717);
                PCPREST com DTPAG (1240).
       Banco:   contas.pagar_pago e contas.receber_pago (carga do histórico + AGENTE LUBE).
  2. Em aberto, como a rotina: a tela (contas.consulta) com os mesmos filtros de saída da rotina
       717: só cheque/borderô não emitidos; 1240: sem DESD e só com cliente e RCA no cadastro; nos dois, os vencidos
       antes de 2011 incluídos (a rotina mostra; a tela deixa fora com "mostrar").

Diferença pequena no ano corrente é o que mudou no WinThor entre as leituras do agente (de minuto em minuto):
rodar de novo. Não grava nada.

Uso: python -X utf8 conferir_pagos.py
"""
import json
import os
from decimal import Decimal

import oracledb
import psycopg2
from dotenv import load_dotenv

ENV = os.environ.get("AGENTE_ENV") or r"C:\Users\gti.julio.alves\Desktop\BI\16. INVENTARIO\etl\ENV"
load_dotenv(ENV)
D = lambda v: Decimal(str(v)) if v is not None else Decimal(0)
FORA_CONTAS = """
   AND c.codconta NOT IN (SELECT NVL(codcontantpag, 0) FROM pcconsum)
   AND c.codconta NOT IN (SELECT NVL(codcontrecjur, 0) FROM pcconsum)
   AND c.codconta NOT IN (SELECT NVL(codcontpagjur, 0) FROM pcconsum)"""

ORA_PAGOS = f"""
SELECT EXTRACT(YEAR FROM l.dtpagto), COUNT(*), SUM(NVL(l.valor, 0)), SUM(NVL(l.vpago, 0))
  FROM pclanc l, pcconta c
 WHERE l.codconta = c.codconta AND l.dtpagto >= DATE '2011-01-01' AND NVL(l.vpago, 0) <> 0 {FORA_CONTAS}
 GROUP BY EXTRACT(YEAR FROM l.dtpagto)"""
ORA_RECEBIDOS = """
SELECT EXTRACT(YEAR FROM p.dtpag), COUNT(*), SUM(NVL(p.valor, 0)), SUM(NVL(p.vpago, 0))
  FROM pcprest p WHERE p.dtpag >= DATE '2011-01-01'
 GROUP BY EXTRACT(YEAR FROM p.dtpag)"""
PG_PAGOS = "SELECT extract(year FROM dtpagto)::int, count(*), sum(valor), sum(vpago) FROM contas.pagar_pago GROUP BY 1"
PG_RECEBIDOS = "SELECT extract(year FROM dtpag)::int, count(*), sum(valor), sum(vpago) FROM contas.receber_pago GROUP BY 1"

ORA_ABERTO_717 = f"""
SELECT COUNT(*), SUM(NVL(l.valor, 0) + NVL(l.txperm, 0) - NVL(l.descontofin, 0) - NVL(l.valordev, 0) + NVL(l.vlvariacaocambial, 0))
  FROM pclanc l, pcconta c
 WHERE l.codconta = c.codconta AND l.dtpagto IS NULL AND l.dtcheq IS NULL AND l.dtborder IS NULL {FORA_CONTAS}"""
ORA_ABERTO_1240 = """
SELECT COUNT(*), SUM(NVL(p.valor, 0))
  FROM pcprest p, pcclient c, pcusuari u
 WHERE p.codcli = c.codcli AND p.codusur = u.codusur AND p.codcob <> 'DESD' AND p.dtpag IS NULL"""


def main() -> None:
    dsn = oracledb.makedsn(os.environ["ORACLE_HOST"].strip(), int(os.environ.get("ORACLE_PORT", "1521")),
                           service_name=os.environ["ORACLE_SERVICE_NAME"].strip())
    ora = oracledb.connect(user=os.environ["ORACLE_USER"].strip(), password=os.environ["ORACLE_PASSWORD"], dsn=dsn)
    ora.module = "CONFERENCIA CONTAS"
    oc = ora.cursor()
    pg = psycopg2.connect(host=os.environ["SUPABASE_DB_HOST"], port=int(os.environ.get("SUPABASE_DB_PORT", "5432")),
                          dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"), user=os.environ["SUPABASE_DB_USER"],
                          password=os.environ["SUPABASE_DB_PASSWORD"], sslmode="require", application_name="conferencia-contas")
    pc = pg.cursor()
    pc.execute("SET statement_timeout = '300s'")
    tudo_ok = True
    for nome, sql_o, sql_p in (("717 PAGOS", ORA_PAGOS, PG_PAGOS), ("1240 RECEBIDOS", ORA_RECEBIDOS, PG_RECEBIDOS)):
        oc.execute(sql_o); w = {int(r[0]): (r[1], D(r[2]), D(r[3])) for r in oc.fetchall()}
        pc.execute(sql_p); b = {int(r[0]): (r[1], D(r[2]), D(r[3])) for r in pc.fetchall()}
        print(f"\n{nome}: ano | WinThor (qtd, valor, pago) | banco | diferença")
        tw = [0, Decimal(0), Decimal(0)]; tb = [0, Decimal(0), Decimal(0)]
        for ano in sorted(set(w) | set(b)):
            x, y = w.get(ano, (0, Decimal(0), Decimal(0))), b.get(ano, (0, Decimal(0), Decimal(0)))
            for i in range(3): tw[i] += x[i]; tb[i] += y[i]
            dif = (y[0] - x[0], y[1] - x[1], y[2] - x[2])
            ok = dif == (0, 0, 0)
            tudo_ok &= ok or ano == max(w)
            print(f"  {ano} | {x[0]:>8} {x[1]:>18,.2f} {x[2]:>18,.2f} | {y[0]:>8} {y[1]:>18,.2f} {y[2]:>18,.2f} | "
                  f"{'igual' if ok else f'{dif[0]:+} {dif[1]:+,.2f} {dif[2]:+,.2f}'}")
        print(f"  TOTAL | {tw[0]:>8} {tw[1]:>18,.2f} {tw[2]:>18,.2f} | {tb[0]:>8} {tb[1]:>18,.2f} {tb[2]:>18,.2f}")

    print("\nEM ABERTO (como a rotina): WinThor | tela")
    oc.execute(ORA_ABERTO_717); n, v = oc.fetchone()
    pc.execute("SELECT contas.consulta(%s::jsonb)", (json.dumps({"rot": "pagar", "status": "aberto", "limite": 1, "mostrar": {"antigos": True}}),))
    t = pc.fetchone()[0]["tot"]
    print(f"  717  {n:>6} {D(v):>18,.2f} | {t['n']:>6} {D(t['valorpagar']):>18,.2f} | {'igual' if n == t['n'] and D(v) == D(t['valorpagar']) else 'DIFERENTE'}")
    oc.execute(ORA_ABERTO_1240); n, v = oc.fetchone()
    pc.execute("SELECT contas.consulta(%s::jsonb)", (json.dumps({"rot": "receber", "status": "aberto", "limite": 1, "mostrar": {"antigos": True}}),))
    t = pc.fetchone()[0]["tot"]
    print(f"  1240 {n:>6} {D(v):>18,.2f} | {t['n']:>6} {D(t['areceber']):>18,.2f} | {'igual' if n == t['n'] and D(v) == D(t['areceber']) else 'DIFERENTE'}")
    ora.close(); pg.close()
    print("\nAnos fechados:", "TODOS IGUAIS" if tudo_ok else "HÁ DIFERENÇA (ver acima)")


if __name__ == "__main__":
    main()
