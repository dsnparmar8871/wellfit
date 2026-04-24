import { useState, useEffect, useRef } from 'react';
import { measurementAPI, userAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import MeasurementForm from '../../components/MeasurementForm.jsx';

const DEFAULT_GARMENT_TYPES = ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta', 'Other'];
const MEASUREMENT_FIELDS_DISPLAY = {
  chest: 'Chest', waist: 'Waist', hip: 'Hip', sleeve: 'Sleeve', length: 'Length',
  shoulder: 'Shoulder', neck: 'Neck', crotch: 'Crotch', thigh: 'Thigh', inseam: 'Inseam',
  bicep: 'Bicep', wrist: 'Wrist',
};

const getStitchingGarmentTypes = (orders = []) => {
  const values = new Set();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (item?.isStitching && item?.garmentType) values.add(item.garmentType);
    });
    if (order?.stitchingDetails?.garmentType) values.add(order.stitchingDetails.garmentType);
  });
  return [...values].filter(Boolean);
};

const formatAddress = (address = {}) => {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].filter(Boolean);
  return parts.join(', ');
};

const isPastOrder = (status) => ['delivered', 'cancelled'].includes(status);

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState({
    user: null,
    recentOrders: [],
    templates: [],
    garmentTypes: [],
  });
  const [measurementForm, setMeasurementForm] = useState({
    name: '',
    garmentType: 'Shirt',
    measurements: {},
    notes: '',
  });
  const activeDetailRequestRef = useRef('');
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const load = () => {
    setLoading(true);
    userAPI.getAllUsers({ search: debouncedSearch, role: 'customer' })
      .then(({ data }) => setUsers(Array.isArray(data.data) ? data.data : (data.data?.users || [])))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        if (keepSearchFocusRef.current && searchInputRef.current) {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            const valueLength = searchInputRef.current?.value?.length || 0;
            searchInputRef.current?.setSelectionRange(valueLength, valueLength);
          });
        }
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [debouncedSearch]);

  const toggle = async (id) => {
    try { await userAPI.toggleStatus(id); toast.success('Status updated'); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  const removeCustomer = async (id) => {
    if (!confirm('Delete this customer account?')) return;
    try {
      await userAPI.deleteUser(id);
      toast.success('Customer deleted');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const loadCustomerDetails = async (customer) => {
    const requestKey = `${customer._id}-${Date.now()}`;
    activeDetailRequestRef.current = requestKey;
    setSelectedCustomer(customer);
    setShowDetailModal(true);
    setDetailLoading(true);
    setCustomerDetails({
      user: customer,
      recentOrders: [],
      templates: [],
      garmentTypes: [],
    });

    try {
      const [userRes, measurementRes] = await Promise.all([
        userAPI.getUserById(customer._id),
        measurementAPI.getCustomerMeasurements(customer._id),
      ]);

      if (activeDetailRequestRef.current !== requestKey) return;

      const user = userRes.data?.data?.user || customer;
      const recentOrders = userRes.data?.data?.recentOrders || [];
      const templates = measurementRes.data?.data?.templates || [];
      const garmentTypesFromOrders = getStitchingGarmentTypes(recentOrders);

      setCustomerDetails({
        user,
        recentOrders,
        templates,
        garmentTypes: garmentTypesFromOrders,
      });
    } catch (err) {
      if (activeDetailRequestRef.current !== requestKey) return;
      toast.error(getErrorMsg(err));
    } finally {
      if (activeDetailRequestRef.current !== requestKey) return;
      setDetailLoading(false);
    }
  };

  const openAddMeasurement = () => {
    const initialGarmentType = customerDetails.garmentTypes[0] || 'Shirt';
    setEditingTemplateId(null);
    setMeasurementForm({
      name: '',
      garmentType: initialGarmentType,
      measurements: {},
      notes: '',
    });
    setShowMeasurementModal(true);
  };

  const openEditMeasurement = (template) => {
    setEditingTemplateId(template._id);
    setMeasurementForm({
      name: template.name || '',
      garmentType: template.garmentType || 'Shirt',
      measurements: template.measurements || {},
      notes: template.notes || '',
    });
    setShowMeasurementModal(true);
  };

  const saveMeasurement = async () => {
    if (!selectedCustomer?._id) return;
    if (!measurementForm.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!Object.keys(measurementForm.measurements || {}).length) {
      toast.error('Please add at least one measurement');
      return;
    }

    setSavingMeasurement(true);
    try {
      const payload = {
        customer: selectedCustomer._id,
        name: measurementForm.name.trim(),
        garmentType: measurementForm.garmentType,
        measurements: measurementForm.measurements,
        notes: measurementForm.notes?.trim() || '',
      };

      if (editingTemplateId) {
        await measurementAPI.updateTemplate(editingTemplateId, payload);
        toast.success('Measurement updated');
      } else {
        await measurementAPI.createTemplate(payload);
        toast.success('Measurement added');
      }

      setShowMeasurementModal(false);
      await loadCustomerDetails(selectedCustomer);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSavingMeasurement(false);
    }
  };

  const deleteMeasurement = async (templateId) => {
    if (!confirm('Delete this measurement?')) return;
    setDeletingMeasurementId(templateId);
    try {
      await measurementAPI.deleteTemplate(templateId);
      toast.success('Measurement deleted');
      await loadCustomerDetails(selectedCustomer);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setDeletingMeasurementId(null);
    }
  };

  const garmentTypeOptions = Array.from(new Set([
    ...customerDetails.garmentTypes,
    ...DEFAULT_GARMENT_TYPES,
  ]));
  const currentOrders = (customerDetails.recentOrders || []).filter((order) => !isPastOrder(order.status));
  const pastOrders = (customerDetails.recentOrders || []).filter((order) => isPastOrder(order.status));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Customers</h1>
      </div>
      <input
        ref={searchInputRef}
        className="form-input"
        style={{ maxWidth: 320, marginBottom: 16 }}
        placeholder="Search by name, email or mobile number…"
        value={search}
        onFocus={() => { keepSearchFocusRef.current = true; }}
        onBlur={() => { keepSearchFocusRef.current = false; }}
        onChange={(e) => {
          keepSearchFocusRef.current = true;
          setSearch(e.target.value);
        }}
      />
      {loading ? <PageSkeleton variant="table" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-light)', fontSize: 13 }}>{u.email}</td>
                  <td style={{ fontSize: 13 }}>{u.phone || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-light)' }}>{formatDate(u.createdAt)}</td>
                  <td><StatusBadge status={u.isActive ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => loadCustomerDetails(u)}>
                        View
                      </button>
                      <button className={`btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-outline'}`}
                        style={u.isActive ? { color: 'var(--error)' } : {}} onClick={() => toggle(u._id)}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--error)' }} onClick={() => removeCustomer(u._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>No users found.</div>}
        </div>
      )}

      <Modal
        open={showDetailModal}
        onClose={() => {
          activeDetailRequestRef.current = '';
          setShowDetailModal(false);
        }}
        title={selectedCustomer ? `Customer Details - ${selectedCustomer.name}` : 'Customer Details'}
        maxWidth={950}
      >
        {detailLoading ? (
          <PageSkeleton variant="modal" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="card" style={{ padding: 12, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Customer Name</div>
                <div style={{ fontWeight: 700, wordBreak: 'break-word', overflow: 'hidden' }}>{customerDetails.user?.name || selectedCustomer?.name || '—'}</div>
              </div>
              <div className="card" style={{ padding: 12, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Email</div>
                <div style={{ fontWeight: 700, wordBreak: 'break-word', overflow: 'hidden' }}>{customerDetails.user?.email || selectedCustomer?.email || '—'}</div>
              </div>
              <div className="card" style={{ padding: 12, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Mobile Number</div>
                <div style={{ fontWeight: 700, wordBreak: 'break-word', overflow: 'hidden' }}>{customerDetails.user?.phone || selectedCustomer?.phone || '—'}</div>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <h3 style={{ marginBottom: 10 }}>Addresses</h3>
              {(customerDetails.user?.addresses || []).length === 0 ? (
                <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No addresses found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(customerDetails.user?.addresses || []).map((address) => (
                    <div key={address._id || `${address.line1}-${address.pincode}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {address.label || 'Address'}{address.isDefault ? ' (Default)' : ''}
                      </div>
                      <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{formatAddress(address)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ marginBottom: 0 }}>Measurements</h3>
                <button className="btn btn-primary btn-sm" onClick={openAddMeasurement}>Add Measurement</button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Custom stitching item types found in orders</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(customerDetails.garmentTypes.length ? customerDetails.garmentTypes : ['No stitching item types found']).map((type) => (
                    <span key={type} className="badge badge-cream">{type}</span>
                  ))}
                </div>
              </div>

              {customerDetails.templates.length === 0 ? (
                <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No measurements saved for this customer.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {customerDetails.templates.map((template) => (
                    <div key={template._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{template.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{template.garmentType}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => openEditMeasurement(template)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ color: 'var(--error)' }}
                            onClick={() => deleteMeasurement(template._id)}
                            disabled={deletingMeasurementId === template._id}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {Object.entries(template.measurements || {})
                          .filter(([key]) => MEASUREMENT_FIELDS_DISPLAY[key])
                          .map(([key, value]) => (
                            <div key={key} style={{ fontSize: 12 }}>
                              <span style={{ color: 'var(--text-light)' }}>{MEASUREMENT_FIELDS_DISPLAY[key]}:</span>
                              <span style={{ marginLeft: 4, fontWeight: 600 }}>{value ?? '—'}</span>
                            </div>
                          ))}
                      </div>
                      {!!template.notes?.trim() && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-light)' }}>Notes:</span>
                          <span style={{ marginLeft: 4 }}>{template.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <h3 style={{ marginBottom: 12 }}>Current Orders</h3>
              {currentOrders.length === 0 ? (
                <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No current orders.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentOrders.map((order) => (
                    <div key={order._id || order.orderNumber} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>#{order.orderNumber}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Placed: {formatDate(order.createdAt)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>Rs. {order.totalAmount ?? 0}</div>
                          <StatusBadge status={order.status} />
                        </div>
                      </div>
                      {!!order.notes?.trim() && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-light)' }}>Notes:</span>
                          <span style={{ marginLeft: 4 }}>{order.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <h3 style={{ marginBottom: 12 }}>Past Orders</h3>
              {pastOrders.length === 0 ? (
                <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No past orders.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pastOrders.map((order) => (
                    <div key={order._id || order.orderNumber} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>#{order.orderNumber}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Placed: {formatDate(order.createdAt)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>Rs. {order.totalAmount ?? 0}</div>
                          <StatusBadge status={order.status} />
                        </div>
                      </div>
                      {!!order.notes?.trim() && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-light)' }}>Notes:</span>
                          <span style={{ marginLeft: 4 }}>{order.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showMeasurementModal}
        onClose={() => setShowMeasurementModal(false)}
        title={editingTemplateId ? 'Edit Measurement' : 'Add Measurement'}
        maxWidth={640}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Template Name</label>
            <input
              className="form-input"
              value={measurementForm.name}
              onChange={(e) => setMeasurementForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Wedding Sherwani"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Garment Type</label>
            <select
              className="form-select"
              value={measurementForm.garmentType}
              onChange={(e) => setMeasurementForm((prev) => ({ ...prev, garmentType: e.target.value }))}
            >
              {garmentTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Measurements</label>
            <MeasurementForm
              garmentType={measurementForm.garmentType}
              measurements={measurementForm.measurements}
              onChange={(measurements) => setMeasurementForm((prev) => ({ ...prev, measurements }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={measurementForm.notes}
              onChange={(e) => setMeasurementForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowMeasurementModal(false)} disabled={savingMeasurement}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveMeasurement} disabled={savingMeasurement}>
              {savingMeasurement ? 'Saving...' : (editingTemplateId ? 'Update Measurement' : 'Save Measurement')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
