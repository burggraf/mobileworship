import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ConnectionManager,
  type ConnectionStatus,
  type DisplayConnection,
  type ClientCommand,
  type HostState,
} from '@mobileworship/protocol';
import { mdnsDiscovery } from '../services/MDNSDiscovery';
import { Config } from '../config';

interface UseDisplayConnectionOptions {
  eventId: string;
  authToken: string;
}

interface UseDisplayConnectionResult {
  connectionStatus: ConnectionStatus;
  hostStates: Map<string, HostState>;
  sendCommand: (command: Omit<ClientCommand, 'commandId'>) => void;
  reconnect: () => Promise<void>;
}

const supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY);

/**
 * Hook for managing connections to displays for an event
 * Handles both local WebSocket and Supabase Realtime connections
 * with preference for local when available
 */
export function useDisplayConnection({
  eventId,
  authToken,
}: UseDisplayConnectionOptions): UseDisplayConnectionResult {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    type: null,
    displays: new Map(),
  });
  const [hostStates, setHostStates] = useState<Map<string, HostState>>(new Map());

  const connectionManager = useRef<ConnectionManager | null>(null);

  const handleStateUpdate = useCallback((displayId: string, state: HostState) => {
    setHostStates((prev) => {
      const next = new Map(prev);
      next.set(displayId, state);
      return next;
    });
  }, []);

  const handleConnectionChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
  }, []);

  const connect = useCallback(async () => {
    // 1. Get displays for this event using the RPC function
    const { data: displays, error } = await supabase.rpc('get_event_displays', {
      p_event_id: eventId,
    });

    if (error || !displays?.length) {
      console.error('No displays for event:', error);
      return;
    }

    // 2. Get display details (local_ip, local_port)
    const { data: displayDetails } = await supabase
      .from('displays')
      .select('id, local_ip, local_port')
      .in('id', displays);

    const displayConnections: DisplayConnection[] = (displayDetails || []).map(
      (d) => ({
        displayId: d.id,
        localIp: d.local_ip,
        localPort: d.local_port || 8765,
      })
    );

    // 3. Try mDNS discovery for displays without local_ip
    for (const conn of displayConnections) {
      if (!conn.localIp) {
        try {
          const discovered = await mdnsDiscovery.findDisplay(conn.displayId, 3000);
          conn.localIp = discovered.host;
          conn.localPort = discovered.port;
        } catch (e) {
          // mDNS failed, will use Realtime only
          console.log(`mDNS discovery failed for ${conn.displayId}, using Realtime only`);
        }
      }
    }

    // 4. Create connection manager and connect
    connectionManager.current = new ConnectionManager({
      supabase,
      onStateUpdate: handleStateUpdate,
      onConnectionChange: handleConnectionChange,
    });

    await connectionManager.current.connect(displayConnections, authToken);
  }, [eventId, authToken, handleStateUpdate, handleConnectionChange]);

  const disconnect = useCallback(async () => {
    await connectionManager.current?.disconnect();
    connectionManager.current = null;
    setHostStates(new Map());
  }, []);

  const sendCommand = useCallback(
    (command: Omit<ClientCommand, 'commandId'>) => {
      connectionManager.current?.sendCommand(command);
    },
    []
  );

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (eventId && authToken) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [eventId, authToken]);

  return {
    connectionStatus,
    hostStates,
    sendCommand,
    reconnect,
  };
}
