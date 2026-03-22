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

    // 2. בחירת קידומת
    const prefix = config.morSettings?.phonePrefix || config.phonePrefix || "052";
    console.log(`[DEBUG] מנסה לבחור קידומת: ${prefix}`);
    
    try {
        await page.click('#phonePrefixNumber', { force: true });
        await page.waitForTimeout(1000);
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

    // 4. סימון הצ'קבוקס
    console.log("[DEBUG] מסמן הסכמה לתנאים...");
    try {
        await page.click('.checkbox-label', { timeout: 2000 }).catch(() => page.click('#userAgreement', { force: true }));
    } catch (e) {
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
            // 1. בדיקה אם כבר עברנו שלב
            const isPassed = await page.$('.new-app-btn').catch(() => null);
            if (isPassed) {
                loginSuccess = true;
                break;
            }

            // 2. חיפוש קוד אוטומטי - המנגנון המקורי שעבד!
            try {
                if (fs.existsSync('./config.json')) {
                    const currentCfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
                    const isFreshFile = currentCfg.otpReceivedAt && (Date.now() - currentCfg.otpReceivedAt < 300000);
                    
                    if (isFreshFile && currentCfg.lastOtp && String(currentCfg.lastOtp).trim().length >= 6) {
                        
                        const firstInputEl = await page.$('#tab0');
                        if (firstInputEl && await firstInputEl.isVisible()) {
                            const otpStr = String(currentCfg.lastOtp).trim();
                            console.log(`🤖 [AUTO-LOGIN] מזין קוד אוטומטי למכון מור: ${otpStr}`);
                            
                            const otpChars = otpStr.split('');
                            for (let i = 0; i < 6; i++) {
                                if (otpChars[i]) {
                                    const currentInput = `#tab${i}`;
                                    await page.click(currentInput, { clickCount: 3 }).catch(() => {});
                                    await page.keyboard.press('Backspace');
                                    await page.type(currentInput, otpChars[i], { delay: 100 });
                                }
                            }
                            
                            await page.waitForTimeout(1000);
                            await page.click('button:has-text("המשך")', { force: true }).catch(() => page.keyboard.press('Enter'));
                            
                            // השמירה חזרה לסוף - לא יהרוג את התהליך באמצע!
                            currentCfg.lastOtp = "";
                            fs.writeFileSync('./config.json', JSON.stringify(currentCfg, null, 2));
                        }
                    }
                }
            } catch (e) {}

            // 3. גיבוי - בדיקה אם הקוד הוזן ידנית
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

        if (!loginSuccess) {
            await page.waitForSelector('.new-app-btn', { timeout: 15000 });
        }

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

    await page.waitForSelector('.box-msg.item', { timeout: 15000 });

    console.log("🛠️ מנתח את המסלול החכם מהדשבורד...");
    
    // חילוץ נתוני המסלול והטקסט המדויק שהוזן ידנית
    const exactMatch = config.morSettings?.targetReferral;
    const fallbackPath = [
        config.morSettings?.category, 
        config.morSettings?.subCategory, 
        config.morSettings?.targetOrgan
    ].filter(Boolean);

    const existingReferrals = await page.$$('.box-msg.item');
    let foundExisting = false;
    let matchedText = "";

    for (const ref of existingReferrals) {
        const text = await ref.innerText();
        
        // זיהוי חכם: בודק קודם טקסט מדויק, ואז את התפריטים
        const isExactMatch = exactMatch && text.includes(exactMatch);
        const isCategoryMatch = fallbackPath.some(pathStep => text.includes(pathStep));

        if (isExactMatch || isCategoryMatch) {
            matchedText = text;
            await ref.click({ delay: Math.random() * 500 + 200 });
            foundExisting = true;
            break;
        }
    }

    if (foundExisting) {
        console.log(`✅ [DEBUG] נמצאה הפניה קיימת שמתאימה למסלול: ${matchedText}`);
        await humanDelay(1000, 2000);
        await page.click('button:has-text("המשך")', { delay: 300 });
   } else {
        console.log("⚠️ הפניה לא נמצאה ברשימה הראשונית, עובר ל'ההפניה שלי לא ברשימה'...");
        await page.click('span:has-text("ההפניה שלי לא ברשימה")').catch(() => page.click('text="ההפניה שלי לא ברשימה"'));
        await humanDelay(1500, 2500);

        // 1. בחירת גורם משלם
        const insurer = config.morSettings?.insuranceType || "כללית";
        console.log(`💳 בוחר גורם משלם: ${insurer}`);
        try {
            await page.click('#insurer', { timeout: 2000 });
            await page.waitForTimeout(500);
            await page.click(`.custom-option:has-text("${insurer}")`, { timeout: 2000 });
        } catch (e) {
            console.log("⚠️ לא נמצא תפריט מעוצב, מנסה בחירה רגילה...");
            await page.selectOption('select', { label: insurer }).catch(() => {});
        }
        await humanDelay(1000, 1500);

        // 2. בחירת קטגוריה ראשית
        if (config.morSettings?.category) {
            console.log(`📋 בוחר קטגוריה: ${config.morSettings.category}`);
            // זיהוי גמיש על בסיס הטקסט בלבד במקום קלאסים ספציפיים
            await page.click(`text="${config.morSettings.category}"`).catch(() => 
                page.click(`//*[contains(text(), "${config.morSettings.category}")]`)
            ).catch(() => console.log("⚠️ לא מצאתי את הקטגוריה במסך"));
            await humanDelay(1000, 1500);
        }

        // 3. בחירת תת-קטגוריה
        if (config.morSettings?.subCategory) {
            console.log(`🔍 בוחר תת-קטגוריה: ${config.morSettings.subCategory}`);
            await page.click(`text="${config.morSettings.subCategory}"`).catch(() => 
                page.click(`//*[contains(text(), "${config.morSettings.subCategory}")]`)
            ).catch(() => {});
            await humanDelay(800, 1200);
            
            const continueBtn = await page.$('button:has-text("המשך")');
            if (continueBtn && await continueBtn.isEnabled()) {
                await continueBtn.click();
                await humanDelay(1500, 2000);
            }
        }

        // 4. בחירת איבר מטרה ספציפי
        if (config.morSettings?.targetOrgan) {
            console.log(`🎾 בוחר איבר/בדיקה: ${config.morSettings.targetOrgan}`);
            const cleanTarget = config.morSettings.targetOrgan.split('(')[0].trim();
            await page.click(`text="${cleanTarget}"`).catch(() => 
                page.click(`//*[contains(text(), "${cleanTarget}")]`)
            ).catch(() => {});
            await humanDelay(1000, 1500);
            
            const continueBtn2 = await page.$('button:has-text("המשך")');
            if (continueBtn2 && await continueBtn2.isEnabled()) {
                await continueBtn2.click();
                await humanDelay(1500, 2000);
            }
        }
    }

    const areas = config.morSettings?.areaPriority || ["מרכז", "ירושלים והסביבה"];
    let foundAppointment = null;

    for (const area of areas) {
        updateLiveProgress(`🔍 בודק אזור: ${area}`);
        
        await page.click(`.flex-text:has-text("${area}")`, { delay: Math.random() * 400 + 200 });
        await humanDelay(3000, 5000); 

        const appointmentBoxes = page.locator('.flex-box-item.free-app .flex-container');
        
        if (await appointmentBoxes.count() > 0) {
            const firstBox = appointmentBoxes.first();
            
            const branchName = await firstBox.locator('.flex-text').innerText(); 
            const dateTimeRaw = await firstBox.locator('.flex-items').innerText(); 
            const [time, date] = dateTimeRaw.split('|').map(s => s.trim());
            
            console.log(`[DEBUG] נמצא תור ב-${branchName} בתאריך ${date} בשעה ${time}`);
            
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