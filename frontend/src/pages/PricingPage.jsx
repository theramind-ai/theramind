import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Check, X } from 'lucide-react';
import api from '../lib/api';

export default function PricingPage() {
    const [currentPlan, setCurrentPlan] = useState('free');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('subscription_plan').eq('id', user.id).single();
                if (data) setCurrentPlan(data.subscription_plan || 'free');
            }
            setLoading(false);
        };
        fetchProfile();

        // Check for success/cancel query params
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            alert("Pagamento realizado com sucesso! Seu plano foi atualizado.");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('canceled')) {
            alert("Pagamento cancelado.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleSubscribe = async (plan) => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert("Faça login para assinar.");
                return;
            }

            // Call Backend to get Checkout URL
            const response = await api.post('/api/create-checkout-session', {
                email: user.email,
                plan: plan
            });

            // Redirect to Stripe
            window.location.href = response.data;

        } catch (error) {
            console.error(error);
            alert("Erro ao iniciar assinatura.");
        } finally {
            setLoading(false);
        }
    };

    const PlanCard = ({ title, price, features, planId, isPopular }) => {
        const isCurrent = currentPlan === planId;
        return (
            <div className={`border rounded-xl p-6 flex flex-col ${isPopular ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200'} bg-white dark:bg-slate-800 dark:border-slate-700`}>
                {isPopular && <div className="text-sm text-blue-500 font-bold mb-2 uppercase tracking-wide">Mais Popular</div>}
                <h3 className="text-2xl font-bold mb-2 dark:text-white">{title}</h3>
                <div className="text-4xl font-bold mb-6 dark:text-white">
                    {price === 0 ? "Grátis" : <>R$ {price}<span className="text-base font-normal text-gray-500">/mês</span></>}
                </div>

                <ul className="flex-1 space-y-4 mb-8">
                    {features.map((f, i) => (
                        <li key={i} className="flex items-start">
                            <Check className="text-green-500 mr-2 flex-shrink-0" size={20} />
                            <span className="text-gray-600 dark:text-gray-300 text-sm">{f}</span>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={() => handleSubscribe(planId)}
                    disabled={isCurrent || loading || price === 0}
                    className={`w-full py-3 rounded-lg font-bold transition-colors ${isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                >
                    {isCurrent ? "Plano Atual" : loading ? "Processando..." : "Assinar Agora"}
                </button>
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center">Carregando...</div>;

    return (
        <div className="container mx-auto p-8 max-w-6xl">
            <h1 className="text-3xl font-bold text-center mb-4 dark:text-white">Planos e Assinaturas</h1>
            <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
                Escolha o plano ideal para sua clínica. Cancele quando quiser.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <PlanCard
                    title="Gratuito"
                    price={0}
                    planId="free"
                    features={[
                        "Até 3 Prontuários (Sessões) por dia",
                        "Gestão básica de pacientes",
                        "Análise básica com IA (3x/dia)",
                        "Sem acesso ao Agendamento"
                    ]}
                />
                <PlanCard
                    title="Plus"
                    price={24.90}
                    planId="plus"
                    isPopular={true}
                    features={[
                        "Até 10 Prontuários (Sessões) por dia",
                        "Análise com IA (Insights Profundos)",
                        "Agendamento de Consultas",
                        "Gestão de Pacientes",
                        "Relatórios PDF"
                    ]}
                />
                <PlanCard
                    title="Premium"
                    price={79.90}
                    planId="premium"
                    features={[
                        "Prontuários Ilimitados",
                        "Chat Copiloto Clínico",
                        "Análise com IA (Insights Profundos)",
                        "Agendamento de Consultas",
                        "Suporte Prioritário",
                        "Tudo do plano Plus"
                    ]}
                />
            </div>
        </div>
    );
}
