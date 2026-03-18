import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Team, PalpiteData, NotaData } from '../types';
import { getFormattedDate, findTeamByName } from '../lib/nbaUtils';

interface UseTipsDashboardLogicProps {
    teams: Team[];
    tipsDateInitial?: string;
}

export const useTipsDashboardLogic = ({ teams, tipsDateInitial }: UseTipsDashboardLogicProps) => {
    const [tipsDate, setTipsDate] = useState(tipsDateInitial || getFormattedDate(new Date()));
    const [predictions, setPredictions] = useState<PalpiteData[]>([]);
    const [tierScores, setTierScores] = useState<Record<string, string>>({});
    const [dbNotas, setDbNotas] = useState<NotaData[]>([]);

    const [isSavingNotas, setIsSavingNotas] = useState(false);
    const [isSavingPalpites, setIsSavingPalpites] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const fetchNotas = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('tabela_notas').select('*');
            if (!error && data) {
                setDbNotas(data);
                const scoreMap: Record<string, string> = {};
                data.forEach((n: NotaData) => {
                    scoreMap[n.franquia] = n.nota_ia;
                });
                setTierScores(scoreMap);
            }
        } catch (err) {
            console.error("Erro ao carregar notas:", err);
        }
    }, []);

    const fetchPalpites = useCallback(async () => {
        const [d, m, y] = tipsDate.split('/');
        const isoDate = `${y}-${m}-${d}`;

        try {
            const { data, error } = await supabase
                .from('painel_palpites')
                .select('*')
                .eq('data_jogo', isoDate)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setPredictions(data);
            } else {
                setPredictions([]);
            }
        } catch (err) {
            console.error("Erro ao carregar palpites:", err);
        }
    }, [tipsDate]);

    useEffect(() => {
        fetchNotas();
        fetchPalpites();
    }, [fetchNotas, fetchPalpites]);

    const handleSaveAllNotas = async () => {
        setIsSavingNotas(true);
        try {
            const entries = Object.entries(tierScores || {});
            for (const [franquia, nota_ia] of entries) {
                const existing = dbNotas.find(n => n.franquia === franquia);
                if (existing) {
                    await supabase.from('tabela_notas').update({ nota_ia }).eq('id', existing.id);
                } else if (nota_ia !== '-') {
                    await supabase.from('tabela_notas').insert([{ franquia, nota_ia, criterio: 'Power Ranking 2026' }]);
                }
            }
            await fetchNotas();
            return { success: true, message: 'Tabela de Notas sincronizada!' };
        } catch (error) {
            console.error('Erro ao salvar notas:', error);
            return { success: false, message: 'Falha na sincronização.' };
        } finally {
            setIsSavingNotas(false);
        }
    };

    const handleSaveAllPalpites = async () => {
        setIsSavingPalpites(true);
        try {
            for (const pred of predictions) {
                if (pred.id) {
                    const { error } = await supabase
                        .from('painel_palpites')
                        .update({
                            time_casa: pred.time_casa,
                            time_fora: pred.time_fora,
                            palpite_principal: pred.palpite_principal,
                            over_line: pred.over_line,
                            under_line: pred.under_line,
                            p_combinados: pred.p_combinados || '-',
                            handicap_line: pred.handicap_line || '-', // MUTAÇÃO INJETADA
                            confianca: pred.confianca,
                            n_casa: pred.n_casa,
                            n_fora: pred.n_fora
                        })
                        .eq('id', pred.id);
                    if (error) throw error;
                }
            }
            return { success: true, message: 'Alterações no Painel salvas!' };
        } catch (error) {
            console.error('Erro ao salvar palpites:', error);
            return { success: false, message: 'Erro ao salvar alterações.' };
        } finally {
            setIsSavingPalpites(false);
        }
    };

    const handleImportFromIA = async () => {
        const [d, m, y] = tipsDate.split('/');
        const isoDate = `${y}-${m}-${d}`;

        setIsImporting(true);
        try {
            const { data: aiData, error } = await supabase
                .from('game_predictions')
                .select('*')
                .eq('date', isoDate);

            if (error) throw error;
            if (!aiData || aiData.length === 0) {
                return { success: false, message: 'Nenhum dado da IA encontrado para esta data.' };
            }

            const imports = aiData.map(ai => {
                const teamCasa = findTeamByName(ai.home_team, teams);
                const teamFora = findTeamByName(ai.away_team, teams);

                // Extrator Termodinâmico Seguro
                let predictionObj: any = {};
                try {
                    predictionObj = typeof ai.prediction === 'string' 
                        ? JSON.parse(ai.prediction) 
                        : (ai.prediction || {});
                } catch (e) {
                    console.error("[IA_PARSE_ERROR] Falha ao extrair payload:", e);
                }

                return {
                    data_jogo: isoDate,
                    time_casa: ai.home_team,
                    time_fora: ai.away_team,
                    palpite_principal: ai.main_pick || predictionObj.palpite_principal || '-',
                    over_line: ai.over_line || predictionObj.linha_seguranca_over || '-',
                    under_line: ai.under_line || predictionObj.linha_seguranca_under || '-',
                    p_combinados: '-', // Isolado
                    handicap_line: ai.handicap_line || predictionObj.handicap_recomendado || '-', // VETOR HABILITADO
                    confianca: ai.confidence ? `${ai.confidence}%` : '-',
                    n_casa: teamCasa ? (tierScores[teamCasa.name] || '-') : '-',
                    n_fora: teamFora ? (tierScores[teamFora.name] || '-') : '-'
                };
            });

            const { data: inserted, error: insError } = await supabase
                .from('painel_palpites')
                .insert(imports)
                .select();

            if (insError) throw insError;

            if (inserted) {
                setPredictions(prev => [...prev, ...inserted]);
            }

            return { success: true, message: `${aiData.length} registros importados da IA com sucesso!` };
        } catch (err) {
            console.error('Erro na importação:', err);
            return { success: false, message: 'Erro ao importar dados da IA.' };
        } finally {
            setIsImporting(false);
        }
    };

    const addPredictionRow = async () => {
        const [d, m, y] = tipsDate.split('/');
        const isoDate = `${y}-${m}-${d}`;

        const newRow: Omit<PalpiteData, 'id' | 'created_at'> = {
            data_jogo: isoDate,
            time_casa: '',
            time_fora: '',
            palpite_principal: '',
            over_line: '',
            under_line: '',
            p_combinados: '-',
            handicap_line: '-', // INICIALIZADOR NEUTRO
            confianca: '',
            n_casa: '-',
            n_fora: '-'
        };

        try {
            const { data, error } = await supabase.from('painel_palpites').insert([newRow]).select();
            if (error) throw error;
            if (data && data.length > 0) setPredictions(prev => [...prev, data[0]]);
        } catch (error) {
            console.error('Erro ao criar palpite:', error);
        }
    };

    const removePredictionRow = async (id: number) => {
        try {
            const { error } = await supabase.from('painel_palpites').delete().eq('id', id);
            if (error) throw error;
            setPredictions(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Erro ao deletar palpite:", error);
        }
    };

    const handleLocalScoreChange = (franquia: string, nota: string) => {
        setTierScores(prev => ({ ...prev, [franquia]: nota }));
    };

    const handleLocalPredictionChange = (id: number, field: keyof PalpiteData, value: string) => {
        setPredictions(prev => prev.map(p => {
            if (p.id === id) {
                const updated = { ...p, [field]: value };
                if (field === 'time_casa') {
                    const team = findTeamByName(value, teams);
                    updated.n_casa = team ? (tierScores[team.name] || '-') : '-';
                } else if (field === 'time_fora') {
                    const team = findTeamByName(value, teams);
                    updated.n_fora = team ? (tierScores[team.name] || '-') : '-';
                }
                return updated;
            }
            return p;
        }));
    };

    return {
        tipsDate,
        setTipsDate,
        predictions,
        tierScores,
        isSavingNotas,
        isSavingPalpites,
        isImporting,
        handleSaveAllNotas,
        handleSaveAllPalpites,
        handleImportFromIA,
        addPredictionRow,
        removePredictionRow,
        handleLocalScoreChange,
        handleLocalPredictionChange
    };
};
