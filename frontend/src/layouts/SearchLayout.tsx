import React from "react";
import { useAuth } from "../context/AuthContext";
import UserLayout from "./UserLayout";
import GuestLayout from "./GuestLayout";

export default function SearchLayout(): React.ReactElement {
  const { user } = useAuth();
  
  if (user) {
    return <UserLayout />;
  }
  
  return <GuestLayout />;
}
