import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { downloadQuotationPdf } from '../utils/generateQuotationPdf';
import './Quotations.css';

const ALL_MONTHS = [
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
  frequency: '1',
  period: [],
  billboards: [], // Array of { billboard_id, location, type, monthly_price, printing_cost, printing_month }
  total_cost_wo_printing: '',
  total_cost_with_printing: '',
  booking_id: '',
  is_unofficial: false,
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

/**
 * Safely extract price for 1 month from billboard object (monthly_price or price).
 */
const getBillboardPrice = (board) => {
  if (!board) return '';
  if (board.monthly_price != null && board.monthly_price !== '') return String(board.monthly_price);
  if (board.price != null && board.price !== '') return String(board.price);
  return '';
};

const totalPrintingCost = (billboards) => {
  if (!Array.isArray(billboards)) return 0;
  return billboards.reduce((acc, b) => acc + (parseFloat(b.printing_cost) || 0), 0);
};

const autoCalcWoPrinting = (billboards, period) => {
  if (!Array.isArray(billboards)) return '';
  const months = Array.isArray(period) ? period.length : 0;
  if (months === 0) return '';
  const sumPerMonth = billboards.reduce((acc, b) => acc + (parseFloat(b.monthly_price) || 0), 0);
  if (sumPerMonth === 0) return '';
  return (sumPerMonth * months).toFixed(2);
};

const recalcWithPrinting = (woPrinting, billboards) => {
  const wo = parseFloat(woPrinting) || 0;
  const printing = totalPrintingCost(billboards);
  return (wo + printing).toFixed(2);
};

const parseBillboards = (item, billboardsData) => {
  if (!item) return [];
  try {
    const parsed = JSON.parse(item.reference);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // Legacy single billboard
    if (item.reference) {
      const board = billboardsData.find(b => String(b.billboard_id) === String(item.reference));
      return [{
        billboard_id: item.reference,
        location: item.media_location || (board ? board.location : ''),
        type: item.media_type || (board ? board.media_type : ''),
        monthly_price: getBillboardPrice(board) || item.billboard_price || 0,
        printing_cost: typeof item.printing_cost === 'number' ? item.printing_cost : 
                       (Array.isArray(item.printing_cost) && item.printing_cost[0] ? parseFloat(item.printing_cost[0].cost) || 0 : 0),
        printing_month: Array.isArray(item.printing_cost) && item.printing_cost[0] ? item.printing_cost[0].from_month : ''
      }];
    }
  }
  return [];
};

// ─── MultiMonthSelect ────────────────────────────────────────────────────────

const MultiMonthSelect = ({ selectedMonths = [], onChange }) => {
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

  const toggleMonth = (month) => {
    let updated;
    if (selectedMonths.includes(month)) {
      updated = selectedMonths.filter((m) => m !== month);
    } else {
      updated = ALL_MONTHS.filter((m) => selectedMonths.includes(m) || m === month);
    }
    onChange(updated);
  };

  const displayText = selectedMonths.length > 0 ? selectedMonths.join(', ') : 'Select months...';

  return (
    <div className="form-field full-width" ref={wrapRef}>
      <label>Period (Months)</label>
      <div
        className={`multi-select-display ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className={selectedMonths.length === 0 ? 'placeholder' : 'selected-value'}>
          {displayText}
        </span>
        <span className="dropdown-arrow">▼</span>
      </div>
      {open && (
        <div className="combobox-list month-dropdown-list">
          {ALL_MONTHS.map((month) => {
            const isSelected = selectedMonths.includes(month);
            return (
              <div
                key={month}
                className={`combobox-option month-option ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMonth(month);
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                {month}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── SearchableSelect ────────────────────────────────────────────────────────

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

// ─── BillboardSearchPicker ────────────────────────────────────────────────────
// Self-managed input that clears itself after a billboard is selected.

const BillboardSearchPicker = ({ allBillboards, onAdd, required }) => {
  const [query, setQuery] = useState('');
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

  const filtered = allBillboards
    .filter((board) => {
      const id = (board.billboard_id || '').toString().toLowerCase();
      const loc = (board.location || '').toLowerCase();
      return !query || id.includes(query.toLowerCase()) || loc.includes(query.toLowerCase());
    })
    .slice(0, 12);

  return (
    <div className="form-field" ref={wrapRef} style={{ flex: '1 1 250px' }}>
      <label>Add a billboard</label>
      <input
        type="text"
        value={query}
        placeholder="Search billboard ID to add..."
        required={required}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="combobox-list">
          {filtered.length === 0 ? (
            <div className="combobox-empty">No matches</div>
          ) : (
            filtered.map((board) => (
              <div
                key={board.billboard_id}
                className="combobox-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd(board);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {board.billboard_id}{board.location ? ` — ${board.location}` : ''}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};



// ─── Main Quotations Component ───────────────────────────────────────────────

const Quotations = ({ startInCreate = false, prefillBookingId = null, onCreateConsumed }) => {
  const [view, setView] = useState(startInCreate ? 'create' : 'list');
  const [quotations, setQuotations] = useState([]);
  const [users, setUsers] = useState([]);
  const [billboards, setBillboards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingItems, setBookingItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientQuery, setClientQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [createdQuotation, setCreatedQuotation] = useState(null);
  const [showPdfPrompt, setShowPdfPrompt] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
      const [quotationsRes, usersRes, billboardsRes, bookingsRes, bookingItemsRes] = await Promise.all([
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('user_id, business_name, user_name, email'),
        supabase.from('billboards').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('booking_items').select('*')
      ]);

      if (quotationsRes.error) throw quotationsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (billboardsRes.error) throw billboardsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (bookingItemsRes.error) throw bookingItemsRes.error;

      setQuotations(quotationsRes.data || []);
      setUsers(usersRes.data || []);
      setBillboards(billboardsRes.data || []);
      setBookings(bookingsRes.data || []);
      setBookingItems(bookingItemsRes.data || []);
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

  const extractBookingPeriod = (booking) => {
    if (!booking) return [];
    if (Array.isArray(booking.period)) return booking.period;
    if (typeof booking.period === 'string' && booking.period.trim()) {
      return booking.period.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (booking.start_time && booking.end_time) {
      const start = new Date(booking.start_time);
      const end = new Date(booking.end_time);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const months = [];
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(end.getFullYear(), end.getMonth(), 1);
        while (current <= last) {
          months.push(ALL_MONTHS[current.getMonth()]);
          current.setMonth(current.getMonth() + 1);
        }
        return Array.from(new Set(months));
      }
    }
    return [];
  };



  const applyBookingPrefill = (bookingId, usersList = users, boards = billboards, bookingsList = bookings, bItems = bookingItems) => {
    if (!bookingId) return;
    const booking = bookingsList.find((item) => String(item.booking_id) === String(bookingId));
    if (!booking) {
      setForm((prev) => ({ ...prev, booking_id: bookingId }));
      return;
    }

    const clientId = booking.client_id || booking.user_id || '';
    const user = usersList.find((item) => item.user_id === clientId);
    const businessName = user?.business_name || user?.user_name || booking.offline_business_name || '';
    const bookingPeriod = extractBookingPeriod(booking);
    
    // Find booking items
    const relatedItems = bItems.filter(item => String(item.booking_id) === String(bookingId));
    let prefilledBillboards = [];
    if (relatedItems.length > 0) {
      prefilledBillboards = relatedItems.map(item => {
        const board = boards.find(b => String(b.billboard_id) === String(item.billboard_id));
        return {
          billboard_id: item.billboard_id,
          location: board?.location || '',
          type: board?.media_type || '',
          monthly_price: getBillboardPrice(board) || item.price_at_the_time_of_booking || 0,
          printing_cost: item.printing_cost || 0,
          printing_month: bookingPeriod[0] || ''
        };
      });
    } else if (booking.billboard_id) {
      // Fallback for old bookings
      const board = boards.find((item) => String(item.billboard_id) === String(booking.billboard_id));
      prefilledBillboards = [{
        billboard_id: booking.billboard_id,
        location: board?.location || '',
        type: board?.media_type || '',
        monthly_price: getBillboardPrice(board) || 0,
        printing_cost: 0,
        printing_month: bookingPeriod[0] || ''
      }];
    }

    const woCalc = autoCalcWoPrinting(prefilledBillboards, bookingPeriod);

    setForm((prev) => ({
      ...prev,
      booking_id: booking.booking_id,
      is_unofficial: false,
      client_id: clientId,
      client_name: businessName,
      period: bookingPeriod.length > 0 ? bookingPeriod : prev.period,
      billboards: prefilledBillboards,
      total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
      total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prefilledBillboards),
    }));
    setClientQuery(businessName);
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

  // ─── Filtered list ─────────────────────────────────────────────────────────

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

  // ─── Options ───────────────────────────────────────────────────────────────

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



  // ─── Open create / edit ────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setClientQuery('');
    setCreatedQuotation(null);
    setShowPdfPrompt(false);
    setEditingId(null);
    setView('create');
  };

  const openEdit = (item) => {
    const parsedBillboards = parseBillboards(item, billboards);
    const isUnofficialQuotation = !item.booking_id || !bookings.some((b) => String(b.booking_id) === String(item.booking_id));

    setForm({
      ...EMPTY_FORM,
      client_id: item.client_id || '',
      client_name: item.client_name || '',
      frequency: item.frequency != null ? String(item.frequency) : '1',
      period: Array.isArray(item.period) ? item.period : [],
      billboards: parsedBillboards,
      total_cost_wo_printing: item.total_cost_wo_printing != null ? String(item.total_cost_wo_printing) : '',
      total_cost_with_printing: item.total_cost_with_printing != null ? String(item.total_cost_with_printing) : '',
      booking_id: isUnofficialQuotation ? '' : (item.booking_id || ''),
      is_unofficial: isUnofficialQuotation,
    });
    setClientQuery(item.client_name || '');
    setCreatedQuotation(null);
    setShowPdfPrompt(false);
    setEditingId(item.id);
    setView('create');
  };

  // ─── Booking select change handler ─────────────────────────────────────────

  const handleBookingSelect = (selectedValue) => {
    if (selectedValue === '__unofficial__') {
      setForm((prev) => ({
        ...prev,
        booking_id: '',
        is_unofficial: true,
      }));
      return;
    }

    const booking = bookings.find((b) => String(b.booking_id) === String(selectedValue));
    if (!booking) return;

    const clientId = booking.client_id || booking.user_id || form.client_id;
    const user = userMap[clientId];
    const businessName = user?.business_name || user?.user_name || booking.offline_business_name || form.client_name;
    const bookingPeriod = extractBookingPeriod(booking);

    const relatedItems = bookingItems.filter(item => String(item.booking_id) === String(booking.booking_id));
    let prefilledBillboards = [];
    if (relatedItems.length > 0) {
      prefilledBillboards = relatedItems.map(item => {
        const board = billboards.find(b => String(b.billboard_id) === String(item.billboard_id));
        return {
          billboard_id: item.billboard_id,
          location: board?.location || '',
          type: board?.media_type || '',
          monthly_price: getBillboardPrice(board) || item.price_at_the_time_of_booking || 0,
          printing_cost: item.printing_cost || 0,
          printing_month: bookingPeriod[0] || ''
        };
      });
    } else if (booking.billboard_id) {
      const board = billboards.find((item) => String(item.billboard_id) === String(booking.billboard_id));
      prefilledBillboards = [{
        billboard_id: booking.billboard_id,
        location: board?.location || '',
        type: board?.media_type || '',
        monthly_price: getBillboardPrice(board) || 0,
        printing_cost: 0,
        printing_month: bookingPeriod[0] || ''
      }];
    }

    const newPeriod = bookingPeriod.length > 0 ? bookingPeriod : form.period;
    const woCalc = autoCalcWoPrinting(prefilledBillboards, newPeriod);

    setClientQuery(businessName);
    setForm((prev) => ({
      ...prev,
      booking_id: booking.booking_id,
      is_unofficial: false,
      client_id: clientId || prev.client_id,
      client_name: businessName || prev.client_name,
      period: newPeriod,
      billboards: prefilledBillboards,
      total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
      total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prefilledBillboards),
    }));
  };

  // ─── Form submit ───────────────────────────────────────────────────────────

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!form.client_name) {
      showMessage('error', 'Please enter or select a client name.');
      return;
    }
    if (!form.billboards || form.billboards.length === 0) {
      showMessage('error', 'Please add at least one billboard.');
      return;
    }
    if (!form.booking_id && !form.is_unofficial) {
      showMessage('error', 'Please choose a booking (or select "Unofficial Booking Quotation").');
      return;
    }
    if (!form.period || form.period.length === 0) {
      showMessage('error', 'Please select at least one month for the period.');
      return;
    }

    try {
      setSaving(true);

      const printingCostPayload = form.billboards.map(b => ({
        cost: parseFloat(b.printing_cost) || 0,
        from_month: b.printing_month || form.period[0] || '',
        to_month: ''
      })).filter(p => p.cost > 0);

      const payload = {
        client_id: form.client_id || null,
        client_name: form.client_name,
        reference: JSON.stringify(form.billboards),
        media_type: form.billboards[0].type || '',
        media_used: '', // not heavily used
        media_location: form.billboards[0].location || '',
        frequency: form.frequency === '' ? null : Number(form.frequency),
        period: form.period,
        printing_cost: printingCostPayload,
        total_cost_wo_printing: form.total_cost_wo_printing === '' ? null : Number(form.total_cost_wo_printing),
        total_cost_with_printing: form.total_cost_with_printing === '' ? null : Number(form.total_cost_with_printing),
        booking_id: form.is_unofficial ? null : (form.booking_id || null),
      };

      let saved;
      let res;
      if (editingId) {
        res = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', editingId)
          .select();
      } else {
        res = await supabase.from('quotations').insert([payload]).select();
      }

      // If saving an unofficial quotation with booking_id: null fails due to NOT-NULL or FK constraints,
      // create a lightweight offline booking in `bookings` table to get a valid UUID reference!
      if (res.error && form.is_unofficial) {
        console.warn('Null booking_id rejected by DB constraints. Creating offline booking placeholder...', res.error);
        const { data: offlineBooking, error: offlineErr } = await supabase
          .from('bookings')
          .insert([{
            is_offline_booking: true,
            offline_business_name: form.client_name ? `${form.client_name} (Unofficial)` : 'Unofficial Booking',
            billboard_id: form.reference || null,
            period: form.period || [],
            user_id: form.client_id || null,
          }])
          .select();

        if (!offlineErr && offlineBooking?.[0]?.booking_id) {
          payload.booking_id = offlineBooking[0].booking_id;
          res = editingId
            ? await supabase.from('quotations').update(payload).eq('id', editingId).select()
            : await supabase.from('quotations').insert([payload]).select();
        }
      }

      if (res.error) throw res.error;

      saved = res.data?.[0] || { ...payload, id: editingId };
      showMessage('success', editingId ? 'Quotation updated successfully.' : 'Quotation created successfully.');

      const quotationForPdf = {
        ...saved,
        is_unofficial: form.is_unofficial,
      };

      setCreatedQuotation(quotationForPdf);
      setShowPdfPrompt(true);
      fetchAll();
    } catch (error) {
      console.error('Error saving quotation:', error);
      showMessage('error', error.message || 'Failed to save quotation.');
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF download ──────────────────────────────────────────────────────────

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadCardPdf = async (item) => {
    try {
      setDownloadingId(item.id);
      const isUnofficial = !item.booking_id || !bookings.some((b) => String(b.booking_id) === String(item.booking_id));
      await downloadQuotationPdf({
        ...item,
        is_unofficial: isUnofficial,
      });
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

      const isUnofficial = createdQuotation.is_unofficial || !createdQuotation.booking_id || !bookings.some((b) => String(b.booking_id) === String(createdQuotation.booking_id));
      if (!isUnofficial && createdQuotation.booking_id) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ quotation_pdf_url: filePath })
          .eq('booking_id', createdQuotation.booking_id);
        if (updateError) throw updateError;
      }

      setShowPdfPrompt(false);
      setView('list');
      setForm(EMPTY_FORM);
      setEditingId(null);
      showMessage('success', 'PDF downloaded, uploaded, and linked to the booking.');
    } catch (error) {
      console.error('Error converting quotation to PDF:', error);
      showMessage('error', error.message || 'Failed to convert quotation to PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  // ─── CREATE / EDIT VIEW ────────────────────────────────────────────────────

  if (view === 'create') {
    const isEdit = !!editingId;
    const derivedPrintingTotal = totalPrintingCost(form.printing_cost);

    return (
      <div className="quotations-page">
        <div className="create-header">
          <button className="back-btn" type="button" onClick={() => setView('list')}>
            ← Back
          </button>
          <h1 className="page-title">{isEdit ? 'EDIT QUOTATION' : 'CREATE QUOTATION'}</h1>
        </div>

        {notification && (
          <div className={`notification-banner ${notification.type}`}>
            <span>{notification.message}</span>
            <button className="notification-close" onClick={() => setNotification(null)}>&times;</button>
          </div>
        )}

        <form className="quotation-form" onSubmit={handleSubmit}>
          {/* ── Client ── */}
          <SearchableSelect
            label="Client name"
            inputValue={clientQuery}
            onInputChange={(value) => {
              setClientQuery(value);
              setForm((prev) => ({ ...prev, client_name: value, client_id: '' }));
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

          {/* ── Billboards List ── */}
          <div className="form-field full-width">
            <label>Selected Billboards</label>
            <div className="printing-cost-list">
              {form.billboards.length === 0 && (
                <p className="printing-cost-empty">No billboards added. Select one below.</p>
              )}
              {form.billboards.map((b, index) => (
                <div key={index} className="printing-cost-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="printing-cost-field" style={{ flex: '2 1 200px' }}>
                    <label className="printing-cost-sublabel">Billboard ID</label>
                    <input type="text" value={b.billboard_id} disabled />
                  </div>
                  <div className="printing-cost-field" style={{ flex: '1 1 100px' }}>
                    <label className="printing-cost-sublabel">Price / Mo ($)</label>
                    <input 
                      type="number" 
                      value={b.monthly_price} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(prev => {
                          const newB = [...prev.billboards];
                          newB[index].monthly_price = val;
                          const woCalc = autoCalcWoPrinting(newB, prev.period);
                          return {
                            ...prev,
                            billboards: newB,
                            total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                            total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, newB)
                          };
                        });
                      }}
                    />
                  </div>
                  <div className="printing-cost-field" style={{ flex: '1 1 100px' }}>
                    <label className="printing-cost-sublabel">Print Cost ($)</label>
                    <input 
                      type="number" 
                      value={b.printing_cost} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(prev => {
                          const newB = [...prev.billboards];
                          newB[index].printing_cost = val;
                          return {
                            ...prev,
                            billboards: newB,
                            total_cost_with_printing: recalcWithPrinting(prev.total_cost_wo_printing, newB)
                          };
                        });
                      }}
                    />
                  </div>
                  <div className="printing-cost-field" style={{ flex: '1 1 120px' }}>
                    <label className="printing-cost-sublabel">Print Month</label>
                    <select 
                      value={b.printing_month} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(prev => {
                          const newB = [...prev.billboards];
                          newB[index].printing_month = val;
                          return { ...prev, billboards: newB };
                        });
                      }}
                    >
                      <option value="">(Default: First)</option>
                      {form.period.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="remove-print-period-btn"
                    onClick={() => {
                      setForm(prev => {
                        const newB = prev.billboards.filter((_, i) => i !== index);
                        const woCalc = autoCalcWoPrinting(newB, prev.period);
                        return {
                          ...prev,
                          billboards: newB,
                          total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                          total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, newB)
                        };
                      });
                    }}
                    title="Remove billboard"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '10px' }}>
            <BillboardSearchPicker
                allBillboards={billboards}
                required={form.billboards.length === 0}
                onAdd={(board) => {
                  const price = getBillboardPrice(board);
                  setForm((prev) => {
                    const newBillboard = {
                      billboard_id: board.billboard_id,
                      location: board.location || '',
                      type: board.media_type || '',
                      monthly_price: price || 0,
                      printing_cost: 0,
                      printing_month: prev.period[0] || ''
                    };
                    const newBillboards = [...prev.billboards, newBillboard];
                    const woCalc = autoCalcWoPrinting(newBillboards, prev.period);
                    return {
                      ...prev,
                      billboards: newBillboards,
                      total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                      total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, newBillboards),
                    };
                  });
                }}
              />
            </div>
          </div>

          {/* ── Period ── */}
          <MultiMonthSelect
            selectedMonths={form.period}
            onChange={(selected) => {
              setForm((prev) => {
                const woCalc = autoCalcWoPrinting(prev.billboards, selected);
                return {
                  ...prev,
                  period: selected,
                  total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                  total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prev.billboards),
                };
              });
            }}
          />

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

          {/* ── Total cost w/o printing (auto-calc, editable) ── */}
          <div className="form-field">
            <label>
              Total cost w/o printing
              {form.billboards.length > 0 && form.period.length > 0 && (
                <span className="cost-auto-badge">AUTO</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost_wo_printing}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  total_cost_wo_printing: val,
                  total_cost_with_printing: recalcWithPrinting(val, prev.billboards),
                }));
              }}
              required
            />
            {form.billboards.length > 0 && form.period.length > 0 && (
              <span className="form-hint">
                Auto-calculated. Still editable.
              </span>
            )}
          </div>

          {/* ── Total printing cost (derived) ── */}
          <div className="form-field">
            <label>Total printing cost (derived)</label>
            <input
              type="text"
              value={money(totalPrintingCost(form.billboards))}
              disabled
            />
            <span className="form-hint">Sum of all printing cost entries above.</span>
          </div>

          {/* ── Total cost with printing (derived, editable) ── */}
          <div className="form-field">
            <label>Total cost with printing</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost_with_printing}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, total_cost_with_printing: e.target.value }))
              }
              required
            />
            <span className="form-hint">Auto-calculated from totals above, still editable.</span>
          </div>

          {/* ── Booking ── */}
          <div className="form-field full-width">
            <label>Booking</label>
            <select
              value={form.is_unofficial ? '__unofficial__' : (form.booking_id || '')}
              onChange={(e) => handleBookingSelect(e.target.value)}
            >
              <option value="">— Select a booking —</option>
              <option value="__unofficial__">Unofficial booking quotation</option>
              {bookings.map((booking) => {
                const client = booking.client_id || booking.user_id;
                const business = booking.is_offline_booking === false
                  ? (userMap[client]?.business_name || 'Unknown business')
                  : booking.offline_business_name;
                return (
                  <option key={booking.booking_id} value={booking.booking_id}>
                    {`${booking.billboard_id || 'No ID'} — ${business}`}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-field">
            <label>Booking ID</label>
            <input
              type="text"
              value={form.is_unofficial ? 'Unofficial quotation (DB default UUID)' : form.booking_id}
              disabled
              placeholder="Assigned from selected booking"
            />
          </div>

          <div className="form-actions">
            <button className="submit-quotation-btn" type="submit" disabled={saving}>
              {saving ? 'SAVING...' : isEdit ? 'SAVE CHANGES' : 'CREATE QUOTATION'}
            </button>
          </div>
        </form>

        {/* ── PDF Prompt Modal ── */}
        {showPdfPrompt && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2 className="modal-title">Convert quotation to PDF &amp; link to booking</h2>
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
                    setEditingId(null);
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

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────

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
            const periodDisplay = Array.isArray(item.period)
              ? item.period.join(', ')
              : (item.starting_period ? `${item.starting_period}${item.ending_period ? ` - ${item.ending_period}` : ''}` : 'N/A');

            const isUnofficial = !item.booking_id || !bookings.some((b) => String(b.booking_id) === String(item.booking_id));

            return (
              <div key={item.id} className="quotation-card">
                <div className="quotation-card-header">
                  <h3 className="quotation-ref">{businessName + "'s Ad Campaign" || 'No reference'}</h3>
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
                  <span className="detail-value">{periodDisplay} · {item.frequency ?? 'N/A'}</span>
                </div>
                <div className="quotation-total">
                  <span className="detail-label">Total with printing</span>
                  <span className="quotation-total-amount">{money(item.total_cost_with_printing)}</span>
                </div>
                {!isUnofficial && item.booking_id && (
                  <div className="quotation-booking-id">Booking: {item.booking_id}</div>
                )}
                {isUnofficial && (
                  <div className="quotation-booking-id quotation-unofficial-badge">Unofficial quotation</div>
                )}
                <div className="card-actions">
                  <button
                    className="edit-quotation-btn"
                    type="button"
                    onClick={() => openEdit(item)}
                  >
                    ✎ EDIT
                  </button>
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
