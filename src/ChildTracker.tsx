import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { Shield, AlertTriangle, Settings, Play, Square, MapPin, User, Activity } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './supabaseClient';

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { color: '#ef4444', label: '高', bg: 'bg-red-500' };
    case 'medium': return { color: '#f97316', label: '中', bg: 'bg-orange-500' };
    case 'low': return { color: '#eab308', label: '低', bg: 'bg-yellow-500' };
    default: return { color: '#64748b', label: '不明', bg: 'bg-slate-500' };
  }
};

// 地図の自動ズーム制御
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, 16); }, [coords]);
  return null;
};

const ChildTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<[number, number]>([35.0222, 135.9619]); // 初期位置：草津駅
  const [dangerZones, setDangerZones] = useState([]);
  const [activeZone, setActiveZone] = useState<any>(null);
  const [checkCount, setCheckCount] = useState(0);
  
  // 設定情報
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [showSettings, setShowSettings] = useState(false);

  // 1. 危険エリアデータの読み込み
  useEffect(() => {
    fetch('/public/tables/danger_zones.json')
      .then(res => res.json())
      .then(json => setDangerZones(json.data))
      .catch(err => console.error("データ読み込みエラー:", err));
  }, []);

  // 2. Supabaseへのデータ送信ロジック
  const sendLocation = useCallback(async (lat: number, lng: number, isActive: boolean) => {
    if (!childId || !parentId) return;
    const { error } = await supabase
      .from('location_logs')
      .insert([{ 
        child_id: childId, 
        parent_id: parentId, 
        latitude: lat, 
        longitude: lng, 
        is_active: isActive 
      }]);
    if (error) console.error("DB送信エラー:", error.message);
  }, [childId, parentId]);

  // 3. メインの追跡ループ
  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          setCheckCount(prev => prev + 1);

          // 危険エリア判定
          const foundZone = dangerZones.find((zone: any) => 
            L.latLng(latitude, longitude).distanceTo([zone.latitude, zone.longitude]) <= zone.radius
          );

          if (foundZone && !activeZone) {
            setActiveZone(foundZone);
            sendLocation(latitude, longitude, true); // 進入通知
          } else if (!foundZone && activeZone) {
            sendLocation(latitude, longitude, false); // 退出通知
            setActiveZone(null);
          }
        }, (err) => console.error(err), { enableHighAccuracy: true });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isTracking, dangerZones, activeZone, sendLocation]);

  // 設定の保存
  const saveSettings = () => {
    localStorage.setItem('childId', childId);
    localStorage.setItem('parentId', parentId);
    setShowSettings(false);
    alert('お子様側の設定を保存しました。');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* ヘッダー */}
      <div className="bg-green-600 p-4 shadow-lg flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Shield size={24} />
          <h1 className="text-xl font-bold">SafeWatch Child</h1>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/20 rounded-full transition"
        >
          <Settings size={24} />
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-green-200 animate-in slide-in-from-top duration-300">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} /> デバイス設定</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 ml-1">自分のID (Child ID)</label>
                <input type="text" placeholder="child001" className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-green-400" 
                  value={childId} onChange={e => setChildId(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 ml-1">保護者のID (Parent ID)</label>
                <input type="text" placeholder="parent001" className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-green-400" 
                  value={parentId} onChange={e => setParentId(e.target.value)} />
              </div>
              <button onClick={saveSettings} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">設定を保存</button>
            </div>
          </div>
        )}

        {/* ユーザー情報表示 */}
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm flex items-center gap-3">
            <User size={16} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-600">{childId || '未設定'}</span>
          </div>
          <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm flex items-center gap-3">
            <Activity size={16} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Check: {checkCount}</span>
          </div>
        </div>

        {/* ステータスパネル */}
        <div className={`p-6 rounded-3xl shadow-xl transition-all ${activeZone ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-bold">現在の状態</p>
              <h2 className="text-2xl font-black">{isTracking ? (activeZone ? '⚠️ 危険エリア内' : '✅ 正常に動作中') : '💤 停止中'}</h2>
            </div>
            <div className={`p-3 rounded-full ${activeZone ? 'bg-white/20' : 'bg-green-100'}`}>
              {activeZone ? <AlertTriangle size={32} /> : <Shield size={32} className="text-green-600" />}
            </div>
          </div>
        </div>

        {/* マップ */}
        <div className="h-80 rounded-3xl overflow-hidden shadow-lg border-4 border-white relative">
        <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap coords={position} />

          {/* --- 危険エリアの円を描画 (ParentDashboardと統一) --- */}
          {/* 危険エリアの描画 */}
            {dangerZones.map((zone: any) => {
              const lat = parseFloat(zone.latitude);
              const lng = parseFloat(zone.longitude);
              const rad = parseFloat(zone.radius);
              if (isNaN(lat) || isNaN(lng)) return null;
            
              const style = getLevelStyle(zone.danger_level);
            
              return (
                <Circle 
                  key={zone.id} 
                  center={[lat, lng]} 
                  radius={rad} 
                  pathOptions={{ color: style.color, fillColor: style.color, fillOpacity: 0.4, weight: 3 }} 
                >
                  <Popup>
                    <div className="text-center p-1">
                      <p className={`font-black text-sm mb-1 ${zone.danger_level === 'high' ? 'text-red-600' : 'text-orange-600'}`}>
                        ⚠️ {zone.incident_type}にちゅうい！
                      </p>
                      <p className="text-xs font-bold text-slate-700">{zone.name}</p>
                      <p className="text-[10px] text-slate-500 mt-2 leading-tight">{zone.description}</p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

          {/* --- 子供の現在地表示を Googleマップ風に変更 --- */}
          {/* 1. 外側の細い白い縁取り（光沢感） */}
          <Circle 
            center={position} 
            radius={12} 
            pathOptions={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              fillColor: '#ffffff', 
              fillOpacity: 0.3, 
              weight: 1 
            }} 
          />

          {/* 2. メインの青いドット（Markerの代わり） */}
          <Circle 
            center={position} 
            radius={6} 
            pathOptions={{ 
              color: '#ffffff',      // ドットの白い縁
              fillColor: '#4285F4',  // Google Blue
              fillOpacity: 1, 
              weight: 2 
            }} 
          />
        </MapContainer>
      </div>

        {/* 操作ボタン */}
        <button 
          onClick={() => setIsTracking(!isTracking)} 
          disabled={!childId || !parentId}
          className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${isTracking ? 'bg-slate-800 text-white' : 'bg-green-500 text-white disabled:opacity-50'}`}
        >
          {isTracking ? <><Square size={20} /> 見守りを停止</> : <><Play size={20} /> 見守りを開始</>}
        </button>
        {!childId && <p className="text-center text-xs text-red-500 font-bold">※右上の設定からIDを入力してください</p>}
      </div>
    </div>
  );
};

export default ChildTracker;