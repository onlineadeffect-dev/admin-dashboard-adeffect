import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './BookingRequests.css';

const BookingRequests = ({ onNavigateToCreateQuotation }) => {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all rows from pending_bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('pending_bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch users for business_name lookup
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('user_id, business_name, user_name, email');

      if (!usersError && usersData) {
        const uMap = {};
        usersData.forEach((u) => {
          if (u.user_id) uMap[u.user_id] = u.business_name || u.user_name || u.email;
          if (u.email) uMap[u.email] = u.business_name || u.user_name || u.email;
        });
        setUsersMap(uMap);
      }

      setPendingBookings(bookingsData || []);
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      showNotification('error', `Failed to load booking requests: ${error.message}`);
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
    if (!searchQuery.trim()) return pendingBookings;
    const q = searchQuery.toLowerCase();
    return pendingBookings.filter((item) => {
      const billboardId = (item.billboard_id || '').toString().toLowerCase();
      const businessName = (usersMap[item.user_id] || usersMap[item.user_email] || '').toLowerCase();
      return billboardId.includes(q) || businessName.includes(q);
    });
  }, [pendingBookings, searchQuery, usersMap]);

  const handleAccept = async (item) => {
    if (processingId) return;
    try {
      setProcessingId(item.id);

      // 1. Set status = 'APPROVED' in pending_bookings
      const { error: updateError } = await supabase
        .from('pending_bookings')
        .update({ status: 'APPROVED' })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // 2. Fetch the actual user_id from the 'users' table using the booking's email
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', item.user_email)
        .single();

      if (userFetchError || !userData) {
        throw new Error(`User with email ${item.user_email} was not found in active users. Approve their account request first!`);
      }

      // 3. Insert row data (excluding extra_services) into the bookings table
      const { extra_services, id, status, user_email, ...restData } = item;
      const bookingPayload = {
        ...restData,
        is_active: true,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('bookings')
        .insert([bookingPayload])
        .select();

      if (insertError) {
        console.error('Error inserting into bookings:', insertError);
        throw insertError;
      }

      const newBookingId =
        (insertedData && insertedData[0]?.booking_id) ||
        (insertedData && insertedData[0]?.id) ||
        item.id;

      setPendingBookings((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, status: 'APPROVED' } : b))
      );

      showNotification('success', `Approved booking request for Billboard ${item.billboard_id}`);

      // 4. Open the create quotation form with this booking preselected
      if (onNavigateToCreateQuotation) {
        onNavigateToCreateQuotation(newBookingId);
      }
    } catch (err) {
      console.error('Error accepting booking request:', err);
      showNotification('error', err.message || 'Failed to accept booking request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (item) => {
    if (processingId) return;
    try {
      setProcessingId(item.id);

      // 1. Set status = 'DECLINED' in pending_bookings
      const { error: updateError } = await supabase
        .from('pending_bookings')
        .update({ status: 'DECLINED' })
        .eq('id', item.id);

      if (updateError) throw updateError;

      setPendingBookings((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, status: 'DECLINED' } : b))
      );

      showNotification('info', `Declined booking request for Billboard ${item.billboard_id}`);

      // 2. Immediately open a mailto: link to user_email
      if (item.user_email) {
        const subject = encodeURIComponent(`AdEffect Booking Request Update - Billboard ${item.billboard_id}`);
        const body = encodeURIComponent(
          `Hello,\n\nThank you for submitting a booking request for Billboard ${item.billboard_id}.\n\nWe regret to inform you that your booking request has been declined.\n\nBest regards,\nAdEffect Team`
        );
        window.location.href = `mailto:${item.user_email}?subject=${subject}&body=${body}`;
      }
    } catch (err) {
      console.error('Error declining booking request:', err);
      showNotification('error', err.message || 'Failed to decline booking request.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="booking-requests-container">
      <h1 className="page-title">BOOKING REQUESTS</h1>

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
          placeholder="Search through billboard id or business name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading booking requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? 'No matching booking requests found.' : 'No pending booking requests.'}
        </div>
      ) : (
        <div className="requests-grid">
          {filteredRequests.map((item) => {
            const businessName =
              usersMap[item.user_id] || usersMap[item.user_email] || 'Unknown Business';
            const statusClass = (item.status || 'PENDING').toLowerCase();

            return (
              <div key={item.id} className="request-card">
                <div className="card-header">
                  <h3 className="billboard-id">{item.billboard_id || 'No Billboard ID'}</h3>
                  <span className={`status-badge ${statusClass}`}>
                    {item.status || 'PENDING'}
                  </span>
                </div>

                <div className="card-body">
                  <div className="detail-row">
                    <span className="detail-label">BUSINESS</span>
                    <span className="detail-value bold">{businessName}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">USER EMAIL</span>
                    <span className="detail-value">{item.user_email || 'N/A'}</span>
                  </div>

                  <div className="dates-row">
                    <div>
                      <span className="detail-label">START DATE</span>
                      <div className="date-value">{formatDate(item.start_time)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="detail-label">END DATE</span>
                      <div className="date-value">{formatDate(item.end_time)}</div>
                    </div>
                  </div>

                  {item.extra_services && (
                    <div className="detail-row">
                      <span className="detail-label">EXTRA SERVICES</span>
                      <span className="detail-value">
                        {typeof item.extra_services === 'object'
                          ? JSON.stringify(item.extra_services)
                          : item.extra_services}
                      </span>
                    </div>
                  )}

                  {item.brief_url && (
                    <div className="detail-row margin-top">
                      <a
                        href={item.brief_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="brief-link"
                      >
                        View Brief Document &rarr;
                      </a>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    className="action-btn accept-btn"
                    onClick={() => handleAccept(item)}
                    disabled={processingId === item.id || item.status === 'APPROVED'}
                  >
                    {processingId === item.id ? 'PROCESSING...' : 'ACCEPT'}
                  </button>
                  <button
                    className="action-btn decline-btn"
                    onClick={() => handleDecline(item)}
                    disabled={processingId === item.id || item.status === 'DECLINED'}
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingRequests;
