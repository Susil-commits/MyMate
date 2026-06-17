import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-blue-600">MyMate</span>
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {user.role === "user" && (
                  <>
                    <Link to="/drivers" className="text-gray-700 hover:text-blue-600 font-medium">
                      Find Drivers
                    </Link>
                    <Link to="/bookings" className="text-gray-700 hover:text-blue-600 font-medium">
                      My Bookings
                    </Link>
                  </>
                )}
                {user.role === "driver" && (
                  <>
                    <Link to="/driver/dashboard" className="text-gray-700 hover:text-blue-600 font-medium">
                      Dashboard
                    </Link>
                    <Link to="/driver/bookings" className="text-gray-700 hover:text-blue-600 font-medium">
                      Requests
                    </Link>
                  </>
                )}
                <Link to="/profile" className="text-gray-700 hover:text-blue-600 font-medium">
                  {user.name || "Profile"}
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/user/login" className="text-gray-700 hover:text-blue-600 font-medium">
                  Sign In
                </Link>
                <Link
                  to="/user/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;