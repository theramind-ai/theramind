import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, X, Check } from 'lucide-react';

export function UpgradeModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header/Banner */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                        <Rocket className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Limite Diário Atingido</h2>
                    <p className="text-blue-100 text-sm mt-1">Você aproveitou ao máximo seu plano gratuito hoje!</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-600 dark:text-slate-300 text-center mb-6">
                        Para continuar gerando análises ilimitadas e ter acesso ao Copiloto Clínico, mude para um de nossos planos premium.
                    </p>

                    <div className="space-y-3 mb-8">
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-200">
                            <Check className="text-green-500 mr-3 flex-shrink-0" size={18} />
                            <span>Análises e gravações ilimitadas</span>
                        </div>
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-200">
                            <Check className="text-green-500 mr-3 flex-shrink-0" size={18} />
                            <span>Insights clínicos profundos</span>
                        </div>
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-200">
                            <Check className="text-green-500 mr-3 flex-shrink-0" size={18} />
                            <span>Agenda e Gestão Financeira</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                onClose();
                                navigate('/pricing');
                            }}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95 text-center"
                        >
                            VER PLANOS E FAZER UPGRADE
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium rounded-xl transition-colors text-center text-sm"
                        >
                            Continuar com limitações
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                        Theramind Premium &copy; 2026
                    </p>
                </div>
            </div>
        </div>
    );
}
