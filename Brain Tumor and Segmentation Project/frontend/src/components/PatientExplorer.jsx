import React, { useState, useEffect } from 'react';
import { Search, Eye, Filter, Users } from 'lucide-react';

export default function PatientExplorer({ backendUrl, onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const limit = 12;

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page,
          limit,
          search,
          status
        });
        const res = await fetch(`${backendUrl}/api/patients?${queryParams}`);
        const data = await res.json();
        setPatients(data.patients);
        setTotalPages(data.total_pages);
        setTotalCount(data.total);
      } catch (err) {
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Simple debounce/delay if search is modified
    const delayDebounce = setTimeout(() => {
      fetchPatients();
    }, search ? 300 : 0);

    return () => clearTimeout(delayDebounce);
  }, [backendUrl, page, search, status]);

  // Reset page when filter/search changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setPage(1);
  };

  return (
    <div>
      <div className="content-header">
        <h1>Patient Directory</h1>
        <p>Browse, filter, and search patient cases. Mapped to the preprocessed dataset manifest.</p>
      </div>

      <div className="glass-card">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)' }} 
            />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 42 }}
              placeholder="Search by Patient ID..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select 
              className="select-input"
              value={status}
              onChange={handleStatusChange}
            >
              <option value="all">All Diagnoses</option>
              <option value="healthy">Healthy Only</option>
              <option value="tumor">Tumor Diagnosed</option>
            </select>
          </div>
        </div>

        {/* Patients Grid */}
        {loading ? (
          <div className="spinner-container" style={{ minHeight: 300 }}>
            <div className="spinner"></div>
            <p>Loading patient directory...</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <Users size={40} />
            <h3>No patients found</h3>
            <p>Try clearing your search query or modifying the diagnosis filter.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="explorer-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Total MRI Slices</th>
                    <th>Positive Tumor Slices</th>
                    <th>Diagnosis Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.patient_id}>
                      <td style={{ fontWeight: 600 }}>{patient.patient_id}</td>
                      <td>{patient.total_slices} slices</td>
                      <td>{patient.tumor_slices} slices</td>
                      <td>
                        <span className={`badge ${patient.status === 'Healthy' ? 'healthy' : 'tumor'}`}>
                          {patient.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-action"
                          onClick={() => onSelectPatient(patient.patient_id)}
                        >
                          <Eye size={12} style={{ marginRight: 6, display: 'inline' }} />
                          Analyze Scan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span>Showing {patients.length} of {totalCount} patients</span>
              <div className="pagination-buttons">
                <button
                  className="btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Previous
                </button>
                <span style={{ alignSelf: 'center', margin: '0 8px' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
