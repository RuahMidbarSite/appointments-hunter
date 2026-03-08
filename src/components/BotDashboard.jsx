import React, { useState, useRef, useEffect } from 'react';
import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';
import { AVAILABLE_CITIES } from '../scrapers/health/constants/cities';
import { AVAILABLE_DOCTORS } from '../scrapers/health/constants/doctors_display';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder, isObject = false, focusClass }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(opt => {
        const text = isObject ? opt.label : opt;
        return text.includes(searchTerm);
    });

    const toggleOption = (option) => {
        const value = isObject ? option.id : option;
        if (selected.includes(value)) {
            onChange(selected.filter(item => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const getSelectedLabels = () => {
        if (selected.length === 0) return <span className="text-gray-400">{placeholder}</span>;
        if (!isObject) return selected.join(', ');
        return selected.map(val => options.find(o => o.id === val)?.label || val).join(', ');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                tabIndex={0}
                /* הוסר font-bold, נשאר text-xl */
                className={`w-full px-4 py-1.5 rounded-xl bg-white border border-gray-200 cursor-pointer text-gray-800 text-xl font-medium transition-all min-h-[40px] flex items-center shadow-sm outline-none focus:ring-2 ${focusClass}`}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
            >
                <div className="truncate font-medium">{getSelectedLabels()}</div>
            </div>
            
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 flex flex-col">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between gap-2">
                        <input 
                            type="text" 
                            className={`flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-base shadow-inner text-gray-800 ${focusClass.replace('focus:ring-2', '')}`}
                            placeholder="חפש וסנן..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {selected.length > 0 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange([]);
                                }}
                                className="text-sm font-bold bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-sm"
                            >
                                נקה
                            </button>
                        )}
                    </div>
                    <div className="overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => {
                            const value = isObject ? option.id : option;
                            const label = isObject ? option.label : option;
                            return (
                                <label key={value} className="flex items-center px-4 py-3 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                                    <input 
                                        type="checkbox" 
                                        className="ml-3 w-5 h-5 cursor-pointer"
                                        checked={selected.includes(value)}
                                        onChange={() => toggleOption(option)}
                                    />
                                    <span className="text-base text-gray-800 font-medium">{label}</span>
                                </label>
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
        selectedCities: ['הרצליה'], 
        selectedDoctors: [], 
        selectedGroup: '32',
        selectedSpecialization: '32',
        endDate: '',
        runInLoop: false,
        loopFrequency: 15
    });

    const [botLiveStatus, setBotLiveStatus] = useState('idle');
    const [status, setStatus] = useState('idle');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const fetchBotData = async () => {
            try {
                const response = await fetch('/api/save-config');
                if (response.ok) {
                    const data = await response.json();
                    setConfig(prev => ({
                        ...prev,
                        userId: data.userId || prev.userId,
                        userCode: data.userCode || prev.userCode,
                        password: data.password || prev.password,
                        familyMember: data.familyMember || prev.familyMember,
                        selectedCities: data.selectedCities || prev.selectedCities,
                        selectedDoctors: data.selectedDoctors || prev.selectedDoctors,
                        selectedGroup: data.selectedGroup || prev.selectedGroup,
                        selectedSpecialization: data.selectedSpecialization || prev.selectedSpecialization,
                        endDate: data.endDate || prev.endDate,
                        runInLoop: data.runInLoop !== undefined ? data.runInLoop : prev.runInLoop,
                        loopFrequency: data.loopFrequency || prev.loopFrequency
                    }));
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

    const handleCitiesChange = (newCities) => {
        setConfig(prev => ({ ...prev, selectedCities: newCities }));
        setStatus('idle');
    };

    const handleDoctorsChange = (newDoctors) => {
        setConfig(prev => ({ ...prev, selectedDoctors: newDoctors }));
        setStatus('idle');
    };

    const handleRun = async (isSingle = false) => {
        setStatus('loading');
        const updatedConfig = { ...config, runInLoop: !isSingle };
        try {
            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedConfig)
            });
            if (response.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        }
    };

    const handleStop = async () => {
        try {
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

    const renderOptions = (data) => {
        if (!data) return null;
        if (Array.isArray(data)) {
            return data.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
            ));
        }
        return Object.entries(data).map(([key, val]) => {
            const valueId = typeof val === 'object' ? val.id : key;
            const valueName = typeof val === 'object' ? val.name : val;
            return <option key={key} value={valueId}>{valueName}</option>;
        });
    };

    return (
        <div className="flex justify-center pt-0 px-2 md:px-4 pb-4 bg-gray-100 font-sans items-start overflow-x-hidden">
            <div className="bg-white rounded-b-3xl shadow-2xl w-full max-w-[98%] h-auto border border-gray-200 mt-0">
                
                {/* Header: כותרת, לוגו וסטטוס */}
                <div className="bg-white border-b border-gray-100 p-3 md:p-4 flex flex-row items-center justify-between gap-4">
                    <div className="text-right">
                        <h1 className="text-4xl md:text-5xl font-black text-[#005a4c] tracking-tight leading-none mb-1">צייד התורים</h1>
                        <p className="text-[#00a896] text-lg md:text-xl font-medium">סריקה חכמה ללקוחות כללית</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="bg-[#f0f9f8] border border-[#d1edea] px-4 py-2 rounded-2xl flex items-center gap-3 shadow-inner">
                            <div className={`w-4 h-4 rounded-full ${botLiveStatus === 'active' ? 'bg-[#00a896] animate-pulse shadow-[0_0_8px_rgba(0,168,150,0.4)]' : 'bg-gray-300'}`}></div>
                            <span className="text-lg font-bold text-[#005a4c] hidden md:inline">
                                {botLiveStatus === 'active' ? 'הבוט פעיל' : 'הבוט בהמתנה'}
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
                    <div className="bg-[#e6f6f5] border border-[#c1edea] rounded-2xl p-3 md:p-4 shadow-sm min-h-[110px] flex flex-col justify-center">
                        <h2 className="text-3xl md:text-4xl font-black text-[#005a4c] mb-2 flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-[#00a896] rounded-full inline-block"></span>
                            הגדרות חיפוש
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">סוג שירות</label>
                                <select name="selectedGroup" value={config.selectedGroup} onChange={handleChange} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00a896] outline-none cursor-pointer">
                                    {renderOptions(CLALIT_GROUPS)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">התמחות</label>
                                <select name="selectedSpecialization" value={config.selectedSpecialization} onChange={handleChange} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00a896] outline-none cursor-pointer">
                                    {CLALIT_SPECIALIZATIONS[config.selectedGroup] ? renderOptions(CLALIT_SPECIALIZATIONS[config.selectedGroup]) : <option value="">בחר קבוצה</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">ערים לסריקה</label>
                                <MultiSelectDropdown options={AVAILABLE_CITIES} selected={config.selectedCities} onChange={handleCitiesChange} placeholder="בחר ערים..." focusClass="focus:ring-[#00a896]" />
                            </div>
                            <div>
                                <label className="block text-lg font-bold text-gray-700 mb-0.5">רופאים מועדפים</label>
                                <MultiSelectDropdown options={AVAILABLE_DOCTORS} selected={config.selectedDoctors} onChange={handleDoctorsChange} placeholder="בחר רופאים..." isObject={true} focusClass="focus:ring-[#00a896]" />
                            </div>
                        </div>
                    </div>

                    {/* סקציה 3: תזמון והפעלה */}
                    <div className="bg-[#f5ecf5] border border-[#ebdaeb] rounded-2xl p-3 md:p-4 shadow-sm min-h-[110px] flex flex-col justify-center">
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
                                <select value={config.loopFrequency} onChange={(e) => setConfig(prev => ({ ...prev, loopFrequency: Number(e.target.value) }))} 
                                    className="w-full px-4 py-1.5 text-xl font-medium bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8c4391] outline-none cursor-pointer">
                                    <option value={15}>כל 15 דקות</option>
                                    <option value={30}>כל 30 דקות</option>
                                    <option value={45}>כל 45 דקות</option>
                                    <option value={60}>כל שעה</option>
                                </select>
                            </div>
                            <div className="flex flex-row gap-2 mt-0">
                                <button onClick={() => handleRun(false)} disabled={status === 'loading' || botLiveStatus === 'active'} className={`px-5 py-2 rounded-xl font-bold text-lg text-white transition-all transform hover:-translate-y-0.5 whitespace-nowrap ${botLiveStatus === 'active' ? 'bg-gray-300' : 'bg-[#00a896] hover:bg-[#008f80]'}`}>
                                    לולאה
                                </button>
                                <button onClick={() => handleRun(true)} disabled={status === 'loading' || botLiveStatus === 'active'} className={`px-5 py-2 rounded-xl font-bold text-lg text-white transition-all transform hover:-translate-y-0.5 whitespace-nowrap ${botLiveStatus === 'active' ? 'bg-gray-300' : 'bg-[#007cc3] hover:bg-[#0066a1]'}`}>
                                    בדיקה
                                </button>
                                <button onClick={handleStop} className="px-5 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-lg rounded-xl transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                                    עצור
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}