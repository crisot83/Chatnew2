import 'dotenv/config';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const testFunction: FunctionDeclaration = {
  name: 'getWeather',
  description: 'Get weather for a location',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING }
    },
    required: ['location']
  }
};

async function test() {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        tools: [{ functionDeclarations: [testFunction] }]
      }
    });

    console.log('Sending message...');
    let response = await chat.sendMessage({ message: 'What is the weather in Paris?' });
    
    console.log('Function calls:', response.functionCalls);
    
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      console.log('Sending function response...');
      
      // Try different formats
      try {
        response = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: call.name,
              response: { temperature: 22 },
              id: call.id
            }
          }] as any
        });
        console.log('Response 1:', response.text);
      } catch (e: any) {
        console.error('Error 1:', e.message);
      }
    }
  } catch (e: any) {
    console.error('Fatal error:', e.message);
  }
}

test();
