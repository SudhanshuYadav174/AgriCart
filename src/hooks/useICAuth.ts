import { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { useToast } from '@/hooks/use-toast';

export interface ICAuthState {
  isAuthenticated: boolean;
  identity: Identity | null;
  principal: Principal | null;
  authClient: AuthClient | null;
  loading: boolean;
}

export const useICAuth = () => {
  const [authState, setAuthState] = useState<ICAuthState>({
    isAuthenticated: false,
    identity: null,
    principal: null,
    authClient: null,
    loading: true,
  });
  const { toast } = useToast();

  // Initialize auth client
  useEffect(() => {
    const initAuthClient = async () => {
      try {
        const authClient = await AuthClient.create({
          idleOptions: {
            disableIdle: true,
            disableDefaultIdleCallback: true,
          },
        });

        const isAuthenticated = await authClient.isAuthenticated();
        
        console.log('IC Auth Client initialized:', { isAuthenticated });

        if (isAuthenticated) {
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal();
          
          console.log('IC User authenticated:', { principal: principal.toText() });

          setAuthState({
            isAuthenticated: true,
            identity,
            principal,
            authClient,
            loading: false,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            identity: null,
            principal: null,
            authClient,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to initialize IC auth client:', error);
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    };

    initAuthClient();
  }, []);

  const login = async (): Promise<boolean> => {
    if (!authState.authClient) {
      toast({
        title: "Authentication Error",
        description: "Auth client not initialized",
        variant: "destructive",
      });
      return false;
    }

    try {
      // For development, try to use local replica if available, otherwise fallback to mainnet
      // For production, always use mainnet
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      
      const identityProvider = isProduction 
        ? 'https://identity.ic0.app'
        : 'https://identity.ic0.app'; // Always use mainnet for now to avoid local setup issues

      console.log('IC Login - Identity Provider:', identityProvider);
      console.log('IC Login - Is Production:', isProduction);

      await new Promise<void>((resolve, reject) => {
        authState.authClient!.login({
          identityProvider,
          maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days in nanoseconds
          onSuccess: () => {
            console.log('IC Login successful');
            resolve();
          },
          onError: (error) => {
            console.error('IC Login error:', error);
            reject(error);
          },
        });
      });

      const isAuthenticated = await authState.authClient.isAuthenticated();
      const identity = authState.authClient.getIdentity();
      const principal = identity.getPrincipal();

      console.log('IC Auth State:', { isAuthenticated, principal: principal.toText() });

      setAuthState(prev => ({
        ...prev,
        isAuthenticated,
        identity,
        principal,
      }));

      toast({
        title: "Welcome to AgriQCert!",
        description: "Successfully authenticated with Internet Identity",
      });

      return true;
    } catch (error) {
      console.error('IC login failed:', error);
      toast({
        title: "Login Failed",
        description: `Failed to authenticate with Internet Identity: ${error}`,
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    if (!authState.authClient) return;

    try {
      await authState.authClient.logout();
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        identity: null,
        principal: null,
      }));

      toast({
        title: "Logged Out",
        description: "Successfully logged out from Internet Identity",
      });

      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('IC logout failed:', error);
      toast({
        title: "Logout Failed",
        description: "Failed to logout from Internet Identity",
        variant: "destructive",
      });
    }
  };

  const getPrincipalText = (): string | null => {
    return authState.principal?.toText() || null;
  };

  return {
    ...authState,
    login,
    logout,
    getPrincipalText,
  };
};