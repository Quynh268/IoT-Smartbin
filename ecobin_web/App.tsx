import React, { useState, useEffect } from 'react';
import { Trash2, BarChart3, MessageSquare, Settings, RefreshCcw, Wind, 
         Thermometer, History, Unlock, Lock, Sparkles, Bot } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TrashCanVisual from './components/TrashCanVisual';
import StatsCard from './components/StatsCard';
import EcoAssistant from './components/EcoAssistant';
import { AppView, TrashCanData, TrashStatus, UsageLog } from './types';

import { db } from "./services/firebase";
import { orderBy, limit } from "firebase/firestore";
import { collection, addDoc, Timestamp, query, where, getDocs, onSnapshot } from "firebase/firestore";

import { addTrashLog, getTodayDumpCount, getTodayVsYesterday } from "./services/firestoreLogs";

import { connectMQTT } from './services/mqttService';

const App: React.FC = () => {
  const logCollection = collection(db, "trash_logs");

  async function saveEmptyEvent() {
    await addDoc(logCollection, {
      event: "emptied",
      ts: Timestamp.now()
    });
  }

  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  
  // Simulated IoT State
  const [trashData, setTrashData] = useState<TrashCanData>({
    id: 'bin-001',
    level: 0,
    lidOpen: false,
    battery: 85,
    temperature: 28,
    humidity: 65,
    odorLevel: 2,
    lastEmptied: '2 giờ trước',
    emptiedCountToday: 0,
    diffWithYesterday: 0,
    isConnected: false
  });

  const [logs, setLogs] = useState<UsageLog[]>([]);

  const [status, setStatus] = useState<TrashStatus>(TrashStatus.NORMAL);

  // Calculate status based on level
  useEffect(() => {
    if (trashData.level >= 90) setStatus(TrashStatus.CRITICAL);
    else if (trashData.level >= 75) setStatus(TrashStatus.FULL);
    else if (trashData.level <= 5) setStatus(TrashStatus.EMPTY);
    else setStatus(TrashStatus.NORMAL);

    loadWeeklyStats();
  }, [trashData.level]);

  useEffect(() => {
    // subscribe chỉ theo event để tránh cần composite index
    const q = query(collection(db, "trash_logs"), where("event", "==", "emptied"));

    const unsub = onSnapshot(q, snapshot => {
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        let todayCount = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          // doc.data().ts là Timestamp -> chuyển về Date
          const tsDate = data.ts && data.ts.toDate ? data.ts.toDate().getTime() : new Date(data.ts).getTime();
          if (tsDate >= start && tsDate <= end) {
            todayCount++;
          }
        });

        setTrashData(prev => ({ ...prev, emptiedCountToday: todayCount }));
      } catch (err) {
        console.error("Error processing snapshot for todays count:", err);
      }
    }, err => {
      console.error("onSnapshot error for trash_logs (emptied):", err);
    });

    return () => unsub();
  }, []);

  // Actions
  const toggleLid = () => {
    setTrashData(prev => ({ ...prev, lidOpen: !prev.lidOpen }));
    addLog(!trashData.lidOpen ? 'OPEN' : 'AUTO_CLOSE', !trashData.lidOpen ? 'Mở nắp thủ công' : 'Đóng nắp thủ công');
  };

  const emptyTrash = () => {
    setTrashData(prev => ({ 
      ...prev, 
      level: 0, 
      odorLevel: 1, 
      emptiedCountToday: prev.emptiedCountToday + 1,
      lastEmptied: 'Vừa xong'
    }));
    setStatus(TrashStatus.EMPTY);
    addLog('EMPTY', 'Đã dọn sạch thùng rác');
  };

  const addLog = (type: UsageLog['type'], details: string) => {
    const newLog: UsageLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      type,
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10)); // Keep last 10
  };

  // View Components
  const SidebarItem = ({ view, icon, label }: { view: AppView, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
        activeView === view 
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  const [weeklyStats, setWeeklyStats] = useState([
    { name: 'T2', amount: 0 },
    { name: 'T3', amount: 0 },
    { name: 'T4', amount: 0 },
    { name: 'T5', amount: 0 },
    { name: 'T6', amount: 0 },
    { name: 'T7', amount: 0 },
    { name: 'CN', amount: 0 },
  ]);

  const loadWeeklyStats = async () => {
    const now = new Date();

    // Tính thứ kiểu ISO: T2 = 1, T7 = 6, CN = 7
    const isoDay = now.getDay() === 0 ? 7 : now.getDay();

    // Lấy thứ 2 của tuần hiện tại
    const start = new Date(now);
    start.setDate(now.getDate() - (isoDay - 1));
    start.setHours(0,0,0,0);

    const q = query(
      logCollection,
      where("ts", ">=", Timestamp.fromDate(start))
    );

    const snapshot = await getDocs(q);

    const stats = [0,0,0,0,0,0,0]; // T2 → CN

    snapshot.forEach(doc => {
      const d = doc.data().ts.toDate();
      d.setHours(d.getHours() + 7); // ép về GMT+7 cho đồng bộ
      
      const day = d.getDay() === 0 ? 7 : d.getDay(); // ISO day
      const index = day - 1; // T2 = index 0
      stats[index]++;
    });

    setWeeklyStats([
      { name: 'T2', amount: stats[0] },
      { name: 'T3', amount: stats[1] },
      { name: 'T4', amount: stats[2] },
      { name: 'T5', amount: stats[3] },
      { name: 'T6', amount: stats[4] },
      { name: 'T7', amount: stats[5] },
      { name: 'CN', amount: stats[6] },
    ]);
    if (stats.every(x => x === 0)) {
      console.log("⚠️ Biểu đồ rỗng do query chưa trả data");
    }
  };

  useEffect(() => {
    const client = connectMQTT(async (type, value) => {
      if (type === "lid") {
        setTrashData(prev => ({
          ...prev,
          lidOpen: Boolean(value)
        }));
      }

      if (type === "fill" && typeof value === "number") {
        setTrashData(prev => ({
          ...prev,
          level: value,
          isConnected: true,
        }));
        return;
      }

      if (type === "emptied") {
        await addTrashLog("emptied");

        const res = await getTodayVsYesterday();

        setTrashData(prev => ({
          ...prev,
          emptiedCountToday: res.today,
          diffWithYesterday: res.diff,
          lastEmptied: "Vừa xong"
        }));

        await loadWeeklyStats();
      }
    });

    return () => client.end();
  }, []);

  useEffect(() => {
    async function loadToday() {
      const count = await getTodayDumpCount();
      setTrashData(prev => ({
        ...prev,
        emptiedCountToday: count
      }));
    }

    loadToday();
  }, []);

  useEffect(() => {
    async function loadAllStats() {
      const res = await getTodayVsYesterday();

      setTrashData(prev => ({
        ...prev,
        emptiedCountToday: res.today,
        diffWithYesterday: res.diff
      }));

      await loadWeeklyStats();
    }

    loadAllStats();
  }, []);
  
  const loadHistoryLogs = async () => {
    try {
      const q = query(
        collection(db, "trash_logs"),
        orderBy("ts", "desc"),
        limit(50)
      );

      const snap = await getDocs(q);

      const results: UsageLog[] = [];

      snap.forEach(doc => {
        const data = doc.data();
        const date = data.ts?.toDate?.() ?? new Date();

        results.push({
          id: doc.id,
          timestamp: date.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }),
          type: data.event === "emptied" ? "EMPTY" : "OPEN",
          details: data.event === "emptied" ? "Đã đổ rác" : "Hoạt động"
        });
      });

      setLogs(results);
    } catch (e) {
      console.error("❌ Load history failed:", e);
    }
  };

  useEffect(() => {
    if (activeView === AppView.HISTORY) {
      loadHistoryLogs();
    }
  }, [activeView]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm z-50">
        <div className="flex items-center gap-2 text-emerald-600 font-black text-xl">
           <Trash2 className="fill-emerald-600 text-white" /> EcoBin
        </div>
        <div className="flex gap-2">
            <button onClick={toggleLid} className="p-2 bg-slate-100 rounded-full">
                {trashData.lidOpen ? <Unlock size={20}/> : <Lock size={20}/>}
            </button>
        </div>
      </div>

      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen p-6 z-20">
        <div className="flex items-center gap-3 text-emerald-600 font-black text-2xl mb-10 px-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-emerald-200 shadow-lg">
             <Trash2 size={24} />
          </div>
          EcoBin
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem view={AppView.DASHBOARD} icon={<BarChart3 size={20} />} label="Tổng Quan" />
          <SidebarItem view={AppView.HISTORY} icon={<History size={20} />} label="Lịch Sử Đổ Rác" />
          <SidebarItem view={AppView.ASSISTANT} icon={<MessageSquare size={20} />} label="Trợ Lý AI" />
          <SidebarItem view={AppView.SETTINGS} icon={<Settings size={20} />} label="Cài Đặt" />
        </nav>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-xs text-slate-400 mb-2 font-semibold">TRẠNG THÁI THIẾT BỊ</p>
          <div className="flex items-center gap-2 mb-2">
             <div className={`w-2 h-2 rounded-full ${trashData.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <span className="text-sm font-medium">{trashData.isConnected ? 'Đã kết nối' : 'Mất kết nối'}</span>
          </div>
          <p className="text-xs text-slate-400">ID: {trashData.id}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto h-[calc(100vh-64px)] md:h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
          
          {/* Header */}
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Xin chào, Gia Chủ! 👋</h1>
              <p className="text-slate-500 text-sm">Quản lý rác thải thông minh cho ngôi nhà sạch đẹp.</p>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-3">
              {/* <button 
                onClick={emptyTrash}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
              >
                <RefreshCcw size={16} />
                Dọn rác
              </button> */}
              <button 
                onClick={toggleLid}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                    trashData.lidOpen 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {trashData.lidOpen ? <Unlock size={16} /> : <Lock size={16} />}
                {trashData.lidOpen ? 'Đóng Nắp' : 'Mở Nắp'}
              </button>
            </div>
          </header>

          {/* Conditional Views */}
          {activeView === AppView.DASHBOARD && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Visual & Controls */}
              <div className="lg:col-span-5 xl:col-span-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 h-full min-h-[500px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                  <TrashCanVisual data={trashData} status={status} />
                  
                  {/* Quick stats inside Visual Card */}
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><Wind size={18}/></div>
                        <div>
                            <p className="text-xs text-slate-400">Mùi hôi (VOC)</p>
                            <p className="font-bold text-slate-700">{trashData.odorLevel < 4 ? 'Thấp' : 'Cao'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><Thermometer size={18}/></div>
                        <div>
                            <p className="text-xs text-slate-400">Nhiệt độ</p>
                            <p className="font-bold text-slate-700">{trashData.temperature}°C</p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Stats & Logs */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                   <StatsCard 
                      title="Lượt đổ trong ngày" 
                      value={trashData.emptiedCountToday} 
                      icon={<RefreshCcw size={24} className="text-blue-500"/>} 
                      color="blue"
                      //trend={`${(trashData.diffWithYesterday ?? 0) >= 0 ? '+' : ''}${trashData.diffWithYesterday ?? 0} so với hôm qua`}
                    />
                   <StatsCard 
                      title="Trạng thái" 
                      value={status === TrashStatus.CRITICAL ? 'Đầy nghiêm trọng' : (status === TrashStatus.FULL ? 'Sắp đầy' : 'Bình thường')} 
                      icon={<Trash2 size={24} className={status === TrashStatus.CRITICAL ? 'text-red-500' : 'text-green-500'}/>} 
                      color={status === TrashStatus.CRITICAL ? 'orange' : 'green'}
                   />
                </div>

                {/* AI Assistant Preview Widget */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden group cursor-pointer transition-all hover:shadow-xl hover:shadow-indigo-200" onClick={() => setActiveView(AppView.ASSISTANT)}>
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10 flex justify-between items-end">
                        <div>
                            <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium mb-3">
                                <Bot size={12} /> Trợ lý thông minh
                            </div>
                            <h3 className="text-xl font-bold mb-2">Bạn cần giúp phân loại rác?</h3>
                            <p className="text-indigo-100 text-sm max-w-md">EcoBot có thể giúp bạn nhận diện loại rác và hướng dẫn cách tái chế đúng cách để bảo vệ môi trường.</p>
                        </div>
                        <button className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-50 transition-colors">
                            Chat ngay
                        </button>
                    </div>
                </div>

                {/* Charts */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <h3 className="font-bold text-lg text-slate-700 mb-6 flex items-center gap-2">
                     <BarChart3 size={18} className="text-slate-400"/> Số lượt đổ rác tuần này (lần đổ)
                   </h3>
                   <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={weeklyStats}>
                         <defs>
                           <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10}/>
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                         <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                         />
                         <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                </div>

              </div>
            </div>
          )}

          {activeView === AppView.HISTORY && (
             <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><History className="text-emerald-600"/> Lịch sử hoạt động</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-sm">
                                <th className="pb-3 pl-2">Thời gian</th>
                                <th className="pb-3">Loại sự kiện</th>
                                <th className="pb-3">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {logs.map(log => (
                                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 pl-2 font-medium text-slate-600">{log.timestamp}</td>
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            log.type === 'EMPTY' ? 'bg-blue-100 text-blue-600' :
                                            log.type === 'ALERT' ? 'bg-red-100 text-red-600' :
                                            'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            {log.type === 'EMPTY' ? 'DỌN RÁC' : log.type === 'ALERT' ? 'CẢNH BÁO' : 'HOẠT ĐỘNG'}
                                        </span>
                                    </td>
                                    <td className="py-4 text-slate-500">{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          )}

          {activeView === AppView.ASSISTANT && (
              <div className="h-[600px] lg:h-[700px]">
                  <EcoAssistant />
              </div>
          )}
          
          {activeView === AppView.SETTINGS && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center py-20">
                  <Settings size={48} className="mx-auto text-slate-300 mb-4"/>
                  <h3 className="text-lg font-bold text-slate-600">Cài đặt thiết bị</h3>
                  <p className="text-slate-400">Tính năng đang được phát triển...</p>
              </div>
          )}

        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 z-50">
        <button onClick={() => setActiveView(AppView.DASHBOARD)} className={`p-2 rounded-xl ${activeView === AppView.DASHBOARD ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><BarChart3 /></button>
        <button onClick={() => setActiveView(AppView.HISTORY)} className={`p-2 rounded-xl ${activeView === AppView.HISTORY ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><History /></button>
        <button onClick={() => setActiveView(AppView.ASSISTANT)} className={`p-2 rounded-xl ${activeView === AppView.ASSISTANT ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><MessageSquare /></button>
      </div>

    </div>
  );
};

export default App;