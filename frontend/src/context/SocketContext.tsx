import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

export interface SocketProviderProps {
  children: React.ReactNode;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000";
      const socketUrl = apiUrl.replace(/\/api\/?$/, ""); // Remove /api from the end for socket origin
      const socketInstance: Socket = io(socketUrl, {
        withCredentials: true,
      });

      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);
      const onConnectError = () => setIsConnected(false);

      socketInstance.on("connect", onConnect);
      socketInstance.on("disconnect", onDisconnect);
      socketInstance.on("connect_error", onConnectError);

      if (socketInstance.connected) {
        setIsConnected(true);
      }

      setSocket(socketInstance);

      return () => {
        socketInstance.off("connect", onConnect);
        socketInstance.off("disconnect", onDisconnect);
        socketInstance.off("connect_error", onConnectError);
        socketInstance.disconnect();
        setIsConnected(false);
        setSocket(null);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  return useContext(SocketContext);
};
