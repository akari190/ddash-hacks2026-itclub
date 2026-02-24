import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, History, Settings, Bell, MapPin } from 'lucide-react'; // MapPinを追加
import { supabase } from './supabaseClient';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  
  useEffect(() => {
    if (coords) {
      // flyTo を使うことで、カクカクせず「スーッ」と動きます
      // 17 はズームレベルです（お好みで 16-18 くらいが最適）
      map.flyTo(coords, 17, {
        animate: true,
        duration: 1.5 // 1.5秒かけて移動（滑らかさ重視）
      });
    }
  }, [coords, map]); // coords が更新されるたびに発火

  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  const [parentId, setParentId] = useState(localStorage.getItem('parent_parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('parent_childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // --- 住所を取得する関数を追加 ---
  const getAddress = async (lat: number, lng: number) => {
    try {
      // 1. ユーザーエージェントの問題を避けるため、ブラウザに任せたシンプルなリクエストにする
      // 2. httpsであることを明示
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      const res = await fetch(url);

      if (!res.ok) throw new Error('Network response was not ok');

      const data = await res.json();

      // 日本の住所形式に合わせて、表示名を整理
      // Nominatimは住所を後ろから繋げる傾向があるので、地名に近い方を取り出す
      if (data.address) {
        const a = data.address;
        return `${a.city || a.town || a.village || ''} ${a.suburb || ''} ${a.road || ''} ${a.house_number || ''}`.trim() || data.display_name.split(',')[0];
      }
      
      return data.display_name.split(',')[0] || "住所不明";
    } catch (err) {
      console.error("住所取得エラー:", err);
      // エラー時は緯度経度を代わりに表示しておくと親切
      return `住所取得不可 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  };
  const saveSettings = () => {
    localStorage.setItem('parent_parentId', parentId);
    localStorage.setItem('parent_childId', childId);
    setShowSettings(false);
    alert('設定を保存しました。');
  };

  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, async (payload) => {
        const newLog = payload.new;
        if (newLog.parent_id === parentId && newLog.child_id === childId) {
          const time = new Date().toLocaleTimeString();
          
          if (newLog.is_active) {
              setChildPos([newLog.latitude, newLog.longitude]);
              setIsDanger(true);

              // 履歴に座標を直接入れる
              setHistory(prev => [{ 
                time: new Date().toLocaleTimeString(), 
                status: '⚠️ 危険エリア進入', 
                lat: newLog.latitude, 
                lng: newLog.longitude 
              }, ...prev].slice(0, 10));
            } else {
              setIsDanger(false);
              setChildPos(null);
              setHistory(prev => [{ 
                time: new Date().toLocaleTimeString(), 
                status: '✅ 安全圏へ移動', 
                lat: null, 
                lng: null 
              }, ...prev].slice(0, 10));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10 text-slate-900">
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck /> SafeWatch Parent</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full transition"><Settings /></button>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-indigo-200">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-900"><Settings size={18}/> 監視設定</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} placeholder="保護者ID" />
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} placeholder="お子様ID" />
            </div>
            <button onClick={saveSettings} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold">設定を保存</button>
          </div>
        )}

        {/* 状況バー */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isDanger ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-700'}`}>
          <span className="font-bold flex items-center gap-2">
            <Bell size={18} /> {isMonitoring ? (isDanger ? '緊急：危険エリアに進入しました！' : '見守り中：安全圏にいます') : '監視停止中'}
          </span>
          <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-6 py-2 rounded-xl font-bold text-sm ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}>
            {isMonitoring ? '監視停止' : '監視開始'}
          </button>
        </div>

        {/* マップ：常に表示 */}
        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={[35.0222, 135.9619]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {isDanger && childPos && (
              <>
                <RecenterMap coords={childPos} />
          
                <Circle 
                  center={childPos} 
                  radius={12} 
                  pathOptions={{ color: 'rgba(255, 255, 255, 0.8)', fillColor: '#ffffff', fillOpacity: 0.3, weight: 1 }} 
                />
                <Circle 
                  center={childPos} 
                  radius={6} 
                  pathOptions={{ fillColor: '#4285F4', fillOpacity: 1, color: '#ffffff', weight: 2 }} 
                />
              </>
            )}
          </MapContainer>
          {!isDanger && isMonitoring && (
            <div className="absolute top-4 right-4 bg-white/90 px-4 py-2 rounded-full shadow-sm text-xs font-bold text-indigo-600 z-[1000] border border-indigo-100">
              プライバシー保護：GPS非表示中
            </div>
          )}
        </div>

        {/* 履歴：住所を表示 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> 履歴</h3>
          <div className="space-y-3">
            {history.map((log, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-xl transition">
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-sm ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>
                    {log.status}
                  </span>
                  <span className="text-slate-400 font-mono text-xs">{log.time}</span>
                </div>
                
                {/* 住所または座標を表示し、クリックでGoogleマップを開けるようにする */}
                <div className="flex items-center gap-1 text-indigo-500 text-xs mt-1">
                  <MapPin size={12} className="shrink-0 text-slate-400" />
                  {log.lat && log.lng ? (
                    <a 
                      href={`https://www.google.com/maps?q=${log.lat},${log.lng}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      位置を確認：{log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                      <span className="text-[10px] bg-indigo-50 px-1 rounded text-indigo-400 ml-1">Googleマップで開く</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">位置情報なし</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;