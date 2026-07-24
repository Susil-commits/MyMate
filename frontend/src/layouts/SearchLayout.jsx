import { useAuth } from "../context/AuthContext";
import UserLayout from "./UserLayout";
import GuestLayout from "./GuestLayout";

export default function SearchLayout() {
  const { user } = useAuth();
  
  if (user) {
    return <UserLayout />;
  }
  
  return <GuestLayout />;
}
