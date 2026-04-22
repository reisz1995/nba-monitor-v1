import React, { useEffect, useState } from 'react';
import { AlignLeft, Database, Loader2, Calendar, Sparkles, Wand2, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ContextoSectionProps {
    tipsDate?: string;
    getTeamLogo?: (teamName: string) => string;
}

interface NbaGameSchedule {
    id: number;
    game_date: string;
    home_team: string;
    away_team: string;
    tactical_prediction: string;
    groq_insight: string;
    gemini_insight?: string;
}

const formatPrompt = (schedule: NbaGameSchedule) => `
Você é um editor sênior de um site profissional de análises esportivas e apostas da NBA. Sua missão é transformar dados brutos em uma redação envolvente, profissional e persuasiva.

## 📋 DADOS DE ENTRADA

### JOGO
- **GAME_DATE**: ${schedule.game_date}
- **HOME_TEAM**: ${schedule.home_team}
- **AWAY_TEAM**: ${schedule.away_team}
- **TACTICAL_PREDICTION**: ${schedule.tactical_prediction}
- **GROQ_INSIGHT**: ${schedule.groq_insight}

## 🎯 INSTRUÇÕES DE ESTRUTURA

Crie uma análise completa seguindo esta estrutura:

### 1. HEADLINE IMPACTANTE
- Título curto e chamativo (máx 60 caracteres)
- Destaque o confronto e a tendência principal (OVER/UNDER)

### 2. SUBTÍTULO
- Uma frase que resume a oportunidade de aposta

### 3. INTRODUÇÃO (2-3 parágrafos)
- Contexto do jogo
- O que está em jogo para cada equipe
- Gancho sobre a previsão

### 4. ANÁLISE TÁTICA
Extraia de TACTICAL_PREDICTION:
- **🏠 HOME TEAM**: Forças, fraquezas, jogadores-chave, lesões
- **✈️ AWAY TEAM**: Forma recente, estilo de jogo, matchups
- **⚔️ CONFRONTO DIRETO**: Histórico H2H, tendências

### 5. PALPITE PROFISSIONAL
Formate EXATAMENTE assim:
🎯 NOSSA APOSTA: [recommendation] [fair_line]
📊 CONFIANÇA: ⭐⭐⭐⭐☆ ([confidence_score]/5)
💰 UNIDADES RECOMENDADAS: [stake_units] unidades
📈 LINHA JUSTA: [fair_line]
🔥 EDGE: [edge_percentage]%

### 6. FATORES DECISIVOS
Liste os key_factors com emojis:
• 🚑 Lesões importantes
• 🔥 Forma recente
• 📊 Estatísticas H2H
• 🏟️ Fator casa/fora
• ⭐ Jogadores experientes

### 7. CONCLUSÃO
- Resumo da análise em 2-3 frases persuasivas
- Call-to-action: "Acompanhe ao vivo e confira nossa aposta!"

## ✨ REGRAS DE ESCRITA
1. **Tom**: Profissional, confiante, entusiasta
2. **Linguagem**: Português do Brasil, informal mas educado
3. **Emojis**: Use moderadamente para destacar pontos
4. **Destaques**: Use **negrito** para nomes de jogadores e estatísticas
5. **Números**: Sempre cite estatísticas específicas
`;

const ContextoSection: React.FC<ContextoSectionProps> = ({ tipsDate = '', getTeamLogo }) => {
    const [schedules, setSchedules] = useState<NbaGameSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formattingId, setFormattingId] = useState<number | null>(null);
    const [formattedData, setFormattedData] = useState<Record<number, string>>({});
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const pendingCount = schedules.filter(s => !formattedData[s.id]).length;

    useEffect(() => {
        const fetchSchedules = async () => {
            if (!tipsDate) return;
            setIsLoading(true);
            try {
                const parts = tipsDate.split('/');
                if (parts.length === 3) {
                    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    const { data, error } = await supabase
                        .from('nba_games_schedule')
                        .select('*')
                        .eq('game_date', formattedDate)
                        .order('game_time_et', { ascending: true });

                    if (error) {
                        console.error('Error fetching nba_games_schedule:', error);
                    } else if (data) {
                        setSchedules(data);

                        const prefilledFormat: Record<number, string> = {};
                        data.forEach((item: NbaGameSchedule) => {
                            if (item.gemini_insight) {
                                prefilledFormat[item.id] = item.gemini_insight;
                            }
                        });
                        setFormattedData(prefilledFormat);
                    }
                }
            } catch (err) {
                console.error('Unexpected error fetching nba_games_schedule:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedules();
    }, [tipsDate]);

    const handleFormat = async (schedule: NbaGameSchedule) => {
        setFormattingId(schedule.id);
        try {
            const prompt = formatPrompt(schedule);
            const response = await fetch('/api/format-context', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt, scheduleId: schedule.id })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Falha ao acionar formatador Gemini.');
            }

            const data = await response.json();



            setFormattedData(prev => ({
                ...prev,
                [schedule.id]: data.text
            }));

            setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, gemini_insight: data.text } : s));
        } catch (err: any) {
            console.error('Erro ao formatar:', err);
            alert(`Falha no Gemini: ${err.message}`);
        } finally {
            setFormattingId(null);
        }
    };

    const handleCopy = async (id: number, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Falha ao copiar:', err);

            // Fallback for non-secure contexts or older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "absolute";
            textArea.style.left = "-999999px";
            document.body.prepend(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            } catch (error) {
                console.error('Fallback copy failed:', error);
                alert('Erro ao copiar conteúdo.');
            } finally {
                textArea.remove();
            }
        }
    };

    const handleGenerateAll = async () => {
        if (!tipsDate || isGeneratingAll) return;
        setIsGeneratingAll(true);
        try {
            const parts = tipsDate.split('/');
            if (parts.length === 3) {
                const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                const response = await fetch('/api/generate-day-insights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: formattedDate })
                });

                if (!response.ok) {
                    throw new Error('Falha ao acionar rotina em lote.');
                }
            }
        } catch (err) {
            console.error('Erro na automação:', err);
            alert('Falha ao processar formatação rápida.');
        } finally {
            setIsGeneratingAll(false);
            window.location.reload(); // Recarrega a aplicação para exibir as tabelas hidratadas com a I.A
        }
    };

    return (
        <section className="space-y-8">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-3 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            <AlignLeft className="w-8 h-8 text-nba-black" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Contexto <span className="text-nba-text-secondary">Node</span>
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 font-oswald">
                                    <Database className="w-3 h-3" /> painel_contexto
                                </p>
                            </div>
                        </div>
                    </div>
                    {schedules.length > 0 && pendingCount > 0 && (
                        <button
                            onClick={handleGenerateAll}
                            disabled={isGeneratingAll || isLoading}
                            className={`flex items-center gap-2 font-black uppercase tracking-widest px-6 py-3 rounded-sm transition-all font-oswald disabled:opacity-50 ${isGeneratingAll ? 'bg-white text-nba-black' : 'bg-nba-gold text-nba-black hover:bg-white'}`}
                        >
                            {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {isGeneratingAll ? `PROCESSANDO ${pendingCount}... (PODE DEMORAR)` : `✨ GERAR TODOS OS INSIGHTS (${pendingCount})`}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-nba-surface border border-white/5 overflow-x-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-nba-surface-elevated text-[10px] font-black text-nba-text-secondary uppercase tracking-widest border-b border-white/5 font-oswald">
                            <th className="px-3 py-3 border-r border-white/5 w-[10%]"><div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> DATA</div></th>
                            <th className="px-3 py-3 border-r border-white/5 w-[20%] text-center">MATCHUP</th>
                            <th className="px-4 py-3 w-[70%] flex items-center gap-2 text-nba-gold">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> IA FORMATTED OUTPUT
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-4 text-nba-text-secondary">
                                        <Loader2 className="w-8 h-8 animate-spin text-nba-gold" />
                                        <span className="text-[10px] font-black uppercase tracking-widest font-oswald">Buscando contexto...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : schedules.length > 0 ? (
                            schedules.map((schedule) => (
                                <tr key={schedule.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-3 py-4 border-r border-white/5 text-xs text-center font-bebas tracking-wider text-nba-text-secondary align-middle">
                                        {schedule.game_date}
                                    </td>
                                    <td className="px-3 py-4 border-r border-white/5 text-sm font-black font-oswald uppercase align-middle">
                                        <div className="flex flex-col items-center gap-4 w-full">
                                            <div className="flex items-center justify-center gap-4 w-full">
                                                <div className="flex flex-col items-center gap-1">
                                                    <img src={getTeamLogo ? getTeamLogo(schedule.home_team) : ''} alt={schedule.home_team} className="w-12 h-12 object-contain" />
                                                    <span className="text-[10px] text-nba-text-secondary truncate w-24 text-center">{schedule.home_team}</span>
                                                </div>
                                                <span className="text-white/30 text-xs italic">vs</span>
                                                <div className="flex flex-col items-center gap-1">
                                                    <img src={getTeamLogo ? getTeamLogo(schedule.away_team) : ''} alt={schedule.away_team} className="w-12 h-12 object-contain" />
                                                    <span className="text-[10px] text-nba-text-secondary truncate w-24 text-center">{schedule.away_team}</span>
                                                </div>
                                            </div>

                                            {!formattedData[schedule.id] && (
                                                <button
                                                    onClick={() => handleFormat(schedule)}
                                                    disabled={formattingId === schedule.id}
                                                    className="mt-2 flex items-center gap-2 text-[10px] bg-nba-gold/10 text-nba-gold border border-nba-gold/30 px-4 py-2.5 uppercase tracking-widest hover:bg-nba-gold hover:text-nba-black transition-all font-oswald rounded-sm disabled:opacity-50 w-full justify-center max-w-[200px]"
                                                >
                                                    {formattingId === schedule.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Wand2 className="w-3.5 h-3.5" />
                                                    )}
                                                    {formattingId === schedule.id ? 'FORMATANDO...' : 'AI FORMAT'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        {formattedData[schedule.id] ? (
                                            <>
                                                <div className="flex items-center justify-between mb-4 bg-white/5 p-2 rounded-sm border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-nba-gold animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-nba-gold font-oswald">Análise Formatada</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopy(schedule.id, formattedData[schedule.id])}
                                                        className={`flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-sm transition-all font-oswald uppercase tracking-widest border ${copiedId === schedule.id ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 hover:bg-nba-gold hover:text-nba-black border-white/10 text-white/70'}`}
                                                    >
                                                        {copiedId === schedule.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                        {copiedId === schedule.id ? 'COPIADO!' : 'COPIAR ANÁLISE'}
                                                    </button>
                                                </div>
                                                <div className="max-h-80 overflow-y-auto pr-4 custom-scrollbar text-sm text-white/90 whitespace-pre-wrap leading-relaxed prose prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4">
                                                    {formattedData[schedule.id].split('\n').map((line, i) => {
                                                        if (line.startsWith('# ')) {
                                                            return <h1 key={i} className="text-xl font-black text-white font-oswald my-2">{line.replace('# ', '')}</h1>
                                                        } else if (line.startsWith('## ')) {
                                                            return <h2 key={i} className="text-lg font-black text-nba-gold font-oswald my-2">{line.replace('## ', '')}</h2>
                                                        } else if (line.startsWith('### ')) {
                                                            return <h3 key={i} className="text-md font-bold text-nba-blue font-oswald my-2">{line.replace('### ', '')}</h3>
                                                        } else if (line.startsWith('- ') || line.startsWith('• ')) {
                                                            try { return <li key={i} className="ml-4 list-disc text-white/80" dangerouslySetInnerHTML={{ __html: line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />; } catch (e) { return <li key={i} className="ml-4 list-disc text-white/80">{line.substring(2)}</li>; }
                                                        } else if (line.trim() === '---') {
                                                            return <hr key={i} className="border-white/10 my-4" />
                                                        } else if (line.startsWith('🎯') || line.startsWith('📊') || line.startsWith('💰') || line.startsWith('📈') || line.startsWith('🔥')) {
                                                            try { return <div key={i} className="font-bebas text-lg tracking-wider text-nba-text-secondary" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />; } catch (e) { return <div key={i} className="font-bebas text-lg tracking-wider text-nba-text-secondary">{line}</div>; }
                                                        } else if (line.trim() === '') {
                                                            return <div key={i} className="h-2"></div>
                                                        }
                                                        try { return <p key={i} className="text-white/80" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />; } catch (e) { return <p key={i} className="text-white/80">{line}</p>; }
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-full min-h-[160px] flex items-center justify-center border border-white/5 border-dashed rounded-sm bg-nba-surface/50">
                                                <span className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-oswald text-center">
                                                    Clique em "AI FORMAT" para gerar redação <br />(Dados Ocultos)
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-6">
                                        <Database className="w-12 h-12 text-white/20" />
                                        <span className="text-[10px] font-black text-nba-text-secondary uppercase tracking-[0.4em] italic font-oswald">
                                            Nenhum contexto encontrado para {tipsDate}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default ContextoSection;
