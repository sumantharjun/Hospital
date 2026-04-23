'use client';

import { useState, useEffect } from 'react';
import styles from './NursePanel.module.css';

export default function NursePanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [nurseInfo, setNurseInfo] = useState(null);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [timesheetForm, setTimesheetForm] = useState({
    patientCategory: 'IP',
    patientRef: '',
    shiftType: 'DAY',
    department: '',
    timeIn: new Date().toISOString(),
    servicesProvided: [],
    vitals: {
      bloodPressure: '',
      pulse: '',
      temperature: '',
      spO2: '',
    },
    observations: '',
  });
  const [vitalsData, setVitalsData] = useState({
    bloodPressure: '',
    pulse: '',
    temperature: '',
    spO2: '',
    respiratoryRate: '',
  });
  const [loading, setLoading] = useState(false);
  const [currentTimesheet, setCurrentTimesheet] = useState(null);

  useEffect(() => {
    fetchNurseInfo();
    fetchAssignedPatients();
  }, []);

  const fetchNurseInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const nurseId = localStorage.getItem('nurseId');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/nursing/dashboard/${nurseId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();
      setNurseInfo(result.data);
    } catch (error) {
      console.error('Failed to fetch nurse info:', error);
    }
  };

  const fetchAssignedPatients = async () => {
    try {
      const token = localStorage.getItem('token');
      const hospitalId = localStorage.getItem('hospitalId');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/patients/admissions/active/${hospitalId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();
      setAssignedPatients(result.data || []);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    }
  };

  const startTimesheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const nurseId = localStorage.getItem('nurseId');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/nursing/timesheet/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nurseId,
            patientCategory: timesheetForm.patientCategory,
            patientRef: timesheetForm.patientRef,
            shiftType: timesheetForm.shiftType,
            department: timesheetForm.department,
            timeIn: new Date().toISOString(),
          }),
        }
      );

      const result = await response.json();
      setCurrentTimesheet(result.data);
      alert('Timesheet started');
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const recordVitals = () => {
    setCurrentTimesheet((prev) => ({
      ...prev,
      vitals: vitalsData,
    }));
    alert('Vitals recorded');
  };

  const submitTimesheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/nursing/timesheet/${currentTimesheet.timesheetId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            timeOut: new Date().toISOString(),
            vitals: currentTimesheet.vitals,
            observations: timesheetForm.observations,
            servicesProvided: timesheetForm.servicesProvided,
            emergencyFlag: false,
          }),
        }
      );

      const result = await response.json();
      alert('Timesheet submitted successfully');
      setCurrentTimesheet(null);
      setTimesheetForm({
        patientCategory: 'IP',
        patientRef: '',
        shiftType: 'DAY',
        department: '',
        timeIn: new Date().toISOString(),
        servicesProvided: [],
        vitals: {
          bloodPressure: '',
          pulse: '',
          temperature: '',
          spO2: '',
        },
        observations: '',
      });
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Nurse Panel</h1>
        {nurseInfo && (
          <div className={styles.nurseInfo}>
            <p>Welcome, {nurseInfo.nurseInfo?.firstName} {nurseInfo.nurseInfo?.lastName}</p>
            <p className={styles.department}>{nurseInfo.nurseInfo?.department}</p>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dashboard' ? styles.active : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'timesheet' ? styles.active : ''}`}
          onClick={() => setActiveTab('timesheet')}
        >
          Timesheet
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'patients' ? styles.active : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          Assigned Patients
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className={styles.content}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Active Assignments</h3>
              <p className={styles.statValue}>{nurseInfo?.activeAssignments?.length || 0}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Pending Handovers</h3>
              <p className={styles.statValue}>{nurseInfo?.pendingHandovers || 0}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Current Shift</h3>
              <p className={styles.statValue}>DAY</p>
            </div>
          </div>

          {currentTimesheet && (
            <div className={styles.activeTimesheet}>
              <h3>Active Timesheet</h3>
              <p>Patient: {currentTimesheet.patientRef?.patientId?.firstName}</p>
              <p>Started: {new Date(currentTimesheet.timeIn).toLocaleTimeString()}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timesheet' && (
        <div className={styles.content}>
          {!currentTimesheet ? (
            <div className={styles.form}>
              <h2>Start New Timesheet</h2>

              <div className={styles.formGroup}>
                <label>Patient Category</label>
                <select
                  value={timesheetForm.patientCategory}
                  onChange={(e) =>
                    setTimesheetForm((prev) => ({
                      ...prev,
                      patientCategory: e.target.value,
                    }))
                  }
                >
                  <option value="IP">In-Patient</option>
                  <option value="OP">Out-Patient</option>
                  <option value="SERVICE">Service</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Patient</label>
                <select
                  value={timesheetForm.patientRef}
                  onChange={(e) =>
                    setTimesheetForm((prev) => ({
                      ...prev,
                      patientRef: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select Patient</option>
                  {assignedPatients.map((patient) => (
                    <option key={patient._id} value={patient._id}>
                      {patient.patientId?.firstName} {patient.patientId?.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label>Shift Type</label>
                  <select
                    value={timesheetForm.shiftType}
                    onChange={(e) =>
                      setTimesheetForm((prev) => ({
                        ...prev,
                        shiftType: e.target.value,
                      }))
                    }
                  >
                    <option value="DAY">Day</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Department</label>
                  <input
                    type="text"
                    value={timesheetForm.department}
                    onChange={(e) =>
                      setTimesheetForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    placeholder="e.g., General Ward"
                  />
                </div>
              </div>

              <button
                className={styles.submitBtn}
                onClick={startTimesheet}
                disabled={loading}
              >
                {loading ? 'Starting...' : 'Start Timesheet'}
              </button>
            </div>
          ) : (
            <div className={styles.form}>
              <h2>Active Timesheet</h2>

              <div className={styles.section}>
                <h3>Record Vitals</h3>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label>Blood Pressure</label>
                    <input
                      type="text"
                      value={vitalsData.bloodPressure}
                      onChange={(e) =>
                        setVitalsData((prev) => ({
                          ...prev,
                          bloodPressure: e.target.value,
                        }))
                      }
                      placeholder="e.g., 120/80"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Pulse (bpm)</label>
                    <input
                      type="number"
                      value={vitalsData.pulse}
                      onChange={(e) =>
                        setVitalsData((prev) => ({
                          ...prev,
                          pulse: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Temperature (°C)</label>
                    <input
                      type="number"
                      value={vitalsData.temperature}
                      onChange={(e) =>
                        setVitalsData((prev) => ({
                          ...prev,
                          temperature: e.target.value,
                        }))
                      }
                      step="0.1"
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label>SpO₂ (%)</label>
                    <input
                      type="number"
                      value={vitalsData.spO2}
                      onChange={(e) =>
                        setVitalsData((prev) => ({
                          ...prev,
                          spO2: e.target.value,
                        }))
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Respiratory Rate</label>
                    <input
                      type="number"
                      value={vitalsData.respiratoryRate}
                      onChange={(e) =>
                        setVitalsData((prev) => ({
                          ...prev,
                          respiratoryRate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <button
                  className={styles.secondaryBtn}
                  onClick={recordVitals}
                >
                  Record Vitals
                </button>
              </div>

              <div className={styles.section}>
                <h3>Observations & Notes</h3>
                <textarea
                  value={timesheetForm.observations}
                  onChange={(e) =>
                    setTimesheetForm((prev) => ({
                      ...prev,
                      observations: e.target.value,
                    }))
                  }
                  placeholder="Record patient observations and any special events"
                  rows="4"
                />
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setCurrentTimesheet(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={submitTimesheet}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Timesheet'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'patients' && (
        <div className={styles.content}>
          <h2>Assigned Patients</h2>
          <div className={styles.patientsList}>
            {assignedPatients.length > 0 ? (
              assignedPatients.map((patient) => (
                <div key={patient._id} className={styles.patientCard}>
                  <h3>
                    {patient.patientId?.firstName} {patient.patientId?.lastName}
                  </h3>
                  <p>
                    <strong>Age:</strong> {patient.patientId?.age} years
                  </p>
                  <p>
                    <strong>Status:</strong> {patient.status}
                  </p>
                  {patient.roomId && (
                    <p>
                      <strong>Room:</strong> {patient.roomId?.roomNumber}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className={styles.noData}>No assigned patients</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}