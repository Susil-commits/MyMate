import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext({ socket: null, isConnected: false });

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const socketUrl = apiUrl.replace(/\/api\/?$/, ""); // Remove /api from the end for socket origin
      const socketInstance = io(socketUrl, {
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

      // eslint-disable-next-line react-hooks/set-state-in-effect
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

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  return useContext(SocketContext);
};
