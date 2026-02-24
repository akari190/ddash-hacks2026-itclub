import React, { useState, useEffect } from 'react';
import { TileLayer, Circle, Popup, useMap } from 'react-leaflet';

// スコアをラベルと色に変換
const getRiskInfo = (s: number) => {
  if (s > 0.945) return { label: "高リスク", color: "#800026" };
  if (s > 0.943) return { label: "中リスク", color: "#BD0026" };
  return { label: "小リスク", color: "#FC4E2A" };
};

// 座標の照合関数
const isLocationMatch = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  return Math.abs(lat1 - lat2) < 0.0005 && Math.abs(lon1 - lon2) < 0.0005;
};

// 現実世界のメートル半径を計算
const riskToRealRadius = (risk: number, isNight: boolean) => {
  const baseRadius = 150; 
  let radius = baseRadius + (risk - 0.94) * 1000;
  if (isNight && risk > 0.943) radius *= 1.5;
  return radius;
};

const RecenterMap = ({ coords }: { coords: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16, { animate: true });
  }, [coords, map]);
  return null;
};

interface DangerMapProps {
  userPosition?: [number, number] | null;
}

const DangerMapContent: React.FC<DangerMapProps> = ({ userPosition }) => {
  const [geoData, setGeoData] = useState<any>(null);
  const [zonesJson, setZonesJson] = useState<any[]>([]);
  const isNight = new Date().getHours() >= 20 || new Date().getHours() < 5;

  useEffect(() => {
    // public フォルダ内のファイルをフェッチ
    Promise.all([
      fetch('/tables/danger_areas.geojson').then(res => res.json()),
      fetch('/tables/danger_zones.json').then(res => res.json())
    ]).then(([geo, json]) => {
      setGeoData(geo);
      setZonesJson(json.data);
    }).catch(err => console.error("データ読み込み失敗:", err));
  }, []);

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {userPosition && <RecenterMap coords={userPosition} />}

      {geoData && zonesJson.length > 0 && geoData.features.map((feature: any, idx: number) => {
        const score = feature.properties.risk_score || 0;
        const coords = feature.geometry.coordinates[0][0]; // Polygonの開始点
        const geoLon = coords[0];
        const geoLat = coords[1];

        const detail = zonesJson.find(z => isLocationMatch(geoLat, geoLon, z.latitude, z.longitude));
        const risk = getRiskInfo(score);
        const radius = riskToRealRadius(score, isNight);

        return (
          <Circle
            key={`danger-${idx}`}
            center={[geoLat, geoLon]}
            radius={radius}
            pathOptions={{
              fillColor: risk.color,
              color: (isNight && score > 0.943) ? "#000" : risk.color,
              weight: isNight ? 2 : 1,
              fillOpacity: isNight ? 0.6 : 0.3,
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <div style={{ borderBottom: `2px solid ${risk.color}`, marginBottom: '5px' }}>
                  <b style={{ color: risk.color }}>{risk.label}</b>
                  {isNight && score > 0.943 && <span style={{ color: 'red', fontSize: '0.8em', float: 'right' }}>⚠️夜間警戒</span>}
                </div>
                {detail && (
                  <div style={{ fontSize: '0.85em' }}>
                    <p><b>📍場所:</b> {detail.name}</p>
                    <p><b>🚨種別:</b> {detail.incident_type}</p>
                    <p><b>⏰発生時刻:</b> {detail.time}</p>
                    <p style={{ color: '#666', fontStyle: 'italic' }}>{detail.description}</p>
                  </div>
                )}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
};

export default DangerMapContent;