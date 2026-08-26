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

const INITIAL_FORM = {
  billboard_id: '',
  location: '',
  size: '',
  structure: '',
  //media_type: '',
  daily_rate: '',
  image_url: '',
  description: '',
  is_available: true,
  price: ''
};

const Billboards = () => {
  const [billboards, setBillboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchBillboards();
  }, []);

  const fetchBillboards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBillboards(data || []);
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
      //const mediaTypeStr = (item.media_type || '').toLowerCase();

      return (
        idStr.includes(q) ||
        locStr.includes(q) ||
        sizeStr.includes(q) ||
        structureStr.includes(q) 
        //mediaTypeStr.includes(q)
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

  const handleAddSubmit = async (e) => {
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
        //media_type: formData.media_type.trim() || null,
        daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
        image_url: formData.image_url.trim() || null,
        description: formData.description.trim() || null,
        is_available: formData.is_available,
        price: formData.price ? parseFloat(formData.price) : null,
      };

      if (formData.billboard_id.trim()) {
        payload.billboard_id = formData.billboard_id.trim();
      }

      const { data, error } = await supabase
        .from('billboards')
        .insert([payload])
        .select();

      if (error) throw error;

      showNotification('success', 'Billboard added successfully!');
      setFormData(INITIAL_FORM);
      setIsModalOpen(false);
      fetchBillboards();
    } catch (error) {
      console.error('Error adding billboard:', error);
      showNotification('error', `Failed to add billboard: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="billboards-container">
      <div className="billboards-header">
        <h1 className="page-title">BILLBOARDS</h1>
        <button className="add-billboard-btn" onClick={() => setIsModalOpen(true)}>
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
          {filteredBillboards.map((billboard) => (
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
                    billboard.is_available === false ? 'unavailable' : 'available'
                  }`}
                >
                  {billboard.is_available === false ? 'Booked / Unavailable' : 'Available'}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Billboard Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>ADD NEW BILLBOARD</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="billboard-form">
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
                  <label>Price: </label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    placeholder="e.g. 150"
                    value={formData.price}
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
                  {submitting ? 'Adding...' : 'Save Billboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billboards;
