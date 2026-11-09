@echo off
rem Abre o painel CONTAS A PAGAR E RECEBER (rotinas 717 e 1240) nesta maquina (http://localhost:3113), lendo o DATA
rem WAREHOUSE com o ENV do agente (ou do Inventario) que ja existe aqui. So esta maquina acessa.
cd /d "%~dp0web"
if not exist node_modules call npm install --no-audit --no-fund
start "" http://localhost:3113
node servidor_local.js
pause
