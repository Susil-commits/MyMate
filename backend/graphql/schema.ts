import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import { GraphQLError } from "graphql";
import { ApolloServer } from "@apollo/server";
// @ts-ignore
import { expressMiddleware } from "@as-integrations/express4";
import { Express } from "express";
import { AuthUser, verifyAndResolveUser } from "../middleware/auth.js";

export interface GraphQLContext {
  user: AuthUser | null;
  userRole: "user" | "driver" | "admin" | null;
}

export const typeDefs = `#graphql
  type Location {
    type: String
    coordinates: [Float]
  }

  type Driver {
    id: ID!
    name: String!
    email: String
    vehicleTypes: [String]
    experienceYears: Int
    averageRating: Float
    isActive: Boolean
    kycStatus: String
    location: Location
  }

  type Booking {
    id: ID!
    userId: ID!
    driverId: ID!
    status: String!
    hireType: String!
    vehicleType: String!
    totalAmount: Float
  }

  type Query {
    drivers(isActive: Boolean, kycStatus: String, limit: Int): [Driver]
    driver(id: ID!): Driver
    bookings(status: String, limit: Int): [Booking]
    booking(id: ID!): Booking
  }
`;

export const resolvers = {
  Query: {
    drivers: async (_: any, args: any, context: GraphQLContext) => {
      const filter: any = {};

      if (context.userRole === "admin") {
        if (args.isActive !== undefined) filter.isActive = args.isActive;
        if (args.kycStatus) filter.kycStatus = args.kycStatus;
      } else {
        // Public and non-admin users only see active and KYC-approved drivers
        filter.isActive = true;
        filter.kycStatus = "approved";
      }

      const query = Driver.find(filter).read("secondaryPreferred");
      const safeLimit = Math.min(Math.max(args.limit || 20, 1), 50);
      query.limit(safeLimit);
      return await query.exec();
    },

    driver: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const driver = await Driver.findById(id).read("secondaryPreferred");
      if (!driver) return null;

      // Non-admins cannot inspect unapproved or deactivated driver profiles
      if (context.userRole !== "admin") {
        if (!driver.isActive || driver.kycStatus !== "approved") {
          return null;
        }
      }
      return driver;
    },

    bookings: async (_: any, args: any, context: GraphQLContext) => {
      if (!context.user || !context.userRole) {
        throw new GraphQLError("Authentication required to access bookings", {
          extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
        });
      }

      const filter: any = {};
      if (args.status) filter.status = args.status;

      if (context.userRole === "admin") {
        // Admin can view all bookings or filter by status
      } else if (context.userRole === "driver") {
        filter.driver = context.user._id;
      } else {
        // Regular user only sees their own bookings
        filter.user = context.user._id;
      }

      const query = Booking.find(filter).read("secondaryPreferred");
      const safeLimit = Math.min(Math.max(args.limit || 20, 1), 50);
      query.limit(safeLimit);
      return await query.exec();
    },

    booking: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      if (!context.user || !context.userRole) {
        throw new GraphQLError("Authentication required to access booking details", {
          extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
        });
      }

      const booking = await Booking.findById(id).read("secondaryPreferred");
      if (!booking) return null;

      const isAuthorized =
        context.userRole === "admin" ||
        (context.userRole === "driver" && String(booking.driver) === String(context.user._id)) ||
        (context.userRole === "user" && String(booking.user) === String(context.user._id));

      if (!isAuthorized) {
        throw new GraphQLError("Forbidden: Not authorized to view this booking", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      return booking;
    },
  },

  Driver: {
    id: (parent: any) => parent._id?.toString() || "",
    email: (parent: any, _: any, context: GraphQLContext) => {
      // Protect email privacy: only visible to admins or the driver themselves
      if (
        context.userRole === "admin" ||
        (context.userRole === "driver" && String(context.user?._id) === String(parent._id))
      ) {
        return parent.email || null;
      }
      return null;
    },
  },

  Booking: {
    id: (parent: any) => parent._id?.toString() || "",
    userId: (parent: any) => parent.user?._id?.toString() || parent.user?.toString() || "",
    driverId: (parent: any) => parent.driver?._id?.toString() || parent.driver?.toString() || "",
  },
};

export const setupGraphQL = async (app: Express) => {
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await server.start();
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        let token = req.cookies?.token;
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
          token = req.headers.authorization.split(" ")[1];
        }
        const { user, userRole } = await verifyAndResolveUser(token);
        return { user, userRole };
      },
    })
  );
};
