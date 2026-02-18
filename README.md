# 🏀 NBA Monitor v1 - Live Scores & AI Analytics

O **NBA Monitor v1** é uma plataforma avançada de monitoramento, análise estatística e predição de jogos da NBA. Projetada com uma estética *Glassmorphism* e foco em performance, a aplicação combina dados em tempo real via Supabase com a inteligência artificial de ponta do Google Gemini.

## 🚀 Visão Geral

A aplicação funciona como um centro de comando para analistas e apostadores de elite, permitindo não apenas acompanhar a classificação, mas simular cenários, analisar o impacto de desfalques e gerar palpites baseados em algoritmos de eficiência cruzada.

---

## ✨ Funcionalidades Principais

### 1. Monitor em Tempo Real
- **Power Ranking Dinâmico**: Classificação baseada no "Momentum" (sequência de vitórias/derrotas ponderada).
- **Integração ESPN**: Sincronização automática com estatísticas avançadas (PTS+, PTS-, %V, SEQ).
- **Sincronização Supabase**: Atualizações instantâneas entre múltiplos dispositivos sem necessidade de refresh.

### 2. Inteligência Artificial (AI Engine)
Utiliza modelos **Gemini 3-Pro** e **3-Flash** para:
- **Insights Estratégicos**: Geração automática de análises sobre tendências de mercado (Over/Under, Handicaps).
- **Matchup Analysis**: Comparativo profundo entre dois times considerando "Regras de Ouro" (ex: Cansaço em Back-to-Back, Defesa Ruim, Impacto de Estrelas Fora).
- **ChatBot Analítico**: O "Estatístico Chefe" disponível para tirar dúvidas sobre dados históricos e lesões.

### 3. Simulador de Confrontos (Team Comparison)
- **Placar Projetado**: Algoritmo que calcula a pontuação provável baseada em médias ofensivas e defensivas cruzadas.
- **Ajuste Médico**: Aplicação automática de penalidades no placar projetado (Ex: -3.0 pts por jogador chave fora).
- **Fator Casa/Fora**: Ponderação estatística para times mandantes.

### 4. Vault History (Arquivo Técnico)
- **Histórico de Performance**: Registro persistente de todas as análises feitas pela IA no Supabase.
- **Validação de Resultados**: Sistema de marcação manual para coletar "Greens" e "Reds", permitindo calcular a taxa de assertividade (Win Rate) real.
- **Layout de Densidade**: Tabela de alta densidade informativa com logos brutalistas e acesso rápido a detalhes.

### 5. ESPN Live Scoreboard
- **Placares em Tempo Real**: Painel dedicado que sincroniza diretamente com a API da ESPN para mostrar jogos ao vivo, placares finais e horários da rodada.
- **Destaque Visual**: Sistema de sinalização para jogos "LIVE" com micro-animações e tipografia mono.

### 6. Tips Dashboard (Painel de Especialista)
- **Tabela de Notas**: Sistema de Power Ranking manual/IA para categorizar franquias (Elite, Candidatos, Reconstrução).
- **Gerador de Cards**: Painel para criação de palpites com exportação direta para imagem (PNG) para compartilhamento em redes sociais.
- **Importação de IA**: Capacidade de puxar as predições geradas pela IA diretamente para o painel de edição.

### 7. Tracking de Desfalques e Stats
- **Relatório Unificado**: Monitoramento de lesões (OUT, Day-to-Day) e líderes de estatísticas (PTS, REB, AST) integrados ao fluxo principal do Monitor.

---

## 🛠 Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS.
- **Banco de Dados**: Supabase (PostgreSQL + Realtime).
- **IA**: Google Generative AI (Gemini API).
- **Bibliotecas Chave**:
  - `SWR`: Cache e revalidação de dados.
  - `html-to-image`: Geração de cards de predição.
  - `Lucide React`: Iconografia.

---

## 🧠 Regras de Ouro da IA (Golden Rules)

O motor de análise segue diretrizes rígidas para garantir qualidade nas predições:
1. **Defesa Ruim = Over**: Times com média de pontos sofridos alta priorizam palpites de Over.
2. **Impacto de Estrelas**: Redução drástica nas chances de vitória se o principal jogador estiver fora.
3. **Fator Cansaço**: Alerta de zebra para favoritos em jogos consecutivos (Back-to-back).
4. **Filtro de Handicap**: Evita Handicaps de baixo valor (+5.5), priorizando linhas mais agressivas ou seguras.
5. **Potencial de Pontuação**: Verificação de capacidade de ambos os times somarem +110 pts.

---

## 📂 Estrutura de Arquivos

- `/components`: Componentes modulares de UI (Standings, Comparison, Scoreboard, etc).
- `/services`: Lógica de integração com a API do Gemini.
- `/lib`: Configurações de clientes externos (Supabase).
- `/types`: Definições de interfaces TypeScript.
- `/constants`: Mock data inicial e configurações de times.

---

## 📖 Como Usar

1. **Navegação**: Use as abas no topo para alternar entre o **Monitor** (Dados em tempo real) e o painel de **Tips** (Predições).
2. **Comparação**: No Monitor, selecione dois times clicando no checkbox ou no logo. O painel de comparação abrirá automaticamente.
3. **Simulação**: Na aba Tips, você pode editar notas, adicionar palpites ou clicar em "Importar IA" para que o sistema gere sugestões baseadas nos dados atuais.
4. **Exportação**: Após configurar seus palpites no Painel de Tips, clique em "Exportar PNG" para gerar o card de divulgação.

---
*Desenvolvido por Senior Frontend Engineers com foco em High-End UI/UX para a comunidade NBA.*