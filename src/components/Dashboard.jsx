import React, { useState } from 'react';
import './Dashboard.css';
import { supabase } from '../supabaseClient';
import DashboardHome from '../pages/DashboardHome';
import ClientsUsers from '../pages/ClientsUsers';
import Bookings from '../pages/Bookings';
import AccountRequests from '../pages/AccountRequests';
import BookingRequests from '../pages/BookingRequests';
import Quotations from '../pages/Quotations';
import Billboards from '../pages/Billboards'; 

const Dashboard = ({ onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [quotationPrefill, setQuotationPrefill] = useState(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('Error logging out:', error.message);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'DASHBOARD' },
    { id: 'billboards', label: 'BILLBOARDS' },
    { id: 'clients', label: 'CLIENTS/USERS' },
    { id: 'bookings', label: 'BOOKINGS' },
    { id: 'booking-requests', label: 'BOOKING REQUESTS' },
    { id: 'quotations', label: 'QUOTATIONS' },
    { id: 'account-requests', label: 'ACCOUNT REQUESTS' },
  ];

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardHome />;
      case 'clients':
        return <ClientsUsers />;
      case 'bookings':
        return <Bookings />;
      case 'booking-requests':
        return (
          <BookingRequests
            onNavigateToCreateQuotation={(bookingId) => {
              setQuotationPrefill({ bookingId });
              setActivePage('quotations');
            }}
          />
        );
      case 'quotations':
        return (
          <Quotations
            startInCreate={Boolean(quotationPrefill)}
            prefillBookingId={quotationPrefill?.bookingId || null}
            onCreateConsumed={() => setQuotationPrefill(null)}
          />
        );
      case 'account-requests':
        return <AccountRequests />;
      default:
        return (
          <div className="coming-soon">
            <h2>Coming Soon</h2>
          </div>
        );

      case 'billboards':
        return <Billboards />;
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="dashboard-sidebar">
        <div className="sidebar-top">
          <div className="avatar-circle">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="logout-btn" onClick={handleLogout}>
            LOGOUT <span>&rarr;</span>
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;
