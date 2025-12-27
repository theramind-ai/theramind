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
    const [recoveryEmail, setRecoveryEmail] = useState('');

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!name.trim() || !crp.trim()) {
            setError('Por favor, preencha o Nome e o CRP.');
            setLoading(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const updates = {
                id: user.id,
                name: name.trim(),
                crp: crp.trim(),
                recovery_email: recoveryEmail.trim(),
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
                                onChange={(e) => setCrp(e.target.value)}
                                placeholder="00/00000"
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Seu registro profissional será exibido nos documentos gerados.
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
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Útil caso você perca acesso ao seu e-mail principal.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
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
