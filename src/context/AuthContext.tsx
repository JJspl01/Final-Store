import { Toaster } from '@/components/ui/sonner';
import { fetchSheet, toCamelCase } from '@/lib/fetchers';
import { supabase } from '@/lib/supabaseClient';
import type { UserPermissions } from '@/types/sheets';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthState {
    loggedIn: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
    user: UserPermissions;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [loggedIn, setLoggedIn] = useState(false);
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const stored = localStorage.getItem('auth');
        if (stored) {
            const { username } = JSON.parse(stored);

            // Direct Supabase call for session verification
            supabase
                .from('user_access_master')
                .select('*')
                .eq('username', username)
                .single()
                .then(({ data, error }) => {
                    if (data && !error) {
                        const user = toCamelCase({ ...data, row_index: data.id }) as UserPermissions;
                        setUserPermissions(user);
                        setLoggedIn(true);
                    }
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    async function login(username: string, password: string) {
        // Direct Supabase call for login
        const { data, error } = await supabase
            .from('user_access_master')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            return false;
        }

        const user = toCamelCase({ ...data, row_index: data.id }) as UserPermissions;
        localStorage.setItem('auth', JSON.stringify({ username }));
        setUserPermissions(user);
        setLoggedIn(true);
        return true;
    }

    function logout() {
        localStorage.removeItem('auth');
        setLoggedIn(false);
        setUserPermissions(null);
    }

    return (
        <AuthContext.Provider value={{ login, loggedIn, logout, user: userPermissions!, loading }}>
            {children}
            <Toaster expand richColors theme="light" closeButton />
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext)!;
