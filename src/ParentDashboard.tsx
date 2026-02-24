import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { ShieldCheck, Navigation, History } from 'lucide-react';
import { supabase } from './supabaseClient'; // 追加

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords); }, [coords]);
  return null;
};

const ParentDashboard = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [childPos, setChildPos] = useState<[number, number] | null>(null);
  const [isDanger, setIsDanger] = useState(false);
  const [parentId] = useState(localStorage.getItem('parentId') || 'parent001');

  useEffect(() => {
    if (!isMonitoring) return;

    // Supabase リアルタイム購読
    const channel = supabase
      .channel('realtime-location')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs' }, (payload) => {
        const newLog = payload.new;
        if (newLog.parent_id === parentId) {
          if (newLog.is_active) {
            setChildPos([newLog.latitude, newLog.longitude]);
            setIsDanger(true);
          } else {
            setIsDanger(false);
            setChildPos(null);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isMonitoring, parentId]);

  return (
    <div className="min-h-screen bg-indigo-50 p-4 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><ShieldCheck className="text-indigo-600" /> 見守り状態</h2>
          <div className={`p-4 rounded-2xl text-center font-bold ${isDanger ? 'bg-red-100 text-red-600 animate-bounce' : 'bg-slate-100 text-slate-500'}`}>
            {isDanger ? '⚠️ 危険エリア侵入中' : 'エリア外（待機中）'}
          </div>
          <button onClick={() => setIsMonitoring(!isMonitoring)} className={`w-full mt-4 py-3 rounded-xl font-bold ${isMonitoring ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>
            {isMonitoring ? '監視を停止' : '監視を開始'}
          </button>
        </div>

        <div className="md:col-span-2 bg-white p-2 rounded-3xl shadow-lg h-[500px] relative overflow-hidden border-4 border-white">
          {!childPos && (
            <div className="absolute inset-0 z-[1000] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center text-center">
              <div className="bg-white p-6 rounded-2xl shadow-xl">
                <Navigation className="mx-auto mb-2 text-indigo-500 animate-bounce" />
                <p className="font-bold text-slate-600">危険エリアに入ると<br/>位置が表示されます</p>
              </div>
            </div>
          )}
          <MapContainer center={[35.0222, 135.9619]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {childPos && (
              <>
                <RecenterMap coords={childPos} />
                <Marker position={childPos} />
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;