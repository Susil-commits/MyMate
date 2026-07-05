import { useAuth } from "../context/AuthContext";
import UserLayout from "./UserLayout";
import DriverLayout from "./DriverLayout";

export default function RoleLayout() {
  const { role } = useAuth();
  return role === "driver" ? <DriverLayout /> : <UserLayout />;
}
