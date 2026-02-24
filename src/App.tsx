import React, { useState } from 'react';
import ChildTracker from './ChildTracker';
import ParentDashboard from './ParentDashboard';

function App() {
  const [mode, setMode] = useState<'home' | 'child' | 'parent'>('home');

  if (mode === 'child') return <ChildTracker />;
  if (mode === 'parent') return <ParentDashboard />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-sm w-full text-center space-y-8">
        <h1 className="text-3xl font-black text-slate-800">SafeWatch</h1>
        <p className="text-slate-500 font-medium">どちらのモードで起動しますか？</p>
        <div className="space-y-4">
          <button 
            onClick={() => setMode('child')}
            className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg hover:bg-green-600 transition shadow-lg shadow-green-200"
          >
            お子様用
          </button>
          <button 
            onClick={() => setMode('parent')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
          >
            保護者用
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;