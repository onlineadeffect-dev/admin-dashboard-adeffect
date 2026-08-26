import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './Careers.css';

const SearchIcon = () => (
  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const PlusIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const EditIcon = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const UsersIcon = () => (
  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const Careers = () => {
  const [careers, setCareers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('careers'); // 'careers' or 'applications'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');

  // Modal States
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState(null);
  const [careerFormData, setCareerFormData] = useState({
    job_title: '',
    requirements: ''
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [careersRes, appsRes] = await Promise.all([
        supabase.from('careers').select('*').order('created_at', { ascending: false }),
        supabase.from('career_applications').select('*').order('created_at', { ascending: false })
      ]);

      if (careersRes.error) throw careersRes.error;
      if (appsRes.error) throw appsRes.error;

      setCareers(careersRes.data || []);
      setApplications(appsRes.data || []);
    } catch (error) {
      console.error('Error fetching careers data:', error);
      showNotification('error', `Failed to load careers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Map careers by role_id for quick job title lookup
  const careerMap = useMemo(() => {
    const map = {};
    careers.forEach((c) => {
      const key = c.role_id || c.id;
      map[key] = c.job_title || 'Unknown Role';
    });
    return map;
  }, [careers]);

  // Applications count by role_id
  const appsCountByRole = useMemo(() => {
    const counts = {};
    applications.forEach((app) => {
      const key = app.role_id;
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [applications]);

  // Filtered Careers
  const filteredCareers = useMemo(() => {
    if (!searchQuery.trim()) return careers;
    const q = searchQuery.toLowerCase();
    return careers.filter((c) => {
      const title = (c.job_title || '').toLowerCase();
      const reqs = (c.requirements || '').toLowerCase();
      const roleId = (c.role_id || c.id || '').toString().toLowerCase();
      return title.includes(q) || reqs.includes(q) || roleId.includes(q);
    });
  }, [careers, searchQuery]);

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Role filter
      if (selectedRoleFilter !== 'ALL' && String(app.role_id) !== String(selectedRoleFilter)) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (app.applicant_name || '').toLowerCase();
        const roleTitle = (careerMap[app.role_id] || '').toLowerCase();
        return name.includes(q) || roleTitle.includes(q);
      }
      return true;
    });
  }, [applications, selectedRoleFilter, searchQuery, careerMap]);

  // Handle Opening Add/Edit Career Modal
  const handleOpenCareerModal = (career = null) => {
    if (career) {
      setEditingCareer(career);
      setCareerFormData({
        job_title: career.job_title || '',
        requirements: career.requirements || ''
      });
    } else {
      setEditingCareer(null);
      setCareerFormData({
        job_title: '',
        requirements: ''
      });
    }
    setIsCareerModalOpen(true);
  };

  const handleSaveCareer = async (e) => {
    e.preventDefault();
    if (!careerFormData.job_title.trim()) {
      showNotification('error', 'Job Title is required.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingCareer) {
        // Update
        const targetId = editingCareer.role_id || editingCareer.id;
        const query = editingCareer.role_id 
          ? supabase.from('careers').update(careerFormData).eq('role_id', editingCareer.role_id)
          : supabase.from('careers').update(careerFormData).eq('id', editingCareer.id);

        const { error } = await query;
        if (error) throw error;
        showNotification('success', 'Career posting updated successfully!');
      } else {
        // Create
        const { error } = await supabase
          .from('careers')
          .insert([careerFormData]);

        if (error) throw error;
        showNotification('success', 'New career posting created successfully!');
      }

      setIsCareerModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving career:', error);
      showNotification('error', `Failed to save career: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCareer = async (career) => {
    const targetId = career.role_id || career.id;
    try {
      setSubmitting(true);
      const query = career.role_id 
        ? supabase.from('careers').delete().eq('role_id', career.role_id)
        : supabase.from('careers').delete().eq('id', career.id);

      const { error } = await query;
      if (error) throw error;

      showNotification('success', 'Career posting deleted successfully.');
      setDeleteConfirmId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting career:', error);
      showNotification('error', `Failed to delete career: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewRoleApplications = (roleId) => {
    setSelectedRoleFilter(String(roleId));
    setActiveTab('applications');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="careers-container">
      {/* Header */}
      <div className="careers-header">
        <div className="header-left">
          <h1>Careers & Applications Management</h1>
          <p className="subtitle">Manage open job postings and review submitted candidate applications</p>
        </div>
        <div className="header-actions">
          <button className="add-career-btn" onClick={() => handleOpenCareerModal()}>
            <PlusIcon /> Post New Career
          </button>
        </div>
      </div>

      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Tabs & Search Navigation */}
      <div className="careers-controls">
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'careers' ? 'active' : ''}`}
            onClick={() => setActiveTab('careers')}
          >
            Posted Careers ({careers.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            Candidate Applications ({applications.length})
          </button>
        </div>

        <div className="controls-row">
          <div className="search-box">
            <SearchIcon />
            <input
              type="text"
              placeholder={
                activeTab === 'careers'
                  ? 'Search by job title or requirements...'
                  : 'Search by applicant name or role...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {activeTab === 'applications' && (
            <div className="role-filter-group">
              <label>Filter by Role:</label>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles ({applications.length})</option>
                {careers.map((c) => {
                  const rId = c.role_id || c.id;
                  const count = appsCountByRole[rId] || 0;
                  return (
                    <option key={rId} value={rId}>
                      {c.job_title} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tab 1: Posted Careers Table */}
      {activeTab === 'careers' && (
        <div className="careers-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading career postings...</p>
            </div>
          ) : filteredCareers.length === 0 ? (
            <div className="empty-state">
              <h3>No career postings found</h3>
              <p>Click "Post New Career" to add your first job opening.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="careers-table">
                <thead>
                  <tr>
                    <th>Role ID</th>
                    <th>Job Title</th>
                    <th>Requirements / Description</th>
                    <th>Applications</th>
                    <th>Date Posted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCareers.map((career) => {
                    const rId = career.role_id || career.id;
                    const appCount = appsCountByRole[rId] || 0;

                    return (
                      <tr key={rId}>
                        <td className="cell-role-id">#{rId}</td>
                        <td className="cell-title">
                          <strong>{career.job_title}</strong>
                        </td>
                        <td className="cell-requirements">
                          <p className="reqs-text">{career.requirements || 'No specific requirements listed.'}</p>
                        </td>
                        <td className="cell-apps">
                          <button
                            className="badge-apps-btn"
                            onClick={() => handleViewRoleApplications(rId)}
                            title="Click to view applicants"
                          >
                            <UsersIcon /> {appCount} Applicants
                          </button>
                        </td>
                        <td className="cell-date">{formatDate(career.created_at)}</td>
                        <td className="cell-actions">
                          <button
                            className="btn-icon-action edit"
                            onClick={() => handleOpenCareerModal(career)}
                            title="Edit Role"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="btn-icon-action delete"
                            onClick={() => setDeleteConfirmId(rId)}
                            title="Delete Role"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Candidate Applications Table */}
      {activeTab === 'applications' && (
        <div className="applications-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="empty-state">
              <h3>No applications received yet</h3>
              <p>When candidates apply online, their details and CV links will appear here.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Applied For Role</th>
                    <th>CV / Resume</th>
                    <th>Date Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => {
                    const jobTitle = careerMap[app.role_id] || `Role #${app.role_id}`;
                    return (
                      <tr key={app.id || app.created_at + app.applicant_name}>
                        <td className="cell-applicant">
                          <strong>{app.applicant_name || 'N/A'}</strong>
                        </td>
                        <td className="cell-role">
                          <span className="role-tag">{jobTitle}</span>
                        </td>
                        <td className="cell-cv">
                          {app.cv_url ? (
                            <a
                              href={app.cv_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cv-link-btn"
                            >
                              View CV <ExternalLinkIcon />
                            </a>
                          ) : (
                            <span className="no-cv">No CV Link</span>
                          )}
                        </td>
                        <td className="cell-date">{formatDate(app.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Career Add/Edit Modal */}
      {isCareerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingCareer ? 'Edit Career Posting' : 'Post New Career Opening'}</h2>
              <button className="close-btn" onClick={() => setIsCareerModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCareer} className="career-form">
              <div className="form-group">
                <label>Job Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Media Buyer / Graphic Designer"
                  value={careerFormData.job_title}
                  onChange={(e) => setCareerFormData({ ...careerFormData, job_title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Requirements & Description</label>
                <textarea
                  rows="6"
                  placeholder="Enter key requirements, experience needed, responsibilities, and qualifications..."
                  value={careerFormData.requirements}
                  onChange={(e) => setCareerFormData({ ...careerFormData, requirements: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCareerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCareer ? 'Save Changes' : 'Post Career'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal">
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="close-btn" onClick={() => setDeleteConfirmId(null)}>
                &times;
              </button>
            </div>
            <div className="delete-modal-body">
              <p>Are you sure you want to delete this career posting? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                className="btn-delete-confirm"
                onClick={() => {
                  const career = careers.find((c) => (c.role_id || c.id) === deleteConfirmId);
                  if (career) handleDeleteCareer(career);
                }}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Posting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Careers;
