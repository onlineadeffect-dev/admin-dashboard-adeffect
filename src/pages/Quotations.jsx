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
  media_type: '',
  media_used: '',
  reference: '',
  media_location: '',
  frequency: '1',
  period: [],
  printing_cost: [],
  total_cost_wo_printing: '',
  total_cost_with_printing: '',
  booking_id: '',
  billboard_price: '',
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

/**
 * Sum all printing cost entries that start in the given month.
 */
const printingCostForMonth = (printingCostList, month, periodMonths) => {
  if (!Array.isArray(printingCostList) || !month) return 0;
  const firstMonth = (periodMonths && periodMonths.length > 0) ? periodMonths[0] : null;
  let total = 0;
  for (const entry of printingCostList) {
    const cost = parseFloat(entry.cost) || 0;
    if (cost <= 0) continue;
    const startMonth = entry.from_month || firstMonth;
    if (startMonth === month) {
      total += cost;
    }
  }
  return total;
};

const totalPrintingCost = (printingCostList) => {
  if (!Array.isArray(printingCostList)) return 0;
  return printingCostList.reduce((acc, e) => acc + (parseFloat(e.cost) || 0), 0);
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

// ─── PrintingCostList ────────────────────────────────────────────────────────

const PrintingCostList = ({ entries, onChange }) => {
  const addEntry = () => {
    onChange([...entries, { cost: '', from_month: '', to_month: '' }]);
  };

  const removeEntry = (index) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index, field, value) => {
    const updated = entries.map((e, i) =>
      i === index ? { ...e, [field]: value } : e
    );
    onChange(updated);
  };

  return (
    <div className="form-field full-width">
      <label>Printing Cost (per period)</label>
      <div className="printing-cost-list">
        {entries.length === 0 && (
          <p className="printing-cost-empty">No printing costs added. Click "+ Add print period" below.</p>
        )}
        {entries.map((entry, index) => (
          <div key={index} className="printing-cost-row">
            <div className="printing-cost-field">
              <label className="printing-cost-sublabel">Cost (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={entry.cost}
                onChange={(e) => updateEntry(index, 'cost', e.target.value)}
              />
            </div>
            <div className="printing-cost-field">
              <label className="printing-cost-sublabel">From month</label>
              <select
                value={entry.from_month}
                onChange={(e) => updateEntry(index, 'from_month', e.target.value)}
              >
                <option value="">Select month</option>
                {ALL_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="printing-cost-field">
              <label className="printing-cost-sublabel">To month</label>
              <select
                value={entry.to_month}
                onChange={(e) => updateEntry(index, 'to_month', e.target.value)}
              >
                <option value="">Select month</option>
                {ALL_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="remove-print-period-btn"
              onClick={() => removeEntry(index)}
              title="Remove this entry"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="add-print-period-btn" onClick={addEntry}>
          + Add print period
        </button>
      </div>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientQuery, setClientQuery] = useState('');
  const [billboardQuery, setBillboardQuery] = useState('');
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

  // ── Auto-calculate total_cost_wo_printing ──
  const autoCalcWoPrinting = (billboardPrice, period) => {
    const price = parseFloat(billboardPrice) || 0;
    const months = Array.isArray(period) ? period.length : 0;
    if (price > 0 && months > 0) {
      return (price * months).toFixed(2);
    }
    return '';
  };

  const recalcWithPrinting = (woPrinting, printingCostList) => {
    const wo = parseFloat(woPrinting) || 0;
    const printing = totalPrintingCost(printingCostList);
    return (wo + printing).toFixed(2);
  };

  const applyBookingPrefill = (bookingId, usersList = users, boards = billboards, bookingsList = bookings) => {
    if (!bookingId) return;
    const booking = bookingsList.find((item) => String(item.booking_id) === String(bookingId));
    if (!booking) {
      setForm((prev) => ({ ...prev, booking_id: bookingId }));
      return;
    }

    const clientId = booking.client_id || booking.user_id || '';
    const user = usersList.find((item) => item.user_id === clientId);
    const billboardId = booking.billboard_id || '';
    const billboard = boards.find((item) => String(item.billboard_id) === String(billboardId));
    const businessName = user?.business_name || user?.user_name || booking.offline_business_name || '';
    const bookingPeriod = extractBookingPeriod(booking);
    const billboardPrice = getBillboardPrice(billboard);
    const woCalc = autoCalcWoPrinting(billboardPrice, bookingPeriod);

    setForm((prev) => ({
      ...prev,
      booking_id: booking.booking_id,
      is_unofficial: false,
      client_id: clientId,
      client_name: businessName,
      reference: billboardId,
      media_location: billboard?.location || prev.media_location,
      media_type: billboard?.media_type || prev.media_type,
      period: bookingPeriod.length > 0 ? bookingPeriod : prev.period,
      billboard_price: billboardPrice,
      total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
      total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prev.printing_cost),
    }));
    setClientQuery(businessName);
    setBillboardQuery(billboardId ? String(billboardId) : '');
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

  // ─── Open create / edit ────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setClientQuery('');
    setBillboardQuery('');
    setCreatedQuotation(null);
    setShowPdfPrompt(false);
    setEditingId(null);
    setView('create');
  };

  const openEdit = (item) => {
    let printingCostList = [];
    if (Array.isArray(item.printing_cost)) {
      printingCostList = item.printing_cost;
    } else if (item.printing_cost && typeof item.printing_cost === 'object') {
      printingCostList = [item.printing_cost];
    } else if (typeof item.printing_cost === 'number' && item.printing_cost > 0) {
      printingCostList = [{ cost: String(item.printing_cost), from_month: '', to_month: '' }];
    }

    const billboard = billboards.find((b) => String(b.billboard_id) === String(item.reference));
    const billboardPrice = getBillboardPrice(billboard);
    const isUnofficialQuotation = !item.booking_id || !bookings.some((b) => String(b.booking_id) === String(item.booking_id));

    setForm({
      ...EMPTY_FORM,
      client_id: item.client_id || '',
      client_name: item.client_name || '',
      media_type: item.media_type || '',
      media_used: item.media_used || '',
      reference: item.reference || '',
      media_location: item.media_location || '',
      frequency: item.frequency != null ? String(item.frequency) : '1',
      period: Array.isArray(item.period) ? item.period : [],
      printing_cost: printingCostList,
      total_cost_wo_printing: item.total_cost_wo_printing != null ? String(item.total_cost_wo_printing) : '',
      total_cost_with_printing: item.total_cost_with_printing != null ? String(item.total_cost_with_printing) : '',
      booking_id: isUnofficialQuotation ? '' : (item.booking_id || ''),
      billboard_price: billboardPrice,
      is_unofficial: isUnofficialQuotation,
    });
    setClientQuery(item.client_name || '');
    setBillboardQuery(item.reference ? String(item.reference) : '');
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
    const board = billboards.find((item) => String(item.billboard_id) === String(booking.billboard_id));
    const bookingPeriod = extractBookingPeriod(booking);
    const billboardPrice = getBillboardPrice(board);
    const woCalc = autoCalcWoPrinting(billboardPrice, bookingPeriod.length > 0 ? bookingPeriod : form.period);

    setClientQuery(businessName);
    setBillboardQuery(booking.billboard_id ? String(booking.billboard_id) : '');
    setForm((prev) => ({
      ...prev,
      booking_id: booking.booking_id,
      is_unofficial: false,
      client_id: clientId || prev.client_id,
      client_name: businessName || prev.client_name,
      reference: booking.billboard_id || prev.reference,
      media_location: board?.location || prev.media_location,
      media_type: board?.media_type || prev.media_type,
      period: bookingPeriod.length > 0 ? bookingPeriod : prev.period,
      billboard_price: billboardPrice,
      total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
      total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prev.printing_cost),
    }));
  };

  // ─── Form submit ───────────────────────────────────────────────────────────

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

      const printingCostPayload = form.printing_cost.map((e) => ({
        cost: parseFloat(e.cost) || 0,
        from_month: e.from_month || '',
        to_month: e.to_month || '',
      }));

      const payload = {
        client_id: form.client_id,
        client_name: form.client_name,
        media_type: form.media_type,
        media_used: form.media_used,
        reference: form.reference,
        media_location: form.media_location,
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

          {/* ── Billboard ── */}
          <SearchableSelect
            label="Reference (billboard ID)"
            inputValue={billboardQuery}
            onInputChange={(value) => {
              setBillboardQuery(value);
              setForm((prev) => ({ ...prev, reference: '', billboard_price: '' }));
            }}
            options={billboardOptions}
            placeholder="Search billboard IDs..."
            required
            onSelect={(option) => {
              const board = option.board;
              const price = getBillboardPrice(board);
              setBillboardQuery(String(board.billboard_id));
              setForm((prev) => {
                const woCalc = autoCalcWoPrinting(price, prev.period);
                return {
                  ...prev,
                  reference: board.billboard_id,
                  media_location: board.location || prev.media_location,
                  media_type: board.media_type || prev.media_type,
                  billboard_price: price,
                  total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                  total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prev.printing_cost),
                };
              });
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

          {/* ── Period ── */}
          <MultiMonthSelect
            selectedMonths={form.period}
            onChange={(selected) => {
              setForm((prev) => {
                const woCalc = autoCalcWoPrinting(prev.billboard_price, selected);
                return {
                  ...prev,
                  period: selected,
                  total_cost_wo_printing: woCalc || prev.total_cost_wo_printing,
                  total_cost_with_printing: recalcWithPrinting(woCalc || prev.total_cost_wo_printing, prev.printing_cost),
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

          {/* ── Printing cost list ── */}
          <PrintingCostList
            entries={form.printing_cost}
            onChange={(updated) => {
              setForm((prev) => {
                const wo = parseFloat(prev.total_cost_wo_printing) || 0;
                const printing = totalPrintingCost(updated);
                return {
                  ...prev,
                  printing_cost: updated,
                  total_cost_with_printing: (wo + printing).toFixed(2),
                };
              });
            }}
          />

          {/* ── Total cost w/o printing (auto-calc, editable) ── */}
          <div className="form-field">
            <label>
              Total cost w/o printing
              {form.billboard_price && form.period.length > 0 && (
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
                  total_cost_with_printing: recalcWithPrinting(val, prev.printing_cost),
                }));
              }}
              required
            />
            {form.billboard_price && form.period.length > 0 && (
              <span className="form-hint">
                Auto-calculated: {money(form.billboard_price)} × {form.period.length} month{form.period.length !== 1 ? 's' : ''}. Still editable.
              </span>
            )}
          </div>

          {/* ── Total printing cost (derived) ── */}
          <div className="form-field">
            <label>Total printing cost (derived)</label>
            <input
              type="text"
              value={form.printing_cost.length > 0 ? money(derivedPrintingTotal) : '—'}
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
