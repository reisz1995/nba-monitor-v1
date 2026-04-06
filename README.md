# 🏀 NBA Monitor v1 - Live Scores & AI Analytics

O **NBA Monitor v1** é uma plataforma avançada de monitoramento, análise estatística e predição de jogos da NBA. Projetada com uma estética *Glassmorphism* e foco em performance, a aplicação combina dados em tempo real via Supabase com a inteligência artificial de ponta do Google Gemini.

## 🚀 Visão Geral

A aplicação funciona como um centro de comando para analistas e apostadores de elite, permitindo não apenas acompanhar a classificação, mas simular cenários, analisar o impacto de desfalques e gerar palpites baseados em algoritmos de eficiência cruzada.

---

## 🏗️ Arquitetura Técnica

O sistema opera em uma arquitetura moderna orientada a dados:

1.  **Ingestão de Dados (Providers)**:
    - **ESPN API**: Sincronização de placares ao vivo, horários e estatísticas básicas de temporada.
    - **Databallr (Supabase)**: Fonte primária para estatísticas avançadas de 14 dias (ORTG, DRTG, Pace Real).
2.  **Camada de Processamento (Logic)**:
    - **Projection Kernel (v4.3)**: Motor central em TypeScript que processa as métricas cruzadas.
    - **Gemini AI Service**: Orquestração de prompts para análise qualitativa de matchups.
3.  **Estado & Sincronização**:
    - **Supabase Realtime**: Persistência de análises e sincronização instantânea entre clientes.
    - **SWR**: Estratégia de cache e revalidação (stale-while-revalidate) para performance no frontend.

---

## 🧠 Algoritmo de Projeção (v4.3)

O coração do monitor é o motor de **Eficiência Cruzada Ajustada**, localizado em `lib/nbaUtils.ts`.

### 1. Parâmetros Base (Temporada 2025-26)
| Métrica | Valor Base | Descrição |
| :--- | :--- | :--- |
| **AVG_ORTG** | 116.9 | Média de pontos por 100 posses. |
| **AVG_PACE** | 99.2 | Média de posses por 48 minutos. |
| **MAX_PACE** | 107.0 | Limite superior de ritmo. |

### 2. O Kernel de Projeção
A pontuação projetada segue um fluxo de 6 estágios:

1.  **Cálculo de Pace Determinístico**: Combina o Pace de 14 dias (Databallr) de ambos os times com ajustes por desfalques críticos.
2.  **Eficiência Cruzada**:
    - `ScoreA = ((Offense_A + Defense_B) / 2) * (MatchPace / 100)`
3.  **Ajustes Contextuais**: Penalidades para vitórias por margens extremas (>20 pts) no jogo anterior e ajustes finos para jogos de ritmo muito lento.
4.  **Filtros de Superioridade (Power Score)**:
    - Aplica bônus de ataque e defesa baseados na diferença de `POWER_SCORE` entre as equipes.
5.  **Filtro de Volatilidade**: Compensa predições onde times de baixo ranking (Power Score <= 3.5) possuem Net Ratings positivos recentes.
6.  **Ajuste Médico & Mando**: Aplica o fator casa (+1.5/-1.5) e subtrai pontos ponderados pelo peso de cada jogador fora (Injury Penalty).

---

## ✨ Funcionalidades Principais

- **Monitor em Tempo Real**: Power Ranking dinâmico baseado em "Momentum".
- **Simulador de Confrontos**: Algoritmo v4.3 integrado com ajuste médico automático.
- **Vault History**: Arquivo técnico persistente no Supabase com validação de Win Rate.
- **Tips Dashboard**: Gerador de cards (PNG) com importação direta de predições da IA.
- **ESPN Live Scoreboard**: Placares sincronizados com micro-animações.

---

## 🛠 Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS 4.
- **Banco de Dados**: Supabase (PostgreSQL + Realtime).
- **IA**: Google Generative AI (Gemini 1.5 Pro/Flash).
- **Bibliotecas**: `SWR`, `html-to-image`, `Lucide React`, `Zod`.

---

## 📂 Estrutura de Arquivos

- `/components`: UI modular (Dashboards, Tables, Modals).
- `/services`: Clientes de API (Gemini, Databallr, History).
- `/lib`: Configurações de infraestrutura (Supabase, Utils de Projeção).
- `/hooks`: Lógica de estado reutilizável e subscrições Realtime.
- `/types`: Definições rigorosas de dados do domínio NBA.

---

## 📖 Configuração e Uso

### Variáveis de Ambiente (.env.local)
```env
VITE_SUPABASE_URL=seu_url
VITE_SUPABASE_ANON_KEY=sua_chave
VITE_GEMINI_API_KEY=sua_chave_gemini
```

### Comandos Disponíveis
- `npm run dev`: Inicia servidor de desenvolvimento Vite.
- `npm run test`: Executa suíte de testes Vitest para o Kernel v4.3.
- `npm run build`: Gera build otimizada para produção.

---
*Desenvolvido com foco em High-End UI/UX para a comunidade analítica da NBA.*