import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './Bookings.css';

const SearchIcon = () => (
  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const FilterIcon = () => (
  <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState('All'); // 'All', 'Active', 'Inactive'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');
          
        if (bookingsError) throw bookingsError;

        // Fetch users for business names
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('user_id, business_name');
          
        if (usersError) throw usersError;

        // Map users to a dictionary for quick lookup
        const userMap = {};
        usersData.forEach(user => {
          userMap[user.user_id] = user.business_name;
        });

        // Combine data
        const enrichedBookings = bookingsData.map(booking => ({
          ...booking,
          business_name: userMap[booking.user_id] || 'Unknown Business'
        }));

        setBookings(enrichedBookings);
      } catch (error) {
        console.error('Error fetching bookings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle clicking outside of filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredBookings = bookings.filter(booking => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (booking.billboard_id && booking.billboard_id.toString().toLowerCase().includes(searchLower)) ||
      (booking.business_name && booking.business_name.toLowerCase().includes(searchLower));

    // Status filter
    let matchesStatus = true;
    if (filterOption === 'Active') {
      matchesStatus = booking.is_active === true;
    } else if (filterOption === 'Inactive') {
      matchesStatus = booking.is_active === false;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bookings-page">
      <h1 className="page-title">BOOKINGS</h1>

      <div className="search-filter-container">
        <div className="search-wrapper">
          <SearchIcon />
          <input
            type="text"
            className="search-input"
            placeholder="Search through billboard id or business name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-wrapper" ref={filterRef}>
          <button 
            className="filter-button" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            title="Filter bookings"
          >
            <FilterIcon />
          </button>

          {isFilterOpen && (
            <div className="filter-dropdown">
              {['All', 'Active', 'Inactive'].map(option => (
                <div
                  key={option}
                  className={`filter-option ${filterOption === option ? 'selected' : ''}`}
                  onClick={() => {
                    setFilterOption(option);
                    setIsFilterOpen(false);
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading bookings...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="empty-state">No bookings found.</div>
      ) : (
        <div className="bookings-grid">
          {filteredBookings.map(booking => (
            <div key={booking.booking_id} className="booking-card">
              <div className="booking-header">
                <h3 className="billboard-id">{booking.billboard_id || 'No ID'}</h3>
                <span className={`status-badge ${booking.is_active ? 'active' : 'inactive'}`}>
                  {booking.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="booking-detail">
                <span className="detail-label">Client</span>
                <span className="business-name">{booking.business_name}</span>
              </div>

              {booking.official_timeframe && (
                <div className="booking-detail">
                  <span className="detail-label">Timeframe</span>
                  <span>{booking.official_timeframe}</span>
                </div>
              )}

              <div className="booking-dates">
                <div>
                  <div className="detail-label">Start</div>
                  <div>{formatDate(booking.start_time)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="detail-label">End</div>
                  <div>{formatDate(booking.end_time)}</div>
                </div>
              </div>

              {(booking.quotation_pdf_url || booking.brief_url) && (
                <div className="booking-links">
                  {booking.quotation_pdf_url && (
                    <a href={booking.quotation_pdf_url} target="_blank" rel="noreferrer" className="doc-link">
                      View Quotation
                    </a>
                  )}
                  {booking.brief_url && (
                    <a href={booking.brief_url} target="_blank" rel="noreferrer" className="doc-link">
                      View Brief
                    </a>
                  )}
                </div>
              )}

              <div className="booking-id-small">ID: {booking.booking_id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bookings;
