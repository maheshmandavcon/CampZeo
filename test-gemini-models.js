
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        // Note: The SDK doesn't expose a direct listModels method on the client instance easily in all versions, 
        // but usually it's on the GoogleGenerativeAI instance or we can try a simple generation to test.
        // Actually, looking at documentation, we might not be able to list models easily with just the SDK wrapper 
        // without a specific method. 
        // Let's try to just run a generation with 'gemini-pro' and 'gemini-1.5-flash' and see which one works 
        // or verify the error details.

        // However, for this script, let's try to log the API key presence (masked) and assume we need to find the right string.
        console.log("API Key present:", !!process.env.GEMINI_API_KEY);

        // Let's try 'gemini-pro'
        console.log("Testing gemini-pro...");
        try {
            const p = genAI.getGenerativeModel({ model: "gemini-pro" });
            await p.generateContent("Test");
            console.log("SUCCESS: gemini-pro");
        } catch (e) {
            console.log("FAILED: gemini-pro", e.message);
        }

        // Let's try 'gemini-1.5-flash-001'
        console.log("Testing gemini-1.5-flash-001...");
        try {
            const f001 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
            await f001.generateContent("Test");
            console.log("SUCCESS: gemini-1.5-flash-001");
        } catch (e) {
            console.log("FAILED: gemini-1.5-flash-001", e.message);
        }

        // Let's try 'gemini-2.5-flash'
        console.log("Testing gemini-2.5-flash...");
        try {
            const f25 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            await f25.generateContent("Test");
            console.log("SUCCESS: gemini-2.5-flash");
        } catch (e) {
            console.log("FAILED: gemini-2.5-flash", e.message);
        }

        // Let's try 'gemini-1.5-pro'
        console.log("Testing gemini-1.5-pro...");
        try {
            const p15 = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            await p15.generateContent("Test");
            console.log("SUCCESS: gemini-1.5-pro");
        } catch (e) {
            console.log("FAILED: gemini-1.5-pro", e.message);
        }

        // Let's try 'gemini-1.5-flash'
        console.log("Testing gemini-1.5-flash...");
        try {
            const f = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await f.generateContent("Test");
            console.log("SUCCESS: gemini-1.5-flash");
        } catch (e) {
            console.log("FAILED: gemini-1.5-flash", e.message);
        }

        // Let's try 'gemini-1.5-flash-latest'
        console.log("Testing gemini-1.5-flash-latest...");
        try {
            const fl = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            await fl.generateContent("Test");
            console.log("SUCCESS: gemini-1.5-flash-latest");
        } catch (e) {
            console.log("FAILED: gemini-1.5-flash-latest", e.message);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
