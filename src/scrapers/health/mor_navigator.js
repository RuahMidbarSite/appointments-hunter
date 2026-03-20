const fs = require('fs');
const { updateLiveProgress } = require('./clalit'); // שימוש בפונקציית העזר הקיימת

async function navigateMor(page, config) {
    const MOR_URL = 'https://zimun.mor.org.il/machon-mor/#/main/page/login';
    console.log("--- מתחיל ניווט באתר מכון מור ---");
    updateLiveProgress("🚀 מתחבר לאתר מכון מור...");

    // שימוש בשיטה מ-clalit.js למניעת דף לבן
await page.goto(MOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// המתנה אקטיבית לשדה ת"ז - אם לא מופיע, מבצעים רענון (כמו ב-handleResponseSorry)
try {
    await page.waitForSelector('#personalId', { state: 'visible', timeout: 20000 });
} catch (e) {
    console.log("⚠️ דף מכון מור נטען ריק. מבצע טעינה מחדש...");
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#personalId', { state: 'visible', timeout: 30000 });
}

await page.fill('#personalId', config.userId);
    
    // בחירת קידומת (מניח שזה כפתור שפותח רשימה או ערך סטטי)
    if (config.morSettings?.phonePrefix) {
        await page.click('#phonePrefixNumber');
        await page.click(`text="${config.morSettings.phonePrefix}"`);
    }
    
    await page.fill('#phoneNumber', config.morSettings?.phoneSuffix || "");
    
    // אישור תנאים ולחיצה על המשך
    await page.click('#userAgreement');
    await page.click('button:has-text("המשך")');

    updateLiveProgress("📱 ממתין להזנת קוד ה-SMS על ידי המשתמש בדפדפן...");
    
    // ממתין שהמשתמש יזין קוד ושיעבור לעמוד הבא (זיהוי לפי כפתור "קבע תור")
    await page.waitForSelector('.new-app-btn', { timeout: 300000 });
    await page.click('.new-app-btn');

    // 2. בחירת ההפניה או מסלול קטגוריות
    if (config.morSettings?.useManualPath) {
        updateLiveProgress("🛠️ מנווט במסלול 'ההפניה שלי לא ברשימה'...");
        await page.waitForSelector('span:has-text("ההפניה שלי לא ברשימה")', { timeout: 15000 });
        await page.click('span:has-text("ההפניה שלי לא ברשימה")');
        
        // בחירת סוג ביטוח מהדרופדאון
        updateLiveProgress(`🏥 בוחר סוג ביטוח: ${config.morSettings.insuranceType || 'כללית'}`);
        await page.waitForSelector('.q_dropdown', { timeout: 10000 });
        await page.click('.q_dropdown'); 
        await page.waitForTimeout(500); // המתנה קצרה לפתיחת התפריט
        await page.click(`.custom-option:has-text("${config.morSettings.insuranceType || 'כללית'}")`);
        
        // בחירת קטגוריה
        updateLiveProgress(`📋 בוחר קטגוריה: ${config.morSettings.category}...`);
        await page.waitForSelector(`.flex-text:has-text("${config.morSettings.category}")`, { timeout: 10000 });
        await page.click(`.flex-text:has-text("${config.morSettings.category}")`);
        
        // לחיצה על המשך
        await page.click('button:has-text("המשך")');
        
        // --- כאן יבוא השלב של תת-התחומים שתשלח לי בהמשך ---
        
    } else {
        const targetRef = config.morSettings?.targetReferral || "מבחן מאמץ";
        updateLiveProgress(`📋 מחפש הפניה: ${targetRef}...`);
        await page.waitForSelector('.box-msg.item', { timeout: 15000 });
        await page.click(`.box-msg.item:has-text("${targetRef}")`);
        await page.click('button:has-text("המשך")');
    }

    // 3. סריקת אזורים לפי סדר עדיפויות
    const areas = config.morSettings?.areaPriority || ["מרכז", "ירושלים והסביבה", "דרום", "צפון"];
    let foundAppointment = null;

    for (const area of areas) {
        updateLiveProgress(`🔍 בודק אזור: ${area}...`);
        await page.click(`.flex-text:has-text("${area}")`);
        await page.waitForTimeout(2000);

        // בדיקה אם אין תורים
        const noApps = await page.$('text="לא נמצאו תורים פנויים"');
        if (noApps) {
            console.log(`- אין תורים באזור ${area}`);
            continue;
        }

        // חילוץ התור הראשון שמופיע (המוקדם ביותר)
        const firstAppt = await page.evaluate(() => {
            const container = document.querySelector('.flex-container.selected');
            if (!container) return null;
            const branch = container.querySelector('.flex-text')?.innerText.trim();
            const date = container.querySelector('.flex-date')?.innerText.trim();
            const time = container.querySelector('.flex-time')?.innerText.trim();
            return { branch, date, time };
        });

        if (firstAppt) {
            foundAppointment = { ...firstAppt, area };
            break; // מצאנו תור באזור בעדיפות גבוהה, עוצרים
        }
    }

    return foundAppointment;
}

module.exports = { navigateMor };