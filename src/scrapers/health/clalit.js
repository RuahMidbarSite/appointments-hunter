const { solveCaptcha } = require('../../services/captchaService');
async function runClalit(page) {
    console.log("--- מתחיל סריקה עבור כללית (מצב Stealth פעיל) ---");
    await page.goto('https://e-services.clalit.co.il/onlineweb/general/login.aspx');

    try {
        // אם האתר נפתח בגרסת מובייל/טאבלט, נלחץ על כפתור הכניסה הראשי
        const loginTrigger = await page.$('text="כניסה לאון־ליין"');
        if (loginTrigger) {
            console.log("📱 מזהה גרסה מצומצמת, לוחץ על כפתור כניסה לפתיחת התפריט...");
            await loginTrigger.click();
            await page.waitForTimeout(2000); // המתנה קצרה לפתיחת האנימציה
        }

        // 1. לחיצה על כרטיסיית "קוד חד-פעמי לנייד" (זיהוי חכם לפי הטקסט עצמו)
        // 1. לחיצה על כרטיסיית "קוד חד-פעמי לנייד" (לפי ה-ID המדויק ששלחת)
        console.log("🖱️ עובר לכרטיסיית 'קוד חד-פעמי לנייד'...");
        const exactSmsBtnSelector = '#ctl00_cphBody__loginView_btnSendSMS';
        
        // מוודא שהכפתור קיים וגלוי, ואז לוחץ עליו
        await page.waitForSelector(exactSmsBtnSelector, { state: 'visible', timeout: 30000 });
        await page.click(exactSmsBtnSelector);
        
        // המתנה קצרה כדי לתת לדף להחליף תצוגה
        console.log("⏳ מחכה להופעת השדות...");
        await page.waitForTimeout(2000);
        
        const userIdSelector = '#ctl00_cphBody__loginView_tbUserId';
        await page.waitForSelector(userIdSelector, { state: 'visible', timeout: 30000 });

        // 2. הזנת תעודת זהות
        console.log("⌨️ מזין תעודת זהות...");
        await page.type(userIdSelector, '029280484', { delay: 150 });
        
        // 3. צילום ופענוח הקפצ'ה בעזרת AI
        // 3. צילום ופענוח הקפצ'ה בעזרת AI
        console.log("📸 מחפש את תמונת הקפצ'ה במסך...");
        
        // זיהוי גמיש: מוצא את התמונה גם אם ה-ID שלה השתנה ל-imgCaptchaLogin
        const captchaEl = await page.waitForSelector('img[id*="Captcha"]', { state: 'visible', timeout: 15000 });
        
        console.log("📸 שומר את תמונת הקפצ'ה לקובץ...");
        const captchaImgPath = 'captcha_temp.png';
        await captchaEl.screenshot({ path: captchaImgPath });
        
        console.log("🤖 שולח את התמונה ל-AI לפענוח (זה עשוי לקחת כמה שניות)...");
        const solvedText = await solveCaptcha(captchaImgPath);
        
        if (solvedText) {
            console.log(`✍️ התקבלה תשובה! מזין קפצ'ה בתיבה: ${solvedText}`);
            await page.type('#ctl00_cphBody__loginView_tbCaptchaLogin', solvedText, { delay: 150 });
        } else {
            console.error("❌ ה-AI לא הצליח לפענח את הקפצ'ה.");
        }

        // 4. לחיצה על הכפתור הגדול למטה כדי לשלוח את הטופס (לפי ה-ID המדויק ששלחת)
        console.log("🔘 לוחץ על כפתור השליחה התחתון ('שלחו לי קוד ב-SMS')...");
        
        const submitBtnId = '#ctl00_cphBody__loginView_lblSendOTP';
        await page.waitForSelector(submitBtnId, { state: 'attached', timeout: 15000 });
        
        // לחיצה ישירה דרך הדפדפן כדי להבטיח שהפעולה עוברת
        await page.evaluate((btnId) => {
            document.querySelector(btnId).click();
        }, submitBtnId);

        console.log("--------------------------------------------------");
        console.log("הטופס נשלח! הסמארטפון שלך אמור לצפצף עכשיו.");
        console.log("אנא הזן את קוד ה-SMS מהנייד בתיבה שנפתחה ולחץ כניסה.");
        console.log("--------------------------------------------------");
        // המשך הקוד המקורי שלך (חיפוש התורים) מתחיל כאן
        const daughterSelector = '#ctl00_ctl00_cphTopMenuRight_FamilySliderControl21_rptPersonList_ctl01_FirstNameTxt';
        await page.waitForSelector(daughterSelector, { timeout: 300000 });
        
        console.log("✅ השם זוהה. עובר לפרופיל הבת...");
        await page.click(daughterSelector);
        await page.waitForTimeout(6000); 

        console.log("ניווט לזימון תורים...");
        await page.click('text="שירותי האון־ליין"');
        await page.waitForTimeout(2500);
        await page.click('a[title="זימון תורים"]');

        // פונקציית עזר למציאת הכפתור בפריימים
        async function getTarget() {
            const selector = '#ProfessionVisitButton';
            if (await page.$(selector)) return page;
            for (const frame of page.frames()) {
                if (await frame.$(selector)) return frame;
            }
            return null;
        }

        let target = await getTarget();
        if (!target) { await page.waitForTimeout(6000); target = await getTarget(); }

        console.log("לחיצה על 'לרפואה יועצת'...");
        await target.click('#ProfessionVisitButton');
        
        await target.waitForSelector('#SelectedGroupCode', { timeout: 20000 });
        console.log("בוחר תחום: נוירולוגיה...");
        await target.selectOption('#SelectedGroupCode', '32');
        await page.waitForTimeout(5000); 

        // בחירת עיר - אולטרה איטי
        console.log("🔎 מזין 'הרצליה' בקצב אנושי...");
        const cityInput = '#SelectedCityName';
        await target.click(cityInput);
        await target.fill(cityInput, '');
        await page.waitForTimeout(1500);

        await target.type(cityInput, 'הרצליה', { delay: 500 });
        
        // המתנה לתפריט הצף
        await target.waitForSelector('li.ui-menu-item', { state: 'visible', timeout: 15000 });
        await page.waitForTimeout(2500); 

        console.log("⌨️ בחירה עם המקלדת (חץ למטה + Enter)...");
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(1500);
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(3000);

        console.log("🚀 לוחץ על חיפוש...");
        await target.click('#searchBtnSpec');

        await page.waitForTimeout(8000);
        const content = await target.content();
        
        if (content.includes('תור פנוי') || content.includes('לבחירת תור')) {
            console.log("✅✅✅ נמצא תור פנוי בהרצליה!");
            process.stdout.write('\x07'); // צפצוף התראה
        } else {
            console.log("❌ אין תורים פנויים כרגע בהרצליה.");
        }

    } catch (error) {
        console.error("שגיאה במהלך הבוט:", error.message);
    }
}

module.exports = { runClalit };