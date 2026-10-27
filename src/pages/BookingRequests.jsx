import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './BookingRequests.css';

const formatBillboardIds = (booking) => {
  if (booking.items && booking.items.length > 0) {
    const fromItems = booking.items.map((i) => i.billboard_id).filter(Boolean);
    if (fromItems.length > 0) {
      return fromItems.join(', ');
    }
  }

  const raw = booking.billboard_id;
  if (!raw) return '';

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return item.billboard_id || item.id || item.name || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join(', ');
  }

  if (typeof raw === 'object') {
    return raw.billboard_id || raw.id || raw.name || JSON.stringify(raw);
  }

  return String(raw);
};

const renderExtraServices = (services) => {
  if (!services) return null;
  if (typeof services === 'string') return services;
  if (Array.isArray(services)) {
    return services
      .map((s) => (typeof s === 'object' && s !== null ? s.name || s.title || JSON.stringify(s) : String(s)))
      .join(', ');
  }
  if (typeof services === 'object') {
    const activeKeys = Object.entries(services)
      .filter(([, v]) => v === true || (typeof v === 'string' && v.trim() !== '') || typeof v === 'number')
      .map(([k, v]) => (v === true ? k.replace(/_/g, ' ') : `${k.replace(/_/g, ' ')}: ${v}`));
    if (activeKeys.length > 0) {
      return activeKeys.join(', ');
    }
    return JSON.stringify(services);
  }
  return String(services);
};

const getStatusClass = (status) => {
  const s = String(status || 'in review').toLowerCase().trim();
  if (s === 'approved') return 'approved';
  if (s === 'rejected' || s === 'declined') return 'rejected';
  return 'in-review';
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const BookingRequests = ({ onNavigateToCreateQuotation }) => {
  const [requestedBookings, setRequestedBookings] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all rows from requested_bookings and requested_booking_items
      const [bookingsRes, itemsRes] = await Promise.all([
        supabase.from('requested_bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('requested_booking_items').select('*'),
      ]);
      if (bookingsRes.error) throw bookingsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const bookingsData = bookingsRes.data || [];
      const itemsData = itemsRes.data || [];

      // Attach items to bookings
      // In requested_booking_items: id or booking_id references requested_bookings.id
      bookingsData.forEach((b) => {
        b.items = itemsData.filter(
          (i) => String(i.booking_id) === String(b.id) || String(i.id) === String(b.id)
        );
        b.billboard_ids = formatBillboardIds(b);
      });

      // Fetch users for business_name lookup
      let usersData = null;
      const { data: uData, error: uError } = await supabase
        .from('users')
        .select('user_id, business_name, user_name, email');

      if (!uError && uData) {
        usersData = uData;
      } else {
        const { data: uFallback } = await supabase
          .from('user')
          .select('user_id, id, business_name, user_name, email');
        usersData = uFallback || [];
      }

      if (usersData) {
        const uMap = {};
        usersData.forEach((u) => {
          const uid = u.user_id || u.id;
          if (uid) uMap[uid] = u;
          if (u.email) uMap[u.email] = u;
        });
        setUsersMap(uMap);
      }

      setRequestedBookings(bookingsData || []);
    } catch (error) {
      console.error('Error fetching requested bookings:', error);
      showNotification('error', `Failed to load booking requests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requestedBookings;
    const q = searchQuery.toLowerCase();
    return requestedBookings.filter((item) => {
      const billboardId = (item.billboard_ids || '').toLowerCase();
      const userObj = usersMap[item.user_id] || (item.user_email ? usersMap[item.user_email] : null);
      const businessName = (userObj?.business_name || userObj?.user_name || '').toLowerCase();
      const userEmail = (userObj?.email || item.user_email || '').toLowerCase();
      const status = (item.status || '').toLowerCase();
      const idStr = String(item.id || '');
      return (
        billboardId.includes(q) ||
        businessName.includes(q) ||
        userEmail.includes(q) ||
        status.includes(q) ||
        idStr.includes(q)
      );
    });
  }, [requestedBookings, searchQuery, usersMap]);

  const handleAccept = async (item) => {
    if (processingId) return;
    try {
      setProcessingId(item.id);

      // 1. Set status = 'Approved' in requested_bookings
      const { error: updateError } = await supabase
        .from('requested_bookings')
        .update({ status: 'Approved' })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // 2. Resolve the target user_id
      const userObj = usersMap[item.user_id] || (item.user_email ? usersMap[item.user_email] : null);
      let targetUserId = item.user_id || userObj?.user_id || userObj?.id;

      if (!targetUserId && item.user_email) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_id')
          .eq('email', item.user_email)
          .maybeSingle();
        targetUserId = userData?.user_id;
      }

      // 3. Insert row data into the bookings table
      const billboardIdValue =
        item.billboard_ids ||
        (Array.isArray(item.billboard_id)
          ? item.billboard_id.join(', ')
          : typeof item.billboard_id === 'object' && item.billboard_id !== null
            ? JSON.stringify(item.billboard_id)
            : item.billboard_id);

      const bookingPayload = {
        user_id: targetUserId || null,
        is_active: true,
        start_time: item.start_time,
        end_time: item.end_time,
        billboard_id: billboardIdValue || null,
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

      // 4. Insert items into booking_items
      if (item.items && item.items.length > 0) {
        const itemsPayload = item.items.map((i) => ({
          booking_id: newBookingId,
          billboard_id: String(i.billboard_id),
          start_date: i.start_date || item.start_time,
          end_date: i.end_date || item.end_time,
          price_at_the_time_of_booking: i.price_at_the_time_of_booking ?? null,
          printing_cost: i.printing_cost ?? null,
        }));
        const { error: itemsError } = await supabase
          .from('booking_items')
          .insert(itemsPayload);

        if (itemsError) {
          console.error('Error inserting into booking_items:', itemsError);
        }
      } else if (Array.isArray(item.billboard_id) && item.billboard_id.length > 0) {
        const itemsPayload = item.billboard_id.map((b) => ({
          booking_id: newBookingId,
          billboard_id: typeof b === 'object' && b !== null ? String(b.billboard_id || b.id || '') : String(b),
          start_date: item.start_time,
          end_date: item.end_time,
        }));
        const { error: itemsError } = await supabase
          .from('booking_items')
          .insert(itemsPayload);

        if (itemsError) {
          console.error('Error inserting into booking_items:', itemsError);
        }
      }

      setRequestedBookings((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, status: 'Approved' } : b))
      );

      showNotification('success', `Approved booking request #${item.id}`);

      // 5. Open the create quotation form with this booking preselected
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

      // 1. Set status = 'Rejected' in requested_bookings
      const { error: updateError } = await supabase
        .from('requested_bookings')
        .update({ status: 'Rejected' })
        .eq('id', item.id);

      if (updateError) throw updateError;

      setRequestedBookings((prev) =>
        prev.map((b) => (b.id === item.id ? { ...b, status: 'Rejected' } : b))
      );

      showNotification('info', `Rejected booking request #${item.id}`);

      // 2. Open mailto: link to client email if available
      const userObj = usersMap[item.user_id] || (item.user_email ? usersMap[item.user_email] : null);
      const userEmail = item.user_email || userObj?.email;

      if (userEmail) {
        const billboardNames = item.billboard_ids || 'your requested billboards';
        const subject = encodeURIComponent(`AdEffect Booking Request Update - Billboards ${billboardNames}`);
        const body = encodeURIComponent(
          `Hello,\n\nThank you for submitting a booking request for Billboards ${billboardNames}.\n\nWe regret to inform you that your booking request has been declined.\n\nBest regards,\nAdEffect Team`
        );
        window.location.href = `mailto:${userEmail}?subject=${subject}&body=${body}`;
      }
    } catch (err) {
      console.error('Error declining booking request:', err);
      showNotification('error', err.message || 'Failed to decline booking request.');
    } finally {
      setProcessingId(null);
    }
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
          placeholder="Search through billboard ID, business name, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading booking requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? 'No matching booking requests found.' : 'No requested bookings.'}
        </div>
      ) : (
        <div className="requests-grid">
          {filteredRequests.map((item) => {
            const userObj =
              usersMap[item.user_id] || (item.user_email ? usersMap[item.user_email] : null);
            const businessName =
              userObj?.business_name || userObj?.user_name || userObj?.email || 'Unknown Business';
            const userEmail = userObj?.email || item.user_email || 'N/A';
            const statusClass = getStatusClass(item.status);
            const displayStatus = item.status || 'In Review';
            const isApproved = statusClass === 'approved';
            const isRejected = statusClass === 'rejected';

            return (
              <div key={item.id} className="request-card">
                <div className="card-header">
                  <div className="card-title-group">
                    <h3 className="billboard-id">{item.billboard_ids || 'No Billboard ID'}</h3>
                    <span className="request-id-tag">Request #{item.id}</span>
                  </div>
                  <span className={`status-badge ${statusClass}`}>
                    {displayStatus}
                  </span>
                </div>

                <div className="card-body">
                  <div className="detail-row">
                    <span className="detail-label">BUSINESS</span>
                    <span className="detail-value bold">{businessName}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">USER EMAIL</span>
                    <span className="detail-value">{userEmail}</span>
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

                  {item.items && item.items.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">ITEMS ({item.items.length})</span>
                      <div className="items-list">
                        {item.items.map((it, idx) => (
                          <div key={it.id || idx} className="item-detail-chip">
                            <span className="item-chip-id">{it.billboard_id}</span>
                            {(it.price_at_the_time_of_booking != null || it.printing_cost != null) && (
                              <span className="item-chip-price">
                                {it.price_at_the_time_of_booking != null ? `$${it.price_at_the_time_of_booking}` : ''}
                                {it.printing_cost != null ? ` (Print: $${it.printing_cost})` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.extra_services && (
                    <div className="detail-row">
                      <span className="detail-label">EXTRA SERVICES</span>
                      <span className="detail-value">
                        {renderExtraServices(item.extra_services)}
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
                    disabled={processingId === item.id || isApproved}
                  >
                    {processingId === item.id ? 'PROCESSING...' : 'ACCEPT'}
                  </button>
                  <button
                    className="action-btn decline-btn"
                    onClick={() => handleDecline(item)}
                    disabled={processingId === item.id || isRejected}
                  >
                    REJECT
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
