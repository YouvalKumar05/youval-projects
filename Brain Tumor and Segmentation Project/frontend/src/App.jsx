import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import PatientExplorer from './components/PatientExplorer';
import PatientAnalyzer from './components/PatientAnalyzer';
import ModelTrainer from './components/ModelTrainer';

const BACKEND_URL = 'http://localhost:5001';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [backendStatus, setBackendStatus] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Periodically check backend status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/status`);
        const data = await res.json();
        setBackendStatus(data);
      } catch (err) {
        console.error('Failed to connect to backend API:', err);
        setBackendStatus({ dataset_loaded: false, models_loaded: false });
      }
    };
    
    checkStatus();
    // Ping every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectPatient = (patientId) => {
    setSelectedPatientId(patientId);
    setActiveTab('analyzer');
  };

  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        backendStatus={backendStatus} 
      />
      <main className="main-content">
        {activeTab === 'overview' && (
          <Overview backendUrl={BACKEND_URL} />
        )}
        {activeTab === 'explorer' && (
          <PatientExplorer 
            backendUrl={BACKEND_URL} 
            onSelectPatient={handleSelectPatient} 
          />
        )}
        {activeTab === 'analyzer' && (
          <PatientAnalyzer 
            backendUrl={BACKEND_URL} 
            preselectedPatientId={selectedPatientId} 
          />
        )}
        {activeTab === 'trainer' && (
          <ModelTrainer backendUrl={BACKEND_URL} />
        )}
      </main>
    </div>
  );
}

export default App;
