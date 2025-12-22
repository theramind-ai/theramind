import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import PatientsPage from './pages/PatientsPage.jsx'
import EditPatientPage from './pages/EditPatientPage.jsx' // Import
import SessionsPage from './pages/SessionsPage.jsx'
import SessionPage from './pages/SessionPage.jsx' // Import
import PatientPage from './pages/PatientPage.jsx'
import { supabase } from './lib/supabaseClient.js'
import { Layout } from './components/Layout.jsx'

import NewPatientPage from './pages/NewPatientPage.jsx'
import AppointmentsPage from './pages/AppointmentsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Routes>
        <Route
          path="/login"
          element={!session ? <LoginPage /> : <Navigate to="/dashboard" />}
        />

        {/* Dashboard (Metrics) */}
        <Route
          path="/dashboard"
          element={
            session ? (
              <Layout>
                <DashboardPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Patients List */}
        <Route
          path="/patients"
          element={
            session ? (
              <Layout>
                <PatientsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/sessions"
          element={
            session ? (
              <Layout>
                <SessionsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Financials & Settings */}
        <Route
          path="/appointments"
          element={
            session ? (
              <Layout>
                <AppointmentsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            session ? (
              <Layout>
                <SettingsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/patient/new"
          element={
            session ? (
              <Layout>
                <NewPatientPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/patient/:id/edit"
          element={
            session ? (
              <Layout>
                <EditPatientPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/patient/:id"
          element={
            session ? (
              <Layout>
                <PatientPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/session/:id"
          element={
            session ? (
              <Layout>
                <SessionPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/"
          element={<Navigate to="/dashboard" />}
        />
      </Routes>
    </div>
  )
}

export default App