import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BarChart2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const queryDatabaseFunction: FunctionDeclaration = {
  name: 'queryDatabase',
  description: 'Ejecuta una consulta SQL SELECT en la base de datos SQLite para obtener estadísticas y datos. La tabla se llama "analisis". Columnas: seccion, subseccion, tipo, referencia, tipo_2, descripcion_referencia, gama, proveedor, cifra_venta (REAL), ranking_cifra_venta (INT), prog_cv (REAL), udes_vendidas (REAL), ranking_unidades (INT), prog_unidades (REAL), margen_eur (REAL), ranking_mg (INT), prog_mg (REAL), margen_pct (REAL), num_tiendas (INT).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'La consulta SQL SELECT a ejecutar. Debe ser segura y solo de lectura (SELECT). Limita los resultados a un máximo de 50 filas si es posible.',
      },
    },
    required: ['query'],
  },
};

export default function AnalisisChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de Análisis. Tengo acceso a la base de datos completa de secciones, subsecciones y tipos. Puedes pedirme estadísticas, comparativas de mercado basadas en margen, ventas (cifra de venta), unidades, y recomendaciones sobre en qué merece la pena apostar.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    chatRef.current = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'Eres un analista de datos experto en retail. Tienes acceso a una base de datos SQLite con información detallada a nivel de sección, subsección y tipo. Tu objetivo es hacer comparativas de análisis, comportamiento de mercado basados en margen, ventas (cifra_venta), unidades, y recomendar en qué merece la pena apostar. Usa la herramienta queryDatabase para consultar los datos. Siempre responde en español y usa formato Markdown. IMPORTANTE: Haz que los resultados sean muy visuales. Usa tablas Markdown siempre que sea posible. Añade indicadores visuales (emojis como 🟢, 🔴, 🟡, 📈, 📉, 🏆, ⚠️) para resaltar valores positivos, negativos o advertencias. Formatea los números de forma legible (ej. 1.234,56 € o 12,3%).',
        tools: [{ functionDeclarations: [queryDatabaseFunction] }],
        temperature: 0.2,
      }
    });
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      let response = await chatRef.current.sendMessage({ message: userMessage });

      let maxCalls = 5;
      while (response.functionCalls && response.functionCalls.length > 0 && maxCalls > 0) {
        maxCalls--;
        const call = response.functionCalls[0];
        
        if (call.name === 'queryDatabase') {
          const query = (call.args as any).query;
          
          const sqlRes = await fetch('/api/sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
          });
          
          const sqlData = await sqlRes.json();
          const result = sqlData.error ? { error: sqlData.error } : sqlData.result;
          
          response = await chatRef.current.sendMessage({
            message: [{
              functionResponse: {
                name: call.name,
                response: { result }
              }
            }] as any
          });
        }
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: response.text || '' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: 'Lo siento, ha ocurrido un error al procesar tu solicitud de análisis. Por favor, inténtalo de nuevo.' 
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
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-800 text-white'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
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
                    <Markdown
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="not-prose overflow-x-auto my-6 rounded-xl border border-slate-200 shadow-sm">
                            <table className="w-full text-sm text-left border-collapse" {...props} />
                          </div>
                        ),
                        thead: ({ node, ...props }) => (
                          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th className="px-4 py-3 whitespace-nowrap" {...props} />
                        ),
                        td: ({ node, children, ...props }) => {
                          let isNegative = false;
                          let isPositive = false;
                          
                          if (typeof children === 'string') {
                            const content = children;
                            isNegative = content.includes('-') && (content.includes('%') || content.includes('€'));
                            isPositive = !content.includes('-') && !['0', '0%', '0€', '0,00%', '0,00 €'].includes(content.trim()) && (content.includes('%') || content.includes('€'));
                          }
                          
                          return (
                            <td className={`px-4 py-3 border-b border-slate-100 last:border-0 ${
                              isNegative ? 'text-red-600 font-medium' : isPositive ? 'text-emerald-600 font-medium' : 'text-slate-700'
                            }`} {...props}>
                              {children}
                            </td>
                          );
                        },
                        h3: ({ node, ...props }) => (
                          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3 flex items-center gap-2" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong className="font-semibold text-slate-900" {...props} />
                        ),
                        code: ({ node, className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return isInline ? (
                            <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center">
                <BarChart2 className="w-5 h-5" />
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

      <footer className="bg-white border-t border-slate-200 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSend} className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pide estadísticas, comparativas o recomendaciones de mercado..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[56px] max-h-32 shadow-sm"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-3">
            El asistente analiza la base de datos de secciones. Puede tardar unos segundos en procesar consultas complejas.
          </p>
        </div>
      </footer>
    </div>
  );
}
