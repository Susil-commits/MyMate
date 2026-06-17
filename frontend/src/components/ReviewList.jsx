const ReviewList = ({ reviews }) => {
  if (!reviews || reviews.length === 0) {
    return <p className="text-gray-500 text-center py-4">No reviews yet.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review._id} className="border-b border-gray-100 pb-4 last:border-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-900">
              {review.user?.name || "Anonymous"}
            </span>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < review.rating ? "text-yellow-500" : "text-gray-300"}>
                  &#9733;
                </span>
              ))}
            </div>
          </div>
          {review.comment && <p className="text-gray-600 text-sm">{review.comment}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ReviewList;