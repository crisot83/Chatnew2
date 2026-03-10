import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function createChatSession(csvData: string): Promise<Chat> {
  const systemInstruction = `
You are an AI assistant for a retail company. You have access to the latest KPI data from various stores, regions, and societies.
The data is provided below in CSV format.
Column A is the Store (TIENDA), Column B is the KPI, and the remaining columns contain the actual data (BUDGET, ACTUAL, DIFERENCIA CON EL BUDGET, RANKING SOCIEDAD).
You can answer questions about this data, compare stores, regions, or societies, and provide insights.
Always base your answers on the provided data. If the data is not available, say so.
IMPORTANT: If the 'RANKING SOCIEDAD' data is empty, missing, or not available for a specific KPI, DO NOT mention it. Do not add any notes saying that the ranking data is not available. Just omit it entirely from your response.
Format your answers clearly using Markdown, tables, or bullet points when appropriate.

Here is the current data:
\`\`\`csv
${csvData}
\`\`\`
`;

  return ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.2,
    },
  });
}

export async function sendMessage(chat: Chat, message: string): Promise<string> {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
  }
}
