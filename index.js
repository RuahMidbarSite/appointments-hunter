const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const mongoose = require('mongoose'); // הוספת ייבוא Mongoose
const { runClalit } = require('./src/scrapers/health/clalit');
const { navigateMor } = require('./src/scrapers/health/mor_navigator');

// הפעלת מצב הסוואה
chromium.use(stealth);

// טעינת משתני סביבה (חובה עבור ה-URI של מסד הנתונים)
require('dotenv').config();

async function main() {
    console.log("--- מפעיל הגנות Stealth ומתחיל הרצה ---");
    
    const browser = await chromium.launch({ 
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
            '--disable-search-engine-choice-screen',
            '--disable-features=PrivacySandboxSettings4',
            '--ignore-certificate-errors'
        ]
    });

    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        // 1. קריאת ההגדרות
        const configPath = path.join(process.cwd(), 'config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        // 2. הפעלה דרך המנוע המרכזי (תומך בלולאה וטיימר לשני המסלולים)
        console.log("🚀 מפעיל מנוע סריקה מרכזי...");
        await runClalit(page);
        
        console.log("-----------------------------------------");
        console.log("✅ הסריקה הסתיימה. הדפדפן יישאר פתוח כעת.");
        await new Promise(() => {}); 
    } catch (error) {
        console.error("שגיאה קריטית:", error);
    }
}

main();