    import React, { useState, useRef, useEffect } from 'react';
    import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';
    import { AVAILABLE_CITIES } from '../scrapers/health/constants/cities';
    import { HOSPITAL_TEST_TYPES, HOSPITAL_TARGET_ORGANS } from '../scrapers/health/hospital_constants/hospital_services';

    // ייבוא קבצי הרופאים
    import { AVAILABLE_DOCTORS as urologyDoctors } from '../scrapers/health/constants/urology';
    import { AVAILABLE_DOCTORS as orthopedicsDoctors } from '../scrapers/health/constants/orthopedics';
    import { AVAILABLE_DOCTORS as gastroDoctors } from '../scrapers/health/constants/gastroenterology';
    import { AVAILABLE_DOCTORS as neurologyDoctors } from '../scrapers/health/constants/neurology';
    import { AVAILABLE_DOCTORS as cardioDoctors } from '../scrapers/health/constants/cardiology';
    import { AVAILABLE_DOCTORS as endoDoctors } from '../scrapers/health/constants/Endocrinology';
    import { AVAILABLE_DOCTORS as dermDoctors } from '../scrapers/health/constants/Dermatology';
    import { AVAILABLE_DOCTORS as hematoDoctors } from '../scrapers/health/constants/Hematology';
    import { AVAILABLE_DOCTORS as rheumaDoctors } from '../scrapers/health/constants/Rheumatology';
    import { AVAILABLE_DOCTORS as entDoctors } from '../scrapers/health/constants/Otolaryngology';
    import { AVAILABLE_DOCTORS as emgDoctors } from '../scrapers/health/constants/EMG';
    import { AVAILABLE_DOCTORS as radioDoctors } from '../scrapers/health/constants/Radiology';
    import { AVAILABLE_DOCTORS as ultraDoctors } from '../scrapers/health/constants/ultrasound';
    import { AVAILABLE_DOCTORS as geriDoctors } from '../scrapers/health/constants/Geriatrics';
    import { AVAILABLE_DOCTORS as plasticDoctors } from '../scrapers/health/constants/PlasticSurgery';
    import { AVAILABLE_DOCTORS as proctoDoctors } from '../scrapers/health/constants/Proctology';
    import { AVAILABLE_DOCTORS as hepatoDoctors } from '../scrapers/health/constants/Hepatology';
    import { AVAILABLE_DOCTORS as allergyDoctors } from '../scrapers/health/constants/Allergy';
    import { AVAILABLE_DOCTORS as oncoDoctors } from '../scrapers/health/constants/oncology';
const MOR_PATHS = {
  "כללית": {
    "לב וכלי דם": {
      "אקו": { "אקו לב": ["רגיל", "במאמץ (סטרס אקו)"] },
      "כלי דם": { "דופלר/דופלקס": ["עורקי כליה", "ורידים", "קרוטיס (צוואר)", "עורקי רגליים"] },
      "ארגומטריה": ["בדיקת מאמץ רגילה"]
    },
    "דימות:  אולטרסאונד / CT": {
      "אולטרסאונד": ["אשכים", "תאירואיד", "בטן עליונה", "מפשעה", "אגן", "צוואר", "שד"],
      "CT": ["סינוסים", "עמוד שדרה", "בטן"]
    },
    "עיניים": { "צילומים": ["פונדוס", "OCT", "שדה ראייה ממוחשב", "צילום רשתית"] },
    "EMG": { "בדיקה": ["רגל", "יד"] }
  },
  "כללית פלטינום או מושלם": {
    "מטיילים": {
      "מרפאת מטיילים": {
        "ייעוץ": ["לא (קביעת תור חדש)", "כן (חיסונים חוזרים בלבד)"],
        "ביקור חוזר": ["כן (עברתי ייעוץ במור)", "לא (נדרש תיאום ייעוץ רופא)"]
      }
    },
    "לב וכלי דם": { "ארגומטריה": ["בדיקת מאמץ רגילה"] },
    "בריאות השד": ["ממוגרפיה", "אולטרסאונד שד"],
    "צפיפות עצם": ["בדיקת צפיפות עצם"]
  },
  "לקוח פרטי": {} 
};

const getMorOptions = (level, settings) => {
  const insurance = settings?.insuranceType === "לקוח פרטי" ? "כללית" : (settings?.insuranceType || "כללית");
  const tree = MOR_PATHS[insurance] || MOR_PATHS["כללית"];
  if (level === 'category') return Object.keys(tree);
  const catData = tree[settings?.category];
  if (!catData) return [];
  if (level === 'subCategory') return Array.isArray(catData) ? [] : Object.keys(catData);
  const subCatData = catData[settings?.subCategory];
  if (!subCatData) return Array.isArray(catData) ? catData : [];
  return Array.isArray(subCatData) ? subCatData : Object.keys(subCatData);
};
    const DOCTORS_DATABASE = {
        "אורולוגיה": urologyDoctors,
        "אורתופדיה": orthopedicsDoctors,
        "גסטרואנטרולוגיה": gastroDoctors,
        "נוירולוגיה": neurologyDoctors,
    "קרדיולוגיה": cardioDoctors,
    "עור": dermDoctors,
        "המטולוגיה": hematoDoctors,
        "ראומטולוגיה": rheumaDoctors,
        "אף אוזן גרון": entDoctors,
        "EMG": emgDoctors,
        "רנטגן": radioDoctors,
        "אולטרסאונד": ultraDoctors,
        "גריאטריה": geriDoctors,
        "כירורגיה פלסטית": plasticDoctors,
        "פרוקטולוגיה": proctoDoctors,
        "כבד": hepatoDoctors,
        "אלרגיה": allergyDoctors,
        "אונקולוגיה": oncoDoctors
    };

    const MultiSelectDropdown = ({ options, selected, onChange, placeholder, isObject = false, focusClass, isMulti = true }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [searchTerm, setSearchTerm] = useState('');
        const dropdownRef = useRef(null);

        const filteredOptions = (Array.isArray(options) ? options : []).filter(opt => {
            const text = String(isObject ? (opt?.label || '') : (opt || ''));
            return text.toLowerCase().includes(searchTerm.toLowerCase());
        });

        const toggleOption = (option) => {
            const value = isObject ? (option.key || option.id) : option;
            if (isMulti) {
                if (selected.includes(value)) {
                    onChange(selected.filter(item => item !== value));
                } else {
                    onChange([...selected, value]);
                }
            } else {
                onChange([value]);
                setIsOpen(false);
            }
            setSearchTerm(''); 
        };

        const getSelectedLabels = () => {
            if (!selected || selected.length === 0) return placeholder;
            if (!isObject) return String(selected.join(', '));
            return selected.map(val => {
                const found = (options || []).find(o => String(o.key || o.id) === String(val));
                if (!found) return String(val);
            // אם מצאנו את הרופא ויש לו label עם |, נציג שם ועיר
            if (found.label && found.label.includes('|')) {
                const parts = found.label.split('|').map(p => p.trim());
                return `${parts[0]} (${parts[1]})`;
            }
    if (!found) return String(val);
                
                // שימוש ב-shortLabel שבנינו ב-getDoctorsList הכולל שם ועיר מדויקים
                if (found.shortLabel) return found.shortLabel;

                // גיבוי למקרה שאין shortLabel מוכן
                if (found.label && found.label.includes('|')) {
                    const parts = found.label.split('|').map(p => p.trim());
                    return `${parts[0]} (${parts[1]})`;
                }
                return String(found.label || found.id);
            }).join(', ');
        };

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                    setIsOpen(false);
                    setSearchTerm('');
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        return (
            <div className="relative" ref={dropdownRef}>
                <div className="relative flex items-center">
    <div 
        className={`w-full px-2 py-1.5 rounded-xl bg-white border border-gray-200 shadow-sm flex flex-wrap gap-2 items-center cursor-text min-h-[46px] focus-within:ring-2 ${focusClass}`}
        onClick={() => {
            setIsOpen(true);
            dropdownRef.current?.querySelector('input')?.focus();
        }}
    >
        {/* תצוגת הבחירות כצ'יפים עם מספר סדר עדיפות */}
{selected.map((val, index) => {
    const option = isObject ? (options || []).find(o => String(o.key || o.id) === String(val)) : null;
    const label = isObject ? (option?.shortLabel || option?.label || val) : val;
    const displayLabel = String(label).split('|')[0].trim();

    return (
        <span key={val} className="flex items-center gap-2 bg-teal-50 text-teal-700 pr-1 pl-3 py-1 rounded-full text-base font-bold border border-teal-200 group/chip hover:bg-teal-100 transition-colors">
            <div className="flex items-center justify-center w-5 h-5 bg-teal-600 text-white rounded-full text-[10px] font-black shadow-sm">
                {index + 1}
            </div>
            <span className="leading-none">{displayLabel}</span>
            <button 
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter(item => item !== val));
                }}
                className="text-teal-300 hover:text-red-500 hover:bg-red-50 w-5 h-5 rounded-full flex items-center justify-center transition-all text-xs font-black mr-1"
            >
                ✕
            </button>
        </span>
    );
})}

        {/* שדה הקלדה לחיפוש */}
        <input 
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-xl font-medium min-w-[100px] text-gray-800"
            placeholder={selected.length === 0 ? placeholder : ""}
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
        />
    </div>
                </div>
                {isOpen && (
                    <div className="absolute z-50 min-w-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => {
                            const value = isObject ? (option.key || option.id) : option;
                            const labelStr = isObject ? option.label : String(option);
                            const isChecked = selected.includes(value);
    // שימוש בתווית המוכנה (shortLabel) שכוללת שם ועיר, או ברירת מחדל
    const displayName = option.shortLabel || (labelStr.includes('|') ? labelStr.split('|')[0].trim() : labelStr);

                            return (
                                <div key={String(value)} className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer text-xl border-b border-gray-50 ${isChecked ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800'}`} onClick={() => toggleOption(option)}>
                                    {isMulti && <input type="checkbox" className="ml-3 w-5 h-5" checked={!!isChecked} readOnly />}
                                    <span className="flex-1 text-right">{displayName}</span>
                                </div>
                            );
                        }) : <div className="p-4 text-xl text-gray-500 text-center">אין תוצאות</div>}
                    </div>
                )}
            </div>
        );
    };

    export default function BotDashboard() {
    const [config, setConfig] = useState({
        userId: '', userCode: '', password: '', familyMember: '', email: '', 
        loginMode: 'password',
        selectedCities: [], includeSurrounding: true, selectedDoctors: [], 
        selectedGroup: '', selectedSpecialization: '', insuranceType: 'הכל', 
        endDate: '', runInLoop: false, loopFrequency: "10-15",
        startTime: '08:00', endTime: '22:00', lastFoundDate: '', doctorDates: {},
        activeEngines: ['clalit_specialist'],
        loadedTemplateId: null,
        templateQueue: [] // שדה חדש לניהול תור של מספר תבניות
    });

    // פונקציה להוספת תבנית לתור במקום טעינה בודדת
    const addToQueue = (template) => {
        if (config.templateQueue.some(t => t._id === template._id)) {
            alert("תבנית זו כבר נמצאת בתור");
            return;
        }
        const { _id, templateName, ...cleanData } = template;
        
        // משיכת התור המוקדם ביותר מהתבנית (אם קיים)
        const newFoundDate = template.lastBestFound || template.lastFoundDate || '';
        
        // יצירת התור החדש (כולל שמירת התאריך המוקדם ביותר בתוך אובייקט התור)
        const newQueue = [...config.templateQueue, { ...cleanData, _id, templateName, lastBestFound: newFoundDate }];
        
        // הגדרת מצב "נקי" לשדות הטופס תוך שמירה על התור
        const updated = {
            ...config,
            templateQueue: newQueue,
            lastFoundDate: newFoundDate, // מעדכן את הבאנר הצהוב לתבנית האחרונה שנוספה
            // איפוס שדות כדי שנוכל לבנות תבנית חדשה בקלות:
            familyMember: '',
            selectedGroup: '',
            selectedSpecialization: '',
            selectedCities: [],
            selectedDoctors: [],
            selectedDoctorNames: [],
            morSettings: {},
            isTemplateActive: false,
            loadedTemplateId: null
        };
        
        setConfig(updated);
        handleAutoSave(updated);
        setDbSearchResults([]);
    };

   // פונקציה להסרת תבנית מהתור
    const removeFromQueue = (id) => {
        const updated = {
            ...config,
            templateQueue: config.templateQueue.filter(t => t._id !== id)
        };
        setConfig(updated);
        handleAutoSave(updated);
    };

    // פונקציה לשמירת כל התור כ"קבוצת סריקה" עם שם אוטומטי
    const saveCurrentQueue = async () => {
        if (!config.templateQueue || config.templateQueue.length === 0) {
            alert("אין תבניות בתור לשמירה.");
            return;
        }

        // 1. יצירת השם האוטומטי המורכב מהשמות והתחומים
        const generatedNameParts = config.templateQueue.map(t => {
            const memberName = t.familyMember || 'ללא שם';
            let medicalField = 'כללי';
            if (t.activeEngines?.includes('mor_institute')) {
                medicalField = t.morSettings?.targetOrgan || t.morSettings?.subCategory || t.morSettings?.category || 'מכון מור';
            } else {
                const groupMatch = t.templateName ? t.templateName.match(/תחום:\s*([^|]+)/) : null;
                medicalField = groupMatch ? groupMatch[1].trim() : 'כללי';
            }
            return `${memberName} ${medicalField}`;
        });

        const autoGroupName = generatedNameParts.join(' | ');
        
        // 2. חלונית אישור או עריכה לשם הקבוצה
        const finalGroupName = prompt("שמירת קבוצת סריקה\nהשם מיוצר אוטומטית, ניתן לערוך אותו כעת:", autoGroupName);
        
        if (!finalGroupName) return;

        try {
            const res = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'save_queue_to_db', 
                    queueName: finalGroupName.trim(), 
                    templates: config.templateQueue 
                })
            });
            
            if (res.ok) {
                alert(`✅ הקבוצה "${finalGroupName}" נשמרה בהצלחה!`);
            } else {
                alert("❌ שגיאה בשמירת הקבוצה לשרת.");
            }
        } catch (err) {
            console.error("Error saving queue:", err);
            alert("❌ שגיאת תקשורת בשמירת הקבוצה.");
        }
    };
const handleMorPathChange = (level, value) => {
        let newSettings = { ...config.morSettings, [level]: value };
        if (level === 'insuranceType') { newSettings.category = ''; newSettings.subCategory = ''; newSettings.targetOrgan = ''; }
        if (level === 'category') { newSettings.subCategory = ''; newSettings.targetOrgan = ''; }
        if (level === 'subCategory') { newSettings.targetOrgan = ''; }

        const autoSkip = (settings, currentLevel) => {
            const nextMap = { 'insuranceType': 'category', 'category': 'subCategory', 'subCategory': 'targetOrgan' };
            const nextLevel = nextMap[currentLevel];
            if (!nextLevel) return settings;
            const options = getMorOptions(nextLevel, settings);
            if (options.length === 1) {
                settings[nextLevel] = options[0];
                return autoSkip(settings, nextLevel);
            }
            return settings;
        };

        const finalSettings = autoSkip(newSettings, level);
        const updated = { ...config, morSettings: finalSettings, isTemplateActive: false };
        setConfig(updated);
        handleAutoSave(updated);
    };
   const [botLiveStatus, setBotLiveStatus] = useState('idle');
    const [liveProgressMsg, setLiveProgressMsg] = useState(''); // חיווי הטקסט שחזר
    const [timeLeft, setTimeLeft] = useState(null);            // הטיימר הסגול (סבב הבא) - חזר למקומו
    const [scanTimeRemaining, setScanTimeRemaining] = useState(null); // הטיימר הטורקיז (סריקה) - חדש

    // טיימר ספירה לאחור לסיום הסריקה (טורקיז) - רץ בנפרד מהטיימר הסגול
    useEffect(() => {
        let timer;
        if (botLiveStatus === 'active' && scanTimeRemaining > 0) {
            timer = setInterval(() => {
                setScanTimeRemaining(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [botLiveStatus, scanTimeRemaining]);
        const hasLoadedInitialConfig = useRef(false);
        useEffect(() => {
            let timer;
            // הטיימר יפעל רק אם הבוט במנוחה, מצב לולאה פעיל, ויש זמן יעד מוגדר בעתיד
            const shouldShowTimer = botLiveStatus === 'idle' && config.runInLoop && config.nextRunTime && config.nextRunTime > Date.now();

            if (shouldShowTimer) {
                const updateTimer = () => {
                    const now = Date.now();
                    const diffSeconds = Math.max(0, Math.floor((config.nextRunTime - now) / 1000));
                    
                    if (diffSeconds <= 0) {
                        setTimeLeft(null);
                        clearInterval(timer);
                    } else {
                        setTimeLeft(diffSeconds);
                    }
                };
                updateTimer();
                timer = setInterval(updateTimer, 1000);
            } else {
                setTimeLeft(null);
            }
            return () => clearInterval(timer);
        }, [botLiveStatus, config.runInLoop, config.nextRunTime]);

        const formatTime = (seconds) => {
            if (seconds === null) return "--:--";
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        };

        useEffect(() => {
            const fetchBotData = async () => {
                try {
                    const response = await fetch(`/api/save-config?t=${new Date().getTime()}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (!hasLoadedInitialConfig.current) {
                            // טוען את הנתונים מהשרת, אך מכריח את סטטוס התבנית להיות כבוי בטעינה ראשונה
                            setConfig(prev => ({ ...prev, ...data, isTemplateActive: false }));
                            hasLoadedInitialConfig.current = true;
                      } else {
                        setConfig(prev => ({ 
                            ...prev, lastFoundDate: data.lastFoundDate || prev.lastFoundDate, 
                            doctorDates: data.doctorDates || prev.doctorDates || {}, 
                            nextRunTime: data.nextRunTime !== undefined ? data.nextRunTime : prev.nextRunTime 
                        }));
                    }
                    setBotLiveStatus(data.botStatus || 'idle');
                    setLiveProgressMsg(data.liveProgress || ''); // משיכת ההודעה מהשרת
                    // עדכון טיימר הסריקה מתוך הנתונים שהגיעו מהשרת
                    if (data.scanTimeRemaining !== undefined) {
                        setScanTimeRemaining(data.scanTimeRemaining);
                    }
                    }
                } catch (error) { console.error("Sync error:", error); }
            };
            
            fetchBotData(); 
            
            // קצב רענון אדפטיבי: 3 שניות בזמן ריצה, 15 שניות בזמן מנוחה/עצירה
            const pollingRate = botLiveStatus === 'active' ? 3000 : 15000;
            const interval = setInterval(fetchBotData, pollingRate); 
            
            return () => clearInterval(interval);
        }, [botLiveStatus]); // ה-useEffect ירוץ מחדש וישנה את הקצב בכל פעם שהסטטוס משתנה

        const handleChange = (e) => { 
        const { name, value } = e.target;
        setConfig(prev => {
            const updated = { ...prev, [name]: value };
            // ביטול סטטוס תבנית אם שונה שדה שאינו קשור לתזמון
            if (!['endDate', 'loopFrequency', 'startTime', 'endTime'].includes(name)) {
                updated.isTemplateActive = false;
                // שמירה שקטה של הביטול לקובץ כדי שהמצב יישמר ברענון
                fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updated, action: 'save_only' }) });
            }
            return updated;
        }); 
    };

        const handleAutoSave = async (updated) => { 
            await fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updated, action: 'save_only' }) }); 
        };

        const handleLoginModeChange = (mode) => {
            const updated = { ...config, loginMode: mode };
            setConfig(updated);
            handleAutoSave(updated);
        };
        
    const [dbSearchResults, setDbSearchResults] = useState([]);
    const [selectedQueueIndex, setSelectedQueueIndex] = useState(0);
    const [bannerDate, setBannerDate] = useState('');

        const searchTemplates = async (query) => {
            // אם השדה ריק, מנקה את התוצאות מיד. אחרת - מחפש החל מהאות הראשונה.
            if (!query || query.trim() === '') { 
                setDbSearchResults([]); 
                return; 
            }
            try {
                const res = await fetch('/api/save-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'search_templates', query })
                });
                const data = await res.json();
                setDbSearchResults(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Search error:", err);
            }
        };

        const saveToDB = async (forceNew = false) => {
            // יצירת תאריך מלא (DD.MM.YYYY) ושעה
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const year = now.getFullYear();
            const datePart = `${day}.${month}.${year}`;
            const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let autoName = "";
            let confirmMessage = "";
            
            // פיצול הלוגיקה: בודקים אם המנוע הנבחר הוא מכון מור
            const isMor = config.activeEngines?.includes('mor_institute');

            if (isMor) {
                // לוגיקה לשמירה והצגת נתונים של מכון מור (שליפה מדורגת של השדה המלא ביותר)
                const searchType = config.morSettings?.targetOrgan || config.morSettings?.subCategory || config.morSettings?.category || config.morSettings?.targetReferral || 'לא הוגדר טקסט לחיפוש';
                const areas = config.morSettings?.areaPriority?.length > 0 ? config.morSettings.areaPriority.join(', ') : 'לא נבחרו אזורים';
                
                autoName = `${config.familyMember || 'ללא שם'} | תז: ${config.userId || ''} | מכון מור | בדיקה: ${searchType} | תאריך: ${datePart} | שעה: ${timePart}`;
                
                confirmMessage = `לשמור תבנית חיפוש למכון מור?\n\n` +
                                `👤 שם: ${config.familyMember || 'ללא שם'}\n` +
                                `💳 תז: ${config.userId || ''}\n` +
                                `📱 נייד (מור): ${config.morSettings?.phonePrefix || '052'}-${config.morSettings?.phoneSuffix || 'לא הוזן'}\n` +
                                `📋 בדיקה: ${searchType}\n` +
                                `📍 אזורים: ${areas}\n` +
                                `📅 תאריך: ${datePart}\n` +
                                `🕒 שעה: ${timePart}`;
            } else {
                // הלוגיקה המקורית עבור שירותי קופ"ח כללית
                const selectedGroupObj = Object.values(CLALIT_GROUPS).find(g => String(g.id) === String(config.selectedGroup));
                const groupName = selectedGroupObj ? selectedGroupObj.name : "כללי";
                const cityName = config.selectedCities.length > 0 
                    ? config.selectedCities.join(', ') 
                    : "לא נבחרה עיר";
                
                let doctorLabelForConfirm = "";
                let doctorLabelForDB = "";
                if (config.selectedDoctors && config.selectedDoctors.length > 0) {
                    if (config.selectedDoctors.length === 1) {
                        const rawDocName = config.selectedDoctorNames?.[0] || "רופא";
                        const cleanDocName = rawDocName.replace(/ד"ר|דר'/g, '').trim();
                        doctorLabelForConfirm = `\n🩺 רופא: ד"ר ${cleanDocName}`;
                        doctorLabelForDB = ` | רופא: ד"ר ${cleanDocName}`;
                    } else {
                        doctorLabelForConfirm = `\n🩺 רופאים: ${config.selectedDoctors.length}`;
                        doctorLabelForDB = ` | רופאים: ${config.selectedDoctors.length}`;
                    }
                }

                autoName = `${config.familyMember || 'ללא שם'} | תז: ${config.userId || ''} | דוא"ל: ${config.email || 'לא הוזן'} | תחום: ${groupName}${doctorLabelForDB} | עיר: ${cityName} | תאריך: ${datePart} | שעה: ${timePart}`;
                
                confirmMessage = `לשמור תבנית חיפוש חדשה לכללית?\n\n` +
                                    `👤 שם: ${config.familyMember || 'ללא שם'}\n` +
                                    `💳 תז: ${config.userId || ''}\n` +
                                    `📧 דוא"ל: ${config.email || 'לא הוזן'}\n` +
                                    `📋 תחום: ${groupName}${doctorLabelForConfirm}\n` +
                                    `📍 עיר: ${cityName}\n` +
                                    `📅 תאריך: ${datePart}\n` +
                                    `🕒 שעה: ${timePart}`;
            }

          // החלטה האם מדובר בעדכון או שמירה חדשה (forceNew מאלץ יצירת תבנית חדשה)
            const isUpdateAction = config.loadedTemplateId && !forceNew;
            const actionType = isUpdateAction ? 'update_template' : 'save_template_to_db';
            const finalConfirmMsg = isUpdateAction ? "האם לעדכן את התבנית הקיימת בנתונים החדשים?" : confirmMessage;

            if (!confirm(finalConfirmMsg)) return;

    try {
                // יצירת עותק נקי של ההגדרות עבור מסד הנתונים בלבד
                const cleanConfigForDB = { ...config };
                delete cleanConfigForDB.lastFoundDate;
                delete cleanConfigForDB.lastBestFound; // חיסול משתנה הרפאים של שם הרופאה
                delete cleanConfigForDB.doctorDates;
                if (forceNew) delete cleanConfigForDB.loadedTemplateId; // מחיקת מזהה ישן אם שומרים כחדש

                // שליחה שקטה למסד הנתונים ללא הפעלת הבוט
                const res = await fetch('/api/save-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: actionType,
                        templateId: isUpdateAction ? config.loadedTemplateId : undefined, // יישלח רק אם מדובר בעדכון
                        data: { 
                            ...cleanConfigForDB, 
                            templateName: autoName,
                            saveDate: datePart,
                            saveTime: timePart
                        } 
                    })
                });
                
                if (res.ok) {
                    alert("✅ התבנית נשמרה בהצלחה!");
                    
                    // 1. מסמנים שהתבנית פעילה, ומעלים את הבאנר הצהוב ותאריכי הרופאים מהמסך
                    const updatedConfig = { ...config, lastFoundDate: '', doctorDates: {}, isTemplateActive: true };
                    
                    // אם שמרנו תבנית חדשה, נאפס את ה-ID כדי לא לדרוס את הקודמת
                    if (forceNew) updatedConfig.loadedTemplateId = null;
                    
                    setConfig(updatedConfig);
                    handleAutoSave(updatedConfig); // שומרים את הסטטוס הפעיל גם לקובץ
                    
                    // 2. מנקה את התור מהקובץ החי בשרת בשקט (בדיוק כמו כפתור ה-X) כדי שלא יחזור ברענון
                    await fetch('/api/save-config', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ 
                            action: 'reset_last_found',
                            userId: config.userId,
                            selectedGroup: config.selectedGroup
                        }) 
                    });
                }
            } catch (err) {
                console.error("Save error:", err);
                alert("❌ שגיאה בשמירה ל-DB");
            }
        };
        const handleResetLastFound = async () => {
            if (!confirm("האם לאפס את התור האחרון שנמצא? (זה ימחק את התור גם מה-Database)")) return;
            
            // הכנת האובייקט לאיפוס כולל מזהים עבור ה-DB
            const resetData = { 
                action: 'reset_last_found',
                userId: config.userId,
                selectedGroup: config.selectedGroup
            };

            // עדכון מקומי של ה-UI
            setConfig(prev => ({ ...prev, lastFoundDate: '', doctorDates: {} }));
            
            try {
                await fetch('/api/save-config', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(resetData) 
                });
            } catch (err) { 
                console.error("Reset error:", err); 
            }
        };
        const handleCitiesChange = (newCities) => {
        const updated = { ...config, selectedCities: newCities, selectedDoctors: [], selectedDoctorNames: [], isTemplateActive: false };
        setConfig(updated); handleAutoSave(updated);
    };

    const handleDoctorsChange = (newDoctors) => {
        const names = newDoctors.map(docId => {
            for (const db of Object.values(DOCTORS_DATABASE)) {
                const found = db.find(d => (d.key || d.id) === docId);
                if (found) return found.label.split('|')[0].trim();
            }
            return docId;
        });
        
        const updated = { ...config, selectedDoctors: newDoctors, selectedDoctorNames: names, isTemplateActive: false };
        setConfig(updated); handleAutoSave(updated);
    };

        const handleRun = async (isSingle = false) => {
    // מאפשר הפעלה אם יש תבנית פעילה או אם התור מכיל תבניות
    const hasQueue = config.templateQueue && config.templateQueue.length > 0;
    if (!config.isTemplateActive && !hasQueue) {
        alert("⚠️ עצור! יש לבחור תבניות לתור הסריקה או לטעון תבנית בודדת לפני ההפעלה.");
        return;
    }

            // איפוס nextRunTime כדי למנוע הופעת טיימר מהסבב הקודם מיד עם הלחיצה
            const updated = { ...config, runInLoop: !isSingle, nextRunTime: null };
            
            // הגנה: מחיקת פקודות תקועות מהזיכרון כדי שהשרת יריץ ולא יעצור
            delete updated.action; 
            
            try {
                const res = await fetch('/api/save-config', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(updated) 
                });
                
                if (res.ok) { 
                    setConfig(updated); 
                    setBotLiveStatus(isSingle ? 'idle' : 'active');
                    // איפוס מקומי של הטיימר בתצוגה כדי להעלימו מהמסך מיד
                    setTimeLeft(null); 
                }
            } catch (err) {
                console.error("Run error:", err);
            }
        };

        const deleteTemplate = async (e, id) => {
            e.stopPropagation();
            if (!confirm("האם אתה בטוח שברצונך למחוק את התבנית?")) return;
            try {
                const res = await fetch('/api/save-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_template', id })
                });
                if (res.ok) {
                    setDbSearchResults(prev => prev.filter(t => t._id !== id));
                    
                  // אם מחקנו את התבנית שטעונה כרגע - מאפסים את הזיכרון שלה לגמרי
                    if (config.loadedTemplateId === id) {
                        setConfig(prev => ({
                            ...prev,
                            isTemplateActive: false,
                            loadedTemplateId: null
                        }));
                    }
                }
            } catch (err) {
                console.error("Delete error:", err);
            }
        };

        const handleStop = async () => {
            const updated = { ...config, runInLoop: false };
            // חשוב: לא שומרים את פקודת העצירה בזיכרון של הממשק
            delete updated.action; 
            setConfig(updated);
            setBotLiveStatus('idle');
            setTimeLeft(null);
            setLiveProgressMsg('🛑 עצרתי הכל'); // עדכון מיידי של התצוגה במסך
            
            await fetch('/api/save-config', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                // מוסיפים את העצירה רק נקודתית לשליחה לשרת
                body: JSON.stringify({ ...updated, action: 'stop' }) 
            });
        };

        const getDoctorsList = () => {
            if (!config.selectedGroup || !config.selectedSpecialization) return [];
            const specs = CLALIT_SPECIALIZATIONS[config.selectedGroup];
            const spec = Object.values(specs || {}).find(s => String(s.id) === String(config.selectedSpecialization));
            if (!spec) return [];
            const matchedKey = Object.keys(DOCTORS_DATABASE).find(key => spec.name.includes(key));
            let list = matchedKey ? DOCTORS_DATABASE[matchedKey] : [];
            
            if (config.insuranceType === 'כללית') list = list.filter(d => d.serviceType === 'כללית');
            else if (config.insuranceType === 'מושלם') list = list.filter(d => d.serviceType === 'מושלם');
            if (config.selectedCities?.length > 0) list = list.filter(d => config.selectedCities.some(city => d.label.includes(city)));
            
            return list.map(doc => {
                const parts = doc.label.split('|').map(p => p.trim());
                const name = parts[0];
                const service = doc.serviceType || '';
                
                // תיקון חילוץ עיר: במושלם העיר נמצאת לרוב בסוף שם המרפאה בחלק ה-3
                let city = parts[1]; 
                if ((service === 'מושלם' || service === 'כללית') && parts[2]) {
                    const clinicParts = parts[2].split('-');
                    if (clinicParts.length > 1) {
                        city = clinicParts[clinicParts.length - 1].trim();
                    }
                }
                
                return { 
                    ...doc, 
                    shortLabel: `${name} (${city} - ${service})`
                };
            });
        };

    const [showPassword, setShowPassword] = useState(false);
    const isSmsMode = config.loginMode === 'sms';    
        const isLoopActive   = botLiveStatus === 'active' && config.runInLoop;
        const isSingleActive = botLiveStatus === 'active' && !config.runInLoop;
        const isWaiting      = botLiveStatus === 'idle' && timeLeft !== null && timeLeft > 0;
        
        // מוכן לריצה אם יש תבנית בודדת פעילה או אם יש תבניות בתור הסריקה
const isReadyToRun = Boolean(config.isTemplateActive) || (config.templateQueue && config.templateQueue.length > 0);
        return (
            <div className="h-screen bg-gray-50 flex flex-col overflow-hidden font-sans">
                <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fbfa]">
                    {/* 3 Columns Section (Dynamic Grid: 4 columns when queue is active to prevent wrapping) */}
                    <div className={`grid grid-cols-1 border-b border-gray-200 bg-white shrink-0 items-start ${config.templateQueue?.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                        
                        {/* Column 1: Connection (Right) */}
                        <div className="p-3 border-l border-gray-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-right">
                                    <h1 className="text-2xl font-black text-[#005a4c] leading-none">צייד התורים</h1>
                                    <p className="text-[#00a896] text-xs font-bold leading-tight">סריקה חכמה ללקוחות כללית</p>
                                </div>
                               {((config.templateQueue?.length > 0 ? bannerDate : config.lastFoundDate)) && (
                                    <div className="bg-amber-50 rounded-xl border-2 border-amber-200 py-1.5 px-3 shadow-sm max-w-[480px] relative group">
                                        <button 
                                            onClick={handleResetLastFound}
                                            className="absolute -left-2 -top-2 bg-amber-200 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-amber-300 hover:bg-amber-300 z-10"
                                            title="איפוס תור אחרון"
                                        >
                                            ✕
                                        </button>
                                    {/* בדיקה גמישה יותר - האם יש HTML או שמדובר בשגיאת הפניה */}
    {(() => {
        const activeDateStr = config.templateQueue?.length > 0 ? bannerDate : config.lastFoundDate;
        if (!activeDateStr) return null;
        if (activeDateStr.includes('<span') || activeDateStr.includes('חסרה הפניה')) {
            return <div className="text-lg font-black leading-tight py-1 text-right" dangerouslySetInnerHTML={{ __html: activeDateStr }} />;
        }
        return (
            <>
                <div className="flex items-center gap-2 border-b border-amber-200 mb-1 pb-1">
                    <span className="text-lg font-black text-[#004e7c] uppercase whitespace-nowrap">
                        {config.templateQueue?.length > 0 ? `תור של ${config.templateQueue[selectedQueueIndex]?.familyMember || ''}:` : 'התור המוקדם ביותר:'}
                    </span>
                    <span className="text-xl font-black text-amber-900 leading-none">
                        {activeDateStr.split('-')[0].trim()}
                    </span>
                </div>
                <p className="text-base font-bold text-amber-800 leading-snug text-right whitespace-normal break-words mt-1">
                    {activeDateStr.split('-').slice(1).join('-').trim()}
                </p>
            </>
        );
    })()}
                                            <div 
                                                className="text-lg font-black leading-tight py-1 text-right"
                                                dangerouslySetInnerHTML={{ __html: config.lastFoundDate }}
                                            />
                                        
                                    </div>
                                )}
                            </div>

                            {/* העלמה במצב קבוצה */}
                            <section className={`bg-blue-50/40 border-2 border-blue-100 rounded-2xl p-3 shadow-sm flex flex-col ${config.templateQueue?.length > 0 ? 'hidden' : ''}`}>
                                <h2 className="text-2xl font-black text-blue-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> פרטי התחברות
                                </h2>

                                {/* Login Mode Tabs */}
                                <div className="flex rounded-xl overflow-hidden border border-blue-200 mb-3 text-base font-bold">
                                    <button
                                        onClick={() => handleLoginModeChange('password')}
                                        className={`flex-1 py-1.5 text-center transition-all ${!isSmsMode ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                    >
                                        קוד משתמש וסיסמה
                                    </button>
                                    <button
                                        onClick={() => handleLoginModeChange('sms')}
                                        className={`flex-1 py-1.5 text-center transition-all border-r border-blue-200 ${isSmsMode ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                    >
                                        📱 קוד חד-פעמי
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                {/* ת"ז של בעל החשבון הראשי */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">ת"ז (ראשי)</label>
                                        <input 
                                            type="text" 
                                            name="userId" 
                                            value={config.userId} 
                                            onChange={handleChange} 
                                            placeholder='ת"ז של בעל המנוי'
                                            className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" 
                                        />
                                    </div>

                                    {/* שדות סיסמה – מוצגים רק במצב password */}
                                    {!isSmsMode && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">קוד</label>
                                                <input type="text" name="userCode" value={config.userCode} onChange={handleChange} className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">סיסמה</label>
                                                <div className="flex-1 relative">
                                                    <input type={showPassword ? "text" : "password"} name="password" value={config.password} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white pr-3 pl-8" />
                                                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
                                                        {showPassword ? "🙈" : "👁️"}
                                                    </button>
                                                </div>                                        
                                            </div>
                                        </>
                                    )}

                                    {/* הודעת SMS – מוצגת רק במצב sms כשהבוט פעיל */}
                                    {isSmsMode && botLiveStatus === 'active' && (
                                        <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-xl px-3 py-2 text-blue-800 font-bold text-base">
                                            <span className="animate-pulse text-xl">📱</span>
                                            <span>קוד נשלח לנייד – הזן אותו בדפדפן</span>
                                        </div>
                                    )}

                                    {/* שם פרטי - מופיע תמיד */}
<div className="flex items-center gap-2">
    <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">שם פרטי</label>
    <input 
        type="text" 
        name="familyMember" 
        value={config.familyMember} 
        onChange={handleChange} 
        placeholder='למעבר תיק (למשל: נועה)'
        className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" 
    />
</div>

{/* טלפון נייד למכון מור - סידור מעודכן עם נעילת תבנית */}
{config.activeEngines?.includes('mor_institute') && (
    <div className="flex items-center gap-2 bg-amber-50/50 p-2 rounded-xl border border-amber-100 mt-1">
        <label className="text-base font-bold text-amber-700 w-24 shrink-0 text-left">נייד (מור)</label>
        <div className="flex flex-1 gap-1 flex-row-reverse">
            <select 
                value={config.morSettings?.phonePrefix || "052"} 
                onChange={(e) => {
                    const updated = {...config, morSettings: {...config.morSettings, phonePrefix: e.target.value}, isTemplateActive: false};
                    setConfig(updated); handleAutoSave(updated);
                }}
                className="w-20 px-1 py-1.5 border border-amber-200 rounded-lg font-bold text-lg outline-none bg-white text-center"
            >
                {["050", "052", "053", "054", "055", "058"].map(p => <option key={p}>{p}</option>)}
            </select>
            <input 
                type="text" 
                maxLength="7"
                dir="ltr" 
                placeholder="7 ספרות"
                value={config.morSettings?.phoneSuffix || ""} 
                onChange={(e) => {
                    const updated = {...config, morSettings: {...config.morSettings, phoneSuffix: e.target.value.replace(/\D/g, '')}, isTemplateActive: false};
                    setConfig(updated); handleAutoSave(updated);
                }}
                className="flex-1 px-3 py-1.5 border border-amber-200 rounded-lg font-bold text-lg outline-none bg-white text-right"
            />
        </div>
    </div>
)}
                            {/* שדה אימייל */}
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">אימייל</label>
                                        <input type="email" name="email" value={config.email} onChange={handleChange} dir="ltr" className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white text-right placeholder:text-right" placeholder="example@email.com" />
                                    </div>
                                </div>
                            </section>
                            
                            {/* אזור החיפוש נשאר גלוי תמיד כדי לאפשר הוספת תבניות לקבוצה */}
                            <div className="mt-3 bg-gray-100/50 border border-gray-200 rounded-2xl p-2 space-y-1.5 flex-1 flex flex-col">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="🔍 חפש תבנית..."
                                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 focus:border-[#00a896] outline-none text-lg font-bold"
                                        onChange={(e) => searchTemplates(e.target.value)}
                                    />
                                    {dbSearchResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[450px] overflow-y-auto">
                                        {dbSearchResults.map(t => {
                                            // --- 1. טיפול בקבוצת סריקה (תיקייה) ---
                                            if (t.itemType === 'group') {
                                                return (
                                                    <div 
                                                        key={t._id} 
                                                        className="p-3 hover:bg-purple-50 cursor-pointer border-b border-purple-100 last:border-0 group flex items-center justify-between"
                                                        dir="rtl"
                                                        onClick={() => {
                                                            const updatedConfig = { 
                                                                ...config, 
                                                                templateQueue: [...t.templates], // טוען את כל הקבוצה
                                                                isTemplateActive: false,
                                                                loadedTemplateId: null
                                                            };
                                                                setConfig(updatedConfig);
                                                                handleAutoSave(updatedConfig);
                                                                setSelectedQueueIndex(0);
                                                                setBannerDate(t.templates?.[0]?.lastBestFound || '');
                                                                setDbSearchResults([]);
                                                                            }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-3xl drop-shadow-sm">📁</span>
                                                            <div>
                                                                <h4 className="text-lg font-black text-purple-900">{t.groupName}</h4>
                                                                <p className="text-sm text-purple-600 font-bold">{t.templates ? t.templates.length : 0} תבניות בקבוצה</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm">טען קבוצה</span>
                                                            <button onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if(confirm("למחוק את הקבוצה ממסד הנתונים?")) {
                                                                    await fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_template', id: t._id, isGroup: true }) });
                                                                    setDbSearchResults(prev => prev.filter(item => item._id !== t._id));
                                                                }
                                                            }} className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-opacity">🗑️</button>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // --- 2. טיפול בתבנית בודדת ---
                                            const groupMatch = t.templateName?.match(/תחום:\s*([^|]+)/);
                                            const groupLabel = groupMatch ? groupMatch[1].trim() : "";
                                            const morTestType = t.morSettings?.targetOrgan || t.morSettings?.subCategory || t.morSettings?.category || t.morSettings?.targetReferral;
                                            
                                            // חילוץ שם המקצוע המדויק מהקבוצה הנבחרת
                                            const specName = t.selectedSpecialization && CLALIT_SPECIALIZATIONS[t.selectedGroup]
                                                ? Object.values(CLALIT_SPECIALIZATIONS[t.selectedGroup]).find(s => String(s.id) === String(t.selectedSpecialization))?.name
                                                : "";

                                            // ניקוי השורה השנייה (finalInfo) מכפילויות
                                            let infoContent = t.templateName || "";
                                            [t.familyMember, t.userId, groupLabel, specName, morTestType, "מכון מור", "רפואה יועצת", "בתי חולים"].forEach(term => {
                                                if (term) infoContent = infoContent.replace(new RegExp(term, 'g'), '');
                                            });

                                            let finalInfo = infoContent
                                                .replace(/תחום:|בדיקה:|רופא:|עיר:|תאריך:|שעה:|אזורים:/g, '')
                                                .replace(/\|/g, ' • ')
                                                .replace(/\s*•\s*•\s*/g, ' • ')
                                                .replace(/^\s*•\s*|\s*•\s*$/g, '')
                                                .trim();
                                            
                                            return (
                                                <div 
                                                    key={t._id} 
                                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 group flex flex-col gap-2 text-right transition-colors"
                                                    dir="rtl"
                                                    onClick={() => { 
                                                        const { _id, __v, updatedAt, templateName, saveDate, saveTime, itemType, ...cleanData } = t;
                                                        const newFoundDate = cleanData.lastBestFound || cleanData.lastFoundDate || '';
                                                        cleanData.lastFoundDate = newFoundDate;
                                                        
                                                        if (newFoundDate && newFoundDate.includes('-')) {
                                                            const parts = newFoundDate.split('-');
                                                            const datePart = parts[0].trim();
                                                            const docPart = parts[1].split('(')[0].trim();
                                                            cleanData.doctorDates = {};
                                                            cleanData.doctorDates[docPart] = datePart;
                                                        } else {
                                                            cleanData.doctorDates = {}; 
                                                        }

                                                        const updatedConfig = { ...config, ...cleanData, activeEngines: cleanData.activeEngines || ['clalit_specialist'], isTemplateActive: true, loadedTemplateId: _id, templateQueue: [] }; 
                                                        setConfig(updatedConfig); handleAutoSave(updatedConfig); setDbSearchResults([]);
                                                    }}
                                                >
                                                    {/* שורה 1: צ'יפים ותגים */}
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">👤</span>
                                                                <span className="text-xl font-black text-blue-900">{t.familyMember}</span>
                                                            </div>
                                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-black text-[13px] shadow-sm
                                                                ${t.activeEngines?.includes('mor_institute') ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                                                                t.activeEngines?.includes('clalit_hospital') ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 
                                                                'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                                                <span>{t.activeEngines?.includes('mor_institute') ? '🧪 מור' : t.activeEngines?.includes('clalit_hospital') ? '🏥 בי"ח' : '🌐 כללית'}</span>
                                                            </div>
                                                            {(groupLabel || morTestType) && (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border bg-gray-50 border-gray-200 text-gray-700 shadow-sm text-[13px] font-black">
                                                                    <span>{morTestType || groupLabel}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={(e) => deleteTemplate(e, t._id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-opacity">🗑️</button>
                                                    </div>

                                                    {/* שורה 2: מידע משלים (ערים, רופאים, תאריכי שמירה) */}
                                                    {finalInfo && (
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-sm mt-0.5 opacity-70">📍</span>
                                                            <p className="text-[15px] font-bold text-gray-700 leading-tight">
                                                                {finalInfo}
                                                                {t.saveDate && <span className="text-[11px] text-gray-400 font-medium mr-2">({t.saveDate} {t.saveTime})</span>}
                                                            </p>
                                                        </div>
                                                    )}
                                                    
                                                    {/* שורה 3: כפתורי פעולה נפרדים לכל תבנית בודדת */}
                                                    <div className="flex gap-2 w-full mt-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); addToQueue(t); }}
                                                            className="flex-1 bg-purple-100 text-purple-700 hover:bg-purple-200 py-1.5 rounded-lg font-bold text-sm transition-colors border border-purple-200"
                                                        >
                                                            ➕ הוסף לקבוצת סריקה
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                const { _id, __v, updatedAt, templateName, saveDate, saveTime, itemType, ...cleanData } = t;
                                                                const newFoundDate = cleanData.lastBestFound || cleanData.lastFoundDate || '';
                                                                cleanData.lastFoundDate = newFoundDate;
                                                                
                                                                if (newFoundDate && newFoundDate.includes('-')) {
                                                                    const parts = newFoundDate.split('-');
                                                                    const datePart = parts[0].trim();
                                                                    const docPart = parts[1].split('(')[0].trim();
                                                                    cleanData.doctorDates = {};
                                                                    cleanData.doctorDates[docPart] = datePart;
                                                                } else {
                                                                    cleanData.doctorDates = {}; 
                                                                }

                                                                const updatedConfig = { ...config, ...cleanData, activeEngines: cleanData.activeEngines || ['clalit_specialist'], isTemplateActive: true, loadedTemplateId: _id, templateQueue: [] }; 
                                                                setConfig(updatedConfig); handleAutoSave(updatedConfig); setDbSearchResults([]);
                                                            }}
                                                            className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 py-1.5 rounded-lg font-bold text-sm transition-colors border border-blue-200"
                                                        >
                                                            ✏️ ערוך תבנית
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if(confirm("לנקות את כל השדות ולנעול את החיפוש?")) {
                                                const clearedConfig = {
                                                    userId: '', userCode: '', password: '', familyMember: '', email: '',
                                                    loginMode: 'password', selectedCities: [], includeSurrounding: true,
                                                    selectedDoctors: [], selectedGroup: '', selectedSpecialization: '',
                                                    insuranceType: 'הכל', endDate: '', runInLoop: false, loopFrequency: "10-15",
                                                    startTime: '08:00', endTime: '22:00', lastFoundDate: '', doctorDates: {},
                                                    morSettings: {}, // איפוס גם להגדרות מור
                                                    activeEngines: ['clalit_specialist'],
                                                    isTemplateActive: false,
                                                    loadedTemplateId: null // הפקודה שמשחררת את כפתור ה"עדכן תבנית"
                                                };
                                                setConfig(clearedConfig);
                                                handleAutoSave(clearedConfig);
                                            }
                                        }}
                                        className="w-1/3 bg-gray-200 text-gray-600 py-1.5 rounded-xl font-black text-lg hover:bg-gray-300 transition-all shadow-sm active:scale-95"
                                        title="נקה טופס"
                                    >
                                        🧹 נקה
                                    </button>
                                   {config.loadedTemplateId ? (
                                        <div className="flex w-2/3 gap-2">
                                            <button 
                                                onClick={() => saveToDB(true)}
                                                className="w-1/2 text-white py-1.5 rounded-xl font-black text-lg transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 bg-[#00a896] hover:bg-[#008f80]"
                                                title="שמור את השינויים כתבנית חדשה לגמרי"
                                            >
                                                ➕ צור תבנית
                                            </button>
                                            <button 
                                                onClick={() => saveToDB(false)}
                                                className="w-1/2 text-white py-1.5 rounded-xl font-black text-lg transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600"
                                                title="עדכן ודרוס את התבנית הנוכחית"
                                            >
                                                🆙 עדכן תבנית
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => saveToDB(false)}
                                            className="w-2/3 text-white py-1.5 rounded-xl font-black text-lg transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 bg-[#00a896] hover:bg-[#008f80]"
                                        >
                                            💾 שמור תבנית חיפוש
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                       {/* Column 2: Search Settings (Center) - Dynamic Span */}
<div className={`p-3 border-l border-gray-100 flex flex-col gap-2 ${config.templateQueue?.length > 0 ? 'col-span-1 lg:col-span-2' : ''}`}>
    
    {/* UI של קבוצת סריקה (מוצג רק כשיש תבניות בתור, ומתפרס על העמודות המוסתרות) */}
    {config.templateQueue && config.templateQueue.length > 0 && (
        <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200 shadow-inner flex-1 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 border-b border-purple-200/60 pb-3">
                <label className="text-2xl font-black text-purple-900 flex items-center gap-3">
                    <span className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-sm"></span>
                    קבוצת סריקה פעילה ({config.templateQueue.length})
                </label>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            if(confirm("לנקות את קבוצת הסריקה?")) {
                                const updated = {...config, templateQueue: []};
                                setConfig(updated); handleAutoSave(updated);
                            }
                        }}
                        className="text-purple-600 hover:text-red-500 font-bold text-sm underline underline-offset-4"
                    >
                        נקה קבוצה
                    </button>
                    <button 
                        onClick={saveCurrentQueue}
                        className="bg-purple-600 text-white px-4 py-2 rounded-xl font-black hover:bg-purple-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                        <span>💾</span> שמור קבוצה ל-DB
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                {config.templateQueue.map((t, index) => (
                    <div 
                    key={t._id} 
                    onClick={() => {
                        setSelectedQueueIndex(index);
                        setBannerDate(t.lastBestFound || '');
                    }}
                    className={`bg-white p-3 rounded-2xl border-2 shadow-sm relative group flex flex-col gap-2 cursor-pointer transition-all
                        ${selectedQueueIndex === index ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30' : 'border-purple-100 hover:border-purple-300'}`}
                >
                        <div className="flex items-center justify-between border-b border-purple-100/50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-black shadow-sm">{index + 1}</div>
                                <span className="text-lg font-black text-gray-800">{t.familyMember || 'ראשי'}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); removeFromQueue(t._id); }} className="text-gray-300 hover:text-red-500 transition-colors font-black text-lg bg-gray-50 hover:bg-red-50 w-7 h-7 flex items-center justify-center rounded-full">✕</button>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 text-[13px] font-bold text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-purple-500 text-xs whitespace-nowrap">מנוע/תחום:</span> 
                                <span className="text-right text-gray-800 leading-tight flex-1">
                                    {t.activeEngines?.includes('mor_institute') ? '🧪 מור' : t.activeEngines?.includes('clalit_hospital') ? '🏥 בי"ח' : '🌐 יועצת'} • {t.activeEngines?.includes('mor_institute') ? (t.morSettings?.targetOrgan || t.morSettings?.subCategory || 'מכון מור') : (t.templateName?.includes('תחום:') ? t.templateName.split('תחום:')[1].split('|')[0].trim() : 'כללי')}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-start gap-2 border-t border-gray-200/60 pt-1.5">
                                <span className="text-purple-500 text-xs whitespace-nowrap">ביטוח:</span> 
                                <span className="text-right text-gray-800 flex-1">{t.activeEngines?.includes('mor_institute') ? (t.morSettings?.insuranceType || 'כללית') : (t.insuranceType || 'הכל')}</span>
                            </div>
                            
                            {(t.selectedCities?.length > 0 || t.morSettings?.areaPriority?.length > 0) && (
                                <div className="flex justify-between items-start gap-2 border-t border-gray-200/60 pt-1.5">
                                    <span className="text-purple-500 text-xs whitespace-nowrap">אזורים:</span> 
                                    <span className="text-right text-gray-800 leading-tight flex-1">
                                        {t.activeEngines?.includes('mor_institute') ? t.morSettings?.areaPriority?.join(', ') : t.selectedCities?.join(', ')}
                                    </span>
                                </div>
                            )}
                            
                            {(!t.activeEngines?.includes('mor_institute') && t.selectedDoctorNames?.length > 0) && (
                                <div className="flex justify-between items-start gap-2 border-t border-gray-200/60 pt-1.5">
                                    <span className="text-purple-500 text-xs whitespace-nowrap">רופאים:</span> 
                                    <span className="text-right text-gray-800 leading-tight flex-1 line-clamp-2" title={t.selectedDoctorNames.join(', ')}>
                                        {t.selectedDoctorNames.join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {t.lastBestFound && (
                            <div className="mt-auto flex items-center justify-between bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100">
                                <span className="text-xs font-black text-amber-700">תור מוקדם:</span>
                                <span className="text-sm font-black text-amber-900">{t.lastBestFound.split('-')[0].trim()}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* הנחיה להוספה */}
            <div className="mt-auto pt-3 text-center">
                <p className="text-sm text-purple-600 font-bold">כדי להוסיף תבניות נוספות, חפש אותן בשורת החיפוש מימין ולחץ על "➕ הוסף לקבוצת סריקה".</p>
            </div>
        </div>
    )}

    {/* הטפסים הרגילים של עמודה 2 (מוסתרים לחלוטין כשיש קבוצה פעילה) */}
    <section className={`bg-teal-50/40 border-2 border-teal-100 rounded-2xl p-3 shadow-sm ${config.templateQueue?.length > 0 ? 'hidden' : ''}`}>
        
        <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-teal-100 shadow-sm">
                                  {[
    { id: 'clalit_specialist', label: 'רפואה יועצת', icon: '🩺' },
    { id: 'clalit_hospital', label: 'בתי חולים (בדיקות)', icon: '🏥' },
    { id: 'mor_institute', label: 'מכון מור', icon: '🧪' }
].map(engine => {
    // התאמה מדויקת ל-State: מסומן רק אם הוא באמת נמצא במערך
    const isChecked = config.activeEngines?.includes(engine.id);

    return (
        <label key={engine.id} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg transition-all border-2 ${isChecked ? 'bg-teal-50 border-teal-400 shadow-sm' : 'bg-white border-transparent opacity-60 hover:opacity-100'}`}>
            <input 
                type="checkbox" 
                checked={!!isChecked} 
                onChange={() => {
                    let newEngines;
                    if (isChecked) {
                        newEngines = config.activeEngines.filter(id => id !== engine.id);
                    } else {
                        newEngines = [engine.id]; 
                    }

                   const updated = { 
                        ...config, 
                        activeEngines: newEngines,
                        selectedGroup: isChecked ? config.selectedGroup : '', 
                        selectedSpecialization: isChecked ? config.selectedSpecialization : '',
                        isTemplateActive: false,
                        loadedTemplateId: null // מאפסים את ה-ID בעת החלפת מנוע כדי למנוע שמירה צולבת
                    };
                    
                    setConfig(updated);
                    handleAutoSave(updated);
                }}
                className="w-5 h-5 accent-[#00a896]" 
            />
            {/* הטקסט הוגדל כאן ל-text-lg */}
            <span className={`text-lg font-black ${isChecked ? 'text-teal-900' : 'text-gray-500'}`}>
                {engine.icon} {engine.label}
            </span>
        </label>
    );
})}
                                </div>
                                </div>

                                <div className="space-y-2">
                                {!config.activeEngines?.includes('mor_institute') && (
                                    <>
                                        {/* תפריט רמה 1: תחום / סוג בדיקה */}
                                        <div className="space-y-0.5">
                                            <label className="text-base font-bold text-gray-500 pr-1">
                                                {config.activeEngines?.includes('clalit_hospital') ? 'סוג בדיקה (MRI, CT, US)' : 'תחום'}
                                            </label>
                                            <MultiSelectDropdown 
                                                options={config.activeEngines?.includes('clalit_hospital')
                                                    ? Object.values(HOSPITAL_TEST_TYPES).map(g => ({ id: String(g.id), label: g.name }))
                                                    : Object.values(CLALIT_GROUPS).map(g => ({ id: String(g.id), label: g.name }))
                                                } 
                                                selected={config.selectedGroup ? [String(config.selectedGroup)] : []} 
                                                onChange={(val) => {
                                                    const groupId = val[0];
                                                    let firstSpec = '';
                                                    
                                                    // קביעת ערך ברירת מחדל לתת-התפריט לפי סוג המנוע
                                                    if (config.activeEngines?.includes('clalit_hospital')) {
                                                        firstSpec = HOSPITAL_TARGET_ORGANS[groupId]?.[0]?.id || '';
                                                    } else {
                                                        firstSpec = CLALIT_SPECIALIZATIONS[groupId]?.[0]?.id || '';
                                                    }

                                                    const updated = {
                                                        ...config, 
                                                        selectedGroup: groupId, 
                                                        selectedSpecialization: String(firstSpec), 
                                                        selectedDoctors: [],
                                                        selectedDoctorNames: [],
                                                        isTemplateActive: false // ביטול הסטטוס הפעיל
                                                    };
                                                    setConfig(updated);
                                                    handleAutoSave(updated); // שומר ברקע כדי שהכפתורים יינעלו גם אחרי רענון
                                                }}
                                                placeholder={config.activeEngines?.includes('clalit_hospital') ? "בחר סוג בדיקה..." : "בחר תחום..."}
                                                isObject 
                                                isMulti={false} 
                                                focusClass="focus:ring-[#00a896]" 
                                            />
                                        </div>

                                        {/* תפריט רמה 2: מקצוע / איבר מטרה */}
                                        <div className="space-y-0.5">
                                            <label className="text-base font-bold text-gray-500 pr-1">
                                                {config.activeEngines?.includes('clalit_hospital') ? 'איבר מטרה' : 'מקצוע'}
                                            </label>
                                            <MultiSelectDropdown 
                                                options={config.activeEngines?.includes('clalit_hospital')
                                                    ? (HOSPITAL_TARGET_ORGANS[config.selectedGroup] ? Object.values(HOSPITAL_TARGET_ORGANS[config.selectedGroup]).map(s => ({ id: String(s.id), label: s.name })) : [])
                                                    : (CLALIT_SPECIALIZATIONS[config.selectedGroup] ? Object.values(CLALIT_SPECIALIZATIONS[config.selectedGroup]).map(s => ({ id: String(s.id), label: s.name })) : [])
                                                } 
                                                selected={config.selectedSpecialization ? [String(config.selectedSpecialization)] : []} 
                                                onChange={(val) => {
                                                    const updated = {...config, selectedSpecialization: val[0], selectedDoctors: [], selectedDoctorNames: [], isTemplateActive: false};
                                                    setConfig(updated);
                                                    handleAutoSave(updated);
                                                }}
                                                placeholder={config.activeEngines?.includes('clalit_hospital') ? "בחר איבר מטרה..." : "בחר מקצוע..."}
                                               isObject 
                                            isMulti={false} 
                                            focusClass="focus:ring-[#00a896]" 
                                        />
                                        </div>

                                        {/* ערים לסריקה */}
                                        <div className="space-y-0.5">
                                            <label className="text-base font-bold text-gray-500 pr-1">ערים לסריקה</label>
                                            <MultiSelectDropdown 
                                                options={AVAILABLE_CITIES} 
                                                selected={config.selectedCities} 
                                                onChange={handleCitiesChange} 
                                                placeholder="בחר ערים לסריקה..." 
                                                isObject 
                                                focusClass="focus:ring-[#00a896]" 
                                            />
                                        </div>
                                    </>
                                )}

                                  {config.activeEngines?.includes('mor_institute') ? (
        <div className="space-y-3">
            {/* ניווט מסלול חכם - מור */}
            <div className="space-y-3 bg-amber-50/30 p-3 rounded-2xl border border-amber-100 mt-2 shadow-inner">
                
                {/* שדה זיהוי מדויק */}
                <div className="space-y-1 mb-3 border-b border-amber-200/60 pb-4">
                    <label className="text-base font-black text-amber-900 pr-1 opacity-90">טקסט ההפניה (לזיהוי מדויק בדף הבית)</label>
                    <input 
                        type="text"
                        value={config.morSettings?.targetReferral || ""}
                        onChange={(e) => {
                            const updated = {...config, morSettings: {...config.morSettings, targetReferral: e.target.value}, isTemplateActive: false};
                            setConfig(updated); handleAutoSave(updated);
                        }}
                        placeholder="למשל: א.ס דופלקס או מבחן מאמץ..."
                        className="w-full px-3 py-2 text-lg font-bold border-2 border-white rounded-xl shadow-sm outline-none focus:border-amber-400 bg-white"
                    />
                </div>

                {/* גריד של 2 עמודות עבור התפריטים */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-base font-black text-amber-900 pr-1 opacity-90">1. סוג ביטוח / משלם</label>
                        <select 
                            value={config.morSettings?.insuranceType || "כללית"}
                            onChange={(e) => handleMorPathChange('insuranceType', e.target.value)}
                            className="w-full px-3 py-2 text-lg font-bold border-2 border-white rounded-xl shadow-sm outline-none focus:border-amber-400 bg-white"
                        >
                            <option>כללית</option>
                            <option>כללית פלטינום או מושלם</option>
                            <option>לקוח פרטי</option>
                        </select>
                    </div>

                    {getMorOptions('category', config.morSettings).length > 0 && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                            <label className="text-base font-black text-amber-900 pr-1 opacity-90">2. תחום בדיקה</label>
                            <select 
                                value={config.morSettings?.category || ""}
                                onChange={(e) => handleMorPathChange('category', e.target.value)}
                                className="w-full px-3 py-2 text-lg font-bold border-2 border-white rounded-xl shadow-sm outline-none focus:border-amber-400 bg-white"
                            >
                                <option value="">בחר תחום...</option>
                                {getMorOptions('category', config.morSettings).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    )}

                    {getMorOptions('subCategory', config.morSettings).length > 1 && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                            <label className="text-base font-black text-amber-900 pr-1 opacity-90">3. תת-קטגוריה</label>
                            <select 
                                value={config.morSettings?.subCategory || ""}
                                onChange={(e) => handleMorPathChange('subCategory', e.target.value)}
                                className="w-full px-3 py-2 text-lg font-bold border-2 border-white rounded-xl shadow-sm outline-none focus:border-amber-400 bg-white"
                            >
                                <option value="">בחר...</option>
                                {getMorOptions('subCategory', config.morSettings).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    )}

                    {getMorOptions('targetOrgan', config.morSettings).length > 1 && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                            <label className="text-base font-black text-amber-900 pr-1 opacity-90">4. איבר</label>
                            <select 
                                value={config.morSettings?.targetOrgan || ""}
                                onChange={(e) => handleMorPathChange('targetOrgan', e.target.value)}
                                className="w-full px-3 py-2 text-lg font-bold border-2 border-amber-200 rounded-xl shadow-md outline-none focus:border-amber-500 bg-amber-50 text-amber-900"
                            >
                                <option value="">בחר בדיקה...</option>
                                {getMorOptions('targetOrgan', config.morSettings).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-1.5 mt-2">
                <label className="text-base font-bold text-gray-500 pr-1">אזורי סריקה (לפי סדר עדיפות)</label>
<MultiSelectDropdown 
                                                    options={["מרכז", "ירושלים והסביבה", "דרום", "צפון"]} 
                                                    selected={config.morSettings?.areaPriority || []} 
                                                    onChange={(areas) => {
                                                        const updated = {...config, morSettings: {...config.morSettings, areaPriority: areas}, isTemplateActive: false};
                                                        setConfig(updated); handleAutoSave(updated);
                                                    }} 
                                                    placeholder="בחר אזורים לסריקה..." 
                                                    focusClass="focus:ring-[#00a896]" 
                                                />
                <p className="text-[11px] text-teal-600 font-bold pr-1 italic leading-tight">
                    * המספר בעיגול מציין את סדר העדיפות שבו הבוט יסרוק את האזורים.
                </p>
            </div>
        </div>
) : (
    /* רופאים מועדפים - מופיע רק בכללית */
    <div className="space-y-0.5">
        <label className="text-base font-bold text-gray-500 pr-1">רופאים מועדפים</label>
        <MultiSelectDropdown 
            options={getDoctorsList()} 
            selected={config.selectedDoctors} 
            onChange={handleDoctorsChange} 
            placeholder="חפש רופאים..." 
            isObject 
            focusClass="focus:ring-[#00a896]" 
        />
    </div>
)}
                                    
                                    {!config.activeEngines?.includes('mor_institute') && (
                                        <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-teal-100">
                                            <label className="flex items-center gap-2 text-lg font-bold text-gray-600 cursor-pointer leading-none">
                                                <input type="checkbox" checked={config.includeSurrounding} onChange={(e) => {
                                                    const updated = {...config, includeSurrounding: e.target.checked, isTemplateActive: false};
                                                    setConfig(updated);
                                                    handleAutoSave(updated);
                                                }} className="w-5 h-5 accent-[#00a896]" />
                                                כולל יישובים בסביבה
                                            </label>
                                            <div className="flex gap-2">
                                                {['הכל', 'כללית', 'מושלם'].map(t => (
                                                    <label key={t} className="flex items-center gap-1.5 cursor-pointer text-base font-bold text-gray-500 leading-none">
                                                        <input type="radio" name="insuranceType" value={t} checked={config.insuranceType === t} onChange={handleChange} className="w-4 h-4 accent-[#00a896]" /> 
                                                        {t}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
          </section>
                        

                        </div>
                    {/* Column 3: Scheduling (Left) */}
                        <div className="p-3 flex flex-col gap-2">
                            <section className="bg-purple-50/40 border-2 border-purple-100 rounded-2xl p-3 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-2xl font-black text-[#005a4c] flex items-center gap-2">
                                        <span className="w-1.5 h-6 bg-[#8c4391] rounded-full"></span> תזמון
                                    </h2>
                                    {/* אינדיקטור מצב מוגדל */}
                                    <div className={`px-4 py-0.5 rounded-full flex items-center gap-3 shadow-sm border transition-all min-w-[165px]
                                        ${isLoopActive   ? 'bg-green-50 border-green-200' :
                                        isSingleActive ? 'bg-blue-50 border-blue-200' :
                                        isWaiting      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100' :
                                                        'bg-gray-50 border-gray-200'}`}>
                                        <div className={`w-3.5 h-3.5 rounded-full shrink-0
                                            ${isLoopActive   ? 'bg-green-500 animate-pulse' :
                                            isSingleActive ? 'bg-blue-500 animate-pulse' :
                                            isWaiting      ? 'bg-amber-500 animate-pulse' :
                                                            'bg-gray-300'}`}>
                                        </div>
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`font-black leading-none transition-all
                                                ${isLoopActive   ? 'text-green-700 text-lg' :
                                                isSingleActive ? 'text-blue-700 text-lg' :
                                                isWaiting      ? 'text-amber-900 text-4xl mt-1' :
                                                                'text-gray-400 text-lg'}`}>
                                                {isLoopActive   ? 'רץ בלולאה' :
                                                isSingleActive ? 'בבדיקה' :
                                                isWaiting      ? formatTime(timeLeft) :
                                                                'במנוחה'}
                                            </span>
                                            {isWaiting && (
                                                <span className="text-[13px] font-black text-amber-700 uppercase tracking-tight leading-none mb-1">
                                                    זמן לסבב הבא
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <label className="text-base font-bold text-gray-500 pr-1">עד תאריך יעד</label>
                                        <input type="date" name="endDate" value={config.endDate} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-base font-bold text-gray-500 pr-1">תדירות סריקה</label>
                                        <select value={config.loopFrequency} onChange={(e) => setConfig({...config, loopFrequency: e.target.value})} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none">
                                            <option value="0-5">בין 0 ל-5 דקות (בדיקות)</option>
                                            <option value="10-15">בין 10 ל-15 דקות</option>
                                            <option value="25-30">בין 25 ל-30 דקות</option>
                                            <option value="40-45">בין 40 ל-45 דקות</option>
                                            <option value="55-60">בין 55 ל-60 דקות</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-bold text-gray-500 pr-1">שעת התחלה</label>
                                            <input type="time" name="startTime" value={config.startTime} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-base font-bold text-gray-500 pr-1">שעת סיום</label>
                                            <input type="time" name="endTime" value={config.endTime} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </section>
                            
                            <div className="grid grid-cols-2 gap-2 mt-1">
                            {/* כפתור לולאה */}
                                <button
                                    onClick={() => handleRun(false)}
                                    disabled={isSingleActive || !isReadyToRun}
                                    title={!isReadyToRun ? "יש לטעון תבנית מהרשימה או ללחוץ על 'שמור ל-DB'" : ""}
                                    className={`py-2.5 text-white font-black text-xl rounded-2xl transition-all duration-150
                                        ${!isReadyToRun 
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                            : isLoopActive
                                                ? 'bg-[#007060] shadow-inner ring-2 ring-inset ring-[#005a4c] translate-y-0.5 cursor-default'
                                                : isSingleActive
                                                    ? 'bg-[#00a896] opacity-30 grayscale cursor-not-allowed shadow-lg'
                                                    : 'bg-[#00a896] hover:bg-[#008f80] shadow-lg active:translate-y-0.5 active:shadow-inner active:bg-[#007060] cursor-pointer'}`}
                                >
                                   {isLoopActive ? '🔄 רץ בלולאה' : (config.templateQueue?.length > 0 ? 'הפעל תור' : 'לולאה')}
                                </button>

                                {/* כפתור בדיקה */}
                                <button
                                    onClick={() => handleRun(true)}
                                    disabled={isLoopActive || !isReadyToRun}
                                    title={!isReadyToRun ? "יש לטעון תבנית מהרשימה או ללחוץ על 'שמור ל-DB'" : ""}
                                    className={`py-2.5 text-white font-black text-xl rounded-2xl transition-all duration-150
                                        ${!isReadyToRun 
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                            : isSingleActive
                                                ? 'bg-[#004f80] shadow-inner ring-2 ring-inset ring-[#003d63] translate-y-0.5 cursor-default'
                                                : isLoopActive
                                                    ? 'bg-[#007cc3] opacity-30 grayscale cursor-not-allowed shadow-lg'
                                                    : 'bg-[#007cc3] hover:bg-[#0066a1] shadow-lg active:translate-y-0.5 active:shadow-inner active:bg-[#004f80] cursor-pointer'}`}
                                >
                                    {isSingleActive ? '🔍 בודק...' : 'בדיקה'}
                                </button>

                                {/* כפתור עצור */}
                                <button
                                    onClick={handleStop}
                                    className="col-span-2 py-2.5 font-black text-xl rounded-2xl transition-all duration-150 bg-[#e11d48] text-white hover:bg-[#be123c] shadow-md active:translate-y-0.5 active:shadow-inner active:bg-[#9f0f35] cursor-pointer"
                                >
                                    ⏹ עצור הכל
                                </button>

                                <a 
                                    href="/api/download-report" 
                                    target="_blank" 
                                    className="col-span-2 py-3 bg-gradient-to-r from-teal-700 to-teal-900 hover:from-teal-600 hover:to-teal-800 text-white font-black text-xl rounded-3xl text-center flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                                >
                                    📊 הורד מצגת דוח PDF
                                </a>
                            </div>

                            {/* חיווי סטטוס בזמן אמת - הועבר לעמודה השמאלית */}
                            {liveProgressMsg && (
                                <div className={`mt-2 bg-white border-2 border-teal-400 rounded-2xl p-3 shadow-md flex items-center gap-3 ${botLiveStatus === 'active' && !liveProgressMsg.includes('הסתיימה') ? 'animate-pulse' : ''}`}>
                                    <div className={`w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full shrink-0 ${botLiveStatus === 'active' && !liveProgressMsg.includes('הסתיימה') ? 'animate-spin' : ''}`}></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-500 mb-0.5">סטטוס סריקה:</p>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-xl font-black text-teal-900 leading-tight">{liveProgressMsg}</p>
                                            </div>
                                            
                                            {/* טיימר סריקה אלגנטי ומעוצב */}
                                            {botLiveStatus === 'active' && scanTimeRemaining > 0 && (
                                                <div className="flex flex-col items-end shrink-0">
                                                    <div className="bg-teal-800 text-white px-4 py-1 rounded-full font-black text-xl shadow-md flex items-center gap-2 min-w-[90px] justify-center">
                                                        <span className="text-base animate-pulse">⏱️</span>
                                                        {formatTime(scanTimeRemaining)}
                                                    </div>
                                                    {/* חיווי הערכה קטן רק כשמדובר בזמן ראשוני */}
                                                    {liveProgressMsg && liveProgressMsg.includes('*') && (
                                                        <span className="text-[10px] text-teal-600 font-bold opacity-70 mt-1">זמן משוער</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* הערה המופיעה רק כשהבוט משתמש בזמן ברירת מחדל אופטימי */}
                                        {liveProgressMsg && liveProgressMsg.includes('*') && (
                                            <p className="text-[11px] text-gray-400 mt-1 font-bold animate-pulse text-right">* מבוסס על הערכת זמן ראשונית</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Section */}
                    {config.selectedDoctors.length > 0 && (
                        <div className="flex-1 flex overflow-hidden bg-white shadow-inner border-t-2 border-gray-100">
                            <div className="w-[180px] p-4 border-l border-gray-100 flex flex-col items-center shrink-0 bg-gray-50/50 justify-center">
                                <h2 className="text-lg font-black text-[#005a4c] text-center leading-tight mb-2">תוצאות סריקה ורופאים</h2>
                                <span className="bg-blue-600 text-white text-3xl font-black px-8 py-2 rounded-full shadow-lg border-2 border-white">{config.selectedDoctors.length}</span>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {config.selectedDoctors.map(docId => {
                                        let docObj = null;
                                        for (const db of Object.values(DOCTORS_DATABASE)) {
                                            const found = db.find(d => (d.key || d.id) === docId);
                                            if (found) { docObj = found; break; }
                                        }
                                        if (!docObj) return null;
                                        const parts = docObj.label.split('|').map(p => p.trim());
                                        const name = parts[0];
                                        const city = parts[1]; // חילוץ העיר מהחלק השני של ה-label
                                        
                                        return (
                                            <div key={docId} className="bg-white p-4 rounded-[2rem] border-2 border-gray-100 shadow-xl relative hover:border-teal-400 transition-all flex flex-col justify-between min-h-[140px]">
                                                <button onClick={() => handleDoctorsChange(config.selectedDoctors.filter(id => id !== docId))} className="absolute top-4 left-4 text-gray-300 hover:text-red-500 text-xl font-black">✕</button>
                                                
                                                <div>
                                                    <div className="font-black text-2xl text-gray-800 mb-2 leading-tight border-r-4 border-blue-500 pr-3">
                                                        {name} <span className="text-gray-400 text-lg font-bold">({city})</span>
                                                    </div>
                                                    <div className="text-base text-gray-500 font-bold leading-tight space-y-1">
                                                        <div className="truncate"><span className="text-[#007cc3]">מרפאה:</span> {parts[2]}</div>
                                                        <div className="truncate"><span className="text-[#007cc3]">כתובת:</span> {parts[3]}</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-3 pt-3 border-t-4 border-gray-50 flex items-center justify-between">
                                                    <span className="text-xl font-black text-[#005a4c]">תור קרוב:</span>
                                                    <span className="text-2xl font-black text-amber-700 bg-[#fff9e6] px-6 py-2 rounded-2xl border-2 border-[#fcefc7] shadow-sm">
                                                        {config.doctorDates[name] || "טרם נמצא"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
    }