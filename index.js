const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { runClalit } = require('./src/scrapers/health/clalit');

// הפעלת מצב הסוואה
chromium.use(stealth);

async function main() {
    console.log("--- מפעיל הגנות Stealth ומתחיל הרצה ---");
    
    const browser = await chromium.launch({ 
        headless: false, // חייב להישאר false עבור SMS וקפצ'ה
        args: [
            '--disable-blink-features=AutomationControlled', // מסתיר את עובדת היותו בוט
            '--start-maximized'
            ,'--disable-search-engine-choice-screen',
            '--disable-features=PrivacySandboxSettings4'
            ,'--ignore-certificate-errors'
        ]
    });

  const context = await browser.newContext({
        viewport: null, // מאפשר לדפדפן להשתמש בכל שטח המסך המקסימלי
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        
    });

    const page = await context.newPage();

    try {
        await runClalit(page);
        console.log("-----------------------------------------");
        console.log("✅ הסריקה הסתיימה. הדפדפן יישאר פתוח כעת.");
        
        // מונע מהתהליך להסתיים ומלסגור את הדפדפן
        await new Promise(() => {}); 
    } catch (error) {
        console.error("שגיאה קריטית:", error);
    }
}

main();