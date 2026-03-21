const fs = require('fs');

function updateLiveProgress(msg, seconds = null) {
    try {
        const configPath = './config.json';
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            cfg.liveProgress = msg;
            cfg.scanTimeRemaining = seconds;
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
        }
    } catch (e) {}
}

async function navigateMor(page, config) {
    const MOR_URL = 'https://zimun.mor.org.il/machon-mor/#/main/page/login';
    console.log("--- מתחיל ניווט באתר מכון מור ---");
    updateLiveProgress("🚀 מתחבר לאתר מכון מור...");

    try {
        await page.goto(MOR_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('#personalId', { state: 'visible', timeout: 30000 });
        console.log("✅ דף הלוגין נטען.");
    } catch (err) {
        console.error("❌ שגיאה בטעינה:", err.message);
        return null;
    }

    // 1. הזנת תעודת זהות
    const idNum = String(config.userId || "");
    console.log(`[DEBUG] מזין ת"ז: ${idNum}`);
    await page.fill('#personalId', idNum);
    await page.keyboard.press('Tab');

    // 2. בחירת קידומת - גרסה אגרסיבית
    // אנחנו בודקים גם ב-config וגם ב-morSettings ליתר ביטחון
    const prefix = config.morSettings?.phonePrefix || config.phonePrefix || "052";
    console.log(`[DEBUG] מנסה לבחור קידומת: ${prefix}`);
    
    try {
        await page.click('#phonePrefixNumber', { force: true });
        await page.waitForTimeout(1000);
        // מחפשים את הקידומת בכל מקום שבו היא מופיעה כתפריט
        await page.click(`.custom-option:has-text("${prefix}")`, { timeout: 3000 });
        console.log(`✅ קידומת ${prefix} נבחרה.`);
    } catch (e) {
        console.log(`⚠️ בחירה ויזואלית נכשלה, מנסה הזרקה ישירה...`);
        await page.evaluate((pfx) => {
            const input = document.querySelector('#phonePrefixNumber');
            if (input) { 
                input.value = pfx;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, prefix);
    }

    // 3. הזנת מספר טלפון
    const phoneSuffix = String(config.morSettings?.phoneSuffix || config.phoneSuffix || "");
    console.log(`[DEBUG] מזין טלפון: ${phoneSuffix}`);
    await page.fill('#phoneNumber', phoneSuffix);
    await page.keyboard.press('Tab');

    // 4. סימון הצ'קבוקס (חובה!)
    console.log("[DEBUG] מסמן הסכמה לתנאים...");
    try {
        // מנסה ללחוץ על הלייבל או על הריבוע עצמו
        await page.click('.checkbox-label', { timeout: 2000 }).catch(() => page.click('#userAgreement', { force: true }));
    } catch (e) {
        // מוודא סימון דרך הקוד אם הלחיצה נכשלה
        await page.evaluate(() => {
            const cb = document.querySelector('input[type="checkbox"]');
            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
        });
    }

    // 5. לחיצה על המשך
    console.log("[DEBUG] לוחץ על כפתור המשך...");
    await page.waitForTimeout(1000);
    await page.click('button:has-text("המשך")', { force: true });

    updateLiveProgress("📱 ממתין להזנת קוד ה-SMS...");
    console.log("[DEBUG] עוקב אחרי הזנת קוד ה-SMS בדפדפן...");

    try {
        // ממתין שהמשתמש יקיש קוד (לפחות 6 ספרות) או שהכפתור יהיה זמין ללחיצה
        await page.waitForFunction(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('המשך'));
            const input = document.querySelector('input[type="tel"], input[name="smsCode"]');
            // תנאי ללחיצה: הכפתור לא כבוי (Enabled) או שהוקלדו 6 ספרות
            return (btn && !btn.disabled) || (input && input.value.length >= 6);
        }, { timeout: 300000 }); // מחכה עד 5 דקות להזנה שלך

        console.log("[DEBUG] הקוד זוהה או שהכפתור נדלק, לוחץ על המשך...");
        await page.click('button:has-text("המשך")', { force: true });
        
        // עכשיו ממתינים שהדף יתחלף ויופיע הכפתור "זימון תור חדש"
        await page.waitForSelector('.new-app-btn', { timeout: 30000 });
        await page.click('.new-app-btn');
        console.log("✅ עברנו את מסך ה-SMS ופתחנו זימון תור חדש.");

    } catch (e) {
        console.log("⚠️ חלף זמן ההמתנה או שהכפתור לא הופיע. ייתכן שצריך ללחוץ ידנית.");
    }

    // --- סריקת תורים ---
    const targetRef = config.morSettings?.targetReferral || "מבחן מאמץ";
    await page.waitForSelector('.box-msg.item', { timeout: 15000 });
    await page.click(`.box-msg.item:has-text("${targetRef}")`);
    await page.click('button:has-text("המשך")');

    const areas = config.morSettings?.areaPriority || ["מרכז", "ירושלים והסביבה"];
    for (const area of areas) {
        updateLiveProgress(`🔍 בודק אזור: ${area}`);
        await page.click(`.flex-text:has-text("${area}")`);
        await page.waitForTimeout(2000);

        const noApps = await page.$('text="לא נמצאו תורים פנויים"');
        if (noApps) continue;

        const result = await page.evaluate(() => {
            const container = document.querySelector('.flex-container.selected');
            if (!container) return null;
            return {
                branch: container.querySelector('.flex-text')?.innerText.trim(),
                date: container.querySelector('.flex-date')?.innerText.trim(),
                time: container.querySelector('.flex-time')?.innerText.trim()
            };
        });
        if (result) return { ...result, area };
    }

    return null;
}

module.exports = { navigateMor };