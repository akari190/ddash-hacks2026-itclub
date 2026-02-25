import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { Shield, AlertTriangle, Settings, User, Activity, Play, Square } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './supabaseClient';
import DangerMapContent from './danger_map';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, 16); }, [coords]);
  return null;
};

const ChildTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<[number, number]>([35.031558, 135.755747]); 
  const [geoData, setGeoData] = useState<any>(null);
  const [activeZone, setActiveZone] = useState<any>(null);
  const [checkCount, setCheckCount] = useState(0);
  
  const [childId, setChildId] = useState(localStorage.getItem('childId') || '');
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch('/tables/danger_areas.geojson')
      .then(res => res.json())
      .then(setGeoData)
      .catch(err => console.error("GeoData読み込みエラー:", err));
  }, []);

  // --- 1. Supabase送信関数 (復活 & エラーログ追加) ---
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

    if (error) {
      console.error("DB送信失敗:", error.message);
    } else {
      console.log("DB送信成功:", { lat, lng, isActive });
    }
  }, [childId, parentId]);

  // --- 2. 判定ロジック ---
  const checkDanger = useCallback((lat: number, lng: number) => {
    if (!geoData) return null;
    const isNight = new Date().getHours() >= 20 || new Date().getHours() < 5;

    return geoData.features.find((f: any) => {
      const score = f.properties.risk_score || 0;
      const center = f.geometry.coordinates[0][0]; 
      let radius = 150 + (score - 0.94) * 1000;
      if (isNight && score > 0.943) radius *= 1.5;

      return L.latLng(lat, lng).distanceTo([center[1], center[0]]) <= radius;
    });
  }, [geoData]);

  // --- 3. 追跡ループ ---
  useEffect(() => {
    if (!isTracking) return;

    const interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setCheckCount(c => c + 1);

        const found = checkDanger(latitude, longitude);
        const isInDanger = !!found;
        setActiveZone(found ? found.properties : null);

        // 送信関数を呼び出す
        sendLocation(latitude, longitude, isInDanger);

      }, (err) => console.error("位置取得エラー:", err), { enableHighAccuracy: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [isTracking, checkDanger, sendLocation]);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-green-600 p-4 shadow-lg flex justify-between items-center text-white">
        <div className="flex items-center gap-2"><Shield /><h1 className="text-xl font-bold">SafeWatch Child</h1></div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-full"><Settings /></button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {showSettings && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-green-200 space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1">Child ID</label>
              <input className="w-full p-3 bg-slate-50 border rounded-xl" value={childId} onChange={e => setChildId(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 ml-1">Parent ID</label>
              <input className="w-full p-3 bg-slate-50 border rounded-xl" value={parentId} onChange={e => setParentId(e.target.value)} />
            </div>
            <button onClick={() => { 
              localStorage.setItem('childId', childId); 
              localStorage.setItem('parentId', parentId); 
              setShowSettings(false); 
              alert("設定を保存しました");
            }} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">保存</button>
          </div>
        )}

        <div className="flex gap-4 text-slate-600 font-bold">
           <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm flex items-center gap-2"><User size={16} className="text-green-500"/> {childId || '未設定'}</div>
           <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm flex items-center gap-2"><Activity size={16} className="text-green-500"/> Check: {checkCount}</div>
        </div>

        <div className={`p-6 rounded-3xl shadow-xl transition-all ${activeZone ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-bold">ステータス</p>
              <h2 className="text-2xl font-black">{isTracking ? (activeZone ? '⚠️ 危険エリア内' : '✅ 正常に動作中') : '💤 停止中'}</h2>
            </div>
            {activeZone ? <AlertTriangle size={32} /> : <Shield size={32} className="text-green-600" />}
          </div>
        </div>

        <div className="h-80 rounded-3xl overflow-hidden shadow-lg border-4 border-white relative">
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DangerMapContent userPosition={position} />
            <RecenterMap coords={position} />
            <Marker position={position} />
          </MapContainer>
        </div>

        <button 
          onClick={() => setIsTracking(!isTracking)} 
          disabled={!childId || !parentId}
          className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 ${isTracking ? 'bg-slate-800 text-white' : 'bg-green-500 text-white'}`}
        >
          {isTracking ? <><Square size={20} /> 見守りを停止</> : <><Play size={20} /> 見守りを開始</>}
        </button>
        {!childId && <p className="text-center text-xs text-red-500 font-bold">※設定からIDを入力してください</p>}
      </div>
    </div>
  );
};

export default ChildTracker;