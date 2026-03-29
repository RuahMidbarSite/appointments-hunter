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

// ==================== פונקציית עזר חסינה ללחיצה על "המשך" ====================
// ממתינה שהכפתור יהיה גלוי ולא מנוטרל, ואז לוחצת עליו
async function clickContinueBtn(page, stepName = '') {
    console.log(`⏳ [${stepName}] ממתין לכפתור 'המשך' זמין...`);
    try {
        // ממתין שהכפתור יופיע ויהיה enabled (אנגולר לפעמים מאפשר אותו באיחור)
        await page.waitForFunction(() => {
            const btn = document.querySelector('app-footer-buttons button.btn-left');
            return btn && !btn.disabled && btn.offsetParent !== null;
        }, { timeout: 8000 });

        const btn = page.locator('app-footer-buttons button.btn-left').last();
        await btn.click({ force: true });
        console.log(`✅ [${stepName}] נלחץ 'המשך' בהצלחה.`);
    } catch (e) {
        console.log(`⚠️ [${stepName}] waitForFunction נכשל, ממתין 2 שניות ומנסה גיבוי ישיר...`);
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
            const btn = document.querySelector('app-footer-buttons button.btn-left')
                     || document.querySelector('button.btn-left');
            if (btn) btn.click();
        });
        await page.waitForTimeout(1000); // נותן לאנגולר זמן לעבד את הלחיצה
    }
}

// ==================== פונקציית עזר: לחיצה על אפשרות בגוף העמוד בלבד ====================
// מונעת לחיצה בטעות על טקסט בסיכום / footer
async function clickOptionInBody(page, texts, stepName = '') {
    for (const text of texts) {
        try {
            const cleanText = text.replace(/\s+/g, ' ').trim();
            
            // מתמקד רק באזור התוכן המרכזי (app-*) כדי לא ללחוץ בטעות על סרגל ה"סיכום" בצד השמאלי
            const container = page.locator('app-service-type-selection, app-examination-type-selection, app-insurer, .body-flex, .buttons-flex').last();
            
            // מחפש את קוביית הבחירה בלי RegExp נוקשה שעלול להיכשל
            const el = container.locator('.item, .service-type-category, .service-type-name, button')
                                .filter({ hasText: cleanText })
                                .first();

            if (await el.count() > 0) {
                await el.scrollIntoViewIfNeeded();
                // לחיצה טבעית (ללא force) כדי שאנגולר יקלוט את הבחירה ויצבע את כפתור 'המשך' בכתום
                await el.click({ timeout: 3000 });
                console.log(`✅ [${stepName}] לחצתי על: "${cleanText}"`);
                return true;
            }
        } catch (e) {}
    }
    return false;
}

async function navigateMor(page, config) {
    const MOR_BASE_URL = 'https://zimun.mor.org.il/machon-mor/';
    const MOR_LOGIN_URL = 'https://zimun.mor.org.il/machon-mor/#/main/page/login';
 console.log("--- מתחיל ניווט באתר מכון מור ---");
    console.log(`[DEBUG-CONFIG] morSettings שהתקבל:`, JSON.stringify(config.morSettings || {}));
    console.log(`[DEBUG-CONFIG] phoneSuffix: "${config.morSettings?.phoneSuffix || config.phoneSuffix || 'חסר!'}", phonePrefix: "${config.morSettings?.phonePrefix || config.phonePrefix || 'חסר!'}"`);
    console.log(`[DEBUG-URL] כתובת נוכחית בכניסה ל-navigateMor: ${page.url()}`);
    
    updateLiveProgress("🚀 מנווט לאתר מכון מור...");

    let isAlreadyLoggedIn = false;

    try {
        // בדיקה אם הבוט כבר באתר מכון מור (כדי לא לאפס סשן במעבר בין תבניות של מור)
        if (!page.url().includes('zimun.mor.org.il')) {
            await page.goto(MOR_BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        }
        await page.waitForTimeout(3000); // נותן לאנגולר זמן לטעון ולבדוק את טוקן החיבור

        // בדיקה האם אנחנו כבר מחוברים (האם יש כפתור קביעת תור חדש)
        isAlreadyLoggedIn = await page.$('.new-app-btn').catch(() => null);
        console.log(`[DEBUG-LOGIN] isAlreadyLoggedIn: ${!!isAlreadyLoggedIn}, URL: ${page.url()}`);
    } catch (err) {
        console.error("❌ שגיאה בטעינת אתר מור:", err.message);
        return null;
    }

    if (isAlreadyLoggedIn) {
        console.log("⚡ מזהה סשן פעיל במכון מור! מדלג על תהליך ההתחברות הכפול...");
        await page.click('.new-app-btn');
        await page.waitForTimeout(2000);
        // קופץ ישירות לשלב בחירת המסלול החכם
    } else {
        console.log("🔑 נדרש לוגין למכון מור...");
        try {
            if (!page.url().includes('/login')) {
                await page.goto(MOR_LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
            }
            await page.waitForSelector('#personalId', { state: 'visible', timeout: 20000 });
            console.log("✅ דף הלוגין נטען.");
        } catch (err) {
            console.error("❌ שגיאה בהמתנה לדף הלוגין:", err.message);
            return null;
        }

        // 1. הזנת תעודת זהות
    const idNum = String(config.userId || "");
    console.log(`[DEBUG] מזין ת"ז: ${idNum}`);
    await page.fill('#personalId', idNum);
    await page.keyboard.press('Tab');

    // 2. בחירת קידומת — עם 3 שיטות עוקבות
    const prefix = config.morSettings?.phonePrefix || config.phonePrefix || "052";
    console.log(`[DEBUG] מנסה לבחור קידומת: ${prefix}`);

    let prefixSelected = false;

    // שיטה א: לחיצה על ה-dropdown ואז על האפשרות (ממתין שהתפריט ייפתח)
    try {
        await page.click('#phonePrefixNumber', { force: true, timeout: 3000 });
        await page.waitForSelector('.custom-option', { state: 'visible', timeout: 3000 });
        await page.click(`.custom-option:has-text("${prefix}")`, { timeout: 3000 });
        // אימות: בודק שהערך הנכון מופיע בשדה
        const selectedVal = await page.$eval('#phonePrefixNumber', el => el.value || el.innerText || el.textContent);
        if (selectedVal && selectedVal.includes(prefix.replace('0', ''))) {
            prefixSelected = true;
            console.log(`✅ קידומת ${prefix} נבחרה (שיטה א).`);
        }
    } catch (e) {}

    // שיטה ב: הזרקת NgModel דרך __ngContext__ (Angular internal)
    if (!prefixSelected) {
        console.log(`⚠️ שיטה א נכשלה, מנסה הזרקת NgModel (שיטה ב)...`);
        prefixSelected = await page.evaluate((pfx) => {
            const el = document.querySelector('#phonePrefixNumber');
            if (!el) return false;
            // נסה לגשת ל-Angular component instance
            const ngCtx = el.__ngContext__ || el.__ngModel__;
            if (ngCtx) {
                // Angular 13+ — ngContext הוא array, הComponent ב-index שונה
                for (const ctx of (Array.isArray(ngCtx) ? ngCtx : [ngCtx])) {
                    if (ctx && typeof ctx.writeValue === 'function') {
                        ctx.writeValue(pfx);
                        ctx._onChange && ctx._onChange(pfx);
                        return true;
                    }
                }
            }
            // גיבוי: nativeElement + אירועים מורחבים
            el.value = pfx;
            ['input', 'change', 'blur', 'keyup'].forEach(ev =>
                el.dispatchEvent(new Event(ev, { bubbles: true }))
            );
            return true;
        }, prefix);
        if (prefixSelected) console.log(`✅ קידומת הוזרקה דרך NgModel (שיטה ב).`);
    }

    // שיטה ג: גיבוי אחרון — לחיצה על ה-display element ואז בחירה ב-keyboard
    if (!prefixSelected) {
        console.log(`⚠️ שיטה ב נכשלה, מנסה keyboard (שיטה ג)...`);
        try {
            await page.focus('#phonePrefixNumber');
            await page.keyboard.press('Home');
            // מנסה Arrow keys עד שהערך הנכון מופיע
            for (let i = 0; i < 10; i++) {
                const val = await page.$eval('#phonePrefixNumber', el => el.value || el.textContent || '');
                if (val.includes(prefix)) { prefixSelected = true; break; }
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(200);
            }
            if (prefixSelected) console.log(`✅ קידומת נבחרה דרך מקלדת (שיטה ג).`);
        } catch (e) {
            console.log(`⚠️ כל שיטות הקידומת נכשלו — ממשיך עם ברירת מחדל.`);
        }
    }

    await page.waitForTimeout(500);

    // 3. הזנת מספר טלפון — עם אימות Angular
    const phoneSuffix = String(
        config.morSettings?.phoneSuffix || 
        config.phoneSuffix || 
        (config.morSettings?.phone ? config.morSettings.phone.slice(-7) : "") ||
        ""
    );
    console.log(`[DEBUG] phoneSuffix שנמצא: "${phoneSuffix}" (מ-morSettings: "${config.morSettings?.phoneSuffix}", מ-config: "${config.phoneSuffix}")`);
    console.log(`[DEBUG] מזין טלפון: ${phoneSuffix}`);

    // ממתין שהשדה יהיה זמין ומנקה אותו לפני הזנה
    await page.waitForSelector('#phoneNumber', { state: 'visible', timeout: 5000 });
    await page.triple_click?.('#phoneNumber').catch(() => {});
    await page.click('#phoneNumber', { clickCount: 3 }); // select all
    await page.keyboard.press('Backspace');
    await page.type('#phoneNumber', phoneSuffix, { delay: 80 }); // type עדיף על fill לאנגולר
    await page.keyboard.press('Tab'); // מפעיל את ה-blur validator של Angular

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

    // 5. לחיצה על המשך (לאחר לוגין)
    console.log("[DEBUG] לוחץ על כפתור המשך...");
    await page.waitForTimeout(1000);
    await page.click('button:has-text("המשך")', { force: true });

    updateLiveProgress("📱 ממתין להזנת קוד ה-SMS...");
    console.log("[DEBUG] עוקב אחרי הזנת קוד ה-SMS בדפדפן...");

    try {
        const timeoutMs = 300000;
        const startTime = Date.now();
        let loginSuccess = false;

        while (Date.now() - startTime < timeoutMs) {
            const isPassed = await page.$('.new-app-btn').catch(() => null);
            if (isPassed) {
                loginSuccess = true;
                break;
            }

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

                            currentCfg.lastOtp = "";
                            fs.writeFileSync('./config.json', JSON.stringify(currentCfg, null, 2));
                        }
                    }
                }
            } catch (e) {}

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
        if (newAppBtn && await newAppBtn.isVisible()) {
            await page.click('.new-app-btn');
        }
        console.log("✅ עברנו את מסך ה-SMS ופתחנו זימון תור חדש במכון מור.");

    } catch (e) {
        console.log("⚠️ חלף זמן ההמתנה, קוד שגוי או שגיאה בטעינת מסך מכון מור.");
        return null;
    }
} // <--- סגירת בלוק ה-else החסר! זה מה שפותר את השגיאה האדומה

const humanDelay = async (min = 1500, max = 3000) => {
        await page.waitForTimeout(Math.floor(Math.random() * (max - min + 1) + min));
    };

    await page.waitForSelector('.box-msg.item', { timeout: 15000 });
    console.log("🛠️ מנתח את המסלול החכם מהדשבורד...");

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
        await clickContinueBtn(page, 'הפניה קיימת');
        await humanDelay(1500, 2500);

    } else {
        console.log("⚠️ הפניה לא נמצאה ברשימה הראשונית, עובר ל'ההפניה שלי לא ברשימה'...");
        await page.click('span:has-text("ההפניה שלי לא ברשימה")').catch(() => page.click('text="ההפניה שלי לא ברשימה"'));
        await humanDelay(1500, 2500);

        // ===== שלב א: מסך גורם משלם (app-insurer) =====
        const insurer = config.morSettings?.insuranceType || "כללית";
        console.log(`💳 [שלב א] בוחר גורם משלם: ${insurer}`);

        // ממתין שמסך הביטוח יטען
        await page.waitForSelector('app-insurer, #insurer, .service-type-category', { timeout: 8000 }).catch(() => {});

        try {
            await page.click('#insurer', { timeout: 2000 });
            await page.waitForTimeout(500);
            await page.click(`.custom-option:has-text("${insurer}")`, { timeout: 2000 });
            console.log(`✅ [שלב א] גורם משלם נבחר: ${insurer}`);
        } catch (e) {
            console.log("⚠️ [שלב א] לא נמצא תפריט מעוצב, מנסה .service-type-category...");
            try {
                // באתר מכון מור, גורם משלם מופיע כ-div עם הטקסט
                await page.click(`.service-type-category:has-text("${insurer}")`, { timeout: 3000 });
                console.log(`✅ [שלב א] גורם משלם נבחר דרך category: ${insurer}`);
            } catch (e2) {
                await page.selectOption('select', { label: insurer }).catch(() => {});
            }
        }

        await humanDelay(800, 1200);

        // ===== FIX #1: לחיצה על "המשך" אחרי בחירת גורם משלם =====
        await clickContinueBtn(page, 'גורם משלם → קטגוריה');

        // ממתין שמסך הקטגוריה יטען
        await page.waitForSelector('app-service-type-selection, .service-type-category', { timeout: 8000 }).catch(() => {});
        await humanDelay(800, 1200);

        // ===== שלב ב: מסך קטגוריה ראשית (app-service-type-selection) =====
        if (config.morSettings?.category) {
            const category = config.morSettings.category;
            console.log(`📋 [שלב ב] בוחר קטגוריה: ${category}`);

            const catFound = await clickOptionInBody(page, [category], 'קטגוריה');
            if (!catFound) {
                // גיבוי
                await page.click(`text="${category}"`).catch(() =>
                    page.click(`xpath=//*[contains(@class,'service-type-category') and contains(text(),"${category}")]`).catch(() => {})
                );
            }
            await humanDelay(800, 1200);

            // ===== FIX #2: לחיצה על "המשך" אחרי בחירת קטגוריה =====
            await clickContinueBtn(page, 'קטגוריה → תת-קטגוריה');

            // ממתין שמסך תת-הקטגוריה יטען
            await page.waitForSelector('app-examination-type-selection, app-service-type-selection', { timeout: 8000 }).catch(() => {});
            await humanDelay(800, 1200);
        }

        // ===== שלב ג: מסך תת-קטגוריה (app-examination-type-selection) =====
        if (config.morSettings?.subCategory) {
            const subCat = config.morSettings.subCategory;
            // מיפוי: "אולטרסאונד" → הטקסטים שמופיעים בפועל באתר
            const labels = subCat === "אולטרסאונד" ? ["א.ס כללי", "אולטרסאונד"] : [subCat];

            console.log(`🔍 [שלב ג] בוחר תת-קטגוריה: ${labels.join(' / ')}`);

            const subFound = await clickOptionInBody(page, labels, 'תת-קטגוריה');
            if (!subFound) {
                console.log(`⚠️ [שלב ג] מנסה גיבוי XPath...`);
                await Promise.any(labels.map(label =>
                    page.click(`xpath=//*[contains(@class,'body-flex') or contains(@class,'buttons-flex')]//*[contains(text(),"${label}")]`, { timeout: 3000 })
                )).catch(() => console.log("⚠️ [שלב ג] גיבוי נכשל גם כן."));
            }

            await humanDelay(500, 1000);

            // ===== FIX #3: לחיצה על "המשך" אחרי בחירת תת-קטגוריה =====
            await clickContinueBtn(page, 'תת-קטגוריה → איבר');

            // ממתין שתוכן המסך יתרענן — לא מספיק לחכות ל-component (הוא נשאר),
            // אלא ממתינים שהכפתור ייעלם/יופיע מחדש כסימן שהרינדור הסתיים
            await page.waitForTimeout(1500);
            await page.waitForFunction(() => {
                // בודק שיש תוכן חדש — כלומר כפתורי בחירה גלויים בגוף העמוד
                const bodyItems = document.querySelectorAll('.body-flex button, .buttons-flex button, app-examination-type-selection button');
                return bodyItems.length > 0;
            }, { timeout: 8000 }).catch(() => page.waitForTimeout(2000));
        }

        // ===== שלב ד: מסך בחירת איבר =====
        if (config.morSettings?.targetOrgan) {
            const organ = config.morSettings.targetOrgan.split('(')[0].trim();
            console.log(`🎾 [שלב ד] מנסה לאתר איבר/בדיקה: ${organ}`);

            const organFound = await clickOptionInBody(page, [organ], 'איבר');
            if (!organFound) {
                await page.click(`xpath=//*[contains(text(), "${organ}")]`, { timeout: 5000 }).catch(() => {
                    console.log(`⚠️ [שלב ד] לא מצאתי את האיבר ${organ} במסך`);
                });
            }

        await humanDelay(800, 1200);
            await clickContinueBtn(page, 'איבר → אזורים');
            await humanDelay(1500, 2000);

            // ----- טיפול במסך שאלות מקדימות (ממוגרפיה/בריאות השד) -----
            // ----- טיפול במסך שאלות מקדימות (ממוגרפיה/בריאות השד) -----
        const isQuestionPage = await page.locator('app-questions-selection, .questions-boxes').count();
        if (isQuestionPage > 0) {
            console.log("❓ [DEBUG] זוהה מסך שאלות מקדימות. מחפש את התשובה 'לא'...");
            
            // התאמה מדויקת ל-HTML של מור: div עם קלאס option בתוך קופסת השאלות
            const noBtn = page.locator('.questions-boxes .option').filter({ hasText: 'לא' }).first();
            
            if (await noBtn.count() > 0) {
                await noBtn.scrollIntoViewIfNeeded();
                await noBtn.click(); // לחיצה טבעית לאישור התשובה
                console.log("✅ [DEBUG] נלחץ 'לא' בשאלות המקדימות.");
                await humanDelay(1000, 1500);
                await clickContinueBtn(page, 'שאלות מקדימות → אזורים');
            } else {
                console.log("⚠️ [DEBUG] לא נמצא כפתור 'לא' במסך השאלות.");
            }
        }
        }
    }

    // ===== סריקת תורים לפי אזורים =====
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

            await clickContinueBtn(page, 'בחירת תור → סיכום');
            console.log("✅ תור נבחר והמשכנו למסך הסיכום.");

            // שליפת מידע נוסף ממסך הסיכום (כתובת, טלפון, שם הבדיקה ושאלות)
            let extraInfo = "";
            let testNameInfo = "";
            let addressInfo = "";
            let phoneInfo = "";
            
            try {
                await page.waitForTimeout(1500); // המתנה לטעינת טקסט הסיכום
                
                // חילוץ כל הטקסט מהעמוד כדי לדוג ממנו נתונים בצורה נקייה
                const bodyText = await page.innerText('body');
                
                // 1. חילוץ שם הבדיקה (עוצר בשורת רווח כדי לא לקחת את התאריך בטעות)
                const testMatch = bodyText.match(/שם הבדיקה:\s*([^\n]+)/);
                if (testMatch && testMatch[1]) {
                    testNameInfo = testMatch[1].trim();
                }

                // 2. חילוץ מספר טלפון (תבנית של 9-10 ספרות שמתחילה ב-0)
                const phoneMatch = bodyText.match(/0[2-9]\d{7,8}/);
                if (phoneMatch) {
                    phoneInfo = phoneMatch[0];
                }

                // 3. חילוץ הכתובת (תמיד מופיעה שורה אחת מתחת לשם הסניף במור)
                // שימוש ב-escape למקרה ששם הסניף מכיל תווים מיוחדים
                const safeBranchName = branchName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const branchRegex = new RegExp(safeBranchName + "\\s*\\n([^\\n]+)");
                const addressMatch = bodyText.match(branchRegex);
                
                if (addressMatch && addressMatch[1] && !addressMatch[1].includes(phoneInfo)) {
                    addressInfo = addressMatch[1].trim();
                }

                // 4. חילוץ שאלות מקדימות
                const questionTexts = await page.locator('div, span, p').filter({ hasText: '?' }).allInnerTexts();
                const cleanQs = questionTexts
                    .map(t => t.replace(/\s+/g, ' ').trim())
                    .filter(t => t.length > 5 && t.length < 120 && t.includes('?'));

                if (cleanQs.length > 0) {
                    extraInfo = [...new Set(cleanQs)][0];
                }
            } catch (e) {
                console.log("⚠️ [DEBUG] לא הצלחתי לשלוף מידע נוסף ממסך הסיכום.");
            }

            // בניית המחרוזת כטקסט נקי בלבד (ללא תגיות HTML)
            // זה פותר לחלוטין את בעיית ה"קוד המיותר" בחיווי הסטטוס משמאל למטה
            let finalBranchName = branchName.trim();
            
            if (addressInfo)  finalBranchName += ` • 📍 ${addressInfo}`;
            if (phoneInfo)    finalBranchName += ` • 📞 ${phoneInfo}`;
            if (testNameInfo) finalBranchName += ` • 🩺 ${testNameInfo}`;
            if (extraInfo)    finalBranchName += ` • 📌 ${extraInfo}`;

            foundAppointment = {
                branch: finalBranchName,
                date: date.trim(),
                time: time.trim(),
                area: area,
                provider: 'MACHON_MOR'
            };
            break;
        }
    }

    return foundAppointment;
}

module.exports = { navigateMor };