import React, { useState, useEffect } from 'react';
import { Lock, Unlock, PlusCircle, LayoutDashboard, User, UserPlus } from 'lucide-react';

const API_URL = '/api';
const ROWS = Array.from({ length: 70 }, (_, i) => String(i + 1).padStart(2, '0'));

// --- COMPOSANT TABLEAU RÉUTILISABLE ---
const Table = ({ columns, rows, entries, onInputChange, isUserView }) => {
  return (
      <div className="overflow-x-auto bg-white shadow-xl rounded-xl border border-slate-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-800 text-white sticky top-0">
          <tr>
            <th className="px-4 py-4 border border-slate-700 w-24 text-center font-bold uppercase tracking-wider">Ligne</th>
            {columns.map(col => (
                <th key={col.id} className="px-4 py-4 border border-slate-700 text-center min-w-[140px]">
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold">{col.name}</span>
                    {col.status === 'locked' ?
                        <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                      <Lock size={10} /> VERROUILLÉ
                    </span> :
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                      <Unlock size={10} /> ACTIF
                    </span>
                    }
                  </div>
                </th>
            ))}
          </tr>
          </thead>
          <tbody>
          {rows.map((row) => (
              <tr key={row} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-3 border-r border-slate-100 font-black text-center bg-slate-50 text-slate-600">{row}</td>
                {columns.map(col => {
                  const val = entries[row]?.[col.id] || '';
                  return (
                      <td key={col.id} className="px-3 py-2 border-r border-slate-100 text-center">
                        {isUserView ? (
                            <input
                                type="number"
                                disabled={col.status === 'locked'}
                                value={val}
                                onChange={(e) => onInputChange(row, col.id, e.target.value)}
                                className={`w-full p-2 border rounded-md text-center transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none
                          ${col.status === 'locked' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white border-slate-300 shadow-sm'}`}
                            />
                        ) : (
                            <span className={`font-bold text-lg ${val > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                        {val || 0}
                      </span>
                        )}
                      </td>
                  );
                })}
              </tr>
          ))}
          </tbody>
        </table>
      </div>
  );
};

// --- VUE UTILISATEUR ---
const UserView = ({ userId, userName }) => {
  const [columns, setColumns] = useState([]);
  const [entries, setEntries] = useState({});

  const fetchColumns = async () => {
    const res = await fetch(`${API_URL}/columns`);
    setColumns(await res.json());
  };

  const fetchEntries = async () => {
    const res = await fetch(`${API_URL}/user/${userId}/entries`);
    const data = await res.json();
    const formatted = {};
    data.forEach(e => {
      if (!formatted[e.row_number]) formatted[e.row_number] = {};
      formatted[e.row_number][e.column_id] = e.quantity;
    });
    setEntries(formatted);
  };

  const saveEntry = async (row, colId, quantity) => {
    await fetch(`${API_URL}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, row_number: row, column_id: colId, quantity }),
    });
  };

  const handleInputChange = (row, colId, value) => {
    const quantity = parseInt(value) || 0;
    setEntries(prev => ({
      ...prev,
      [row]: { ...(prev[row] || {}), [colId]: quantity }
    }));
    saveEntry(row, colId, quantity);
  };

  useEffect(() => {
    fetchColumns();
    fetchEntries();
  }, [userId]);

  return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-6 flex items-center gap-3 text-slate-800">
            <div className="p-2 bg-blue-600 rounded-lg text-white"><User size={24} /></div>
            Espace de Saisie : <span className="text-blue-600">{userName}</span>
          </h2>
          <Table columns={columns} rows={ROWS} entries={entries} onInputChange={handleInputChange} isUserView={true} />
        </div>
      </div>
  );
};

// --- VUE GLOBALE ---
const GlobalView = ({ onUserAdded }) => {
  const [columns, setColumns] = useState([]);
  const [entries, setEntries] = useState({});

  const fetchData = async () => {
    const colsRes = await fetch(`${API_URL}/columns`);
    setColumns(await colsRes.json());
    const entriesRes = await fetch(`${API_URL}/admin/entries`);
    const data = await entriesRes.json();
    const formatted = {};
    data.forEach(e => {
      if (!formatted[e.row_number]) formatted[e.row_number] = {};
      formatted[e.row_number][e.column_id] = e.total_quantity;
    });
    setEntries(formatted);
  };

  const handleAddUser = async () => {
    const name = prompt("Nom du nouvel utilisateur :");
    if (name && name.trim() !== "") {
      await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      onUserAdded();
    }
  };

  const handleAction = async () => {
    if(window.confirm("Voulez-vous vraiment verrouiller la colonne actuelle et passer à la suivante ?")) {
      await fetch(`${API_URL}/admin/columns/action`, { method: 'POST' });
      fetchData();
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-emerald-600 rounded-lg text-white"><LayoutDashboard size={24} /></div>
              Vue Globale Agrégée
            </h2>
            <div className="flex gap-3">
              <button onClick={handleAddUser} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-5 py-2.5 rounded-lg shadow-sm hover:bg-slate-50 transition font-semibold">
                <UserPlus size={20} className="text-blue-600" /> Ajouter Utilisateur
              </button>
              <button onClick={handleAction} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg shadow-lg hover:bg-emerald-700 transition font-semibold">
                <PlusCircle size={20} /> Verrouiller & Suivant
              </button>
            </div>
          </div>
          <Table columns={columns} rows={ROWS} entries={entries} isUserView={false} />
        </div>
      </div>
  );
};

// --- COMPOSANT RACINE ---
export default function App() {
  const [currentView, setCurrentView] = useState('global');
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    const res = await fetch(`${API_URL}/users`);
    const data = await res.json();
    setUsers(data);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900">
        <nav className="bg-slate-900 text-white p-2 flex items-center gap-2 overflow-x-auto shadow-2xl sticky top-0 z-50">
          <button
              onClick={() => setCurrentView('global')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap ${currentView === 'global' ? 'bg-emerald-600 shadow-inner' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <LayoutDashboard size={18} /> Vue Globale
          </button>

          <div className="h-8 w-px bg-slate-700 mx-2 shadow-sm" />

          {users.map(user => (
              <button
                  key={user.id}
                  onClick={() => setCurrentView(`user-${user.id}`)}
                  className={`px-6 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap ${currentView === `user-${user.id}` ? 'bg-blue-600 shadow-inner' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {user.name}
              </button>
          ))}
        </nav>

        <main className="flex-grow">
          {currentView === 'global' && <GlobalView onUserAdded={fetchUsers} />}
          {users.map(user =>
              currentView === `user-${user.id}` ? (
                  <UserView key={user.id} userId={user.id} userName={user.name} />
              ) : null
          )}
        </main>
      </div>
  );
}