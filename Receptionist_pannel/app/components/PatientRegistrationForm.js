'use client';

import { useState } from 'react';
import { Toast } from '@/components/Toast';
import styles from './PatientRegistrationForm.module.css';

export default function PatientRegistrationForm() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    contact: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [ipData, setIpData] = useState({
    admissionDate: '',
    expectedDays: '',
    casualtyFlag: false,
    emergencyFlag: false,
    doctorId: '',
    roomId: '',
    bedId: '',
  });
  const [opData, setOpData] = useState({
    doctorId: '',
  });
  const [serviceData, setServiceData] = useState({
    serviceType: '',
    serviceId: '',
  });
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/doctors/active`);
      const result = await response.json();
      setDoctors(result.data || []);
    } catch (error) {
      showToast('Failed to fetch doctors', 'error');
    }
  };

  const fetchRooms = async () => {
    try {
      const hospitalId = localStorage.getItem('hospitalId');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/infrastructure/rooms/${hospitalId}`
      );
      const result = await response.json();
      setRooms(result.data || []);
    } catch (error) {
      showToast('Failed to fetch rooms', 'error');
    }
  };

  const fetchBeds = async (roomId) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/infrastructure/beds/available/${roomId}`
      );
      const result = await response.json();
      setBeds(result.data || []);
    } catch (error) {
      showToast('Failed to fetch available beds', 'error');
    }
  };

  const fetchServices = async () => {
    try {
      const hospitalId = localStorage.getItem('hospitalId');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/services/list/${hospitalId}`
      );
      const result = await response.json();
      setServices(result.data || []);
    } catch (error) {
      showToast('Failed to fetch services', 'error');
    }
  };

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    setStep(2);
    if (selectedCategory === 'IP') {
      fetchDoctors();
      fetchRooms();
    } else if (selectedCategory === 'OP') {
      fetchDoctors();
    } else if (selectedCategory === 'SERVICES') {
      fetchServices();
    }
  };

  const handleFormDataChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleIpDataChange = (e) => {
    const { name, value, type, checked } = e.target;
    setIpData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRoomChange = (roomId) => {
    setIpData((prev) => ({ ...prev, roomId, bedId: '' }));
    fetchBeds(roomId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const hospitalId = localStorage.getItem('hospitalId');
      const token = localStorage.getItem('token');

      // First, create patient record
      const patientResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/patients/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            hospitalId,
          }),
        }
      );

      const patientResult = await patientResponse.json();

      if (!patientResponse.ok) {
        throw new Error(patientResult.error || 'Failed to create patient');
      }

      const patientId = patientResult.data._id;

      let registrationResponse;

      if (category === 'IP') {
        registrationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/patients/register-ip`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              patientId,
              ...ipData,
              hospitalId,
            }),
          }
        );
      } else if (category === 'OP') {
        registrationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/patients/register-op`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              patientId,
              ...opData,
              hospitalId,
            }),
          }
        );
      } else if (category === 'SERVICES') {
        registrationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/patients/register-service`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              patientId,
              ...serviceData,
              hospitalId,
            }),
          }
        );
      }

      const registrationResult = await registrationResponse.json();

      if (!registrationResponse.ok) {
        throw new Error(registrationResult.error || 'Registration failed');
      }

      showToast(`${category} Registration Successful!`, 'success');
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        age: '',
        gender: '',
        contact: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
      });
      setIpData({
        admissionDate: '',
        expectedDays: '',
        casualtyFlag: false,
        emergencyFlag: false,
        doctorId: '',
        roomId: '',
        bedId: '',
      });
      setOpData({ doctorId: '' });
      setServiceData({ serviceType: '', serviceId: '' });
      setCategory('');
      setStep(1);

      // Navigate to registration ID
      if (category === 'IP') {
        window.location.href = `/reception/patients/${registrationResult.ipId}`;
      } else if (category === 'OP') {
        window.location.href = `/reception/patients/${registrationResult.opId}`;
      } else {
        window.location.href = `/reception/patients/${registrationResult.serviceId}`;
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {toast.show && (
        <Toast message={toast.message} type={toast.type} />
      )}

      {step === 1 && (
        <div className={styles.categorySelection}>
          <h2>Select Registration Category</h2>
          <div className={styles.categoryCards}>
            <div
              className={styles.card}
              onClick={() => handleCategorySelect('IP')}
            >
              <div className={styles.icon}>🏥</div>
              <h3>In-Patient (IP)</h3>
              <p>Hospital admission with room & bed allocation</p>
            </div>
            <div
              className={styles.card}
              onClick={() => handleCategorySelect('OP')}
            >
              <div className={styles.icon}>👨‍⚕️</div>
              <h3>Out-Patient (OP)</h3>
              <p>Doctor consultation & treatment</p>
            </div>
            <div
              className={styles.card}
              onClick={() => handleCategorySelect('SERVICES')}
            >
              <div className={styles.icon}>🔬</div>
              <h3>Services</h3>
              <p>Lab, Scan, or Procedure services</p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setStep(1)}
          >
            ← Back
          </button>

          <h2>Patient Information - {category}</h2>

          <div className={styles.formGroup}>
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleFormDataChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleFormDataChange}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Age *</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleFormDataChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Gender *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleFormDataChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Contact Number *</label>
            <input
              type="tel"
              name="contact"
              value={formData.contact}
              onChange={handleFormDataChange}
              pattern="[0-9]{10}"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Address *</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleFormDataChange}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleFormDataChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleFormDataChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Pincode</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleFormDataChange}
              />
            </div>
          </div>

          {category === 'IP' && (
            <>
              <h3>Admission Details</h3>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label>Admission Date & Time *</label>
                  <input
                    type="datetime-local"
                    name="admissionDate"
                    value={ipData.admissionDate}
                    onChange={handleIpDataChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Expected Days of Stay *</label>
                  <input
                    type="number"
                    name="expectedDays"
                    value={ipData.expectedDays}
                    onChange={handleIpDataChange}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.checkbox}>
                  <input
                    type="checkbox"
                    name="casualtyFlag"
                    checked={ipData.casualtyFlag}
                    onChange={handleIpDataChange}
                  />
                  <label>Casualty Case</label>
                </div>
                <div className={styles.checkbox}>
                  <input
                    type="checkbox"
                    name="emergencyFlag"
                    checked={ipData.emergencyFlag}
                    onChange={handleIpDataChange}
                  />
                  <label>Emergency Admission</label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Doctor *</label>
                <select
                  name="doctorId"
                  value={ipData.doctorId}
                  onChange={handleIpDataChange}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.firstName} {doc.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Room *</label>
                <select
                  name="roomId"
                  value={ipData.roomId}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  required
                >
                  <option value="">Select Room</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.roomNumber} - {room.roomType} ({room.availableBeds} beds available)
                    </option>
                  ))}
                </select>
              </div>

              {ipData.roomId && (
                <div className={styles.formGroup}>
                  <label>Bed *</label>
                  <select
                    name="bedId"
                    value={ipData.bedId}
                    onChange={handleIpDataChange}
                    required
                  >
                    <option value="">Select Bed</option>
                    {beds.map((bed) => (
                      <option key={bed._id} value={bed._id}>
                        {bed.bedNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {category === 'OP' && (
            <>
              <h3>Consultation Details</h3>

              <div className={styles.formGroup}>
                <label>Doctor *</label>
                <select
                  name="doctorId"
                  value={opData.doctorId}
                  onChange={(e) =>
                    setOpData((prev) => ({ ...prev, doctorId: e.target.value }))
                  }
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.firstName} {doc.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {category === 'SERVICES' && (
            <>
              <h3>Service Details</h3>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label>Service Type *</label>
                  <select
                    name="serviceType"
                    value={serviceData.serviceType}
                    onChange={(e) =>
                      setServiceData((prev) => ({
                        ...prev,
                        serviceType: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="LAB">Lab</option>
                    <option value="SCAN">Scan</option>
                    <option value="PROCEDURE">Procedure</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Service *</label>
                  <select
                    name="serviceId"
                    value={serviceData.serviceId}
                    onChange={(e) =>
                      setServiceData((prev) => ({
                        ...prev,
                        serviceId: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select Service</option>
                    {services
                      .filter((s) => s.category === serviceData.serviceType)
                      .map((service) => (
                        <option key={service._id} value={service._id}>
                          {service.serviceName} - ₹{service.totalFee}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Processing...' : `Register ${category}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}