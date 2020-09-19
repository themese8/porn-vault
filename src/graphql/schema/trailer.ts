import { gql } from "apollo-server-express";

export default gql`
  type Trailer {
    _id: String!
    name: String!
    path: String

    # Resolvers
    scene: Scene
  }
`;
