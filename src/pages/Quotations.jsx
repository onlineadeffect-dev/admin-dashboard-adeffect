import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { downloadQuotationPdf } from '../utils/generateQuotationPdf';
import './Quotations.css';

const STARTING_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ENDING_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MEDIA_USED_OPTIONS = [
  'unipole',
  'megapole',
  'minipole',
  'bridge',
  'wallbanner',
  'lightpole banners',
  'rooftop',
  'backlit',
];

const EMPTY_FORM = {
  client_id: '',
  client_name: '',
  media_type: '',
  media_used: '',
  reference: '',
  media_location: '',
  frequency: '1',
  starting_period: '',
  ending_period:'',
  printing_cost: '',
  total_cost_wo_printing: '',
  total_cost_with_printing: '',
  booking_id: '',
};

const SearchIcon = () => (
  <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const money = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(n) ? n : 0);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const SearchableSelect = ({
  label,
  inputValue,
  onInputChange,
  options,
  onSelect,
  placeholder,
  required,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="form-field" ref={wrapRef}>
      <label>{label}</label>
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onInputChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="combobox-list">
          {options.length === 0 ? (
            <div className="combobox-empty">No matches</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className="combobox-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(option);
                  setOpen(false);
                }}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const Quotations = ({ startInCreate = false, prefillBookingId = null, onCreateConsumed }) => {
  const [view, setView] = useState(startInCreate ? 'create' : 'list');
  const [quotations, setQuotations] = useState([]);
  const [users, setUsers] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientQuery, setClientQuery] = useState('');
  const [billboardQuery, setBillboardQuery] = useState('');
  const [bookingQuery, setBookingQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [createdQuotation, setCreatedQuotation] = useState(null);
  const [showPdfPrompt, setShowPdfPrompt] = useState(false);
  const consumedRef = useRef(false);

  const showMessage = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((user) => {
      if (user.user_id) map[user.user_id] = user;
    });
    return map;
  }, [users]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [quotationsRes, usersRes, billboardsRes, bookingsRes] = await Promise.all([
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('user_id, business_name, user_name, email'),
        supabase.from('billboards').select('*'),
        supabase.from('bookings').select('*'),
      ]);

      if (quotationsRes.error) throw quotationsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (billboardsRes.error) throw billboardsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      setQuotations(quotationsRes.data || []);
      setUsers(usersRes.data || []);
      setBillboards(billboardsRes.data || []);
      setBookings(bookingsRes.data || []);
    } catch (error) {
      console.error('Error loading quotations:', error);
      showMessage('error', error.message || 'Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const applyBookingPrefill = (bookingId, usersList = users, boards = billboards, bookingsList = bookings) => {
    if (!bookingId) return;
    const booking = bookingsList.find((item) => String(item.booking_id) === String(bookingId));
    if (!booking) {
      setForm((prev) => ({ ...prev, booking_id: bookingId }));
      setBookingQuery(String(bookingId));
      return;
    }

    const clientId = booking.client_id || booking.user_id || '';
    const user = usersList.find((item) => item.user_id === clientId);
    const billboardId = booking.billboard_id || '';
    const billboard = boards.find((item) => String(item.billboard_id) === String(billboardId));
    const businessName = user?.business_name || user?.user_name || '';

    setForm((prev) => ({
      ...prev,
      booking_id: booking.booking_id,
      client_id: clientId,
      client_name: businessName,
      reference: billboardId,
      media_location: billboard?.location || prev.media_location,
      media_type: billboard?.media_type || prev.media_type,
    }));
    setClientQuery(businessName);
    setBillboardQuery(billboardId ? String(billboardId) : '');
    setBookingQuery(`${billboardId || booking.booking_id} — ${businessName || 'Booking'}`);
  };

  useEffect(() => {
    if (!startInCreate || consumedRef.current) return;
    consumedRef.current = true;
    setView('create');
    if (onCreateConsumed) onCreateConsumed();
  }, [startInCreate, onCreateConsumed]);

  useEffect(() => {
    if (prefillBookingId && (bookings.length || users.length || billboards.length)) {
      applyBookingPrefill(prefillBookingId);
    }
  }, [prefillBookingId, bookings, users, billboards]);

  const updateCost = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field !== 'total_cost_with_printing') {
        const printing = parseFloat(field === 'printing_cost' ? value : next.printing_cost) || 0;
        const without = parseFloat(field === 'total_cost_wo_printing' ? value : next.total_cost_wo_printing) || 0;
        next.total_cost_with_printing = (printing + without).toFixed(2);
      }
      return next;
    });
  };

  const filteredQuotations = useMemo(() => {
    if (!searchQuery.trim()) return quotations;
    const q = searchQuery.toLowerCase();
    return quotations.filter((item) => {
      const billboardId = (item.reference || '').toString().toLowerCase();
      const clientName = (item.client_name || '').toLowerCase();
      const businessName = (userMap[item.client_id]?.business_name || '').toLowerCase();
      return billboardId.includes(q) || clientName.includes(q) || businessName.includes(q);
    });
  }, [quotations, searchQuery, userMap]);

  const clientOptions = useMemo(() => {
    const q = clientQuery.toLowerCase();
    return users
      .filter((user) => {
        const name = (user.business_name || user.user_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return !q || name.includes(q) || email.includes(q);
      })
      .slice(0, 12)
      .map((user) => ({
        value: user.user_id,
        label: user.business_name || user.user_name || user.email || user.user_id,
        user,
      }));
  }, [users, clientQuery]);

  const billboardOptions = useMemo(() => {
    const q = billboardQuery.toLowerCase();
    return billboards
      .filter((board) => {
        const id = (board.billboard_id || '').toString().toLowerCase();
        const loc = (board.location || '').toLowerCase();
        return !q || id.includes(q) || loc.includes(q);
      })
      .slice(0, 12)
      .map((board) => ({
        value: board.billboard_id,
        label: `${board.billboard_id}${board.location ? ` — ${board.location}` : ''}`,
        board,
      }));
  }, [billboards, billboardQuery]);

  const bookingOptions = useMemo(() => {
    const q = bookingQuery.toLowerCase();
    return bookings
      .filter((booking) => {
        const billboardId = (booking.billboard_id || '').toString().toLowerCase();
        const client = booking.client_id || booking.user_id;
        const business = (userMap[client]?.business_name || '').toLowerCase();
        const id = (booking.booking_id || '').toLowerCase();
        return !q || billboardId.includes(q) || business.includes(q) || id.includes(q);
      })
      .slice(0, 12)
      .map((booking) => {
        const client = booking.client_id || booking.user_id;
        const business = booking.is_offline_booking == false ? userMap[client]?.business_name || 'Unknown business' : booking.offline_business_name;
        return {
          value: booking.booking_id,
          label: `${booking.billboard_id || 'No ID'} — ${business}`,
          booking,
        };
      });
  }, [bookings, bookingQuery, userMap]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setClientQuery('');
    setBillboardQuery('');
    setBookingQuery('');
    setCreatedQuotation(null);
    setShowPdfPrompt(false);
    setView('create');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!form.client_id || !form.client_name) {
      showMessage('error', 'Please choose a client from the dropdown.');
      return;
    }
    if (!form.reference) {
      showMessage('error', 'Please choose a billboard reference from the dropdown.');
      return;
    }
    if (!form.booking_id) {
      showMessage('error', 'Please choose a booking so the PDF can be linked.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        client_id: form.client_id,
        client_name: form.client_name,
        media_type: form.media_type,
        media_used: form.media_used,
        reference: form.reference,
        media_location: form.media_location,
        frequency: form.frequency === '' ? null : Number(form.frequency),
        starting_period: form.starting_period,
        ending_period: form.ending_period,
        printing_cost: form.printing_cost === '' ? null : Number(form.printing_cost),
        total_cost_wo_printing: form.total_cost_wo_printing === '' ? null : Number(form.total_cost_wo_printing),
        total_cost_with_printing: form.total_cost_with_printing === '' ? null : Number(form.total_cost_with_printing),
        booking_id: form.booking_id,
      };

      const { data, error } = await supabase.from('quotations').insert([payload]).select();
      if (error) throw error;

      const saved = data?.[0] || payload;
      setCreatedQuotation(saved);
      setShowPdfPrompt(true);
      showMessage('success', 'Quotation created successfully.');
      fetchAll();
    } catch (error) {
      console.error('Error creating quotation:', error);
      showMessage('error', error.message || 'Failed to create quotation.');
    } finally {
      setSaving(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadCardPdf = async (item) => {
    try {
      setDownloadingId(item.id);
      await downloadQuotationPdf(item);
      showMessage('success', 'Quotation PDF downloaded successfully.');
    } catch (error) {
      console.error('Error downloading quotation PDF:', error);
      showMessage('error', error.message || 'Failed to generate PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConvertToPdf = async () => {
    if (!createdQuotation || pdfBusy) return;
    try {
      setPdfBusy(true);
      const { blob, fileName } = await downloadQuotationPdf(createdQuotation);
      const storagePath = `${createdQuotation.booking_id || createdQuotation.id || Date.now()}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Quotations')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('Quotations').getPublicUrl(storagePath);
      const filePath = publicData?.publicUrl || storagePath;

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ quotation_pdf_url: filePath })
        .eq('booking_id', createdQuotation.booking_id);
      if (updateError) throw updateError;

      setShowPdfPrompt(false);
      setView('list');
      setForm(EMPTY_FORM);
      showMessage('success', 'PDF downloaded, uploaded, and linked to the booking.');
    } catch (error) {
      console.error('Error converting quotation to PDF:', error);
      showMessage('error', error.message || 'Failed to convert quotation to PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (view === 'create') {
    return (
      <div className="quotations-page">
        <div className="create-header">
          <button className="back-btn" type="button" onClick={() => setView('list')}>
            ← Back
          </button>
          <h1 className="page-title">CREATE QUOTATION</h1>
        </div>

        {notification && (
          <div className={`notification-banner ${notification.type}`}>
            <span>{notification.message}</span>
            <button className="notification-close" onClick={() => setNotification(null)}>&times;</button>
          </div>
        )}

        <form className="quotation-form" onSubmit={handleSubmit}>
          <SearchableSelect
            label="Client name"
            inputValue={clientQuery}
            onInputChange={(value) => {
              setClientQuery(value);
              setForm((prev) => ({ ...prev, client_name: '', client_id: '' }));
            }}
            options={clientOptions}
            placeholder="Search business names..."
            required
            onSelect={(option) => {
              setClientQuery(option.label);
              setForm((prev) => ({
                ...prev,
                client_id: option.user.user_id,
                client_name: option.user.business_name || option.user.user_name || option.label,
              }));
            }}
          />

          <div className="form-field">
            <label>Client ID</label>
            <input type="text" value={form.client_id} disabled placeholder="Assigned from selected client" />
          </div>

          <SearchableSelect
            label="Reference (billboard ID)"
            inputValue={billboardQuery}
            onInputChange={(value) => {
              setBillboardQuery(value);
              setForm((prev) => ({ ...prev, reference: '' }));
            }}
            options={billboardOptions}
            placeholder="Search billboard IDs..."
            required
            onSelect={(option) => {
              setBillboardQuery(String(option.board.billboard_id));
              setForm((prev) => ({
                ...prev,
                reference: option.board.billboard_id,
                media_location: option.board.location || prev.media_location,
                media_type: option.board.media_type || prev.media_type,
              }));
            }}
          />

          <div className="form-field">
            <label>Media location</label>
            <input
              type="text"
              value={form.media_location}
              onChange={(e) => setForm((prev) => ({ ...prev, media_location: e.target.value }))}
              placeholder="Filled from the billboard, editable"
            />
          </div>

          <div className="form-field">
            <label>Media type</label>
            <input
              type="text"
              value={form.media_type}
              onChange={(e) => setForm((prev) => ({ ...prev, media_type: e.target.value }))}
              placeholder="e.g. Outdoor Unipole"
              required
            />
          </div>

          <div className="form-field">
            <label>Media used</label>
            <select
              value={form.media_used}
              onChange={(e) => setForm((prev) => ({ ...prev, media_used: e.target.value }))}
              required
            >
              <option value="">Select media used</option>
              {MEDIA_USED_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Starting Period</label>
            <select
              value={form.starting_period}
              onChange={(e) => setForm((prev) => ({ ...prev, starting_period: e.target.value }))}
              required
            >
              <option value="">Select month</option>
              {STARTING_MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Ending Period</label>
            <select
              value={form.ending_period}
              onChange={(e) => setForm((prev) => ({ ...prev, ending_period: e.target.value }))}
              required
            >
              <option value="">Select month</option>
              {ENDING_MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Frequency</label>
            <input
              type="number"
              min="1"
              value={form.frequency}
              onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
              required
            />
          </div>

          <div className="form-field">
            <label>Printing cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.printing_cost}
              onChange={(e) => updateCost('printing_cost', e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Total cost w/o printing</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost_wo_printing}
              onChange={(e) => updateCost('total_cost_wo_printing', e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Total cost with printing</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost_with_printing}
              onChange={(e) => updateCost('total_cost_with_printing', e.target.value)}
              required
            />
            <span className="form-hint">Auto-calculated from the two cost fields, still editable.</span>
          </div>

          <SearchableSelect
            label="Booking"
            inputValue={bookingQuery}
            onInputChange={setBookingQuery}
            options={bookingOptions}
            placeholder="Search bookings by billboard ID or business name..."
            required
            onSelect={(option) => {
              const booking = option.booking;
              const clientId = booking.client_id || booking.user_id || form.client_id;
              const user = userMap[clientId];
              const businessName = user?.business_name || user?.user_name || form.client_name;
              const board = billboards.find((item) => String(item.billboard_id) === String(booking.billboard_id));
              setBookingQuery(option.label);
              setClientQuery(businessName);
              setBillboardQuery(booking.billboard_id ? String(booking.billboard_id) : '');
              setForm((prev) => ({
                ...prev,
                booking_id: booking.booking_id,
                client_id: clientId || prev.client_id,
                client_name: businessName || prev.client_name,
                reference: booking.billboard_id || prev.reference,
                media_location: board?.location || prev.media_location,
              }));
            }}
          />

          <div className="form-field">
            <label>Booking ID</label>
            <input type="text" value={form.booking_id} disabled placeholder="Assigned from selected booking" />
          </div>

          <div className="form-actions">
            <button className="submit-quotation-btn" type="submit" disabled={saving}>
              {saving ? 'SAVING...' : 'CREATE QUOTATION'}
            </button>
          </div>
        </form>

        {showPdfPrompt && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2 className="modal-title">Convert quotation to PDF & link to booking</h2>
              <p className="modal-description">
                Generate the official quotation PDF, download it, upload it to the Quotations bucket, and save the file path on the matching booking.
              </p>
              <div className="modal-actions">
                <button className="modal-btn primary" type="button" onClick={handleConvertToPdf} disabled={pdfBusy}>
                  {pdfBusy ? 'PROCESSING...' : 'Convert quotation to PDF & link to booking'}
                </button>
                <button
                  className="modal-btn secondary"
                  type="button"
                  disabled={pdfBusy}
                  onClick={() => {
                    setShowPdfPrompt(false);
                    setView('list');
                  }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="quotations-page">
      <h1 className="page-title">QUOTATIONS</h1>

      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>&times;</button>
        </div>
      )}

      <div className="search-bar-container">
        <SearchIcon />
        <input
          type="text"
          className="search-input"
          placeholder="Search through billboard id or business name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading quotations...</div>
      ) : filteredQuotations.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? 'No matching quotations found.' : 'No quotations yet.'}
        </div>
      ) : (
        <div className="quotations-grid">
          {filteredQuotations.map((item) => {
            const businessName =
              item.client_name || userMap[item.client_id]?.business_name || 'Unknown business';
            const isDownloading = downloadingId === item.id;
            return (
              <div key={item.id} className="quotation-card">
                <div className="quotation-card-header">
                  <h3 className="quotation-ref">{item.reference || 'No reference'}</h3>
                  <span className="quotation-date">{formatDate(item.created_at)}</span>
                </div>
                <div className="quotation-detail">
                  <span className="detail-label">Client</span>
                  <span className="detail-value">{businessName}</span>
                </div>
                <div className="quotation-detail">
                  <span className="detail-label">Media</span>
                  <span className="detail-value">{item.media_type || 'N/A'} · {item.media_used || 'N/A'}</span>
                </div>
                <div className="quotation-detail">
                  <span className="detail-label">Location</span>
                  <span className="detail-value">{item.media_location || 'N/A'}</span>
                </div>
                <div className="quotation-detail">
                  <span className="detail-label">Period / Frequency</span>
                  <span className="detail-value">{item.starting_period + "-" + item.ending_period || 'N/A'} · {item.frequency ?? 'N/A'}</span>
                </div>
                <div className="quotation-total">
                  <span className="detail-label">Total with printing</span>
                  <span className="quotation-total-amount">{money(item.total_cost_with_printing)}</span>
                </div>
                {item.booking_id && (
                  <div className="quotation-booking-id">Booking: {item.booking_id}</div>
                )}
                <button
                  className="download-pdf-btn"
                  type="button"
                  onClick={() => handleDownloadCardPdf(item)}
                  disabled={isDownloading}
                >
                  <svg className="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isDownloading ? 'GENERATING...' : 'DOWNLOAD PDF'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className="create-quotation-btn" type="button" onClick={openCreate}>
        + CREATE QUOTATION
      </button>
    </div>
  );
};

export default Quotations;


