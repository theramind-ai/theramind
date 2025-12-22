import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, DollarSign, Clock, CheckCircle, XCircle, Plus, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixKey } from '../lib/pix';

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPixModal, setShowPixModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    // New Appointment Form
    const [formData, setFormData] = useState({
        patient_id: '',
        appointment_date: '',
        appointment_time: '',
        duration_minutes: 50,
        price: 150.00,
        notes: ''
    });

    useEffect(() => {
        fetchData();
        fetchProfile();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Appointments
            const { data: appts, error: apptError } = await supabase
                .from('appointments')
                .select(`
          *,
          patients (id, name)
        `)
                .eq('user_id', user.id)
                .order('appointment_date', { ascending: false });

            if (apptError) throw apptError;
            setAppointments(appts || []);

            // Fetch Patients for dropdown
            const { data: pats, error: patError } = await supabase
                .from('patients')
                .select('id, name')
                .eq('user_id', user.id)
                .order('name');

            if (patError) throw patError;
            setPatients(pats || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(data);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const fullDate = new Date(`${formData.appointment_date}T${formData.appointment_time}`);

            const { error } = await supabase.from('appointments').insert({
                user_id: user.id,
                patient_id: formData.patient_id,
                appointment_date: fullDate.toISOString(),
                duration_minutes: parseInt(formData.duration_minutes),
                price: parseFloat(formData.price),
                status: 'scheduled',
                payment_status: 'pending',
                notes: formData.notes
            });

            if (error) throw error;

            setShowModal(false);
            setFormData({ // Reset form
                patient_id: '', appointment_date: '', appointment_time: '',
                duration_minutes: 50, price: 150.00, notes: ''
            });
            fetchData();
        } catch (error) {
            alert('Erro ao criar agendamento: ' + error.message);
        }
    };

    const updateStatus = async (id, updates) => {
        try {
            const { error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error updating:', error);
        }
    };

    const handlePixClick = (appt) => {
        if (!userProfile?.pix_key) {
            alert('Configure sua Chave Pix em "Configurações" primeiro!');
            return;
        }
        setSelectedAppointment(appt);
        setShowPixModal(true);
    };

    const pixPayload = selectedAppointment && userProfile ? generatePixKey(
        userProfile.pix_key,
        'TheraMind User',
        'Cidade',
        selectedAppointment.price,
        selectedAppointment.id.substring(0, 10).replace(/-/g, '')
    ) : '';

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="container mx-auto p-4 max-w-6xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <Calendar className="mr-2" /> Agendamentos & Financeiro
                </h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                    <Plus size={18} className="mr-2" /> Novo Agendamento
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-200">
                            <tr>
                                <th className="p-4">Data/Hora</th>
                                <th className="p-4">Paciente</th>
                                <th className="p-4">Valor</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Pagamento</th>
                                <th className="p-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {appointments.map((appt) => (
                                <tr key={appt.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <td className="p-4 text-gray-800 dark:text-gray-300">
                                        <div className="flex items-center">
                                            <Clock size={16} className="mr-2 text-gray-400" />
                                            {new Date(appt.appointment_date).toLocaleDateString('pt-BR')} <br />
                                            {new Date(appt.appointment_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                                        {appt.patients?.name || 'Desconhecido'}
                                    </td>
                                    <td className="p-4 text-gray-800 dark:text-gray-300">
                                        R$ {appt.price?.toFixed(2)}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${appt.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                appt.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'
                                            }`}>
                                            {appt.status === 'scheduled' ? 'Agendado' :
                                                appt.status === 'completed' ? 'Realizado' : 'Cancelado'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center text-sm ${appt.payment_status === 'paid' ? 'text-green-600 font-bold' : 'text-yellow-600'
                                            }`}>
                                            {appt.payment_status === 'paid' ? (
                                                <><CheckCircle size={14} className="mr-1" /> Pago</>
                                            ) : 'Pendente'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex space-x-2">
                                            {appt.payment_status !== 'paid' && (
                                                <button
                                                    onClick={() => handlePixClick(appt)}
                                                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-full"
                                                    title="Receber via Pix"
                                                >
                                                    <QrCode size={18} />
                                                </button>
                                            )}
                                            {appt.payment_status !== 'paid' && (
                                                <button
                                                    onClick={() => updateStatus(appt.id, { payment_status: 'paid', paid_at: new Date() })}
                                                    className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                                                    title="Marcar como Pago"
                                                >
                                                    <DollarSign size={18} />
                                                </button>
                                            )}
                                            {appt.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => updateStatus(appt.id, { status: 'cancelled' })}
                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                                                    title="Cancelar"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {appointments.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        Nenhum agendamento encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL NEW APPOINTMENT */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4 dark:text-white">Novo Agendamento</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1 dark:text-gray-300">Paciente</label>
                                <select
                                    required
                                    className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                                    value={formData.patient_id}
                                    onChange={e => setFormData({ ...formData, patient_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Data</label>
                                    <input type="date" required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                                        value={formData.appointment_date} onChange={e => setFormData({ ...formData, appointment_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Hora</label>
                                    <input type="time" required className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                                        value={formData.appointment_time} onChange={e => setFormData({ ...formData, appointment_time: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Valor (R$)</label>
                                    <input type="number" step="0.01" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                                        value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 dark:text-gray-300">Duração (min)</label>
                                    <input type="number" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                                        value={formData.duration_minutes} onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Agendar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PIX */}
            {showPixModal && selectedAppointment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full text-center">
                        <h3 className="text-xl font-bold mb-2 dark:text-white">Pagamento Pix</h3>
                        <p className="text-gray-600 mb-4 dark:text-gray-300">
                            Valor: <span className="font-bold text-lg">R$ {selectedAppointment.price.toFixed(2)}</span>
                        </p>

                        <div className="flex justify-center mb-4 p-4 bg-white rounded-lg border">
                            <QRCodeSVG value={pixPayload} size={200} />
                        </div>

                        <p className="text-xs text-gray-500 mb-4 break-words font-mono bg-gray-100 p-2 rounded">
                            Copy/Paste Code (Simulado): <br />
                            {pixPayload.substring(0, 30)}...
                        </p>

                        <button
                            onClick={() => {
                                updateStatus(selectedAppointment.id, { payment_status: 'paid', paid_at: new Date() });
                                setShowPixModal(false);
                            }}
                            className="w-full mb-2 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700"
                        >
                            Confirmar Recebimento
                        </button>
                        <button onClick={() => setShowPixModal(false)} className="w-full text-gray-500 text-sm">
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
