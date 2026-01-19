import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/api';
import { X, Send, MessageSquare, Loader2, RefreshCw } from 'lucide-react';

export function CopilotChat({ isOpen, onClose }) {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            loadConversations();
        }
    }, [isOpen]);

    useEffect(() => {
        if (currentConversationId) {
            loadMessages(currentConversationId);
        } else {
            setMessages([]);
        }
    }, [currentConversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async () => {
        try {
            const data = await api.copilot.listConversations();
            setConversations(data || []);
            // Opcional: selecionar a última conversa automaticamente
            // if (data && data.length > 0 && !currentConversationId) {
            //   setCurrentConversationId(data[0].id);
            // }
        } catch (error) {
            console.error('Erro ao carregar conversas:', error);
        }
    };

    const loadMessages = async (id) => {
        try {
            setIsLoading(true);
            const data = await api.copilot.getMessages(id);
            setMessages(data || []);
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.copilot.sendMessage(userMsg.content, currentConversationId);

            if (!currentConversationId && response.conversation_id) {
                setCurrentConversationId(response.conversation_id);
                loadConversations(); // Recarrega lista para mostrar nova conversa
            }

            setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar sua solicitação.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const startNewChat = () => {
        setCurrentConversationId(null);
        setMessages([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-gray-200 dark:border-slate-700">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center space-x-2">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white">Copiloto Clínico</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Apoio ao raciocínio e conduta clínica</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={startNewChat}
                        className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                        title="Nova Conversa"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* Sidebar (History) - Visible on larger screens or togglable? Keeping simple for now: maybe just a dropdown or separate view? 
            For now, let's keep it simple: Just the chat area. 
        */}

                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-slate-900">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                <MessageSquare className="h-16 w-16 text-indigo-300 dark:text-indigo-700 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Como posso apoiar seu raciocínio clínico?</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                    Tire dúvidas sobre casos, peça auxílio em diagnósticos diferenciais ou organize suas condutas terapêuticas.
                                </p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-slate-700'
                                        }`}>
                                        {msg.role === 'user' ? (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }) {
                                                            return !inline ? (
                                                                <div className="bg-slate-900 text-gray-100 rounded-md p-3 my-2 overflow-x-auto text-xs">
                                                                    <code {...props}>{children}</code>
                                                                </div>
                                                            ) : (
                                                                <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-xs" {...props}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        },
                                                        table({ children }) {
                                                            return <div className="overflow-x-auto my-4 border border-gray-200 dark:border-slate-700 rounded-lg"><table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">{children}</table></div>
                                                        },
                                                        th({ children }) {
                                                            return <th className="px-3 py-2 bg-gray-50 dark:bg-slate-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{children}</th>
                                                        },
                                                        td({ children }) {
                                                            return <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-slate-700">{children}</td>
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center space-x-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Digitando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-700">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Digite sua pergunta..."
                                className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-slate-900 border-none rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-2">
                            IA pode cometer erros. Verifique informações importantes.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
