require('dotenv').config();
const fs = require('fs');

/**
 * פונקציה לפענוח קפצ'ה עם מנגנון ניסיונות חוזרים במקרה של עומס שרת
 * @param {string} imagePath - נתיב לתמונת הקפצ'ה שנשמרה
 * @param {number} retries - מספר ניסיונות מקסימלי (ברירת מחדל: 3)
 */
async function solveCaptcha(imagePath, retries = 3) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const model = "gemini-3-flash-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let i = 0; i < retries; i++) {
        try {
            const imageData = fs.readFileSync(imagePath).toString('base64');
            const payload = {
                contents: [{
                    parts: [
                        { text: "Identify the 5 characters in this captcha image. Output ONLY the characters, no spaces, no explanation." },
                        { inline_data: { mime_type: "image/png", data: imageData } }
                    ]
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // זיהוי שגיאת עומס (High Demand / 503)
            if (data.error && (data.error.message.includes("high demand") || data.error.code === 503)) {
                console.warn(`⚠️ השרת עמוס (ניסיון ${i + 1}/${retries}). מחכה 4 שניות לניסיון חוזר...`);
                await new Promise(resolve => setTimeout(resolve, 4000)); 
                continue; // חוזר לתחילת הלולאה לניסיון נוסף
            }

            // טיפול בשגיאות אחרות
            if (data.error) throw new Error(data.error.message);

            if (!data.candidates || !data.candidates[0]) {
                throw new Error("No response from AI candidates");
            }

            const text = data.candidates[0].content.parts[0].text.trim().toUpperCase();
            console.log(`🤖 AI Result: ${text}`);
            return text;

        } catch (error) {
            if (i === retries - 1) {
                console.error("❌ שגיאה סופית בחיבור ל-AI אחרי כל הניסיונות:", error.message);
                return null;
            }
            console.log(`🔄 ניסיון ${i + 1} נכשל, מנסה שוב בעוד 2 שניות...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

module.exports = { solveCaptcha };