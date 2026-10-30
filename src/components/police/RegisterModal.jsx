import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  User,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Shield
} from 'lucide-react';
import { createMissingPerson } from '../../services/api';
import AddressSearchSelector from './AddressSearchSelector';

export default function RegisterModal({ isOpen, onClose, onSuccess, authority }) {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [jurisdiction, setJurisdiction] = useState(authority?.jurisdiction || 'Bandra');
  const [lastSeenDate, setLastSeenDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  // Address-based location resolution
  const [confirmedLocation, setConfirmedLocation] = useState(null);
  const [hasUnconfirmedSearch, setHasUnconfirmedSearch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Prevent background page from scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setFullName('');
      setAge('');
      setGender('');
      setJurisdiction(authority?.jurisdiction || 'Bandra');
      setLastSeenDate('');
      setDescription('');
      setSelectedPhotos([]);
      setConfirmedLocation(null);
      setHasUnconfirmedSearch(false);
      setErrorMessage(null);
      setLoading(false);
    }
  }, [isOpen, authority]);

  if (!isOpen) return null;

  const handleFilesSelected = (files) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];
    const errors = [];
    const filesToRead = [];

    fileArray.forEach((file, idx) => {
      // Validate file format
      const ext = file.name.split('.').pop().toLowerCase();
      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        errors.push(`"${file.name}" is not a supported format (JPG, PNG, WEBP).`);
        return;
      }

      // Validate size (10 MB)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`"${file.name}" exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        return;
      }

      // Check for duplicate file already added
      const isDuplicate = selectedPhotos.some(
        (existing) => existing.name === file.name && existing.size === file.size
      );
      if (isDuplicate) return;

      filesToRead.push({ file, idx });
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join(' '));
    } else {
      setErrorMessage(null);
    }

    if (filesToRead.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Read files as base64 Data URLs so previews remain robustly in memory and never fail with ERR_FILE_NOT_FOUND
    Promise.all(
      filesToRead.map(({ file, idx }) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: `${file.name}_${file.size}_${Date.now()}_${idx}`,
              file,
              name: file.name,
              size: file.size,
              preview: reader.result,
            });
          };
          reader.onerror = () => {
            resolve(null);
          };
          reader.readAsDataURL(file);
        });
      })
    ).then((results) => {
      const validResults = results.filter(Boolean);
      if (validResults.length > 0) {
        setSelectedPhotos((prev) => [...prev, ...validResults]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });
  };

  const handleRemovePhoto = (idToRemove) => {
    setSelectedPhotos((prev) => prev.filter((p) => p.id !== idToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!fullName.trim()) {
      setErrorMessage('Full legal name is required.');
      return;
    }

    if (selectedPhotos.length === 0) {
      setErrorMessage('At least one reference photograph is required for biometric facial indexing.');
      return;
    }

    // Check if officer typed an address search but did not confirm a candidate
    if (hasUnconfirmedSearch) {
      setErrorMessage(
        'You entered an address search without selecting and confirming a location. Please select one of the matching search results, or clear the address search.'
      );
      return;
    }

    if (age && (Number(age) < 0 || Number(age) > 150)) {
      setErrorMessage('Age must be between 0 and 150.');
      return;
    }

    const formData = new FormData();
    formData.append('full_name', fullName.trim());
    if (age) formData.append('age', age.trim());
    if (gender) formData.append('gender', gender);
    if (jurisdiction) formData.append('jurisdiction', jurisdiction);

    if (lastSeenDate) {
      try {
        const iso = new Date(lastSeenDate).toISOString();
        formData.append('last_seen_date', iso);
      } catch {
        formData.append('last_seen_date', lastSeenDate);
      }
    }

    // Automatically resolve numeric coordinates from confirmed address
    if (confirmedLocation) {
      formData.append('latitude', String(confirmedLocation.lat));
      formData.append('longitude', String(confirmedLocation.lon));
    }

    // Append description and include full address text if available
    let finalDescription = description.trim();
    if (confirmedLocation?.displayName) {
      const locNotice = `Last Seen Address: ${confirmedLocation.displayName}`;
      finalDescription = finalDescription
        ? `${finalDescription}\n\n${locNotice}`
        : locNotice;
    }
    if (finalDescription) {
      formData.append('description', finalDescription);
    }

    // Primary photo for initial report & InsightFace biometric indexing
    formData.append('missing_person_image', selectedPhotos[0].file);

    // Append all photos for multi-photo support
    selectedPhotos.forEach((item) => {
      formData.append('missing_person_images', item.file);
    });
    selectedPhotos.slice(1).forEach((item) => {
      formData.append('additional_images', item.file);
    });

    setLoading(true);

    try {
      const response = await createMissingPerson(formData);
      onSuccess(response);
      onClose();
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMessage(err.message || 'Failed to register missing person report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-register" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <div className="modal-header-titles">
            <h2 className="modal-title">Register Missing Person</h2>
            <span className="modal-subtitle">
              Create an official law-enforcement dossier & extract biometric facial embedding
            </span>
          </div>
          <button
            type="button"
            className="btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body with Fixed Footer */}
        <form onSubmit={handleSubmit} id="register-form" className="modal-form">
          <div className="modal-body">
            {errorMessage && (
              <div className="alert-banner error">
                <AlertCircle size={18} className="shrink-0" />
                <div>
                  <strong>Registration Error:</strong>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="alert-banner info">
              <AlertCircle size={18} className="shrink-0" />
              <div>
                <strong>Biometric Facial Requirements:</strong>
                <p>
                  Each reference photograph should feature clear frontal or near-frontal visibility.
                  InsightFace extracts 512-dimensional facial embeddings for automatic AI cross-referencing against citizen sightings.
                  Multiple photos from different angles improve match accuracy.
                </p>
              </div>
            </div>

            <div className="form-grid">
              {/* Full Name */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  <User size={14} /> Full Legal Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Age */}
              <div className="form-group">
                <label className="form-label">Age (Years)</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  className="form-input"
                  placeholder="e.g. 24"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              {/* Gender */}
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>

              {/* Police Jurisdiction */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  <Shield size={14} /> Incident Police Jurisdiction <span className="required-star">*</span>
                </label>
                <select
                  className="form-select"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  required
                >
                  {authority?.jurisdiction && (
                    <option value={authority.jurisdiction}>
                      {authority.jurisdiction} Police Station (My Station)
                    </option>
                  )}
                  {authority?.jurisdiction?.toLowerCase() !== 'bandra' && (
                    <option value="Bandra">Bandra Police Station</option>
                  )}
                  {authority?.jurisdiction?.toLowerCase() !== 'andheri' && (
                    <option value="Andheri">Andheri Police Station</option>
                  )}
                  <option value="unassigned">Unassigned / Pending Area Review</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Assign to the police station having local jurisdiction, or select Pending Area Review if unknown.
                </span>
              </div>

              {/* Last Seen Date */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  <Calendar size={14} /> Last Seen Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={lastSeenDate}
                  onChange={(e) => setLastSeenDate(e.target.value)}
                />
              </div>

              {/* Address-based Location Selector */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  <MapPin size={14} /> Last Seen Address / Landmark
                </label>
                <AddressSearchSelector
                  onLocationConfirmed={(loc) => setConfirmedLocation(loc)}
                  onUnconfirmedQueryChange={(unconfirmed) => setHasUnconfirmedSearch(unconfirmed)}
                  initialLocation={confirmedLocation}
                />
              </div>

              {/* Description & Narrative */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  <FileText size={14} /> Distinguishing Features & Incident Context
                </label>
                <textarea
                  className="form-textarea"
                  placeholder="Clothing worn, height, physical scars, incident circumstances..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Photo Upload Section */}
              <div className="form-group col-span-2">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    <ImageIcon size={14} /> Reference Photographs ({selectedPhotos.length}) <span className="required-star">*</span>
                  </label>
                  {selectedPhotos.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus size={13} /> Add More Photos
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />

                {selectedPhotos.length === 0 ? (
                  <div
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-icon-box">
                      <Upload size={24} />
                    </div>
                    <p className="upload-title">
                      Click or Drag & Drop Reference Photos
                    </p>
                    <p className="upload-subtitle">
                      Select one or multiple photos (JPG, PNG, WEBP up to 10 MB per file)
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="photos-gallery-grid" style={{ marginTop: '0.25rem' }}>
                      {selectedPhotos.map((photo, index) => (
                        <div key={photo.id} className="photo-card" style={{ height: 'auto' }}>
                          <img
                            src={photo.preview}
                            alt={`Preview ${index + 1}`}
                            className="photo-card-img"
                            style={{ height: '110px' }}
                          />
                          <div className="photo-card-overlay" style={{ padding: '0.4rem 0.5rem' }}>
                            <span
                              className="score-badge"
                              style={{
                                color: index === 0 ? 'var(--color-teal)' : 'var(--color-midnight)',
                                background: index === 0 ? 'var(--color-teal-bg)' : 'var(--color-midnight-light)',
                                borderColor: index === 0 ? 'var(--color-teal-border)' : 'rgba(30, 58, 95, 0.2)',
                                fontSize: '0.66rem'
                              }}
                            >
                              {index === 0 ? 'Primary' : `Photo #${index + 1}`}
                            </span>
                            <button
                              type="button"
                              className="btn-delete-photo"
                              title="Remove this photo"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePhoto(photo.id);
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div style={{ padding: '0.25rem 0.5rem 0.4rem', background: '#FFFFFF', borderTop: '1px solid var(--color-border-subtle)' }}>
                            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-dark)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={photo.name}>
                              {photo.name}
                            </p>
                            <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>
                              {(photo.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Add photo card inside gallery */}
                      <div
                        className="add-photo-dropzone"
                        style={{ height: '185px' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus size={22} />
                        <span>Add Another</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-light)' }}>
                          Additional angle
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Tip: The first photograph serves as the primary biometric index. Additional photographs are linked to the case dossier to enhance facial matching confidence.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Extracting Biometrics & Indexing ({selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''})...
                </>
              ) : (
                `Register Case Dossier (${selectedPhotos.length} Photo${selectedPhotos.length > 1 ? 's' : ''})`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
