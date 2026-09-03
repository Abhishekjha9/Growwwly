const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash"
];

async function test() {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const schema = {
    type: "OBJECT",
    properties: {
      analysis: { type: "STRING" },
      score: { type: "INTEGER" }
    }
  };

  for (const model of MODELS) {
    console.log(`Testing ${model}...`);
    try {
      const response = await client.models.generateContent({
        model: model,
        contents: "Analyze this SaaS: Growwwly. It does growth analytics.",
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      console.log(`✅ ${model} success:`, response.text);
      return; // Stop if we find a working one
    } catch (err) {
      console.error(`❌ ${model} failed:`, err.message || err);
    }
  }
}

test();
