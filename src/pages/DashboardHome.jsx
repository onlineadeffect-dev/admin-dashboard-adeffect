import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './DashboardHome.css';

const DashboardHome = () => {
  const [earnings, setEarnings] = useState(null);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [activeBillboards, setActiveBillboards] = useState([]);
  const [loadingBillboards, setLoadingBillboards] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const currentMonthFullName = new Date().toLocaleString('en-US', { month: 'long' });

      // Fetch earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from('quotations')
        .select('total_cost_with_printing')
        .eq('period', currentMonthFullName);
      
      if (!earningsError && earningsData) {
        const total = earningsData.reduce((sum, item) => sum + (Number(item.total_cost_with_printing) || 0), 0);
        setEarnings(total);
      } else {
        setEarnings(0);
      }

      // Fetch bookings count
      const { count: bookingsCount, error: bookingsError } = await supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true })
        .eq('period', currentMonthFullName);
        
      if (!bookingsError) {
        setBookingsThisMonth(bookingsCount || 0);
      } else {
        setBookingsThisMonth(0);
      }

      // Fetch users count
      const { count: usersCount, error: usersError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });
        
      if (!usersError) {
        setUserCount(Math.max(0, (usersCount || 0) - 1));
      } else {
        setUserCount(0);
      }

      // Fetch active billboards
      setLoadingBillboards(true);
      const { data: bookingsData, error: activeBookingsError } = await supabase
        .from('bookings')
        .select('billboard_id')
        .eq('is_active', true);

      if (!activeBookingsError && bookingsData && bookingsData.length > 0) {
        const billboardIds = bookingsData.map(b => b.billboard_id);
        const { data: billboardsData, error: billboardsError } = await supabase
          .from('billboards')
          .select('billboard_id, image_url, location, size')
          .in('billboard_id', billboardIds);

        if (!billboardsError && billboardsData) {
          setActiveBillboards(billboardsData);
        } else {
          setActiveBillboards([]);
        }
      } else {
        setActiveBillboards([]);
      }
      setLoadingBillboards(false);
    };

    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="dashboard-home">
      <h1 className="dashboard-title">ADEFFECT DASHBOARD</h1>
      
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">This month's earnings</span>
          <span className="stat-value">{earnings !== null ? formatCurrency(earnings) : 'N/A'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Amount of billboards booked online this month</span>
          <span className="stat-value">{bookingsThisMonth !== null ? bookingsThisMonth : 'N/A'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Real-time number of users</span>
          <span className="stat-value">{userCount !== null ? userCount : 'N/A'}</span>
        </div>
      </div>

      <div className="active-billboards-section">
        <h2 className="section-title">CURRENTLY ACTIVE BILLBOARDS</h2>
        
        {loadingBillboards ? (
          <p>Loading active billboards...</p>
        ) : activeBillboards.length > 0 ? (
          <div className="billboards-grid">
            {activeBillboards.map((billboard) => (
              <div key={billboard.billboard_id} className="billboard-card">
                <div className="billboard-image-container">
                  {billboard.image_url ? (
                    <img src={billboard.image_url} alt={`Billboard ${billboard.billboard_id}`} className="billboard-image" />
                  ) : (
                    <div className="billboard-image-placeholder">No Image</div>
                  )}
                  <div className="billboard-id-overlay">{billboard.billboard_id}</div>
                </div>
                <div className="billboard-details">
                  <p className="billboard-location">{billboard.location}</p>
                  <p className="billboard-size">{billboard.size}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No active billboards found.</p>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
