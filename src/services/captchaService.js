require('dotenv').config();
const fs = require('fs');

async function solveCaptcha(imagePath) {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    // השם המדויק מהמסך שלך ב-Google AI Studio
    const model = "gemini-3-flash-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const imageData = fs.readFileSync(imagePath).toString('base64');

        const payload = {
            contents: [{
                parts: [
                    { text: "Identify the 5 characters in this captcha image. Output ONLY the characters, no spaces, no explanation." },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData
                        }
                    }
                ]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.candidates || !data.candidates[0]) {
            throw new Error("No response from AI candidates");
        }

        const text = data.candidates[0].content.parts[0].text.trim().toUpperCase();
        console.log(`🤖 AI Result: ${text}`);
        return text;

    } catch (error) {
        console.error("❌ שגיאה בחיבור ל-AI:", error.message);
        return null;
    }
}

module.exports = { solveCaptcha };