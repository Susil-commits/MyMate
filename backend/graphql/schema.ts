import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";

export const typeDefs = `#graphql
  type Location {
    type: String
    coordinates: [Float]
  }

  type Driver {
    id: ID!
    name: String!
    email: String!
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
    drivers: async (_: any, args: any) => {
      const filter: any = {};
      if (args.isActive !== undefined) filter.isActive = args.isActive;
      if (args.kycStatus) filter.kycStatus = args.kycStatus;
      
      const query = Driver.find(filter).read('secondaryPreferred');
      if (args.limit) query.limit(args.limit);
      return await query.exec();
    },
    driver: async (_: any, { id }: any) => {
      return await Driver.findById(id).read('secondaryPreferred');
    },
    bookings: async (_: any, args: any) => {
      const filter: any = {};
      if (args.status) filter.status = args.status;
      
      const query = Booking.find(filter).read('secondaryPreferred');
      if (args.limit) query.limit(args.limit);
      return await query.exec();
    },
    booking: async (_: any, { id }: any) => {
      return await Booking.findById(id).read('secondaryPreferred');
    }
  },
  Driver: {
    id: (parent: any) => parent._id.toString()
  },
  Booking: {
    id: (parent: any) => parent._id.toString(),
    userId: (parent: any) => parent.user?.toString(),
    driverId: (parent: any) => parent.driver?.toString()
  }
};

import { ApolloServer } from '@apollo/server';
// @ts-ignore
import { expressMiddleware } from '@as-integrations/express4';
import { Express } from 'express';

export const setupGraphQL = async (app: Express) => {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  app.use('/graphql', expressMiddleware(server));
};
