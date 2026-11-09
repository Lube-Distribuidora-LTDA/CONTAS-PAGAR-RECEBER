"""
Carga ÚNICA do histórico de pagos e recebidos (2026-11-09), de 01/01/2011 até 60 dias atrás.

Pedido do Júlio: "preciso saber o que já pagou também... desde 01/01/2011 e atualizando todos os dias". Daí em diante
quem mantém é o AGENTE LUBE: os fluxos contas.pagar_pago / contas.receber_pago (7 dias, de minuto em minuto) e
*_60d (60 dias, de hora em hora). Esta carga cobre só o que é mais velho que a janela de 60 dias, então não encosta
no que o agente grava. A regra é a dos fluxos (fluxos/contas.toml do agente), com as mesmas colunas.

Lê o WinThor ano a ano (só leitura, uma consulta por vez) e grava no DATA WAREHOUSE por COPY numa tabela temporária
+ INSERT ... ON CONFLICT DO NOTHING (rodar de novo não duplica nada). Texto sem espaço nas pontas e vazio vira nulo,
número do Oracle pelo mesmo caminho do agente (float -> Decimal(repr)).

Uso:  python -X utf8 carga_historico.py               os dois lados
      python -X utf8 carga_historico.py pagar          só a 717
      python -X utf8 carga_historico.py receber 2019   só a 1240, de 2019 em diante
"""
import io
import os
import sys
import time
from datetime import date, datetime, timedelta
from decimal import Decimal

import oracledb
import psycopg2
from dotenv import load_dotenv

ENV = os.environ.get("AGENTE_ENV") or r"C:\Users\gti.julio.alves\Desktop\BI\16. INVENTARIO\etl\ENV"
load_dotenv(ENV)
INICIO = date(2011, 1, 1)
CORTE = date.today() - timedelta(days=60)   # a janela do fluxo *_60d começa aqui (meia-noite de 60 dias atrás)

LADOS = {
    "pagar": {
        "destino": "contas.pagar_pago",
        "chave": "recnum",
        "colunas": ["recnum", "recnumprinc", "codfilial", "dtlanc", "dtemissao", "dtvenc", "dtpagto", "dtcompetencia",
                    "codfornec", "tipoparceiro", "parceiro_txt", "codconta", "historico", "numnota", "duplic", "parcela",
                    "valor", "descontofin", "valordev", "txperm", "vlvariacaocambial", "vpago", "numbanco", "nomefunc",
                    "codcomprador", "codrotinabaixa"],
        "sql": """
SELECT l.recnum, l.recnumprinc, l.codfilial, l.dtlanc, l.dtemissao, l.dtvenc, l.dtpagto, l.dtcompetencia, l.codfornec,
       l.tipoparceiro, CASE WHEN l.tipoparceiro IN ('F', 'R', 'C', 'M', 'L') THEN NULL ELSE l.fornecedor END AS parceiro_txt,
       l.codconta, l.historico, l.numnota, l.duplic, NVL(l.parcela, l.duplic) AS parcela,
       NVL(l.valor, 0) AS valor, NVL(l.descontofin, 0) AS descontofin, NVL(l.valordev, 0) AS valordev,
       NVL(l.txperm, 0) AS txperm, NVL(l.vlvariacaocambial, 0) AS vlvariacaocambial, NVL(l.vpago, 0) AS vpago,
       l.numbanco, l.nomefunc, l.codcomprador, l.codrotinabaixa
  FROM pclanc l, pcconta c
 WHERE l.codconta = c.codconta
   AND l.dtpagto >= :ini AND l.dtpagto < :fim
   AND NVL(l.vpago, 0) <> 0
   AND c.codconta NOT IN (SELECT NVL(codcontantpag, 0) FROM pcconsum)
   AND c.codconta NOT IN (SELECT NVL(codcontrecjur, 0) FROM pcconsum)
   AND c.codconta NOT IN (SELECT NVL(codcontpagjur, 0) FROM pcconsum)""",
        "data": "dtpagto",
    },
    "receber": {
        "destino": "contas.receber_pago",
        "chave": "numtransvenda, prest",
        "colunas": ["numtransvenda", "prest", "codfilial", "duplic", "dtemissao", "dtvenc", "dtpag", "dtcancel", "codcli",
                    "codusur", "codsupervisor", "codcob", "valor", "txperm", "valordesc", "vpago", "codbanco",
                    "nossonumbco", "tem_cad"],
        "sql": """
SELECT p.numtransvenda, p.prest, p.codfilial, p.duplic, p.dtemissao, p.dtvenc, p.dtpag, p.dtcancel, p.codcli, p.codusur,
       p.codsupervisor, p.codcob, NVL(p.valor, 0) AS valor, NVL(p.txperm, 0) AS txperm, NVL(p.valordesc, 0) AS valordesc,
       NVL(p.vpago, 0) AS vpago, p.codbanco, p.nossonumbco,
       CASE WHEN EXISTS (SELECT 1 FROM pcclient c WHERE c.codcli = p.codcli)
             AND EXISTS (SELECT 1 FROM pcusuari u WHERE u.codusur = p.codusur) THEN 'S' ELSE 'N' END AS tem_cad
  FROM pcprest p
 WHERE p.dtpag >= :ini AND p.dtpag < :fim""",
        "data": "dtpag",
    },
}


def numero(d: Decimal) -> str:
    t = format(d.normalize(), "f")
    return "0" if t == "-0" else t


def texto(v) -> str:
    """Valor do Oracle -> campo do COPY (o mesmo formato do agente)."""
    if v is None:
        return r"\N"
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return r"\N"
        return v.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")
    if isinstance(v, bool):
        return "t" if v else "f"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return numero(Decimal(repr(v)))
    if isinstance(v, Decimal):
        return numero(v)
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return texto(str(v))


def conectar():
    dsn = oracledb.makedsn(os.environ["ORACLE_HOST"].strip(), int(os.environ.get("ORACLE_PORT", "1521")),
                           service_name=os.environ["ORACLE_SERVICE_NAME"].strip())
    ora = oracledb.connect(user=os.environ["ORACLE_USER"].strip(), password=os.environ["ORACLE_PASSWORD"], dsn=dsn)
    ora.module = "CARGA HISTORICO CONTAS"
    ora.call_timeout = 600_000
    pg = psycopg2.connect(host=os.environ["SUPABASE_DB_HOST"], port=int(os.environ.get("SUPABASE_DB_PORT", "5432")),
                          dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"), user=os.environ["SUPABASE_DB_USER"],
                          password=os.environ["SUPABASE_DB_PASSWORD"], sslmode="require",
                          application_name="carga-historico-contas")
    return ora, pg


def carregar(ora, pg, lado: str, de_ano: int) -> None:
    L = LADOS[lado]
    cols = ", ".join(L["colunas"])
    for ano in range(max(de_ano, INICIO.year), CORTE.year + 1):
        ini = max(date(ano, 1, 1), INICIO)
        fim = min(date(ano + 1, 1, 1), CORTE)
        if ini >= fim:
            continue
        t = time.time()
        oc = ora.cursor()
        oc.arraysize = 20000
        oc.prefetchrows = 20000
        oc.execute(L["sql"], ini=datetime(ini.year, ini.month, ini.day), fim=datetime(fim.year, fim.month, fim.day))
        buf = io.StringIO()
        n = 0
        while True:
            lote = oc.fetchmany()
            if not lote:
                break
            for r in lote:
                buf.write("\t".join(texto(v) for v in r))
                buf.write("\n")
            n += len(lote)
        oc.close()
        t_ora = time.time() - t
        buf.seek(0)
        with pg.cursor() as cur:
            cur.execute("SET statement_timeout = '900s'")
            cur.execute(f"CREATE TEMP TABLE stg (LIKE {L['destino']}) ON COMMIT DROP")
            cur.copy_expert(f"COPY stg ({cols}) FROM STDIN", buf)
            cur.execute(f"INSERT INTO {L['destino']} ({cols}) SELECT {cols} FROM stg ON CONFLICT ({L['chave']}) DO NOTHING")
            gravadas = cur.rowcount
        pg.commit()
        print(f"{lado:8} {ini:%d/%m/%Y} a {fim - timedelta(days=1):%d/%m/%Y}: {n:>9,} lidas em {t_ora:5.1f}s, "
              f"{gravadas:>9,} gravadas em {time.time() - t - t_ora:5.1f}s".replace(",", "."), flush=True)


def main() -> None:
    lados = [a for a in sys.argv[1:] if a in LADOS] or list(LADOS)
    anos = [int(a) for a in sys.argv[1:] if a.isdigit()]
    de_ano = anos[0] if anos else INICIO.year
    print(f"Histórico de {INICIO:%d/%m/%Y} até {CORTE - timedelta(days=1):%d/%m/%Y} (daí em diante, o agente)")
    ora, pg = conectar()   # só SELECT; cada ano é uma consulta (uma transação longa de leitura arriscaria o ORA-01555)
    try:
        for lado in lados:
            carregar(ora, pg, lado, de_ano)
    finally:
        ora.rollback()
        ora.close()
        pg.close()


if __name__ == "__main__":
    main()
