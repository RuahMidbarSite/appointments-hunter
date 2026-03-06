require('dotenv').config(); 
const { solveCaptcha } = require('./src/services/captchaService');

async function runTest() {
    console.log("------------------------------------------");
    console.log("🧪 מתחיל ניסוי זיהוי קפצ'ה עם Gemini");
    console.log("------------------------------------------");

    // שמות הקבצים כפי שהם מופיעים בצילום המסך שלך
    const testFiles = ['1.png', '2.png', '3.png'];

    for (const file of testFiles) {
        try {
            console.log(`🔎 בודק את הקובץ: ${file}...`);
            const result = await solveCaptcha(`./${file}`);
            
            if (result) {
                console.log(`✅ תוצאה עבור ${file}: ${result}`);
            } else {
                console.log(`⚠️ לא התקבלה תשובה עבור ${file}`);
            }
        } catch (error) {
            console.error(`❌ שגיאה בבדיקת ${file}:`, error.message);
        }
        console.log("------------------------------------------");
    }
}

if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ שגיאה: לא נמצא GOOGLE_API_KEY בקובץ .env");
} else {
    runTest();
}