import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { Shield, AlertTriangle, Settings, Play, Square } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './supabaseClient'; // 追加

// アイコン修正
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords); }, [coords]);
  return null;
};

const ChildTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<[number, number]>([35.0222, 135.9619]); // 草津駅
  const [dangerZones, setDangerZones] = useState([]);
  const [activeZone, setActiveZone] = useState<any>(null);
  const [childId, setChildId] = useState(localStorage.getItem('childId') || 'child001');
  const [parentId, setParentId] = useState(localStorage.getItem('parentId') || 'parent001');

    useEffect(() => {
      fetch('/tables/danger_zones.json')
        .then(res => res.json())
        .then(json => {
          console.log("読み込んだ危険エリア:", json.data); // これがコンソールに出るか？
          setDangerZones(json.data);
        })
        .catch(err => console.error("読み込みエラー:", err));
    }, []);
    
  // Supabaseへ送信する関数
  const sendLocationToDB = async (lat: number, lng: number, isActive: boolean) => {
    const { error } = await supabase
      .from('location_logs')
      .insert([{ child_id: childId, parent_id: parentId, latitude: lat, longitude: lng, is_active: isActive }]);
    if (error) console.error("送信エラー:", error.message);
  };

  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);

          const foundZone = dangerZones.find((zone: any) => 
            L.latLng(latitude, longitude).distanceTo([zone.latitude, zone.longitude]) <= zone.radius
          );

          if (foundZone) {
            if (!activeZone) {
              setActiveZone(foundZone);
              sendLocationToDB(latitude, longitude, true); // 侵入
            }
          } else if (activeZone) {
            sendLocationToDB(latitude, longitude, false); // 退出
            setActiveZone(null);
          }
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isTracking, dangerZones, activeZone]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-4">
        <div className={`p-6 rounded-3xl shadow-xl transition-all ${activeZone ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 font-bold">現在の状態</p>
              <h1 className="text-2xl font-black">{activeZone ? '危険エリア内' : '安全に見守り中'}</h1>
            </div>
            <div className={`p-3 rounded-full ${activeZone ? 'bg-white/20' : 'bg-green-100'}`}>
              {activeZone ? <AlertTriangle size={32} /> : <Shield size={32} className="text-green-600" />}
            </div>
          </div>
        </div>

        <div className="h-80 rounded-3xl overflow-hidden shadow-lg border-4 border-white">
          <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap coords={position} />
            <Marker position={position} />
            {dangerZones.map((zone: any) => (
              <Circle 
                key={zone.id}
                center={[zone.latitude, zone.longitude]} // ここが数値であることを確認
                radius={zone.radius}
                pathOptions={{ 
                  color: 'red', 
                  fillColor: 'red', 
                  fillOpacity: 0.3,
                  weight: 2 
                }}
              />
            ))}
          </MapContainer>
        </div>

        <button onClick={() => setIsTracking(!isTracking)} className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${isTracking ? 'bg-slate-800 text-white' : 'bg-green-500 text-white'}`}>
          {isTracking ? <><Square size={20} /> 停止</> : <><Play size={20} /> 開始</>}
        </button>
      </div>
    </div>
  );
};

export default ChildTracker;