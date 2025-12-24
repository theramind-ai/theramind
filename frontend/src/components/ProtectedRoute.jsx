import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function ProtectedRoute({ children }) {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [profileComplete, setProfileComplete] = useState(false);
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        async function checkAuth() {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (mounted) {
                    setSession(currentSession);

                    if (currentSession) {
                        // Check if profile is complete
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('name, crp')
                            .eq('id', currentSession.user.id)
                            .single();

                        if (profile && profile.name && profile.crp) {
                            setProfileComplete(true);
                        }
                    }
                }
            } catch (error) {
                console.error("Auth check failed:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        checkAuth();

        return () => {
            mounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // If on onboarding page:
    if (location.pathname === '/onboarding') {
        // If profile IS complete, go to dashboard
        if (profileComplete) {
            return <Navigate to="/dashboard" replace />;
        }
        // If profile NOT complete, stay here
        return children;
    }

    // If on any other protected page:
    // If profile is NOT complete, force onboarding
    if (!profileComplete) {
        return <Navigate to="/onboarding" replace />;
    }

    return children;
}
