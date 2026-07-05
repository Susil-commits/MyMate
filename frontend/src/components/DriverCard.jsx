import { Link } from "react-router-dom";

const DriverCard = ({ driver }) => {
  return (
 <Link to={`/drivers/${driver._id}`} className="bg-white rounded-xl shadow-sm p-6 hover:text-gray-700 transition block">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{driver.name}</h3>
          <p className="text-sm text-gray-500">{driver.locality}</p>
        </div>
        <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-lg">
          <span className="text-yellow-500 mr-1">&#9733;</span>
          <span className="text-sm font-semibold">{driver.averageRating || "New"}</span>
          <span className="text-xs text-gray-400 ml-1">({driver.totalReviews})</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {driver.vehicleTypes.map((vt) => (
          <span key={vt} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            {vt}
          </span>
        ))}
        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
          {driver.experienceYears}y exp
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{driver.bio}</p>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600">
          &#8377;{driver.hourlyRate}/hr | &#8377;{driver.dailyRate}/day
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          driver.availability === "available" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        }`}>
          {driver.availability}
        </span>
      </div>
    </Link>
  );
};

export default DriverCard;
