import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import './Billboards.css';

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

const EditIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const INITIAL_FORM = {
  billboard_id: '',
  location: '',
  size: '',
  structure: '',
  media_type: '',
  daily_rate: '',
  image_url: '',
  description: '',
  is_available: true,
  price: '',
  monthly_price: '',
};

const Billboards = () => {
  const [billboards, setBillboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState(null);

  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    fetchBillboards();
  }, []);

  const fetchBillboards = async () => {
    try {
      setLoading(true);
      const [billboardsRes, bookingsRes] = await Promise.all([
        supabase.from('billboards').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*')
      ]);

      if (billboardsRes.error) throw billboardsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      setBillboards(billboardsRes.data || []);
      setBookings(bookingsRes.data || []);
    } catch (error) {
      console.error('Error fetching billboards:', error.message);
      showNotification('error', `Failed to load billboards: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const filteredBillboards = useMemo(() => {
    if (!searchQuery.trim()) return billboards;
    const q = searchQuery.toLowerCase();
    return billboards.filter((item) => {
      const idStr = (item.billboard_id || item.id || '').toString().toLowerCase();
      const locStr = (item.location || '').toLowerCase();
      const sizeStr = (item.size || '').toLowerCase();
      const structureStr = (item.structure || '').toLowerCase();

      return (
        idStr.includes(q) ||
        locStr.includes(q) ||
        sizeStr.includes(q) ||
        structureStr.includes(q)
      );
    });
  }, [billboards, searchQuery]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleOpenAddModal = () => {
    setEditingBillboard(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (billboard) => {
    setEditingBillboard(billboard);
    setFormData({
      billboard_id: billboard.billboard_id || '',
      location: billboard.location || '',
      size: billboard.size || '',
      structure: billboard.structure || '',
      media_type: billboard.media_type || '',
      daily_rate: billboard.daily_rate ? billboard.daily_rate.toString() : '',
      image_url: billboard.image_url || '',
      description: billboard.description || '',
      is_available: billboard.is_available !== false,
      price: billboard.price ? billboard.price.toString() : '',
      monthly_price: billboard.monthly_price ? billboard.monthly_price.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.location.trim()) {
      showNotification('error', 'Please enter a location.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        location: formData.location.trim(),
        size: formData.size.trim() || null,
        structure: formData.structure.trim() || null,
        media_type: formData.media_type ? formData.media_type.trim() : null,
        daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
        image_url: formData.image_url.trim() || null,
        description: formData.description.trim() || null,
        is_available: formData.is_available,
        price: formData.price ? parseFloat(formData.price) : null,
        monthly_price: formData.monthly_price ? parseFloat(formData.monthly_price) : null,
      };

      if (formData.billboard_id.trim()) {
        payload.billboard_id = formData.billboard_id.trim();
      }

      if (editingBillboard) {
        const targetKey = editingBillboard.id ? 'id' : 'billboard_id';
        const targetVal = editingBillboard.id || editingBillboard.billboard_id;

        const { error } = await supabase
          .from('billboards')
          .update(payload)
          .eq(targetKey, targetVal);

        if (error) throw error;

        showNotification('success', 'Billboard updated successfully!');
      } else {
        const { error } = await supabase
          .from('billboards')
          .insert([payload]);

        if (error) throw error;

        showNotification('success', 'Billboard added successfully!');
      }

      setFormData(INITIAL_FORM);
      setEditingBillboard(null);
      setIsModalOpen(false);
      fetchBillboards();
    } catch (error) {
      console.error('Error saving billboard:', error);
      showNotification('error', `Failed to save billboard: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const targetKey = deleteTarget.id ? 'id' : 'billboard_id';
      const targetVal = deleteTarget.id || deleteTarget.billboard_id;

      const { error } = await supabase
        .from('billboards')
        .delete()
        .eq(targetKey, targetVal);

      if (error) throw error;

      showNotification('success', 'Billboard deleted successfully!');
      setDeleteTarget(null);
      fetchBillboards();
    } catch (error) {
      console.error('Error deleting billboard:', error);
      showNotification('error', `Failed to delete billboard: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const isBillboardCurrentlyBooked = (billboard) => {
    const boardId = (billboard.billboard_id || billboard.id || '').toString();
    const now = new Date();

    return bookings.some((b) => {
      const bBoardId = (b.billboard_id || '').toString();
      if (bBoardId !== boardId) return false;

      // Check if booking is marked active (if specified)
      if (b.is_active === false) return false;

      // Check date range if start_time/end_time exist
      if (b.start_time && b.end_time) {
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        // Normalize end to end of day if only date is provided
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      }

      return true;
    });
  };

  return (
    <div className="billboards-container">
      <div className="billboards-header">
        <h1 className="page-title">BILLBOARDS</h1>
        <button className="add-billboard-btn" onClick={handleOpenAddModal}>
          <PlusIcon />
          <span>ADD NEW BILLBOARD</span>
        </button>
      </div>

      {notification && (
        <div className={`notification-banner ${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>
            &times;
          </button>
        </div>
      )}

      <div className="search-bar-container">
        <SearchIcon />
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, location, size, structure, or media type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="billboards-loading">
          <div className="spinner"></div>
          <p>Loading billboards...</p>
        </div>
      ) : filteredBillboards.length === 0 ? (
        <div className="empty-billboards">
          <h3>No billboards found</h3>
          <p>{searchQuery ? 'Try matching another search query.' : 'Click "Add New Billboard" to get started.'}</p>
        </div>
      ) : (
        <div className="billboards-grid">
          {filteredBillboards.map((billboard) => {
            const isBooked = isBillboardCurrentlyBooked(billboard);
            const isAvailable = billboard.is_available !== false && !isBooked;

            return (
              <div className="billboard-card" key={billboard.billboard_id || billboard.id}>
                <div className="billboard-image-container">
                  {billboard.image_url ? (
                    <img
                      src={billboard.image_url}
                      alt={billboard.location || 'Billboard'}
                      className="billboard-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="billboard-image-fallback"
                    style={{ display: billboard.image_url ? 'none' : 'flex' }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span>No Image</span>
                  </div>
                  <span
                    className={`status-tag ${
                      isAvailable ? 'available' : 'unavailable'
                    }`}
                  >
                    {isAvailable ? 'Available' : 'Booked / Unavailable'}
                  </span>
                </div>

                <div className="billboard-card-body">
                  <div className="billboard-id-badge">
                    ID: {billboard.billboard_id || billboard.id || 'N/A'}
                  </div>
                  <h3 className="billboard-location">{billboard.location || 'Unspecified Location'}</h3>

                  <div className="billboard-details">
                    {billboard.size && (
                      <div className="detail-row">
                        <span className="detail-label">Size:</span>
                        <span className="detail-value">{billboard.size}</span>
                      </div>
                    )}
                    {billboard.structure && (
                      <div className="detail-row">
                        <span className="detail-label">Structure:</span>
                        <span className="detail-value">{billboard.structure}</span>
                      </div>
                    )}
                    
                    {billboard.price && (
                      <div className="detail-row">
                        <span className="detail-label">Price:</span>
                        <span className="detail-value rate">${billboard.price}</span>
                      </div>
                    )}
                  </div>

                  {billboard.description && (
                    <p className="billboard-description">{billboard.description}</p>
                  )}

                  <div className="billboard-card-actions">
                    <button
                      className="card-btn edit-btn"
                      onClick={() => handleOpenEditModal(billboard)}
                      title="Edit Billboard"
                    >
                      <EditIcon /> Edit
                    </button>
                    <button
                      className="card-btn delete-btn"
                      onClick={() => setDeleteTarget(billboard)}
                      title="Delete Billboard"
                    >
                      <TrashIcon /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Billboard Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBillboard ? 'EDIT BILLBOARD' : 'ADD NEW BILLBOARD'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="billboard-form">
              <div className="form-group">
                <label>Billboard ID (Optional)</label>
                <input
                  type="text"
                  name="billboard_id"
                  placeholder="e.g. BB-101"
                  value={formData.billboard_id}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Location *</label>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g. Highway Expressway Exit 4"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Size</label>
                  <input
                    type="text"
                    name="size"
                    placeholder="e.g. 14x48 ft"
                    value={formData.size}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Structure</label>
                  <input
                    type="text"
                    name="structure"
                    placeholder="e.g. Unipole, Wallbanner"
                    value={formData.structure}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Media Type</label>
                  <input
                    type="text"
                    name="media_type"
                    placeholder="e.g. Digital, Static"
                    value={formData.media_type}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    placeholder="e.g. 150"
                    value={formData.price}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="monthly_price"
                    placeholder="e.g. 1200"
                    value={formData.monthly_price}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  name="image_url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image_url}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  rows="3"
                  placeholder="Additional billboard specifications..."
                  value={formData.description}
                  onChange={handleInputChange}
                ></textarea>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_available"
                    checked={formData.is_available}
                    onChange={handleInputChange}
                  />
                  <span>Mark as Available for booking</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting
                    ? editingBillboard ? 'Saving...' : 'Adding...'
                    : editingBillboard ? 'Update Billboard' : 'Save Billboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content delete-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>DELETE BILLBOARD</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>
                &times;
              </button>
            </div>
            <div className="delete-modal-body">
              <p>Are you sure you want to delete this billboard?</p>
              <div className="delete-target-info">
                <strong>{deleteTarget.location || 'Unspecified Location'}</strong>
                <span>(ID: {deleteTarget.billboard_id || deleteTarget.id || 'N/A'})</span>
              </div>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Billboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billboards;
