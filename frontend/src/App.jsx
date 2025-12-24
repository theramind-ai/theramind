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
import VerifyEmailPage from './pages/VerifyEmailPage.jsx' // Import
import OnboardingPage from './pages/OnboardingPage.jsx' // Import
import { ProtectedRoute } from './components/ProtectedRoute.jsx' // Import

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
        <Route
          path="/verify-email"
          element={!session ? <VerifyEmailPage /> : <Navigate to="/dashboard" />}
        />

        {/* Dashboard (Metrics) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Dashboard (Metrics) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Patients List */}
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <Layout>
                <PatientsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <Layout>
                <SessionsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Financials & Settings */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute>
              <Layout>
                <AppointmentsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/new"
          element={
            <ProtectedRoute>
              <Layout>
                <NewPatientPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <EditPatientPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PatientPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <SessionPage />
              </Layout>
            </ProtectedRoute>
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