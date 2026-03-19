async function navigateHospitalSearch(page, config, hospitalName) {
    console.log(`🏥 [NAV] מתחיל ניווט למסלול בתי חולים...`);
    
    // 1. לחיצה בתפריט הימני על "בתי חולים" (span.menuTitle)
    await page.click('span.menuTitle:has-text("בתי חולים")');
    await page.waitForURL('**/HospitalsLobby.aspx');

    // 2. לחיצה על "תורים לבתי חולים" בסקציה "ביצוע פעולות"
    await page.click('div.CommonOperationsTitle:has-text("תורים לבתי חולים")');
    await page.waitForURL('**/HospitalObligation.aspx');

    // 3. לחיצה על "זימון תור" (li.liMedicineMenu)
    await page.click('li.liMedicineMenu span:has-text("זימון תור")');
    await page.waitForURL('**/HospitalReturnVisit.aspx');

    // 4. איתור הרשומה עם קוד השירות ולחיצה על "להזמנת התור"
    // אנחנו מחפשים שורה שמכילה את קוד השירות (למשל L9255) ואז לוחצים על הכפתור באותה שורה
    const row = await page.locator('tr', { hasText: config.selectedSpecialization });
    const orderBtn = row.locator('button.btn-primary:has-text("להזמנת התור")');
    
    if (await orderBtn.count() > 0) {
        await orderBtn.click();
    } else {
        console.log("❌ לא נמצא כפתור הזמנה עבור קוד שירות זה");
        return { success: false, error: 'NO_BUTTON' };
    }

    // 5. בחירת בית חולים ולחיצה על "המשך" (online_blue_button)
    await page.waitForSelector('select[name*="Hospital"]');
    await page.selectOption('select[name*="Hospital"]', { label: hospitalName });
    await page.click('a.online_blue_button:has-text("המשך")');

    // 6. בדיקת הודעת שגיאה "בעיה בהגדרות המערכת"
    await page.waitForTimeout(2000);
    const hasSystemError = await page.evaluate(() => {
        return document.body.innerText.includes('בעיה בהגדרות המערכת') || 
               document.body.innerText.includes('לא ניתן לזמן תור בשלב הזה');
    });

    return hasSystemError ? { success: false, error: 'SYSTEM_CONFIG_ERROR' } : { success: true };
}

module.exports = { navigateHospitalSearch };