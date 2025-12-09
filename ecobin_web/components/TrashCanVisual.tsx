// TrashCanVisual.tsx — REPLACEMENT (no mqtt inside)
import React from 'react';
import { TrashCanData, TrashStatus } from '../types';
import { Wifi, WifiOff, Battery, Zap } from 'lucide-react';

interface TrashCanVisualProps {
  data: TrashCanData;
  status: TrashStatus;
}

const TrashCanVisual: React.FC<TrashCanVisualProps> = ({ data, status }) => {
  const level = Number.isFinite(data.level) ? data.level : 0;

  // Determine fill color based on status
  const getFillColor = () => {
    if (status === TrashStatus.CRITICAL) return 'bg-red-500';
    if (status === TrashStatus.FULL) return 'bg-orange-500';
    if (status === TrashStatus.NORMAL) return 'bg-emerald-500';
    return 'bg-emerald-300';
  };

  const lidRotation = data.lidOpen ? '-rotate-[110deg]' : 'rotate-0';
  const lidTranslate = data.lidOpen ? '-translate-y-4 translate-x-2' : 'translate-y-0';

  return (
    <div className="relative flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="absolute top-4 right-4 flex space-x-2">
        <div className={`p-2 rounded-full ${data.isConnected ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
          {data.isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
        </div>
        <div className={`p-2 rounded-full flex items-center space-x-1 ${data.battery < 20 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {data.battery < 20 ? <Zap size={16} /> : <Battery size={20} />}
          <span className="text-xs font-bold">{data.battery}%</span>
        </div>
      </div>

      <div className="relative w-48 md:w-64 perspective-1000">
        <div className={`absolute top-0 left-0 w-full h-8 bg-slate-700 rounded-t-lg z-20 origin-bottom-left transition-all duration-700 ease-in-out shadow-lg ${lidRotation} ${lidTranslate}`}>
          <div className="w-full h-full bg-slate-600 rounded-t-lg border-b-4 border-slate-800 flex justify-center items-center">
             <div className="w-16 h-1 bg-slate-400 rounded-full opacity-50"></div>
          </div>
        </div>

        <div className="mt-8 relative w-full h-64 bg-slate-100 rounded-b-xl border-x-8 border-b-8 border-slate-300 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-inner-shadow pointer-events-none z-10"></div>

          <div 
            className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out flex items-end justify-center ${getFillColor()}`}
            style={{ height: `${level}%` }}
          >
             <div className="w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
             <div className="absolute -top-3 left-0 w-full h-4 bg-white opacity-20 blur-sm rounded-t-[100%]"></div>
          </div>
        </div>

        <div className="w-[90%] mx-auto h-4 bg-slate-400 rounded-b-lg -mt-1 shadow-md"></div>
      </div>

      <div className="mt-8 text-center">
        <h2 className="text-4xl font-black text-slate-700 tracking-tighter">
          {Math.round(level)}%
        </h2>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">
          Dung tích chứa
        </p>
        {status === TrashStatus.CRITICAL && (
           <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold animate-bounce">
             ⚠️ CẦN ĐỔ RÁC NGAY
           </div>
        )}
      </div>
    </div>
  );
};

export default TrashCanVisual;
