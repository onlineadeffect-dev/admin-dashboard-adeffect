import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { downloadStatisticsPdf } from '../utils/generateStatisticsPdf';
import './Statistics.css';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PALETTE = [
  '#f2061f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#d97706',
];

const formatCurrency = (val) => {
  const num = typeof val === 'number' ? val : parseFloat(val || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
};

// ─── SVG Charts Subcomponents ────────────────────────────────────────────────

/**
 * Monthly Revenue & Profit Chart (Bar or Line/Area with tooltip)
 */
const RevenueChart = ({ data, chartType = 'bar' }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return <div className="stats-empty-chart">No revenue data available for this timeframe.</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 1000);
  // Round up to nice number for grid
  const step = Math.ceil(maxVal / 4 / 500) * 500;
  const chartMax = Math.max(step * 4, 1000);

  const svgW = 800;
  const svgH = 260;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const getY = (val) => padTop + plotH - (val / chartMax) * plotH;
  const getX = (index) => padLeft + (index + 0.5) * (plotW / data.length);

  // Line path points
  const points = data.map((d, i) => `${getX(i)},${getY(d.revenue || 0)}`).join(' ');
  const areaPath = `${getX(0)},${padTop + plotH} ` + points + ` ${getX(data.length - 1)},${padTop + plotH}`;

  return (
    <div className="svg-chart-container" onMouseLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="chart-svg">
        <defs>
          <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2061f" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f2061f" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="mediaBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2061f" />
            <stop offset="100%" stopColor="#de310a" />
          </linearGradient>
          <linearGradient id="printBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines and Y-axis labels */}
        {[0, 1, 2, 3, 4].map((stepIdx) => {
          const val = step * stepIdx;
          const y = getY(val);
          return (
            <g key={stepIdx}>
              <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} className="grid-line" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" className="axis-text">
                ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {/* Render depending on chart type */}
        {chartType === 'line' ? (
          <>
            {/* Area fill */}
            <polygon points={areaPath} fill="url(#revAreaGrad)" />
            {/* Line stroke */}
            <polyline
              points={points}
              fill="none"
              stroke="#f2061f"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Circles */}
            {data.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.revenue || 0);
              const isHovered = hoveredIndex === i;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7 : 4.5}
                  fill={isHovered ? '#ffffff' : '#f2061f'}
                  stroke="#f2061f"
                  strokeWidth={isHovered ? 3.5 : 2}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              );
            })}
          </>
        ) : (
          /* Stacked / Grouped Bars */
          data.map((d, i) => {
            const colW = Math.min((plotW / data.length) * 0.65, 42);
            const x = getX(i) - colW / 2;
            const isHovered = hoveredIndex === i;

            const total = d.revenue || 0;
            const media = d.mediaRevenue || 0;
            const print = d.printingRevenue || 0;

            const totalH = (total / chartMax) * plotH;
            const printH = total > 0 ? (print / chartMax) * plotH : 0;
            const mediaH = total > 0 ? (media / chartMax) * plotH : 0;

            const yTotal = padTop + plotH - totalH;
            const yPrint = yTotal;
            const yMedia = yTotal + printH;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background hover bar highlight */}
                {isHovered && (
                  <rect
                    x={x - 6}
                    y={padTop}
                    width={colW + 12}
                    height={plotH}
                    fill="#fef2f2"
                    rx="4"
                  />
                )}

                {/* Print portion (top) */}
                {printH > 0 && (
                  <rect
                    x={x}
                    y={yPrint}
                    width={colW}
                    height={printH}
                    fill="url(#printBarGrad)"
                    rx="2"
                    opacity={isHovered ? 0.9 : 0.75}
                  />
                )}

                {/* Media portion (base) */}
                {mediaH > 0 && (
                  <rect
                    x={x}
                    y={yMedia}
                    width={colW}
                    height={mediaH}
                    fill="url(#mediaBarGrad)"
                    rx="2"
                    opacity={isHovered ? 1 : 0.9}
                  />
                )}

                {/* If total is 0, tiny indicator dot */}
                {total === 0 && (
                  <rect
                    x={x + colW / 2 - 3}
                    y={padTop + plotH - 3}
                    width={6}
                    height={3}
                    fill="#e5e7eb"
                    rx="1.5"
                  />
                )}
              </g>
            );
          })
        )}

        {/* X-axis Month Labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={padTop + plotH + 20}
            textAnchor="middle"
            className={hoveredIndex === i ? 'axis-text-strong' : 'axis-text'}
          >
            {d.shortLabel || d.label}
          </text>
        ))}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="custom-chart-tooltip"
          style={{
            left: `${(getX(hoveredIndex) / svgW) * 100}%`,
            top: `${(getY(data[hoveredIndex].revenue || 0) / svgH) * 100}%`,
          }}
        >
          <div className="tooltip-title">{data[hoveredIndex].label}</div>
          <div className="tooltip-row">
            <span>Total Revenue:</span>
            <strong>{formatCurrency(data[hoveredIndex].revenue)}</strong>
          </div>
          <div className="tooltip-row">
            <span>Media Rental:</span>
            <span>{formatCurrency(data[hoveredIndex].mediaRevenue)}</span>
          </div>
          <div className="tooltip-row">
            <span>Printing Cost:</span>
            <span>{formatCurrency(data[hoveredIndex].printingRevenue)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Monthly Bookings Volume Bar Chart
 */
const BookingsVolumeChart = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return <div className="stats-empty-chart">No bookings volume data recorded.</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.count || 0), 4);
  const chartMax = Math.ceil(maxVal * 1.25);

  const svgW = 800;
  const svgH = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const getY = (val) => padTop + plotH - (val / chartMax) * plotH;
  const getX = (index) => padLeft + (index + 0.5) * (plotW / data.length);

  return (
    <div className="svg-chart-container" onMouseLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="chart-svg">
        <defs>
          <linearGradient id="bookingsBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Y Gridlines */}
        {[0, 0.33, 0.66, 1].map((ratio, i) => {
          const val = Math.round(chartMax * ratio);
          const y = getY(val);
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} className="grid-line" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="axis-text">
                {val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const colW = Math.min((plotW / data.length) * 0.55, 36);
          const x = getX(i) - colW / 2;
          const isHovered = hoveredIndex === i;
          const barH = ((d.count || 0) / chartMax) * plotH;
          const y = padTop + plotH - barH;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              style={{ cursor: 'pointer' }}
            >
              {isHovered && (
                <rect
                  x={x - 6}
                  y={padTop}
                  width={colW + 12}
                  height={plotH}
                  fill="#f1f5f9"
                  rx="4"
                />
              )}
              <rect
                x={x}
                y={y}
                width={colW}
                height={Math.max(barH, 3)}
                fill="url(#bookingsBarGrad)"
                rx="4"
                opacity={isHovered ? 1 : 0.85}
              />
            </g>
          );
        })}

        {/* X Labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={padTop + plotH + 18}
            textAnchor="middle"
            className={hoveredIndex === i ? 'axis-text-strong' : 'axis-text'}
          >
            {d.shortLabel || d.label}
          </text>
        ))}
      </svg>

      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="custom-chart-tooltip"
          style={{
            left: `${(getX(hoveredIndex) / svgW) * 100}%`,
            top: `${(getY(data[hoveredIndex].count || 0) / svgH) * 100}%`,
          }}
        >
          <div className="tooltip-title">{data[hoveredIndex].label}</div>
          <div className="tooltip-row">
            <span>Billboards Booked:</span>
            <strong>{data[hoveredIndex].count || 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Donut Chart with Legend
 */
const DonutChart = ({ items = [], totalLabel = 'Total' }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);

  if (total === 0 || items.length === 0) {
    return <div className="stats-empty-chart">No categorization data available.</div>;
  }

  // Pre-calculate SVG arcs
  const radius = 70;
  const strokeWidth = 24;
  const center = 95;
  const circumference = 2 * Math.PI * radius;

  const slices = items.reduce((acc, item, idx) => {
    const percent = item.value / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -acc.accumulated * circumference;
    const slice = {
      ...item,
      color: item.color || PALETTE[idx % PALETTE.length],
      strokeDasharray,
      strokeDashoffset,
      percent: Math.round(percent * 100),
    };
    return {
      accumulated: acc.accumulated + percent,
      list: [...acc.list, slice],
    };
  }, { accumulated: 0, list: [] }).list;

  return (
    <div className="donut-layout">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 190 190" className="chart-svg">
          {slices.map((slice, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={hoveredIdx === i ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                cursor: 'pointer',
                opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : 1,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {/* Donut Center Text */}
          <text x={center} y={center - 4} textAnchor="middle" style={{ fontSize: '18px', fontWeight: '800', fill: '#111827' }}>
            {hoveredIdx !== null ? `${slices[hoveredIdx].percent}%` : total}
          </text>
          <text x={center} y={center + 14} textAnchor="middle" style={{ fontSize: '10px', fontWeight: '600', fill: '#6b7280', textTransform: 'uppercase' }}>
            {hoveredIdx !== null ? slices[hoveredIdx].label : totalLabel}
          </text>
        </svg>
      </div>

      <div className="donut-legend-items">
        {slices.map((slice, i) => (
          <div
            key={i}
            className="donut-legend-row"
            style={{ opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : 1 }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="donut-legend-left">
              <span className="legend-dot" style={{ backgroundColor: slice.color }} />
              <span>{slice.label}</span>
            </div>
            <div className="donut-legend-right">
              <span>{slice.percent}%</span>
              {slice.subtext && <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '11px' }}>({slice.subtext})</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Statistics Component ───────────────────────────────────────────────

const Statistics = () => {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingItems, setBookingItems] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [users, setUsers] = useState([]);

  // Timeframe Controls
  const [timeframe, setTimeframe] = useState('12_months'); // 'all', 'this_year', '12_months', '6_months', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Chart Preference Toggles
  const [revenueChartType, setRevenueChartType] = useState('bar'); // 'bar' | 'line'
  const [topBillboardsLimit, setTopBillboardsLimit] = useState(5); // 5 | 10
  const [topClientsLimit, setTopClientsLimit] = useState(5); // 5 | 10

  // Customization & PDF options modal
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Section Visibility Checklist
  const [visibleSections, setVisibleSections] = useState({
    kpis: true,
    revenueTrend: true,
    bookingsTrend: true,
    topBillboards: true,
    topClients: true,
    mediaBreakdown: true,
    channels: true,
    dataTable: true,
  });

  // PDF Custom Metadata
  const [pdfTitle, setPdfTitle] = useState('AD EFFECT — COMPREHENSIVE STATISTICS REPORT');
  const [pdfSubtitle, setPdfSubtitle] = useState('Executive Business Performance & Inventory Analytics');
  const [pdfNotes, setPdfNotes] = useState('Detailed breakdown of revenue generation, client retention, and billboard occupancy.');

  // DOM Refs for PDF chart capture
  const revenueChartCardRef = useRef(null);
  const bookingsChartCardRef = useRef(null);

  // ─── Fetch Raw Data ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [quotationsRes, bookingsRes, bookingItemsRes, billboardsRes, usersRes] = await Promise.all([
          supabase.from('quotations').select('*').order('created_at', { ascending: false }),
          supabase.from('bookings').select('*').order('created_at', { ascending: false }),
          supabase.from('booking_items').select('*'),
          supabase.from('billboards').select('*'),
          supabase.from('users').select('*'),
        ]);

        if (quotationsRes.error) throw quotationsRes.error;
        if (bookingsRes.error) throw bookingsRes.error;
        if (bookingItemsRes.error) throw bookingItemsRes.error;
        if (billboardsRes.error) throw billboardsRes.error;
        if (usersRes.error) throw usersRes.error;

        setQuotations(quotationsRes.data || []);
        setBookings(bookingsRes.data || []);
        setBookingItems(bookingItemsRes.data || []);
        setBillboards(billboardsRes.data || []);
        setUsers(usersRes.data || []);
      } catch (err) {
        console.error('Error fetching statistics data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ─── Filter Data by Timeframe ──────────────────────────────────────────────
  const { filteredQuotations, filteredBookings, periodLabel } = useMemo(() => {
    const now = new Date();
    let startDate = null;
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let label = 'All Time';

    if (timeframe === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      label = `Year ${now.getFullYear()}`;
    } else if (timeframe === '12_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      label = 'Last 12 Months';
    } else if (timeframe === '6_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      label = 'Last 6 Months';
    } else if (timeframe === 'custom') {
      if (customStart) startDate = new Date(customStart);
      if (customEnd) endDate = new Date(customEnd + 'T23:59:59');
      label = `Custom (${customStart || 'Start'} to ${customEnd || 'Now'})`;
    }

    const checkDate = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    };

    const fQuotes = timeframe === 'all' ? quotations : quotations.filter((q) => checkDate(q.created_at));
    const fBookings = timeframe === 'all' ? bookings : bookings.filter((b) => checkDate(b.start_time || b.created_at));

    return {
      filteredQuotations: fQuotes,
      filteredBookings: fBookings,
      periodLabel: label,
    };
  }, [quotations, bookings, timeframe, customStart, customEnd]);

  // ─── Analytics Aggregations ────────────────────────────────────────────────
  const stats = useMemo(() => {
    // 1. Users Map
    const userMap = {};
    users.forEach((u) => {
      userMap[u.user_id] = u;
    });

    // 2. Billboards Map
    const billboardMap = {};
    billboards.forEach((b) => {
      billboardMap[b.billboard_id] = b;
    });

    // 3. Revenue Metrics
    let totalRevenue = 0;
    let totalMedia = 0;
    let totalPrinting = 0;

    filteredQuotations.forEach((q) => {
      const withPrint = Number(q.total_cost_with_printing) || 0;
      const woPrint = Number(q.total_cost_wo_printing) || 0;
      totalRevenue += withPrint;
      totalMedia += woPrint;
      totalPrinting += Math.max(0, withPrint - woPrint);
    });

    const totalBookings = filteredBookings.length;
    const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Active occupancy rate
    const activeBookingsCount = bookings.filter((b) => b.is_active === true).length;
    const totalBillboardsCount = billboards.length || 1;
    const occupancyRate = Math.min(100, Math.round((activeBookingsCount / totalBillboardsCount) * 100));

    // 4. Monthly Trend (Past 12 or 6 months sequence)
    const monthsCount = timeframe === '6_months' ? 6 : 12;
    const now = new Date();
    const monthlyDataMap = {};

    // Generate monthly slots
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${SHORT_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      monthlyDataMap[key] = {
        key,
        year: d.getFullYear(),
        month: d.getMonth(),
        label,
        shortLabel: SHORT_MONTHS[d.getMonth()],
        revenue: 0,
        mediaRevenue: 0,
        printingRevenue: 0,
        count: 0,
      };
    }

    // Populate revenue
    filteredQuotations.forEach((q) => {
      if (!q.created_at) return;
      const d = new Date(q.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyDataMap[key]) {
        const withPrint = Number(q.total_cost_with_printing) || 0;
        const woPrint = Number(q.total_cost_wo_printing) || 0;
        monthlyDataMap[key].revenue += withPrint;
        monthlyDataMap[key].mediaRevenue += woPrint;
        monthlyDataMap[key].printingRevenue += Math.max(0, withPrint - woPrint);
      }
    });

    // Populate bookings count
    filteredBookings.forEach((b) => {
      const dateVal = b.start_time || b.created_at;
      if (!dateVal) return;
      const d = new Date(dateVal);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].count += 1;
      }
    });

    const revenueByMonth = Object.values(monthlyDataMap);
    const bookingsByMonth = Object.values(monthlyDataMap);

    // 5. Most Booked Billboards (Top Billboards)
    const billboardStatsMap = {};

    // From booking items
    bookingItems.forEach((item) => {
      const id = String(item.billboard_id || '').trim();
      if (!id) return;
      if (!billboardStatsMap[id]) {
        const board = billboardMap[id];
        billboardStatsMap[id] = {
          billboard_id: id,
          location: board?.location || 'Unknown Location',
          type: board?.media_type || 'Standard',
          count: 0,
          revenue: 0,
        };
      }
      billboardStatsMap[id].count += 1;
      billboardStatsMap[id].revenue += Number(item.price_at_the_time_of_booking) || 0;
    });

    // Also parse from quotations billboard array if available
    filteredQuotations.forEach((q) => {
      let qBoards = [];
      try {
        if (typeof q.reference === 'string' && q.reference.startsWith('[')) {
          qBoards = JSON.parse(q.reference);
        } else if (q.reference) {
          qBoards = [{ billboard_id: q.reference }];
        }
      } catch (_e) {
        // fallback
      }

      qBoards.forEach((b) => {
        const id = String(b.billboard_id || '').trim();
        if (!id) return;
        if (!billboardStatsMap[id]) {
          const board = billboardMap[id];
          billboardStatsMap[id] = {
            billboard_id: id,
            location: b.location || board?.location || 'Unknown Location',
            type: b.type || board?.media_type || 'Standard',
            count: 0,
            revenue: 0,
          };
        }
        billboardStatsMap[id].revenue += Number(b.monthly_price) || 0;
      });
    });

    const topBillboards = Object.values(billboardStatsMap)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    // 6. Most Loyal Clients
    const clientStatsMap = {};

    filteredQuotations.forEach((q) => {
      const clientId = q.client_id || q.client_name || 'Anonymous';
      const user = userMap[q.client_id];
      const businessName = user?.business_name || q.client_name || 'Client';

      if (!clientStatsMap[clientId]) {
        clientStatsMap[clientId] = {
          id: clientId,
          name: q.client_name || user?.user_name || 'Private Client',
          business_name: businessName,
          email: user?.email || '',
          count: 0,
          spend: 0,
        };
      }
      clientStatsMap[clientId].count += 1;
      clientStatsMap[clientId].spend += Number(q.total_cost_with_printing) || 0;
    });

    filteredBookings.forEach((b) => {
      const clientId = b.client_id || b.user_id || b.offline_business_name || 'Anonymous';
      const user = userMap[b.user_id];
      const businessName = b.offline_business_name || user?.business_name || 'Client';

      if (!clientStatsMap[clientId]) {
        clientStatsMap[clientId] = {
          id: clientId,
          name: user?.user_name || 'Client',
          business_name: businessName,
          email: user?.email || '',
          count: 0,
          spend: 0,
        };
      }
      clientStatsMap[clientId].count += 1;
    });

    const topClients = Object.values(clientStatsMap)
      .map((c) => ({
        ...c,
        avgSpend: c.count > 0 ? c.spend / c.count : 0,
      }))
      .sort((a, b) => b.spend - a.spend || b.count - a.count);

    // 7. Media Type Breakdown
    const mediaMap = {};
    let totalMediaRev = 0;

    billboards.forEach((b) => {
      const mType = (b.media_type || 'standard').toLowerCase().trim();
      if (!mediaMap[mType]) {
        mediaMap[mType] = { type: mType, count: 0, revenue: 0 };
      }
      mediaMap[mType].count += 1;
    });

    topBillboards.forEach((tb) => {
      const mType = (tb.type || 'standard').toLowerCase().trim();
      if (mediaMap[mType]) {
        mediaMap[mType].revenue += tb.revenue;
        totalMediaRev += tb.revenue;
      }
    });

    const mediaTypeBreakdown = Object.values(mediaMap).map((m) => ({
      ...m,
      percentage: totalMediaRev > 0 ? Math.round((m.revenue / totalMediaRev) * 100) : 0,
    }));

    // 8. Online vs Offline Channels
    let onlineCount = 0;
    let offlineCount = 0;
    filteredBookings.forEach((b) => {
      if (b.is_offline_booking === true) {
        offlineCount += 1;
      } else {
        onlineCount += 1;
      }
    });
    const totalChannels = onlineCount + offlineCount || 1;
    const channelBreakdown = {
      onlineCount,
      offlineCount,
      onlinePercent: Math.round((onlineCount / totalChannels) * 100),
      offlinePercent: Math.round((offlineCount / totalChannels) * 100),
    };

    return {
      kpis: {
        totalRevenue,
        totalMedia,
        totalPrinting,
        totalBookings,
        totalBillboardsBooked: bookingItems.length,
        avgBookingValue,
        occupancyRate,
        activeBillboardsCount,
        totalBillboardsCount,
        topClient: topClients[0] || null,
        topBillboard: topBillboards[0] || null,
      },
      revenueByMonth,
      bookingsByMonth,
      topBillboards,
      topClients,
      mediaTypeBreakdown,
      channelBreakdown,
    };
  }, [filteredQuotations, filteredBookings, bookingItems, billboards, users, bookings, timeframe]);

  // ─── PDF Export Handler ────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);

      const chartImages = {};

      // Snapshot Revenue Chart if present
      if (revenueChartCardRef.current && visibleSections.revenueTrend !== false) {
        try {
          const revCanvas = await html2canvas(revenueChartCardRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
          });
          chartImages.revenueChart = revCanvas.toDataURL('image/png');
        } catch (e) {
          console.warn('html2canvas revenue snapshot warning:', e);
        }
      }

      // Snapshot Bookings Chart if present
      if (bookingsChartCardRef.current && visibleSections.bookingsTrend !== false) {
        try {
          const bookCanvas = await html2canvas(bookingsChartCardRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
          });
          chartImages.bookingsChart = bookCanvas.toDataURL('image/png');
        } catch (e) {
          console.warn('html2canvas bookings snapshot warning:', e);
        }
      }

      await downloadStatisticsPdf({
        stats,
        periodLabel,
        visibleSections,
        customTitle: pdfTitle,
        customSubtitle: pdfSubtitle,
        customNotes: pdfNotes,
        chartImages,
        adminName: 'Admin',
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const toggleSection = (key) => {
    setVisibleSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="statistics-page">
        <div className="stats-loading-box">
          <div className="stats-spinner" />
          <p>Compiling analytics and generating graphs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="statistics-page">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="statistics-header">
        <div className="header-title-group">
          <h1 className="statistics-title">STATISTICS & ANALYTICS</h1>
          <p className="statistics-subtitle">
            Executive insights, visual charts, revenue growth & inventory performance.
          </p>
        </div>

        <div className="statistics-controls">
          <label className="control-label">
            Period:
            <select
              className="timeframe-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="12_months">Last 12 Months</option>
              <option value="6_months">Last 6 Months</option>
              <option value="this_year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </label>

          <button
            className="btn-secondary"
            onClick={() => setIsCustomizeModalOpen(true)}
            title="Customize Visible Graphs and PDF Output"
          >
            <svg className="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Customize Report
          </button>

          <button
            className="btn-primary"
            onClick={handleExportPdf}
            disabled={exportingPdf}
          >
            <svg className="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {exportingPdf ? 'GENERATING PDF...' : 'DOWNLOAD PDF REPORT'}
          </button>
        </div>
      </div>

      {/* ─── Custom Date Range Bar ─────────────────────────────────────────── */}
      {timeframe === 'custom' && (
        <div className="custom-range-bar">
          <span>From:</span>
          <input
            type="date"
            className="date-input"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span>To:</span>
          <input
            type="date"
            className="date-input"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </div>
      )}

      {/* ─── 1. Key Performance Indicators (KPIs) ──────────────────────────── */}
      {visibleSections.kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Total Revenue</span>
              <div className="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
            </div>
            <div className="kpi-value">{formatCurrency(stats.kpis.totalRevenue)}</div>
            <p className="kpi-subtext">
              Media: {formatCurrency(stats.kpis.totalMedia)} • Print: {formatCurrency(stats.kpis.totalPrinting)}
            </p>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Billboards Booked</span>
              <div className="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18" />
                </svg>
              </div>
            </div>
            <div className="kpi-value">{stats.kpis.totalBookings} Bookings</div>
            <p className="kpi-subtext">
              {stats.kpis.totalBillboardsBooked} billboard slots allocated
            </p>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Avg. Deal Value</span>
              <div className="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
            </div>
            <div className="kpi-value">{formatCurrency(stats.kpis.avgBookingValue)}</div>
            <p className="kpi-subtext">Average gross spend per client campaign</p>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Current Occupancy</span>
              <div className="kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>
            <div className="kpi-value">{stats.kpis.occupancyRate}%</div>
            <p className="kpi-subtext">
              {stats.kpis.activeBillboardsCount} of {stats.kpis.totalBillboardsCount} billboards currently active
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. Graphs Layout Grid ─────────────────────────────────────────── */}
      <div className="charts-grid">
        {/* Revenue Growth Trend Chart */}
        {visibleSections.revenueTrend && (
          <div className="chart-card col-8" ref={revenueChartCardRef}>
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Revenue & Profit Growth Trend</h3>
                <p className="chart-desc">Monthly breakdown of rental income and production printing costs</p>
              </div>

              <div className="chart-controls-wrap">
                <button
                  className={`chart-toggle-btn ${revenueChartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setRevenueChartType('bar')}
                >
                  Bar
                </button>
                <button
                  className={`chart-toggle-btn ${revenueChartType === 'line' ? 'active' : ''}`}
                  onClick={() => setRevenueChartType('line')}
                >
                  Area Line
                </button>
              </div>
            </div>

            <RevenueChart data={stats.revenueByMonth} chartType={revenueChartType} />

            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#f2061f' }} />
                <span>Media Rental Income</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#fb7185' }} />
                <span>Printing Production</span>
              </div>
            </div>
          </div>
        )}

        {/* Media Type Breakdown Donut */}
        {visibleSections.mediaBreakdown && (
          <div className="chart-card col-4">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Billboard Media Share</h3>
                <p className="chart-desc">Revenue distribution by billboard structure</p>
              </div>
            </div>

            <DonutChart
              items={stats.mediaTypeBreakdown.map((m, idx) => ({
                label: m.type.toUpperCase(),
                value: m.revenue || m.count || 1,
                color: PALETTE[idx % PALETTE.length],
                subtext: formatCurrency(m.revenue),
              }))}
              totalLabel="Structures"
            />
          </div>
        )}

        {/* Billboards Booked Volume per Month */}
        {visibleSections.bookingsTrend && (
          <div className="chart-card col-6" ref={bookingsChartCardRef}>
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Billboards Booked Volume</h3>
                <p className="chart-desc">Number of campaign reservations created per month</p>
              </div>
            </div>

            <BookingsVolumeChart data={stats.bookingsByMonth} />
          </div>
        )}

        {/* Online vs Offline Acquisition Channels */}
        {visibleSections.channels && (
          <div className="chart-card col-6">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Booking Acquisition Channels</h3>
                <p className="chart-desc">Online self-serve requests vs offline direct contracts</p>
              </div>
            </div>

            <DonutChart
              items={[
                {
                  label: 'Online Portal',
                  value: stats.channelBreakdown.onlineCount,
                  color: '#3b82f6',
                  subtext: `${stats.channelBreakdown.onlineCount} bookings`,
                },
                {
                  label: 'Offline Direct',
                  value: stats.channelBreakdown.offlineCount,
                  color: '#8b5cf6',
                  subtext: `${stats.channelBreakdown.offlineCount} bookings`,
                },
              ]}
              totalLabel="Channels"
            />
          </div>
        )}

        {/* ─── 3. Top Billboards Ranking ──────────────────────────────────── */}
        {visibleSections.topBillboards && (
          <div className="chart-card col-6">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Most Booked Billboards</h3>
                <p className="chart-desc">Highest demand billboard inventory by booking count</p>
              </div>

              <div className="chart-controls-wrap">
                <button
                  className={`chart-toggle-btn ${topBillboardsLimit === 5 ? 'active' : ''}`}
                  onClick={() => setTopBillboardsLimit(5)}
                >
                  Top 5
                </button>
                <button
                  className={`chart-toggle-btn ${topBillboardsLimit === 10 ? 'active' : ''}`}
                  onClick={() => setTopBillboardsLimit(10)}
                >
                  Top 10
                </button>
              </div>
            </div>

            {stats.topBillboards.length === 0 ? (
              <div className="stats-empty-chart">No billboard bookings recorded in this timeframe.</div>
            ) : (
              <div className="ranking-list">
                {stats.topBillboards.slice(0, topBillboardsLimit).map((board, idx) => {
                  const maxCount = stats.topBillboards[0]?.count || 1;
                  const percent = Math.min(100, Math.round((board.count / maxCount) * 100));

                  return (
                    <div key={board.billboard_id} className="ranking-item">
                      <div className={`ranking-badge top-${idx + 1}`}>#{idx + 1}</div>
                      <div className="ranking-details">
                        <div className="ranking-name">
                          {board.billboard_id} — {board.location}
                        </div>
                        <div className="ranking-meta">{board.type}</div>
                        <div className="ranking-bar-track">
                          <div className="ranking-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <div className="ranking-value-group">
                        <div className="ranking-primary-val">{board.count} bookings</div>
                        <div className="ranking-secondary-val">{formatCurrency(board.revenue)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── 4. Most Loyal Clients Ranking ──────────────────────────────── */}
        {visibleSections.topClients && (
          <div className="chart-card col-6">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Most Loyal Clients</h3>
                <p className="chart-desc">Top enterprise clients ranked by total spend and volume</p>
              </div>

              <div className="chart-controls-wrap">
                <button
                  className={`chart-toggle-btn ${topClientsLimit === 5 ? 'active' : ''}`}
                  onClick={() => setTopClientsLimit(5)}
                >
                  Top 5
                </button>
                <button
                  className={`chart-toggle-btn ${topClientsLimit === 10 ? 'active' : ''}`}
                  onClick={() => setTopClientsLimit(10)}
                >
                  Top 10
                </button>
              </div>
            </div>

            {stats.topClients.length === 0 ? (
              <div className="stats-empty-chart">No client transaction data available.</div>
            ) : (
              <div className="ranking-list">
                {stats.topClients.slice(0, topClientsLimit).map((client, idx) => {
                  const maxSpend = stats.topClients[0]?.spend || 1;
                  const percent = Math.min(100, Math.round((client.spend / maxSpend) * 100));

                  return (
                    <div key={client.id || idx} className="ranking-item">
                      <div className={`ranking-badge top-${idx + 1}`}>#{idx + 1}</div>
                      <div className="ranking-details">
                        <div className="ranking-name">{client.business_name || client.name}</div>
                        <div className="ranking-meta">{client.email || client.name || 'Account'}</div>
                        <div className="ranking-bar-track">
                          <div className="ranking-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <div className="ranking-value-group">
                        <div className="ranking-primary-val">{formatCurrency(client.spend)}</div>
                        <div className="ranking-secondary-val">{client.count} campaigns</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── 5. Detailed Monthly Breakdown Table ─────────────────────────── */}
        {visibleSections.dataTable && (
          <div className="chart-card col-12">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <h3 className="chart-title">Monthly Financial & Operational Breakdown</h3>
                <p className="chart-desc">Consolidated ledger of media revenue, printing, and campaign transactions</p>
              </div>
            </div>

            <div className="stats-table-wrap">
              <table className="stats-data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Revenue</th>
                    <th>Media Rental</th>
                    <th>Printing Production</th>
                    <th>Bookings Volume</th>
                    <th>Avg. Deal Size</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.revenueByMonth.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      <td><strong>{formatCurrency(row.revenue)}</strong></td>
                      <td>{formatCurrency(row.mediaRevenue)}</td>
                      <td>{formatCurrency(row.printingRevenue)}</td>
                      <td>{row.count}</td>
                      <td>{row.count > 0 ? formatCurrency(row.revenue / row.count) : '$0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Customization & PDF Modal ─────────────────────────────────────── */}
      {isCustomizeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCustomizeModalOpen(false)}>
          <div className="customize-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Customize Dashboard & Report</h2>
              <button className="modal-close-btn" onClick={() => setIsCustomizeModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div>
                <div className="modal-section-title">Include in View & PDF Export:</div>
                <div className="checkbox-list">
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.kpis}
                      onChange={() => toggleSection('kpis')}
                    />
                    Key Performance Indicators (KPIs)
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.revenueTrend}
                      onChange={() => toggleSection('revenueTrend')}
                    />
                    Revenue Growth Trend Graph
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.bookingsTrend}
                      onChange={() => toggleSection('bookingsTrend')}
                    />
                    Bookings Volume Graph
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.topBillboards}
                      onChange={() => toggleSection('topBillboards')}
                    />
                    Most Booked Billboards
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.topClients}
                      onChange={() => toggleSection('topClients')}
                    />
                    Most Loyal Clients
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.mediaBreakdown}
                      onChange={() => toggleSection('mediaBreakdown')}
                    />
                    Billboard Media Share
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.channels}
                      onChange={() => toggleSection('channels')}
                    />
                    Acquisition Channels
                  </label>
                  <label className="custom-checkbox-label">
                    <input
                      type="checkbox"
                      checked={visibleSections.dataTable}
                      onChange={() => toggleSection('dataTable')}
                    />
                    Financial Breakdown Table
                  </label>
                </div>
              </div>

              <div className="form-field-group">
                <label className="form-label">PDF Report Title</label>
                <input
                  type="text"
                  className="text-input"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label className="form-label">PDF Subtitle / Header Note</label>
                <input
                  type="text"
                  className="text-input"
                  value={pdfSubtitle}
                  onChange={(e) => setPdfSubtitle(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label className="form-label">Executive Notes / Commentary (Printed on PDF Page 1)</label>
                <textarea
                  className="textarea-input"
                  value={pdfNotes}
                  onChange={(e) => setPdfNotes(e.target.value)}
                  placeholder="Enter executive commentary, performance summary, or strategic guidance..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsCustomizeModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
