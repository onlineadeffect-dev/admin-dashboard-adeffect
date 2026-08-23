import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './AccountRequests.css';

const AccountRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      showNotification('error', `Failed to load pending account requests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return pendingRequests;
    const lowerQuery = searchQuery.toLowerCase();
    return pendingRequests.filter(req => {
      const businessName = (req.business_name || '').toLowerCase();
      const userName = (req.user_name || '').toLowerCase();
      return businessName.includes(lowerQuery) || userName.includes(lowerQuery);
    });
  }, [pendingRequests, searchQuery]);

  const handleApprove = async (item) => {
    if (processingId) return;
    try {
      setProcessingId(item.id);

      // Step 1: Trigger Supabase auth signup/confirmation email for email
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + 'A1!';
      const { error: authError } = await supabase.auth.signUp({
        email: item.email,
        password: tempPassword,
      });

      if (authError) {
        throw new Error(`Auth Signup Failed: ${authError.message}`);
      }

      // Step 2: Insert the user's details into the users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            user_name: item.user_name,
            business_name: item.business_name,
            website: item.website,
            phone_number: item.phone_number,
            email: item.email,
          },
        ]);

      if (insertError) {
        throw new Error(`Insert User Failed: ${insertError.message}`);
      }

      // Step 3: ONLY after steps 1 and 2 succeed, delete record from pending_users
      const { error: deleteError } = await supabase
        .from('pending_users')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        throw new Error(`Delete Pending User Failed: ${deleteError.message}`);
      }

      setPendingRequests(prev => prev.filter(req => req.id !== item.id));
      showNotification('success', `Approved account request for ${item.business_name || item.user_name || item.email}`);
    } catch (err) {
      console.error('Error during approval workflow:', err);
      showNotification('error', err.message || 'An error occurred while approving the request.');
    } finally {
      setProcessingId(null);
    }
  };

  const openDeclineModal = (item) => {
    setDeclineTarget(item);
  };

  const closeDeclineModal = () => {
    setDeclineTarget(null);
  };

  const handleDeclineOption = async (withEmail) => {
    if (!declineTarget || processingId) return;
    const item = declineTarget;
    try {
      setProcessingId(item.id);

      if (withEmail) {
        // Redirect browser to mailto with template rejection subject & body
        const subject = encodeURIComponent('AdEffect Account Request Update');
        const body = encodeURIComponent(
          `Hello ${item.user_name || 'Applicant'},\n\nThank you for your interest in AdEffect. We regret to inform you that your account request for ${item.business_name || 'your business'} has been declined.\n\nBest regards,\nAdEffect Team`
        );
        window.location.href = `mailto:${item.email}?subject=${subject}&body=${body}`;
      }

      // Delete the record from pending_users
      const { error: deleteError } = await supabase
        .from('pending_users')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        throw new Error(`Delete Pending User Failed: ${deleteError.message}`);
      }

      setPendingRequests(prev => prev.filter(req => req.id !== item.id));
      showNotification(
        'info',
        `Declined account request for ${item.business_name || item.user_name || item.email}`
      );
      closeDeclineModal();
    } catch (err) {
      console.error('Error during decline workflow:', err);
      showNotification('error', err.message || 'An error occurred while declining the request.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="account-requests-container">
      <h1 className="page-title">ACCOUNT REQUESTS</h1>

      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>
            &times;
          </button>
        </div>
      )}

      <div className="search-bar-container">
        <svg
          className="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search through business or client name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="requests-list">
        {loading ? (
          <p className="loading-state">Loading account requests...</p>
        ) : filteredRequests.length === 0 ? (
          <p className="empty-state">
            {searchQuery ? 'No matching account requests found.' : 'No pending account requests.'}
          </p>
        ) : (
          filteredRequests.map((req) => (
            <div key={req.id} className="request-card">
              <div className="card-header-row">
                <div className="business-name">{req.business_name || 'N/A'}</div>
                <div className="client-name">{req.user_name || 'N/A'}</div>
              </div>

              <div className="card-details-grid">
                <div className="detail-item">
                  <span className="detail-label">EMAIL</span>
                  <span className="detail-value">{req.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">PHONE NUMBER</span>
                  <span className="detail-value">{req.phone_number || 'N/A'}</span>
                </div>
                {req.website && (
                  <div className="detail-item">
                    <span className="detail-label">WEBSITE</span>
                    <a
                      href={req.website.startsWith('http') ? req.website : `https://${req.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-value link"
                    >
                      {req.website}
                    </a>
                  </div>
                )}
                {req.hear_about_us && (
                  <div className="detail-item">
                    <span className="detail-label">HEAR ABOUT US</span>
                    <span className="detail-value">{req.hear_about_us}</span>
                  </div>
                )}
                {req.location && (
                  <div className="detail-item">
                    <span className="detail-label">LOCATION</span>
                    <span className="detail-value">{req.location}</span>
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="action-btn approve-btn"
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                >
                  {processingId === req.id ? 'PROCESSING...' : 'APPROVE'}
                </button>
                <button
                  className="action-btn decline-btn"
                  onClick={() => openDeclineModal(req)}
                  disabled={processingId === req.id}
                >
                  DECLINE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {declineTarget && (
        <div className="modal-backdrop" onClick={closeDeclineModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Decline Account Request</h2>
            <p className="modal-description">
              Are you sure you want to decline the request for{' '}
              <strong>{declineTarget.business_name || declineTarget.user_name || declineTarget.email}</strong>?
            </p>

            <div className="modal-actions">
              <button
                className="modal-btn decline-email-btn"
                onClick={() => handleDeclineOption(true)}
                disabled={processingId === declineTarget.id}
              >
                Decline and Email
              </button>
              <button
                className="modal-btn decline-immediate-btn"
                onClick={() => handleDeclineOption(false)}
                disabled={processingId === declineTarget.id}
              >
                Decline Immediately
              </button>
              <button
                className="modal-btn cancel-btn"
                onClick={closeDeclineModal}
                disabled={processingId === declineTarget.id}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountRequests;
