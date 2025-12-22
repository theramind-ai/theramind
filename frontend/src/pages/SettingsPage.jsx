import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Save, User, CreditCard } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const [profile, setProfile] = useState({
        pix_key: '',
        pix_key_type: 'CPF' // DEFAULT
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                throw error;
            }

            if (data) {
                setProfile({
                    pix_key: data.pix_key || '',
                    pix_key_type: data.pix_key_type || 'CPF'
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const updates = {
                id: user.id,
                pix_key: profile.pix_key,
                pix_key_type: profile.pix_key_type,
                updated_at: new Date()
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;

    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
                <User className="mr-2" /> Configurações
            </h1>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center">
                    <CreditCard className="mr-2" size={20} />
                    Dados Financeiros (Pix)
                </h2>

                {message && (
                    <div className={`p-3 mb-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tipo de Chave Pix
                        </label>
                        <select
                            value={profile.pix_key_type}
                            onChange={(e) => setProfile({ ...profile, pix_key_type: e.target.value })}
                            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                            <option value="EMAIL">E-mail</option>
                            <option value="PHONE">Telefone</option>
                            <option value="RANDOM">Chave Aleatória</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Chave Pix
                        </label>
                        <input
                            type="text"
                            value={profile.pix_key}
                            onChange={(e) => setProfile({ ...profile, pix_key: e.target.value })}
                            placeholder="Digite sua chave Pix..."
                            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Essa chave será usada para gerar QR Codes para pagamento dos pacientes.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Save className="mr-2" size={18} />
                        {saving ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                </form>
            </div>
        </div>
    );
}
