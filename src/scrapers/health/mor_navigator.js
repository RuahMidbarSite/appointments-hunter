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
        const timeoutMs = 300000; // 5 דקות להמתנה
        const startTime = Date.now();
        let loginSuccess = false;

        while (Date.now() - startTime < timeoutMs) {
            // 1. בדיקה אם כבר עברנו שלב (הכפתור של הדף הבא הופיע)
            const isPassed = await page.$('.new-app-btn').catch(() => null);
            if (isPassed) {
                loginSuccess = true;
                break;
            }

            // 2. חיפוש קוד אוטומטי מקובץ ה-config
            try {
                if (fs.existsSync('./config.json')) {
                    const currentCfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                    const isFreshFile = currentCfg.otpReceivedAt && (Date.now() - currentCfg.otpReceivedAt < 300000);
                    
                    // במכון מור הקוד מורכב מ-6 ספרות
                    if (isFreshFile && currentCfg.lastOtp && currentCfg.lastOtp.length >= 6) {
                        
                        // מוודאים שהמשבצת הראשונה של הקוד (tab0) נטענה
                        const firstInputEl = await page.$('#tab0');
                        if (firstInputEl && await firstInputEl.isVisible()) {
                            console.log(`🤖 [AUTO-LOGIN] מזין קוד אוטומטי למכון מור: ${currentCfg.lastOtp}`);
                            
                            // פירוק הקוד ל-6 ספרות והזנה לכל תיבה בנפרד (tab0 עד tab5)
                            const otpChars = currentCfg.lastOtp.split('');
                            for (let i = 0; i < 6; i++) {
                                if (otpChars[i]) {
                                    const currentInput = `#tab${i}`;
                                    await page.click(currentInput, { clickCount: 3 }).catch(() => {});
                                    await page.keyboard.press('Backspace');
                                    await page.type(currentInput, otpChars[i], { delay: 100 });
                                }
                            }
                            
                            await page.waitForTimeout(1000);
                            
                            // לחיצה על "המשך" (שלפעמים נדלק אוטומטית, אז אנחנו דוחפים לחיצה)
                            await page.click('button:has-text("המשך")', { force: true }).catch(() => page.keyboard.press('Enter'));
                            
                            // מחיקת הקוד מהקובץ למניעת הזנה כפולה
                            currentCfg.lastOtp = "";
                            fs.writeFileSync('./config.json', JSON.stringify(currentCfg, null, 2));
                        }
                    }
                }
            } catch (e) {}

            // 3. גיבוי - בדיקה אם הקוד הוזן ידנית והכפתור "המשך" הפך לפעיל
            try {
                const btnReady = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('המשך'));
                    return btn && !btn.disabled;
                });
                
                if (btnReady) {
                    await page.click('button:has-text("המשך")', { force: true }).catch(() => {});
                }
            } catch (err) {}

            await new Promise(r => setTimeout(r, 3000));
        }

        // מוודאים שטעינת הדף הבא הסתיימה
        if (!loginSuccess) {
            await page.waitForSelector('.new-app-btn', { timeout: 15000 });
        }

        // מעבר לחיפוש בפועל על ידי לחיצה על "זימון תור חדש"
        const newAppBtn = await page.$('.new-app-btn');
        if(newAppBtn && await newAppBtn.isVisible()){
            await page.click('.new-app-btn');
        }
        console.log("✅ עברנו את מסך ה-SMS ופתחנו זימון תור חדש במכון מור.");

    } catch (e) {
        console.log("⚠️ חלף זמן ההמתנה, קוד שגוי או שגיאה בטעינת מסך מכון מור.");
        return null;
    }

   // --- סריקת תורים ודימוי התנהגות אנושית ---
    const humanDelay = async (min = 1500, max = 3000) => {
        await page.waitForTimeout(Math.floor(Math.random() * (max - min + 1) + min));
    };

    const targetRef = config.morSettings?.targetReferral || "מבחן מאמץ";
    await page.waitForSelector('.box-msg.item', { timeout: 15000 });
    
    console.log(`[DEBUG] בוחר הפניה: ${targetRef}`);
    await page.click(`.box-msg.item:has-text("${targetRef}")`, { delay: Math.random() * 500 + 200 });
    await humanDelay(1000, 2000);
    await page.click('button:has-text("המשך")', { delay: 300 });

    const areas = config.morSettings?.areaPriority || ["מרכז", "ירושלים והסביבה"];
    let foundAppointment = null;

    for (const area of areas) {
        updateLiveProgress(`🔍 בודק אזור: ${area}`);
        
        // לחיצה אנושית על האזור עם השהיה
        await page.click(`.flex-text:has-text("${area}")`, { delay: Math.random() * 400 + 200 });
        await humanDelay(3000, 5000); 

       // איתור תיבת התור הראשון המדויקת (לפי ה-HTML של כרטיסיית התור)
        const appointmentBoxes = page.locator('.flex-box-item.free-app .flex-container');
        
        if (await appointmentBoxes.count() > 0) {
            const firstBox = appointmentBoxes.first();
            
            // שליפת המקום והזמן מהאלמנטים הפנימיים המדויקים (מונע "זיהום" מהתפריט העליון)
            const branchName = await firstBox.locator('.flex-text').innerText(); 
            const dateTimeRaw = await firstBox.locator('.flex-items').innerText(); 
            const [time, date] = dateTimeRaw.split('|').map(s => s.trim());
            
            console.log(`[DEBUG] נמצא תור ב-${branchName} בתאריך ${date} בשעה ${time}`);
            
            // לחיצה פיזית על התור כדי להפעיל את כפתור ה'המשך'
            await firstBox.click({ delay: Math.random() * 500 + 300 });
            await humanDelay(2000, 3000);

            const continueBtn = page.locator('button:has-text("המשך")');
            if (await continueBtn.isEnabled()) {
                await continueBtn.click({ delay: 500 });
                console.log("✅ תור נבחר והמשכנו למסך הסיכום.");
                
                foundAppointment = {
                    branch: branchName.trim(),
                    date: date.trim(),
                    time: time.trim(),
                    area: area,
                    provider: 'MACHON_MOR'
                };
                break; 
            }
        }
    }

    return foundAppointment;
}

module.exports = { navigateMor };