import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FeatureShipClient, FlagsMap } from './FeatureShipClient';

interface FeatureShipContextValue {
  client: FeatureShipClient | null;
  flags: FlagsMap;
  isReady: boolean;
}

const FeatureShipContext = createContext<FeatureShipContextValue>({
  client: null,
  flags: {},
  isReady: false
});

export interface FeatureShipProviderProps {
  clientKey: string;
  baseUrl?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureShipProvider: React.FC<FeatureShipProviderProps> = ({ 
  clientKey, 
  baseUrl, 
  children,
  fallback = null 
}) => {
  const [client, setClient] = useState<FeatureShipClient | null>(null);
  const [flags, setFlags] = useState<FlagsMap>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const newClient = new FeatureShipClient(clientKey, { baseUrl });
    
    newClient.on('ready', (initialFlags) => {
      setFlags({ ...initialFlags });
      setIsReady(true);
    });

    newClient.on('change', (updatedFlags) => {
      setFlags({ ...updatedFlags });
    });

    newClient.init();
    setClient(newClient);

    return () => {
      newClient.close();
    };
  }, [clientKey, baseUrl]);

  if (!isReady && fallback) {
    return <>{fallback}</>;
  }

  return (
    <FeatureShipContext.Provider value={{ client, flags, isReady }}>
      {children}
    </FeatureShipContext.Provider>
  );
};

export function useFeatureShip() {
  return useContext(FeatureShipContext);
}

export function useFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  const { flags, isReady } = useFeatureShip();
  
  if (!isReady) return defaultValue;
  
  const flag = flags[key];
  if (!flag) return defaultValue;
  
  return flag.isActive;
}
