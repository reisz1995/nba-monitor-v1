# Plano de Orquestração: Pre-flight & Deploy Checks

Este plano coordena três especialistas para garantir que a aplicação `nba-monitor-v1` está pronta para entrar em produção com segurança e estabilidade.

## Agentes e Atribuições

### 1. 🛡️ Security Auditor (`security-auditor`)
**Foco:** Garantir que nenhum segredo ou vulnerabilidade crítica chegue à produção.
- **Ações:**
    - Executar `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`
    - Verificar `services/geminiService.ts` quanto ao tratamento de API Keys.
    - Auditar `lib/supabase.ts` para garantir que `service_role` não é usado no frontend (vazamento de privilégios).
    - Verificar se `.env.local` está devidamente ignorado e se há referências a segredos no código.

### 2. 🏗️ DevOps Engineer (`devops-engineer`)
**Foco:** Validar build, infraestrutura e limites da Vercel.
- **Ações:**
    - Executar `npm run build` para garantir que o bundle final é válido e sem erros de types.
    - Validar `vercel.json`: Verificar se `maxDuration: 60` é suficiente para as funções de scraping (Gemini + Cheerio).
    - Verificar conformidade do `package.json` (versões e dependências).
    - Validar caminhos de API e cabeçalhos CORS.

### 3. 🧪 Test Engineer (`test-engineer`)
**Foco:** Garantir integridade lógica e regressão zero.
- **Ações:**
    - Executar `npx vitest run` (suíte completa).
    - Verificar cobertura de testes em `lib/nbaUtils.ts` (Core do algoritmo).
    - Validar se as correções de "Edge Calculation" estão cobertas logicamente.
    - Verificar testes de componentes UI em `components/`.

---

## Fluxo de Saída

Cada agente gerará um sub-relatório que será consolidado pelo **Orchestrator** num relatório final de prontidão.

---

## Critérios de Sucesso (Go/No-Go)
1. **Security**: Zero vulnerabilidades de alta prioridade. Segredos protegidos.
2. **Build**: Sucesso no `npm run build`.
3. **Tests**: 100% de passagem nos 22 testes existentes.
4. **Vercel**: Configuração de memória e timeout alinhada com os requisitos do Scraper.
