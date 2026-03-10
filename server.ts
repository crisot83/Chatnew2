import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import https from 'https';
import { parse } from 'csv-parse';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const db = new Database(':memory:');

// Initialize DB
db.exec(`
  CREATE TABLE analisis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seccion TEXT,
    subseccion TEXT,
    tipo TEXT,
    referencia TEXT,
    tipo_2 TEXT,
    descripcion_referencia TEXT,
    gama TEXT,
    proveedor TEXT,
    cifra_venta REAL,
    ranking_cifra_venta INTEGER,
    prog_cv REAL,
    udes_vendidas REAL,
    ranking_unidades INTEGER,
    prog_unidades REAL,
    margen_eur REAL,
    ranking_mg INTEGER,
    prog_mg REAL,
    margen_pct REAL,
    num_tiendas INTEGER
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO analisis (
    seccion, subseccion, tipo, referencia, tipo_2, descripcion_referencia, gama, proveedor,
    cifra_venta, ranking_cifra_venta, prog_cv, udes_vendidas, ranking_unidades, prog_unidades,
    margen_eur, ranking_mg, prog_mg, margen_pct, num_tiendas
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function parseNumber(val: string): number {
  if (!val) return 0;
  let cleaned = val.replace(/[€%]/g, '').trim();
  cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function loadData() {
  console.log('Downloading CSV data...');
  const url = 'https://docs.google.com/spreadsheets/d/1-3u_uuEcPW98KvqKQ_ivdW0qG9FA3YMoF-Cl2zfuZI0/gviz/tq?tqx=out:csv&sheet=analisisseccionRamon';
  
  return new Promise<void>((resolve, reject) => {
    https.get(url, (res) => {
      const parser = parse({
        columns: false,
        skip_empty_lines: true,
        from_line: 2 // skip header
      });

      let count = 0;
      db.exec('BEGIN TRANSACTION');

      parser.on('readable', function() {
        let record;
        while ((record = parser.read()) !== null) {
          try {
            insertStmt.run(
              record[0], record[1], record[2], record[3], record[4], record[5], record[6], record[7],
              parseNumber(record[8]), parseInt(record[9]) || 0, parseNumber(record[10]),
              parseNumber(record[11]), parseInt(record[12]) || 0, parseNumber(record[13]),
              parseNumber(record[14]), parseInt(record[15]) || 0, parseNumber(record[16]),
              parseNumber(record[17]), parseInt(record[18]) || 0
            );
            count++;
          } catch (e) {
            console.error('Error inserting row:', e);
          }
        }
      });

      parser.on('error', function(err) {
        db.exec('ROLLBACK');
        console.error('CSV Parsing Error:', err.message);
        reject(err);
      });

      parser.on('end', function() {
        db.exec('COMMIT');
        console.log(`Successfully loaded ${count} rows into SQLite.`);
        resolve();
      });

      res.pipe(parser);
    }).on('error', (err) => {
      console.error('Download Error:', err.message);
      reject(err);
    });
  });
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

app.get('/api/env', (req, res) => {
  res.json({ hasKey: !!process.env.GEMINI_API_KEY, keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) : null });
});

app.post('/api/sql', (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed.' });
    }
    
    console.log('Executing SQL:', query);
    const stmt = db.prepare(query);
    const result = stmt.all();
    res.json({ result });
  } catch (error: any) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analisis', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'Eres un analista de datos experto en retail. Tienes acceso a una base de datos SQLite con información detallada a nivel de sección, subsección y tipo. Tu objetivo es hacer comparativas de análisis, comportamiento de mercado basados en margen, ventas (cifra_venta), unidades, y recomendar en qué merece la pena apostar. Usa la herramienta queryDatabase para consultar los datos. Siempre responde en español y usa formato Markdown. IMPORTANTE: Haz que los resultados sean muy visuales. Usa tablas Markdown siempre que sea posible. Añade indicadores visuales (emojis como 🟢, 🔴, 🟡, 📈, 📉, 🏆, ⚠️) para resaltar valores positivos, negativos o advertencias. Formatea los números de forma legible (ej. 1.234,56 € o 12,3%).',
        tools: [{ functionDeclarations: [queryDatabaseFunction] }],
        temperature: 0.2,
      },
      history: history || []
    });

    let response = await chat.sendMessage({ message });

    let maxCalls = 5;
    while (response.functionCalls && response.functionCalls.length > 0 && maxCalls > 0) {
      maxCalls--;
      const call = response.functionCalls[0];
      
      if (call.name === 'queryDatabase') {
        const query = (call.args as any).query;
        let result;
        try {
          const stmt = db.prepare(query);
          result = stmt.all();
        } catch (e: any) {
          result = { error: e.message };
        }
        
        response = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: call.name,
              response: { result }
            }
          }] as any
        });
      }
    }

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  await loadData();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
