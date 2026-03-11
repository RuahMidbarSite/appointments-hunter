import React, { useState, useRef, useEffect } from 'react';
import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';
import { AVAILABLE_CITIES } from '../scrapers/health/constants/cities';

// 1. ייבוא קבצי הרופאים באנגלית (חובה לוודא ששמות הקבצים בתיקייה אכן שונו לאנגלית)
import { AVAILABLE_DOCTORS as urologyDoctors } from '../scrapers/health/constants/urology';
import { AVAILABLE_DOCTORS as orthopedicsDoctors } from '../scrapers/health/constants/orthopedics';
import { AVAILABLE_DOCTORS as gastroDoctors } from '../scrapers/health/constants/gastroenterology';
import { AVAILABLE_DOCTORS as neurologyDoctors } from '../scrapers/health/constants/neurology';
import { AVAILABLE_DOCTORS as cardioDoctors } from '../scrapers/health/constants/cardiology';

const DOCTORS_DATABASE = {
    "אורולוגיה": urologyDoctors,
    "אורתופדיה": orthopedicsDoctors,
    "גסטרואנטרולוגיה": gastroDoctors,
    "נוירולוגיה": neurologyDoctors,
    "קרדיולוגיה": cardioDoctors
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
            // מציג בשורת החיפוש רק את השם הקצר ולא את כל הכתובת
            return found ? String(found.shortLabel || found.label || found.id) : String(val);
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
               <input 
                    type="text"
                    className={`w-full px-4 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-xl font-medium transition-all min-h-[40px] shadow-sm outline-none focus:ring-2 ${focusClass}`}
                    placeholder={isOpen && selected.length > 0 ? getSelectedLabels() : placeholder}
                    value={isOpen ? searchTerm : getSelectedLabels()}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => { setIsOpen(true); setSearchTerm(''); }}
                    onClick={() => { if (isOpen) setSearchTerm(''); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' && isMulti && searchTerm === '' && selected.length > 0) {
                            onChange(selected.slice(0, -1));
                        }
                    }}
                />
                {selected.length > 0 && !isOpen && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                        className="absolute left-3 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        title="נקה הכל"
                    >
                        ✕
                    </button>
                )}
            </div>
            
            {isOpen && (
                <div className="absolute z-50 min-w-full sm:w-[350px] lg:w-[400px] mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 flex flex-col overflow-hidden">
                    {isMulti && (
                        <div className="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 mr-2 uppercase">
                                {selected.length} נבחרו
                            </span>
                            {selected.length > 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onChange([]); }}
                                    className="text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-red-100"
                                >
                                    נקה הכל
                                </button>
                            )}
                        </div>
                    )}

                    <div className="overflow-y-auto p-1 max-h-80">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => {
                            const value = isObject ? (option.key || option.id) : option;
                            const labelStr = isObject ? option.label : String(option);
                            const isChecked = selected.includes(value);
                            
                            // עיצוב ייעודי לרופאים בשורות נפרדות
                            // עיצוב נקי - מציג רק את השם בשורת החיפוש
                            let displayContent = <span className="text-base font-medium pointer-events-none">{labelStr}</span>;
                            
                            if (labelStr.includes('|')) {
                                const name = labelStr.split('|')[0].trim();
                                displayContent = (
                                    <span className={`text-base font-bold ${isChecked ? 'text-blue-800' : 'text-gray-900'} pointer-events-none`}>
                                        {name}
                                    </span>
                                );
                            }

                            return (
                                <div 
                                    key={String(value)} 
                                    className={`flex items-start px-4 py-3 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${isChecked ? 'bg-blue-50 text-blue-700' : 'text-gray-800'}`}
                                    onClick={(e) => {
                                        e.preventDefault(); 
                                        e.stopPropagation();
                                        toggleOption(option);
                                    }}
                                >
                                    {isMulti && (
                                        <div className="pt-1">
                                            <input 
                                                type="checkbox" 
                                                className="ml-3 w-5 h-5 cursor-pointer pointer-events-none" 
                                                checked={!!isChecked} 
                                                readOnly
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 w-full text-right">
                                        {displayContent}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="p-4 text-base text-gray-500 text-center font-medium">לא נמצאו תוצאות</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function BotDashboard() {
   const [config, setConfig] = useState({
       userId: '', 
       userCode: '', 
       password: '', 
       familyMember: '', 
       selectedCities: [], // שים לב: איפסתי את העיר, אחרת זה יסנן ויעלים קרדיולוגים שלא מהרצליה!
       includeSurrounding: true, 
       selectedDoctors: [], 
       selectedGroup: '', // איפסתי כדי שלא יופיע "32" בהתחלה
       selectedSpecialization: '', // איפסתי כדי שלא יופיע "32" בהתחלה
       insuranceType: 'הכל', 
       endDate: '',
       runInLoop: false,
       loopFrequency: "10-15",
       startTime: '08:00', 
       endTime: '22:00',   
      lastFoundDate: '',
       doctorDates: {}
    });

    const [botLiveStatus, setBotLiveStatus] = useState('idle');
    const [status, setStatus] = useState('idle');
    const [showPassword, setShowPassword] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        let timer;
        if (botLiveStatus === 'idle' && config.runInLoop) {
            const updateTimerFromServer = () => {
                if (config.nextRunTime) {
                    const now = Date.now();
                    const diffSeconds = Math.max(0, Math.floor((config.nextRunTime - now) / 1000));
                    setTimeLeft(diffSeconds);
                } else {
                    setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
                }
            };
            updateTimerFromServer();
            timer = setInterval(updateTimerFromServer, 1000);
        } else {
            if (timeLeft !== null) setTimeLeft(null);
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
        let hasLoadedInitialConfig = false;

        const fetchBotData = async () => {
            try {
                const response = await fetch(`/api/save-config?t=${new Date().getTime()}`);
                if (response.ok) {
                    const data = await response.json();
                    
                    if (!hasLoadedInitialConfig) {
                        let freq = data.loopFrequency || config.loopFrequency;
                        if (freq == 60) freq = "55-60";
                        else if (freq == 45) freq = "40-45";
                        else if (freq == 30) freq = "25-30";
                        else if (freq == 15) freq = "10-15";
                        else if (freq && !String(freq).includes('-')) freq = "10-15"; 

                        setConfig(prev => ({
                            ...prev,
                            userId: data.userId || prev.userId,
                            userCode: data.userCode || prev.userCode,
                            password: data.password || prev.password,
                            familyMember: data.familyMember || prev.familyMember,
                            selectedCities: data.selectedCities || prev.selectedCities,
                            includeSurrounding: data.includeSurrounding !== undefined ? data.includeSurrounding : true,
                            selectedDoctors: data.selectedDoctors || prev.selectedDoctors,
                            selectedGroup: data.selectedGroup || prev.selectedGroup,
                            selectedSpecialization: data.selectedSpecialization || prev.selectedSpecialization,
                            insuranceType: data.insuranceType || prev.insuranceType || 'הכל',
                            endDate: data.endDate || prev.endDate,
                            runInLoop: data.runInLoop !== undefined ? data.runInLoop : prev.runInLoop,
                           loopFrequency: freq,
                            lastFoundDate: data.lastFoundDate || prev.lastFoundDate,
                            doctorDates: data.doctorDates || prev.doctorDates || {},
                            nextRunTime: data.nextRunTime || null 
                        }));
                        
                        if (data && Object.keys(data).length > 0) {
                            hasLoadedInitialConfig = true;
                        }
                    } else {
                        setConfig(prev => ({
                            ...prev,
                            lastFoundDate: data.lastFoundDate || prev.lastFoundDate,
                            doctorDates: data.doctorDates || prev.doctorDates || {},
                            nextRunTime: data.nextRunTime !== undefined ? data.nextRunTime : prev.nextRunTime
                        }));
                    }
                    setBotLiveStatus(data.botStatus || 'idle');
                }
            } catch (error) {
                console.error("שגיאה בסנכרון מול השרת:", error);
            }
        };
        
        fetchBotData(); 
        const interval = setInterval(fetchBotData, 3000); 
        return () => clearInterval(interval);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
        setStatus('idle');
    };

    const handleAutoSave = async (updatedConfig) => {
        try {
            await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updatedConfig, action: 'save_only' })
            });
        } catch (error) {
            console.error("שגיאה בשמירה אוטומטית:", error);
        }
    };

    const handleCitiesChange = (newCities) => {
        const updated = { ...config, selectedCities: newCities };
        // מרוקן את הרופאים הנבחרים אם העיר השתנתה, כדי שלא יישארו רופאים לא רלוונטיים מסומנים
        updated.selectedDoctors = []; 
        setConfig(updated);
        setStatus('idle');
        handleAutoSave(updated);
    };

    const handleDoctorsChange = (newDoctors) => {
        const updated = { ...config, selectedDoctors: newDoctors };
        setConfig(updated);
        setStatus('idle');
        handleAutoSave(updated);
    };

    const handleRun = async (isSingle = false) => {
        setStatus('loading');
        setTimeLeft(null); 
        
        const updatedConfig = { ...config, runInLoop: !isSingle };
        
        try {
            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });

            if (response.ok) {
                setConfig(updatedConfig);
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
                setBotLiveStatus(isSingle ? 'idle' : 'active');
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        }
    };

    const handleSaveOnly = async () => {
        setStatus('loading');
        const updatedConfig = { ...config, action: 'save_only' };
        
        try {
            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });

            if (response.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
                alert('ההגדרות נשמרו בהצלחה! הן ייכנסו לתוקף בסבב הבא ⏳');
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        }
    };

    const handleStop = async () => {
        try {
            setTimeLeft(null);
            setConfig(prev => ({ ...prev, runInLoop: false }));
            setBotLiveStatus('idle');

            const response = await fetch('/api/save-config', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }) 
            });
            if (response.ok) {
                setStatus('idle');
                alert('הבוט הופסק בהצלחה 🛑');
            } else {
                alert('השרת החזיר שגיאה בניסיון העצירה');
            }
        } catch (error) {
            console.error('שגיאה בעצירת הבוט:', error);
            alert('שגיאה בתקשורת עם השרת');
        }
    };

    // פונקציה חכמה למציאת רופאים + סינון ביטוח + סינון ערים
    const getDoctorsListForCurrentSpecialization = () => {
        if (!config.selectedGroup || !config.selectedSpecialization) return [];
        
        const specsForGroup = CLALIT_SPECIALIZATIONS[config.selectedGroup];
        if (!specsForGroup) return [];
        
        // תיקון השליפה כדי לזהות את השם העברי המדויק של ההתמחות
        const specObj = Object.values(specsForGroup).find(s => String(s.id) === String(config.selectedSpecialization));
        if (!specObj || !specObj.name) return [];

        const specName = specObj.name;
        const matchedKey = Object.keys(DOCTORS_DATABASE).find(key => specName.includes(key));
        let list = matchedKey ? DOCTORS_DATABASE[matchedKey] : [];

        // סינון לפי כללית / מושלם
        if (config.insuranceType === 'כללית') {
            list = list.filter(d => d.serviceType === 'כללית');
        } else if (config.insuranceType === 'מושלם') {
            list = list.filter(d => d.serviceType === 'מושלם');
        }

        // סינון לפי ערים (קריטי: אם העיר לא תואמת, הרופא לא יופיע ברשימה!)
        if (config.selectedCities && config.selectedCities.length > 0) {
            list = list.filter(d => {
                const parts = d.label.split('|').map(p => p.trim());
                const clinic = parts[2] || '';
                const address = parts[3] || '';
                return config.selectedCities.some(city => address.includes(city) || clinic.includes(city));
            });
        }

        // הוספת shortLabel לשם הצגה קצרה בתיבה
        return list.map(doc => {
            const name = doc.label.split('|')[0].trim();
            return { ...doc, shortLabel: name };
        });
    };

    const currentDoctorsList = getDoctorsListForCurrentSpecialization();

    return (
        <div className="flex justify-center pt-0 px-2 md:px-4 pb-4 bg-gray-100 font-sans items-start overflow-x-hidden">
            <div className="bg-white rounded-b-3xl shadow-2xl w-full max-w-[98%] h-auto border border-gray-200 mt-0">
                
                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-3 md:p-4 flex flex-row items-center justify-between gap-4">
                    <div className="text-right">
                        <h1 className="text-4xl md:text-5xl font-black text-[#005a4c] tracking-tight leading-none mb-1">צייד התורים</h1>
                        <p className="text-[#00a896] text-lg md:text-xl font-medium">סריקה חכמה ללקוחות כללית</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* מוצג למעלה רק אם לא נבחרו רופאים ספציפיים */}
                        {config.selectedDoctors.length === 0 && (
                            <div className="bg-[#fff9e6] border border-[#fcefc7] px-6 py-3 rounded-2xl hidden lg:flex flex-col items-start shadow-inner min-w-[320px] max-w-md transition-all">
                                <span className="text-base font-bold text-[#856404] uppercase leading-tight mb-2 opacity-90">התור המוקדם ביותר שנמצא:</span>
                                {config.lastFoundDate && config.lastFoundDate.includes(' - ') ? (
                                    <div className="flex flex-col">
                                        <span className="text-4xl font-black text-[#856404] leading-none mb-2">{config.lastFoundDate.split(' - ')[0]}</span>
                                        <span className="text-lg font-bold text-[#856404] opacity-90 leading-tight">{config.lastFoundDate.split(' - ')[1]}</span>
                                    </div>
                                ) : (
                                    <span className="text-2xl font-black text-[#856404] leading-tight">{config.lastFoundDate || "טרם נמצאו תורים"}</span>
                                )}
                            </div>
                        )}

                        <div className="bg-[#f0f9f8] border border-[#d1edea] px-4 py-2 rounded-2xl flex items-center gap-3 shadow-inner">
                            <div className={`w-4 h-4 rounded-full ${botLiveStatus === 'active' ? 'bg-[#00a896] animate-pulse shadow-[0_0_8px_rgba(0,168,150,0.4)]' : 'bg-gray-300'}`}></div>
                            <span className="text-lg font-bold text-[#005a4c] hidden md:inline">
                                {botLiveStatus === 'active' ? 'סריקה פעילה...' : `סבב הבא בעוד: ${formatTime(timeLeft)}`}
                            </span>
                        </div>
                        <img src="/clalit-logo.png" alt="כללית" className="h-12 md:h-16 object-contain" />
                    </div>
                </div>

                <div className="p-3 md:p-4 flex flex-col gap-3 bg-[#f8fbfa]">
                    
                    {/* סקציה 1: פרטי התחברות */}
                    <div className="bg-[#e1f0f9] border border-[#b8dcf2] rounded-2xl p-3 md:p-4 shadow-sm min-h-[110px] flex flex-col justify-center">
                        <h2 className="text-3xl md:text-4xl font-black text-[#005a4c] mb-2 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-[#007cc3] rounded-full inline-block"></span>
                            פרטי התחברות
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">תעודת זהות</label>
                                <input type="text" name="userId" value={config.userId} onChange={handleChange} placeholder="ENV או הזן כאן" 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007cc3] transition-all outline-none" />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">קוד משתמש</label>
                                <input type="text" name="userCode" value={config.userCode} onChange={handleChange} placeholder="ENV או הזן כאן" 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007cc3] transition-all outline-none" />
                            </div>
                            <div className="relative">
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">סיסמה</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} name="password" value={config.password} onChange={handleChange} placeholder="ENV או הזן כאן" 
                                        className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007cc3] transition-all outline-none" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#007cc3] text-xl">
                                        {showPassword ? "🙈" : "👁️"}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">שם בן משפחה</label>
                                <input type="text" name="familyMember" value={config.familyMember} onChange={handleChange} placeholder="אופציונלי" 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007cc3] transition-all outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* סקציה 2: הגדרות חיפוש */}
                    <div className="bg-[#e6f6f5] border border-[#c1edea] rounded-2xl p-3 md:p-4 shadow-sm flex flex-col justify-center">
                        <h2 className="text-3xl md:text-4xl font-black text-[#005a4c] mb-2 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-[#00a896] rounded-full inline-block"></span>
                            הגדרות חיפוש
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
                           <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">תחום</label>
                                <MultiSelectDropdown 
                                    options={Object.values(CLALIT_GROUPS).map(g => ({ id: String(g.id), label: String(g.name) }))}
                                    selected={config.selectedGroup ? [String(config.selectedGroup)] : []}
                                    onChange={(val) => {
                                        const updated = { 
                                            ...config, 
                                            selectedGroup: val[0] || '',
                                            selectedSpecialization: '', 
                                            selectedDoctors: [] 
                                        };
                                        setConfig(updated);
                                        handleAutoSave(updated);
                                    }}
                                    placeholder="בחר תחום..."
                                    isObject={true}
                                    isMulti={false} 
                                    focusClass="focus:ring-[#00a896]"
                                />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">מקצוע</label>
                                <MultiSelectDropdown 
                                    options={CLALIT_SPECIALIZATIONS[config.selectedGroup] 
                                        ? Object.values(CLALIT_SPECIALIZATIONS[config.selectedGroup]).map(spec => ({ 
                                            id: String(spec.id), 
                                            label: String(spec.name) 
                                          }))
                                        : []
                                    }
                                    selected={config.selectedSpecialization ? [String(config.selectedSpecialization)] : []}
                                    onChange={(val) => {
                                        const updated = { 
                                            ...config, 
                                            selectedSpecialization: val[0] || '',
                                            selectedDoctors: [] 
                                        };
                                        setConfig(updated);
                                        handleAutoSave(updated);
                                    }}
                                    placeholder={CLALIT_SPECIALIZATIONS[config.selectedGroup] ? "בחר מקצוע..." : "בחר תחום תחילה"}
                                    isObject={true}
                                    isMulti={false} 
                                    focusClass="focus:ring-[#00a896]"
                                />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">ערים לסריקה</label>
                                <MultiSelectDropdown options={AVAILABLE_CITIES} selected={config.selectedCities} onChange={handleCitiesChange} placeholder="בחר ערים..." isObject={true} focusClass="focus:ring-[#00a896]" />
                                <div className="mt-2.5 flex items-center pr-1">
                                    <input 
                                        type="checkbox" 
                                        id="includeSurrounding" 
                                        name="includeSurrounding"
                                        checked={config.includeSurrounding}
                                        onChange={(e) => {
                                            const updated = { ...config, includeSurrounding: e.target.checked };
                                            setConfig(updated);
                                            handleAutoSave(updated);
                                        }}
                                        className="w-4 h-4 cursor-pointer text-[#00a896] bg-white border-gray-300 rounded focus:ring-[#00a896] focus:ring-2"
                                    />
                                    <label htmlFor="includeSurrounding" className="mr-2 text-sm font-bold text-gray-600 cursor-pointer select-none">
                                        כולל יישובים בסביבה
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">רופאים מועדפים</label>
                                <MultiSelectDropdown 
                                    options={currentDoctorsList} 
                                    selected={config.selectedDoctors} 
                                    onChange={handleDoctorsChange} 
                                    placeholder={currentDoctorsList.length > 0 ? "חפש לפי שם או מרפאה..." : "לא נמצאו רופאים לתנאים אלו"} 
                                    isObject={true} 
                                    focusClass="focus:ring-[#00a896]" 
                                />
                                
                                {/* כפתורי הרדיו לסינון כללית/מושלם */}
                                <div className="mt-2.5 flex items-center pr-1 gap-3">
                                    <span className="text-sm font-bold text-gray-600">ביטוח:</span>
                                    <label className="flex items-center text-sm cursor-pointer text-gray-700 hover:text-[#00a896]">
                                        <input type="radio" name="insuranceType" value="הכל" 
                                            checked={config.insuranceType === 'הכל' || !config.insuranceType} 
                                            onChange={(e) => {
                                                const updated = { ...config, insuranceType: e.target.value, selectedDoctors: [] };
                                                setConfig(updated);
                                                handleAutoSave(updated);
                                            }} 
                                            className="ml-1 cursor-pointer accent-[#00a896]" 
                                        /> הכל
                                    </label>
                                    <label className="flex items-center text-sm cursor-pointer text-gray-700 hover:text-[#00a896]">
                                        <input type="radio" name="insuranceType" value="כללית" 
                                            checked={config.insuranceType === 'כללית'} 
                                            onChange={(e) => {
                                                const updated = { ...config, insuranceType: e.target.value, selectedDoctors: [] };
                                                setConfig(updated);
                                                handleAutoSave(updated);
                                            }} 
                                            className="ml-1 cursor-pointer accent-[#00a896]" 
                                        /> כללית
                                    </label>
                                    <label className="flex items-center text-sm cursor-pointer text-gray-700 hover:text-[#00a896]">
                                        <input type="radio" name="insuranceType" value="מושלם" 
                                            checked={config.insuranceType === 'מושלם'} 
                                            onChange={(e) => {
                                                const updated = { ...config, insuranceType: e.target.value, selectedDoctors: [] };
                                                setConfig(updated);
                                                handleAutoSave(updated);
                                            }} 
                                            className="ml-1 cursor-pointer accent-[#00a896]" 
                                        /> מושלם
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* תצוגת הכרטיסיות של הרופאים מחוץ לתפריט בצורה בולטת */}
                        {config.selectedDoctors.length > 0 && (
                            <div className="mt-6 p-4 bg-[#f0f9f8] border border-[#d1edea] rounded-xl shadow-inner">
                                <h3 className="text-xl font-bold text-[#005a4c] mb-3">רופאים שנבחרו לסריקה ({config.selectedDoctors.length}):</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {config.selectedDoctors.map(docId => {
                                        // מציאת הרופא מתוך מאגר הנתונים
                                        let docObj = null;
                                        for (const db of Object.values(DOCTORS_DATABASE)) {
                                            const found = db.find(d => (d.key || d.id) === docId);
                                            if (found) { docObj = found; break; }
                                        }
                                        if (!docObj) return null;

                                        const parts = docObj.label.split('|').map(p => p.trim());
                                        const name = parts[0] || '';
                                        const service = parts[1] || '';
                                        const clinic = parts[2] || '';
                                        const address = parts[3] || '';
                                        let phone = parts[4] || '';
                                        if (phone.startsWith('טל:')) phone = phone.replace('טל:', '').trim();

                                        return (
                                            <div key={docId} className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-200 relative hover:shadow-md transition-shadow">
                                                <button 
                                                    onClick={() => handleDoctorsChange(config.selectedDoctors.filter(id => id !== docId))}
                                                    className="absolute top-1.5 left-1.5 text-gray-400 hover:text-red-500 transition-colors w-5 h-5 flex items-center justify-center bg-gray-50 rounded-md"
                                                    title="הסר רופא"
                                                >
                                                    ✕
                                                </button>
                                                <div className="font-bold text-sm text-gray-800 pe-6 leading-tight mb-1.5">
                                                    {name} <span className="inline-block ms-1 text-[10px] font-bold text-[#007cc3] bg-[#e1f0f9] px-1.5 py-0.5 rounded-full">{service}</span>
                                                </div>
                                                <div className="space-y-0.5">
                                                    {clinic && <div className="text-xs text-gray-600 truncate" title={clinic}><span className="font-bold text-gray-700">מרפאה:</span> {clinic}</div>}
                                                    {address && <div className="text-xs text-gray-600 truncate" title={address}><span className="font-bold text-gray-700">כתובת:</span> {address}</div>}
                                                    {phone && phone !== 'אין טלפון' && <div className="text-xs text-gray-600"><span className="font-bold text-gray-700">טלפון:</span> <span dir="ltr">{phone}</span></div>}
                                                </div>
                                                
                                                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-[#005a4c]">תור קרוב:</span>
                                                    <span className="text-xs font-black text-[#856404] bg-[#fff9e6] px-1.5 py-0.5 rounded border border-[#fcefc7]">
                                                        {config.doctorDates && config.doctorDates[name] ? config.doctorDates[name] : "טרם נמצא"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* סקציה 3: תזמון והפעלה */}
                    <div className="bg-[#f5ecf5] border border-[#ebdaeb] rounded-2xl p-3 md:p-4 shadow-sm min-h-[110px] flex flex-col justify-center mt-3">
                        <h2 className="text-3xl md:text-4xl font-black text-[#005a4c] mb-2 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-[#8c4391] rounded-full inline-block"></span>
                            תזמון והפעלה
                        </h2>
                        <div className="w-full grid grid-cols-1 md:grid-cols-[1.5fr,1.5fr,auto] gap-x-6 gap-y-1 items-end">
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">תאריך יעד אחרון</label>
                                <input type="date" name="endDate" value={config.endDate} onChange={handleChange} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8c4391] outline-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">תדירות סריקה</label>
                                <select value={config.loopFrequency} onChange={(e) => setConfig(prev => ({ ...prev, loopFrequency: e.target.value }))} 
                                className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8c4391] outline-none cursor-pointer">
                                <option value="10-15">בין 10 ל-15 דקות</option>
                                <option value="25-30">בין 25 ל-30 דקות</option>
                                <option value="40-45">בין 40 ל-45 דקות</option>
                                <option value="55-60">בין 55 ל-60 דקות</option>
                            </select>
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">שעת התחלה</label>
                                <input type="time" name="startTime" value={config.startTime} onChange={handleChange} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8c4391] outline-none" />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">שעת סיום</label>
                                <input type="time" name="endTime" value={config.endTime} onChange={handleChange} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8c4391] outline-none" />
                            </div>
                            <div className="flex flex-row gap-2 mt-0">
                                <button onClick={() => handleRun(false)} disabled={status === 'loading' || botLiveStatus === 'active'} className={`px-5 py-2 rounded-xl font-bold text-lg text-white transition-all transform hover:-translate-y-0.5 whitespace-nowrap ${botLiveStatus === 'active' ? 'bg-gray-300' : 'bg-[#00a896] hover:bg-[#008f80]'}`}>
                                    לולאה
                                </button>
                                <button onClick={() => handleRun(true)} disabled={status === 'loading' || botLiveStatus === 'active'} className={`px-5 py-2 rounded-xl font-bold text-lg text-white transition-all transform hover:-translate-y-0.5 whitespace-nowrap ${botLiveStatus === 'active' ? 'bg-gray-300' : 'bg-[#007cc3] hover:bg-[#0066a1]'}`}>
                                    בדיקה
                                </button>
                                <button onClick={handleSaveOnly} disabled={status === 'loading'} className="px-5 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-lg rounded-xl transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                                    שמור (לסבב הבא)
                                </button>
                               <button onClick={handleStop} className="px-5 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-lg rounded-xl transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                                    עצור
                                </button>
                                
                                <a href="/api/download-report" download className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white font-bold text-lg rounded-xl transition-all transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2">
                                    📄 דוח
                                </a>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}