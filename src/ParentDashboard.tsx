import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { ShieldCheck, History, Settings, Bell, MapPin, Navigation } from 'lucide-react';
import L from 'leaflet';
import DangerMapContent from './danger_map';
import { supabase } from './supabaseClient';

// --- CSSスタイルの注入（お子様の現在地の脈動アニメーション） ---
const injectStyles = () => {
  if (document.getElementById('parent-tracker-styles')) return;
  const style = document.createElement('style');
  style.id = 'parent-tracker-styles';
  style.innerHTML = `
    .pulse-child {
      width: 20px; height: 20px;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(66, 133, 244, 0.4);
      animation: pulse-animation 2s infinite;
    }
    @keyframes pulse-animation {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
    .user-dot-child {
      width: 14px; height: 14px;
      background-color: #4285F4;
      border: 2px solid white;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 8px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);
};

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { color: '#ef4444', label: '高', bg: 'bg-red-500' };
    case 'medium': return { color: '#f97316', label: '中', bg: 'bg-orange-500' };
    case 'low': return { color: '#eab308', label: '低', bg: 'bg-yellow-500' };
    default: return { color: '#64748b', label: '不明', bg: 'bg-slate-500' };
  }
};

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 17, { animate: true, duration: 1.5 });
  }, [coords, map]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [dangerZones, setDangerZones] = useState<any[]>([]);

  const [parentId, setParentId] = useState(localStorage.getItem('parent_parentId') || '');
  const [childId, setChildId] = useState(localStorage.getItem('parent_childId') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    injectStyles();
    fetch('/public/tables/danger_zones.json')
      .then(res => res.json())
      .then(json => setDangerZones(json.data))
      .catch(err => console.error("データ読み取りエラー:", err));
  }, []);

  useEffect(() => {
  injectStyles();
  fetch('/public/tables/danger_zones.json')
    .then(res => res.json())
    .then(json => {
      // 現在の時刻（時）を取得
      const currentHour = new Date().getHours();
      
      // 夜間判定 (20:00以降 または 5:00未満)
      const isNight = currentHour >= 20 || currentHour < 5;

      const customizedData = json.data.map((zone) => {
        let finalRadius = 100; // デフォルトの半径

        if (isNight && zone.danger_level === 'high') {
          // 夜間かつ危険度が高い場合：半径を大きく（例：250m）
          finalRadius = 250;
        } else if (zone.danger_level === 'high') {
          // 昼間だが危険度が高い場合：少し大きめ（例：150m）
          finalRadius = 150;
        } else {
          // それ以外（low/medium）はランダム要素を入れて自然に
          finalRadius = Math.floor(Math.random() * (120 - 70 + 1)) + 70;
        }

        return {
          ...zone,
          radius: finalRadius
        };
      });

      setDangerZones(customizedData);
    })
    .catch(err => console.error("データ読み込みエラー:", err));
}, []);

  useEffect(() => {
    if (!isMonitoring || !parentId || !childId) return;

    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, (payload) => {
        const newLog = payload.new;
        if (newLog.parent_id === parentId && newLog.child_id === childId) {
          const pos: [number, number] = [newLog.latitude, newLog.longitude];
          setChildPos(pos);
          setIsDanger(newLog.is_active);

          const statusMsg = newLog.is_active ? '⚠️ 危険エリア進入' : '✅ 安全圏へ移動';
          setHistory(prev => [{ 
            time: new Date().toLocaleTimeString(), 
            status: statusMsg, 
            lat: newLog.latitude, 
            lng: newLog.longitude 
          }, ...prev].slice(0, 10));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId, childId]);

  // お子様の現在地アイコン（脈動ドット）
  const childIcon = L.divIcon({
    className: 'custom-child-icon',
    html: `<div class="pulse-child"></div><div class="user-dot-child"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const saveSettings = () => {
    localStorage.setItem('parent_parentId', parentId);
    localStorage.setItem('parent_childId', childId);
    setShowSettings(false);
    alert('設定を保存しました。');
  };

  return (
    <div className="min-h-screen bg-indigo-50 font-sans pb-10">
      <div className="bg-indigo-700 p-4 text-white shadow-lg flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck /> SafeWatch Parent</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full transition"><Settings /></button>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-indigo-200">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-700"><Settings size={18}/> 監視設定</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} placeholder="保護者ID" />
              <input type="text" className="p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} placeholder="お子様ID" />
            </div>
            <button onClick={saveSettings} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold">設定を保存</button>
          </div>
        )}

        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-500 ${isDanger ? 'bg-red-500 text-white shadow-red-200 shadow-lg' : 'bg-white text-slate-700'}`}>
          <span className="font-bold flex items-center gap-2">
            <Bell size={18} className={isDanger ? 'animate-bounce' : ''} /> 
            {isMonitoring ? (isDanger ? '【緊急】危険エリアに進入しました！' : '見守り中：正常') : '監視が停止しています'}
          </span>
          <button onClick={() => setIsMonitoring(!isMonitoring)} className={`px-6 py-2 rounded-xl font-bold text-sm transition ${isMonitoring ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white shadow-lg'}`}>
            {isMonitoring ? '監視を終了' : '監視を開始'}
          </button>
        </div>

        <div className="relative h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-white overflow-hidden">
          <MapContainer center={childPos || [35.0116, 135.7681]} zoom={15} style={{ height: '100%', width: '100%' }}>
            {/* 保護者側でも同じ危険エリアを表示。子供の位置を渡して追跡 */}
            <DangerMapContent userPosition={childPos} />
                
            {childPos && (
              <Marker position={childPos} icon={childIcon} />
            )}
          </MapContainer>
          
          {isMonitoring && childPos && (
            <div className={`absolute bottom-4 left-4 z-[1000] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md ${isDanger ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
              <Navigation size={12} fill="white" /> {isDanger ? '緊急追跡中' : '位置確認中'}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><History size={20}/> アクティビティログ</h3>
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-center text-slate-400 py-4 text-sm font-medium italic">新しいログはありません</p>
            ) : (
              history.map((log, i) => (
                <div key={i} className="flex flex-col gap-1 p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-xl transition">
                  <div className="flex justify-between items-center">
                    <span className={`font-bold text-sm ${log.status.includes('⚠️') ? 'text-red-500' : 'text-green-600'}`}>{log.status}</span>
                    <span className="text-slate-400 font-mono text-xs">{log.time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-500 text-xs mt-1">
                    <MapPin size={12} className="text-slate-400" />
                    <a href={`https://www.google.com/maps?q=${log.lat},${log.lng}`} target="_blank" rel="noreferrer" className="hover:underline">Googleマップで場所を表示</a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;