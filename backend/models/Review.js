import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

reviewSchema.index({ driver: 1 });
reviewSchema.index({ user: 1, booking: 1 }, { unique: true });

reviewSchema.statics.updateDriverRating = async function (driverId) {
  const result = await this.aggregate([
    { $match: { driver: driverId } },
    {
      $group: {
        _id: "$driver",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await mongoose.model("Driver").findByIdAndUpdate(driverId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews,
    });
  } else {
    await mongoose.model("Driver").findByIdAndUpdate(driverId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

reviewSchema.post("save", async function () {
  await this.constructor.updateDriverRating(this.driver);
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.updateDriverRating(doc.driver);
  }
});

export default mongoose.model("Review", reviewSchema);