import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { Logo } from '../components/Logo';

export default function VerifyEmailPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 flex items-center justify-center px-4 transition-colors duration-200">
            <div className="w-full max-w-md">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Mail className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Verifique seu e-mail</h1>
                    
                    <p className="text-slate-600 dark:text-slate-300 mb-8">
                        Enviamos um link de confirmação para o seu endereço de e-mail. Por favor, verifique sua caixa de entrada (e a pasta de spam) para ativar sua conta.
                    </p>

                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-3 px-4 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                    >
                        Voltar para o Login
                    </button>

                    <div className="mt-6">
                         <Logo />
                    </div>

                    <div className="mt-4 flex justify-center">
                        <ThemeSwitch />
                    </div>
                </div>
            </div>
        </div>
    );
}
