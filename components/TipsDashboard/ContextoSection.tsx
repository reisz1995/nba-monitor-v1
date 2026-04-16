import React from 'react';
import { AlignLeft, Database } from 'lucide-react';

const ContextoSection: React.FC = () => {
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
                </div>
            </div>

            <div className="bg-nba-surface border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm min-h-[200px] flex items-center justify-center p-8">
                <div className="text-center">
                    <span className="text-sm font-black text-nba-text-secondary uppercase tracking-[0.4em] italic font-oswald">
                        Aguardando instruções...
                    </span>
                </div>
            </div>
        </section>
    );
};

export default ContextoSection;
