import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './Availability.css';

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const SHORT_MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

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

const ChevronUpIcon = () => (
  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const Availability = () => {
  const [billboards, setBillboards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Year & Month Display Controls
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(3); // April (0-indexed)
  const [endMonth, setEndMonth] = useState(10); // November (0-indexed)
  
  // Table Section Collapse States: { [typeKey]: boolean }
  const [collapsedTables, setCollapsedTables] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null); // For detail/edit modal
  const [formData, setFormData] = useState({
    billboard_id: '',
    user_id: '',
    custom_client_name: '',
    start_time: '',
    end_time: '',
    offers: '',
    is_online_booking: false,
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [billboardsRes, bookingsRes, usersRes] = await Promise.all([
        supabase.from('billboards').select('*').order('created_at', { ascending: true }),
        supabase.from('bookings').select('*'),
        supabase.from('users').select('user_id, business_name, user_name, email')
      ]);

      if (billboardsRes.error) throw billboardsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (usersRes.error) throw usersRes.error;

      setBillboards(billboardsRes.data || []);
      setBookings(bookingsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error fetching availability data:', error);
      showNotification('error', `Failed to load availability data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Map users for quick client name lookup
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((user) => {
      map[user.user_id] = user.business_name || user.full_name || user.user_name || user.email;
    });
    return map;
  }, [users]);

  // Group billboards by type / structure
  const groupedBillboards = useMemo(() => {
    const groups = {};
    
    billboards.forEach((board) => {
      const code = board.billboard_id || board.code || board.id || 'N/A';
      const loc = board.location || 'Unknown Location';
      const size = board.size || '';
      const structure = board.structure || board.type || board.media_type || 'GENERAL';
      
      // Create type label similar to physical reference (e.g. UNIPOLE 14.7*4.3, MEGAPOLE 14*80)
      let typeTitle = structure.toUpperCase();
      if (size && !typeTitle.includes(size.toUpperCase())) {
        typeTitle += ` ${size}`;
      }

      if (!groups[typeTitle]) {
        groups[typeTitle] = [];
      }
      
      // Filter by search query if typed
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = code.toLowerCase().includes(q) || loc.toLowerCase().includes(q) || typeTitle.toLowerCase().includes(q);
        if (matches) {
          groups[typeTitle].push({ ...board, code, location: loc });
        }
      } else {
        groups[typeTitle].push({ ...board, code, location: loc });
      }
    });

    // Remove empty groups if search query filter filtered all items out
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }, [billboards, searchQuery]);

  // Visible Month Indices
  const visibleMonths = useMemo(() => {
    const months = [];
    const min = Math.min(startMonth, endMonth);
    const max = Math.max(startMonth, endMonth);
    for (let i = min; i <= max; i++) {
      months.push(i);
    }
    return months;
  }, [startMonth, endMonth]);

  // Check if a billboard is booked in a given month of selectedYear
  const getBookingForMonth = (billboardId, monthIndex, year) => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    return bookings.find((b) => {
      // Check billboard match
      const bId = (b.billboard_id || '').toString();
      const matchBoard = bId === billboardId.toString();
      if (!matchBoard) return false;

      // Check date range overlap
      const startDate = new Date(b.start_time);
      const endDate = new Date(b.end_time);

      return startDate <= monthEnd && endDate >= monthStart;
    });
  };

  const toggleTableCollapse = (typeKey) => {
    setCollapsedTables((prev) => ({
      ...prev,
      [typeKey]: !prev[typeKey]
    }));
  };

  const toggleCollapseAll = () => {
    const nextState = !allCollapsed;
    setAllCollapsed(nextState);
    const newCollapsed = {};
    Object.keys(groupedBillboards).forEach((key) => {
      newCollapsed[key] = nextState;
    });
    setCollapsedTables(newCollapsed);
  };

  // Open Modal for manual/offline booking
  const handleOpenAddModal = (prefillBillboardId = '') => {
    setSelectedBooking(null);
    setFormData({
      billboard_id: prefillBillboardId || (billboards[0]?.billboard_id || billboards[0]?.id || ''),
      user_id: '',
      custom_client_name: '',
      start_time: new Date().toISOString().split('T')[0],
      end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      offers: '',
      is_online_booking: false,
      is_active: true, 
      offline_business_name: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal to view/edit existing booking
  const handleOpenEditBookingModal = (booking) => {
    setSelectedBooking(booking);
    setFormData({
      billboard_id: booking.billboard_id || '',
      user_id: booking.user_id || '',
      custom_client_name: booking.custom_client_name || '',
      start_time: booking.start_time ? booking.start_time.split('T')[0] : '',
      end_time: booking.end_time ? booking.end_time.split('T')[0] : '',
      offers: booking.offers || '',
      is_online_booking: booking.is_online_booking ?? false,
      is_active: booking.is_active ?? true, 
      offline_business_name: booking.offline_business_name || ''
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!formData.billboard_id) {
      showNotification('error', 'Please select a billboard.');
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      showNotification('error', 'Please select both start and end dates.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        billboard_id: formData.billboard_id,
        user_id: formData.user_id || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        offers: formData.offers || null,
        is_online_booking: formData.is_online_booking, // false for offline bookings
        is_active: formData.is_active,
        offline_business_name: formData.offline_business_name
      };

      if (selectedBooking) {
        // Update existing booking
        const { error } = await supabase
          .from('bookings')
          .update(payload)
          .eq('id', selectedBooking.id);

        if (error) throw error;
        showNotification('success', 'Booking updated successfully!');
      } else {
        // Create new offline/manual booking
        const { error } = await supabase
          .from('bookings')
          .insert([payload]);

        if (error) throw error;
        showNotification('success', 'Offline booking added successfully!');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving booking:', error);
      showNotification('error', `Failed to save booking: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePresetMonthView = (preset) => {
    if (preset === 'full') {
      setStartMonth(0);
      setEndMonth(11);
    } else if (preset === 'ref') {
      setStartMonth(3); // April
      setEndMonth(10); // November
    } else if (preset === 'q1') {
      setStartMonth(0);
      setEndMonth(2);
    } else if (preset === 'q2') {
      setStartMonth(3);
      setEndMonth(5);
    } else if (preset === 'q3') {
      setStartMonth(6);
      setEndMonth(8);
    } else if (preset === 'q4') {
      setStartMonth(9);
      setEndMonth(11);
    }
  };

  return (
    <div className="availability-container">
      {/* Top Header & Action Controls */}
      <div className="availability-header">
        <div className="header-left">
          <h1>Billboard Availability & Schedule</h1>
          <p className="subtitle">Real-time digitalization of billboard availability layout by type and date</p>
        </div>
        <div className="header-actions">
          <button className="add-offline-btn" onClick={() => handleOpenAddModal()}>
            <PlusIcon /> Add Offline Booking
          </button>
        </div>
      </div>

      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Control Panel: Month Controls, Search & Table View Toggles */}
      <div className="availability-controls">
        <div className="controls-row">
          {/* Search */}
          <div className="search-box">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search Code, Location or Billboard Type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Year selector */}
          <div className="control-group">
            <label>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Month Range Selectors */}
          <div className="control-group">
            <label>From:</label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>To:</label>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Presets */}
          <div className="preset-buttons">
            <button className="preset-chip" onClick={() => handlePresetMonthView('ref')}>
              April - Nov (Reference)
            </button>
            <button className="preset-chip" onClick={() => handlePresetMonthView('full')}>
              Full 12 Months
            </button>
            <button className="preset-chip" onClick={() => handlePresetMonthView('q1')}>Q1</button>
            <button className="preset-chip" onClick={() => handlePresetMonthView('q2')}>Q2</button>
            <button className="preset-chip" onClick={() => handlePresetMonthView('q3')}>Q3</button>
            <button className="preset-chip" onClick={() => handlePresetMonthView('q4')}>Q4</button>
          </div>

          {/* Collapse/Expand All Tables */}
          <button className="toggle-collapse-btn" onClick={toggleCollapseAll}>
            {allCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
            {allCollapsed ? 'Expand All Tables' : 'Minimize All Tables'}
          </button>
        </div>
      </div>

      {/* Main Content Area: Grouped Tables */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading real-time availability schedule...</p>
        </div>
      ) : Object.keys(groupedBillboards).length === 0 ? (
        <div className="empty-state">
          <h3>No billboards matching your selection</h3>
          <p>Try adjusting your search criteria or add new billboards.</p>
        </div>
      ) : (
        <div className="tables-sequence">
          {Object.entries(groupedBillboards).map(([typeKey, items]) => {
            const isCollapsed = collapsedTables[typeKey];

            return (
              <div key={typeKey} className="billboard-type-block">
                {/* Table Header Bar matching reference sheet green header */}
                <div className="type-block-header" onClick={() => toggleTableCollapse(typeKey)}>
                  <div className="header-title">
                    <span className="badge-code-label">Code</span>
                    <span className="type-title">{typeKey}</span>
                  </div>
                  <div className="header-controls">
                    <span className="count-pill">{items.length} Billboards</span>
                    <button className="collapse-toggle">
                      {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                    </button>
                  </div>
                </div>

                {/* Table Content */}
                {!isCollapsed && (
                  <div className="table-responsive">
                    <table className="availability-table">
                      <thead>
                        <tr>
                          <th className="col-code">Code</th>
                          <th className="col-location">Location / Details</th>
                          {visibleMonths.map((mIdx) => (
                            <th key={mIdx} className="col-month">
                              {SHORT_MONTH_NAMES[mIdx]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((board) => {
                          const boardIdStr = board.billboard_id || board.id || board.code;
                          return (
                            <tr key={boardIdStr}>
                              <td className="cell-code">
                                <strong>{board.code}</strong>
                              </td>
                              <td className="cell-location">{board.location}</td>
                              {visibleMonths.map((mIdx) => {
                                const booking = getBookingForMonth(boardIdStr, mIdx, selectedYear);
                                const isBooked = Boolean(booking);
                                const clientName = isBooked
                                  ? booking.offline_business_name || 'Booked Client'
                                  : null;

                                return (
                                  <td
                                    key={mIdx}
                                    className={`cell-month ${isBooked ? 'booked' : 'available'}`}
                                    onClick={() => isBooked ? handleOpenEditBookingModal(booking) : handleOpenAddModal(boardIdStr)}
                                    title={
                                      isBooked
                                        ? `Client: ${clientName}\nOffers: ${booking.offers || 'None'}\nType: ${booking.is_online_booking ? 'Online' : 'Offline'}\nDates: ${booking.start_time} to ${booking.end_time}`
                                        : 'Click to Add Offline Booking'
                                    }
                                  >
                                    {isBooked ? (
                                      <div className="booking-cell-content">
                                        <span className="client-name">{clientName}</span>
                                        {!booking.is_online_booking && (
                                          <span className="badge-offline" title="Offline/Outside Booking">Offline</span>
                                        )}
                                        {booking.offers && (
                                          <span className="badge-offer" title={`Offer: ${booking.offers}`}>★ Offer</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="cell-available-dash">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Adding Offline Booking / Editing Existing Booking */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedBooking ? 'Booking & Offer Details' : 'Add Outside / Offline Booking'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} className="booking-form">
              <div className="form-group">
                <label>Select Billboard *</label>
                <select
                  name="billboard_id"
                  value={formData.billboard_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Choose Billboard --</option>
                  {billboards.map((board) => (
                    <option key={board.id || board.billboard_id} value={board.billboard_id || board.id}>
                      {board.billboard_id || board.code} - {board.location} ({board.structure || board.size})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Client / Business Name</label>
                <textarea
                  name="offline_business_name"
                  rows="3"
                  placeholder="Enter business or client name if unregistered in database..."
                  value={formData.offline_business_name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Registered Client / Business</label>
                  <select
                    name="user_id"
                    value={formData.user_id}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Client (Optional) --</option>
                    {users.map((usr) => (
                      <option key={usr.user_id} value={usr.user_id}>
                        {usr.business_name || usr.full_name || usr.user_name || usr.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Offers / Special Notes (Text)</label>
                <textarea
                  name="offers"
                  rows="3"
                  placeholder="Enter special offers, package terms, discounts, or notes..."
                  value={formData.offers}
                  onChange={handleInputChange}
                />
              </div>


              <div className="form-row checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_online_booking"
                    checked={formData.is_online_booking}
                    onChange={handleInputChange}
                  />
                  <span>Online Website Booking (Uncheck for Offline/Outside Bookings)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : selectedBooking ? 'Save Changes' : 'Create Offline Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Availability;
