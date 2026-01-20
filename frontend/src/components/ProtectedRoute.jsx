import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function ProtectedRoute({ children, session }) {
    const [loading, setLoading] = useState(true);
    const [profileComplete, setProfileComplete] = useState(false);
    const location = useLocation();

    // Reset state when session or path changes
    useEffect(() => {
        let mounted = true;

        async function checkProfile() {
            try {
                // If path changed, we should show loading while we re-verify
                setLoading(true);

                if (session?.user) {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (error) {
                        console.error("Profile check error in ProtectedRoute:", error);
                    }

                    if (mounted) {
                        if (profile && profile.name && profile.crp) {
                            setProfileComplete(true);
                        } else {
                            setProfileComplete(false);
                        }
                    }
                }
            } catch (error) {
                console.error("Profile check failed:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        if (session) {
            checkProfile();
        } else {
            setLoading(false);
        }

        return () => { mounted = false; };
    }, [session, location.pathname]);

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
