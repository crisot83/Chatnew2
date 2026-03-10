import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Bot, User, AlertCircle, Database, MessageSquare, BarChart2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { fetchSheetData } from './services/dataService';
import { createChatSession, sendMessage } from './services/geminiService';
import { Chat } from '@google/genai';
import AnalisisChat from './components/AnalisisChat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'performance' | 'analisis'>('performance');
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeData = async (manual = false) => {
    try {
      if (manual) setIsLoading(true);
      else setIsInitializing(true);
      setError(null);

      const csvData = await fetchSheetData();
      const chat = await createChatSession(csvData);
      chatSessionRef.current = chat;
      
      setLastUpdated(new Date());
      
      if (!manual && messages.length === 0) {
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: '¡Hola! Soy tu asistente de datos. He cargado la información más reciente de las tiendas, KPIs y presupuestos. ¿En qué te puedo ayudar hoy? Puedes preguntarme sobre comparativas entre tiendas, regiones o sociedades.'
        }]);
      } else if (manual) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '✅ Base de datos actualizada correctamente con la información más reciente.'
        }]);
      }
    } catch (err) {
      setError('Error al cargar los datos. Por favor, inténtalo de nuevo.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  // Initial load
  useEffect(() => {
    initializeData();

    // Auto-refresh every 48 hours (48 * 60 * 60 * 1000 ms)
    const interval = setInterval(() => {
      initializeData();
    }, 48 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !chatSessionRef.current) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await sendMessage(chatSessionRef.current, userMessage);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: 'Lo siento, ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 pt-4 flex flex-col gap-4 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">PerformanceRSE</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                {lastUpdated ? (
                  <>Actualizado: {lastUpdated.toLocaleString()}</>
                ) : (
                  'Cargando datos...'
                )}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => initializeData(true)}
            disabled={isLoading || isInitializing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading && !isInitializing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar Datos</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mt-2">
          <button
            onClick={() => setActiveTab('performance')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'performance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Performance RSE
          </button>
          <button
            onClick={() => setActiveTab('analisis')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'analisis'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Análisis
          </button>
        </div>
      </header>

      {activeTab === 'performance' ? (
        <>
          {/* Main Chat Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {isInitializing ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-slate-500 animate-pulse">Cargando base de datos y preparando asistente...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                  <h3 className="text-lg font-medium text-red-800">Error de conexión</h3>
                  <p className="text-red-600">{error}</p>
                  <button 
                    onClick={() => initializeData(true)}
                    className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-800 text-white'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    
                    <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="markdown-body prose prose-slate prose-sm max-w-none">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && !isInitializing && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input Area */}
          <footer className="bg-white border-t border-slate-200 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto relative">
              <form onSubmit={handleSend} className="relative flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregunta sobre tiendas, KPIs, comparativas..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[56px] max-h-32 shadow-sm"
                  rows={1}
                  disabled={isLoading || isInitializing || !!error}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || isInitializing || !!error}
                  className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
              <p className="text-center text-xs text-slate-400 mt-3">
                El asistente utiliza IA y los datos más recientes de la hoja de cálculo. Puede cometer errores.
              </p>
            </div>
          </footer>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <AnalisisChat />
        </div>
      )}
    </div>
  );
}
