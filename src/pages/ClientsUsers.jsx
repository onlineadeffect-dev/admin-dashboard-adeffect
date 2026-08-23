import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './ClientsUsers.css';

const ClientsUsers = () => {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersResponse, bookingsResponse] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('bookings').select('client_id')
        ]);

        if (usersResponse.error) throw usersResponse.error;
        if (bookingsResponse.error) throw bookingsResponse.error;

        setUsers(usersResponse.data || []);
        setBookings(bookingsResponse.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const usersWithBookingCount = useMemo(() => {
    return users.map(user => {
      const lifetimeBookings = bookings.filter(b => b.client_id === user.user_id).length;
      return {
        ...user,
        lifetimeBookings
      };
    });
  }, [users, bookings]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersWithBookingCount;
    const lowerQuery = searchQuery.toLowerCase();
    return usersWithBookingCount.filter(user => {
      const userName = (user.user_name || '').toLowerCase();
      const businessName = (user.business_name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const userId = (user.user_id || '').toLowerCase();
      
      return userName.includes(lowerQuery) || 
             businessName.includes(lowerQuery) || 
             email.includes(lowerQuery) || 
             userId.includes(lowerQuery);
    });
  }, [searchQuery, usersWithBookingCount]);

  return (
    <div className="clients-users-container">
      <h1 className="page-title">CLIENTS/USERS</h1>
      
      <div className="search-bar-container">
        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Search through client or business name or client id or email..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="users-list">
        {loading ? (
          <p className="loading-state">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="empty-state">No users found.</p>
        ) : (
          filteredUsers.map(user => (
            <div key={user.user_id || Math.random().toString()} className="user-card">
              <div className="card-left">
                <div className="business-name">{user.business_name || 'N/A'}</div>
                <div className="contact-info">
                  <span className="email">{user.email || 'N/A'}</span>
                  <span className="phone">{user.phone_number || 'N/A'}</span>
                </div>
              </div>
              <div className="card-right">
                <div className="client-name">{user.user_name || 'N/A'}</div>
                <div className="lifetime-bookings">
                  <span className="booking-number">{user.lifetimeBookings}</span>
                  <span className="booking-label">LIFETIME BOOKINGS</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientsUsers;
