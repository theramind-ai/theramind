import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User, FileBadge, Mail, LogOut, Save } from 'lucide-react';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { Logo } from '../components/Logo';

export default function OnboardingPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state
    const [name, setName] = useState('');
    const [crp, setCrp] = useState('');
    const [isCrpValid, setIsCrpValid] = useState(null); // null, true, false
    const [crpError, setCrpError] = useState('');
    const [validatingCrp, setValidatingCrp] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [theoreticalApproach, setTheoreticalApproach] = useState('Integrativa');
    const [termsAccepted, setTermsAccepted] = useState(false);

    useEffect(() => {
        // Double check if profile exists or is already complete to avoid stuck users
        async function checkProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile?.name && profile?.crp) {
                    navigate('/dashboard');
                }
            } catch (err) {
                console.error("Error checking profile:", err);
            } finally {
                setInitialLoading(false);
            }
        }
        checkProfile();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleCrpBlur = async () => {
        if (!crp.trim()) return;

        setValidatingCrp(true);
        setCrpError('');
        setIsCrpValid(null);

        try {
            const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/api/validate-crp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crp: crp.trim() })
            });

            if (!response.ok) throw new Error('Erro na validação');

            const result = await response.json();

            if (result.valid && !result.exists_in_theramind) {
                setIsCrpValid(true);
            } else {
                setIsCrpValid(false);
                setCrpError(result.error || 'CRP inválido ou já cadastrado.');
            }
        } catch (err) {
            console.error('Error validating CRP:', err);
            // Non-blocking fallback if API is down, but let's be strict for now
            // setIsCrpValid(true); 
        } finally {
            setValidatingCrp(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const missing = [];
        if (!name.trim()) missing.push('Nome');
        if (!crp.trim()) missing.push('CRP');
        if (!termsAccepted) missing.push('Termos de Uso');

        if (missing.length > 0) {
            setError(`Os seguintes campos são obrigatórios: ${missing.join(', ')}.`);
            setLoading(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // --- NOVO: Verificação de CRP Duplicado ---
            const { data: existingProfile, error: searchError } = await supabase
                .from('profiles')
                .select('id')
                .eq('crp', crp.trim())
                .maybeSingle();

            if (existingProfile && existingProfile.id !== user.id) {
                setError('Este CRP já está vinculado a outro profissional cadastrado no sistema.');
                setLoading(false);
                return;
            }
            // ------------------------------------------

            const updates = {
                id: user.id,
                name: name.trim(),
                crp: crp.trim(),
                recovery_email: recoveryEmail.trim(),
                theoretical_approach: theoreticalApproach,
                terms_accepted: true,
                terms_accepted_at: new Date(),
                updated_at: new Date()
            };

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert(updates);

            if (updateError) throw updateError;

            // Success! Redirect to dashboard
            // Success! Redirect to dashboard
            navigate('/dashboard');

        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Erro ao salvar informações. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 flex items-center justify-center px-4 transition-colors duration-200">
            <div className="w-full max-w-xl">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
                    <div className="text-center mb-8">
                        <Logo />
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-6">
                            Bem-vindo ao TheraMind!
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 mt-2">
                            Para começar, precisamos de algumas informações para criar seu perfil profissional.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center">
                                <User size={16} className="mr-2" /> Nome completo *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Como você gostaria de ser chamado?"
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* CRP */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center">
                                <FileBadge size={16} className="mr-2" /> Seu CRP *
                            </label>
                            <input
                                type="text"
                                value={crp}
                                onChange={(e) => {
                                    setCrp(e.target.value);
                                    setIsCrpValid(null);
                                    setCrpError('');
                                }}
                                onBlur={handleCrpBlur}
                                placeholder="00/00000"
                                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCrpValid === true ? 'border-green-500' :
                                        isCrpValid === false ? 'border-red-500' :
                                            'border-slate-300 dark:border-slate-600'
                                    }`}
                                required
                            />
                            {validatingCrp && (
                                <p className="text-xs text-blue-500 mt-1 flex items-center">
                                    <span className="animate-spin mr-1">◌</span> Validando no CFP...
                                </p>
                            )}
                            {crpError && (
                                <p className="text-xs text-red-500 mt-1">{crpError}</p>
                            )}
                            {isCrpValid && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    CRP validado com sucesso!
                                </p>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Seu registro profissional será exibido nos documentos gerados. Use o padrão Região/Número (ex: 04/44606).
                            </p>
                        </div>

                        {/* Email de Recuperação */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center">
                                <Mail size={16} className="mr-2" /> E-mail de Recuperação (Opcional)
                            </label>
                            <input
                                type="email"
                                value={recoveryEmail}
                                onChange={(e) => setRecoveryEmail(e.target.value)}
                                placeholder="seu.email.secundario@exemplo.com"
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Abordagem Teórica */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center">
                                <Save size={16} className="mr-2" /> Abordagem Teórica Principal
                            </label>
                            <select
                                value={theoreticalApproach}
                                onChange={(e) => setTheoreticalApproach(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Integrativa">Integrativa / Multimodal</option>
                                <option value="TCC">TCC (Terapia Cognitivo-Comportamental)</option>
                                <option value="Psicanálise">Psicanálise</option>
                                <option value="Humanismo">Humanismo / Fenomenologia</option>
                                <option value="Analítica">Psicologia Analítica (Junguiana)</option>
                                <option value="Sistêmica">Terapia Sistêmica</option>
                            </select>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Isso ajudará a IA a personalizar as análises de acordo com sua linha de trabalho.
                            </p>
                        </div>

                        {/* Termos de Uso */}
                        <div className="space-y-4 pt-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                                Termos de Uso e Responsabilidade Ética
                            </label>
                            <div className="h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 leading-relaxed scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                                <p className="font-bold mb-2 uppercase text-slate-800 dark:text-slate-200">TERMOS DE USO E RESPONSABILIDADE ÉTICA (THERAMIND)</p>
                                <p className="mb-2">Ao utilizar a plataforma TheraMind, você, profissional de psicologia devidamente registrado(a) no Conselho Regional de Psicologia (CRP), declara estar ciente e concordar com os seguintes termos:</p>
                                <ul className="list-disc pl-4 space-y-2">
                                    <li><strong>1. Responsabilidade Clínica Única:</strong> O TheraMind é uma ferramenta de apoio e suporte ao raciocínio clínico. Toda e qualquer decisão diagnóstica, técnica ou intervenção é de responsabilidade exclusiva do profissional psicólogo(a) titular do caso.</li>
                                    <li><strong>2. Conformidade com o CFP:</strong> O uso desta ferramenta não isenta o profissional do cumprimento integral das Resoluções CFP nº 01/2009 (Registro Documental) e nº 06/2019 (Elaboração de Documentos). O psicólogo deve revisar e validar todo conteúdo gerado pela IA antes de sua oficialização.</li>
                                    <li><strong>3. Sigilo Profissional e LGPD:</strong> O profissional compromete-se a resguardar o sigilo das informações de seus pacientes, em conformidade com o Código de Ética Profissional e a Lei Geral de Proteção de Dados (LGPD).</li>
                                    <li><strong>4. Natureza da IA:</strong> Você reconhece que as sugestões da IA são baseadas em modelos probabilísticos e podem conter imprecisões, devendo ser sempre submetidas ao crivo técnico do profissional.</li>
                                    <li><strong>5. Guarda de Documentos:</strong> A responsabilidade pela guarda dos prontuários pelo prazo mínimo de 5 anos permanece sendo do profissional, conforme exigido pelo CFP.</li>
                                </ul>
                            </div>
                            <label className="flex items-start cursor-pointer group">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                                        required
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <span className="text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                                        Li e concordo com os Termos de Uso e me comprometo a seguir as normas éticas do CFP. *
                                    </span>
                                </div>
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !termsAccepted}
                            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                        >
                            <Save className="mr-2" size={18} />
                            {loading ? 'Salvando...' : 'Concluir Cadastro'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <button
                            onClick={handleLogout}
                            className="flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm transition-colors"
                        >
                            <LogOut size={14} className="mr-1" />
                            Sair
                        </button>
                        <ThemeSwitch />
                    </div>
                </div>
            </div>
        </div>
    );
}
