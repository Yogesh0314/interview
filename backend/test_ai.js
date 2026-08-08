import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'say hi in json format like {"msg": "hi"}',
            config: {
                responseMimeType: "application/json",
            }
        });
        console.log(response.text);
    } catch (e) {
        console.error("AI Error:", e);
    }
}
test();
