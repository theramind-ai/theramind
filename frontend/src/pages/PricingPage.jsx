import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function PricingPage() {
    const navigate = useNavigate();

    const handleSubscribe = () => {
        alert("Atualmente todos os recursos estão liberados! Aproveite.");
        navigate('/dashboard');
    };

    const PlanCard = ({ title, price, features, isPopular }) => {
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
                    onClick={handleSubscribe}
                    className={`w-full py-3 rounded-lg font-bold transition-colors bg-blue-600 hover:bg-blue-700 text-white`}
                >
                    Escolher este plano
                </button>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-8 max-w-6xl">
            <h1 className="text-3xl font-bold text-center mb-4 dark:text-white">Planos e Assinaturas</h1>
            <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
                Todos os recursos estão liberados neste ambiente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <PlanCard
                    title="Gratuito"
                    price={0}
                    features={[
                        "Até 3 atendimentos por dia",
                        "Gravação e Transcrição (3x/dia)",
                        "Análise básica com IA (3x/dia)",
                        "Gestão básica de pacientes"
                    ]}
                />
                <PlanCard
                    title="Plus"
                    price={24.90}
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
