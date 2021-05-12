import gql from 'graphql-tag';
import { addInterfacesForEachContentItemType } from '@apollosproject/data-schema/lib/utils';

export default gql`
  type Route {
    pathname: String
    deepLink: Url
  }

  interface NodeRoute {
    routing: Route
  }

  extend type DevotionalContentItem implements NodeRoute {
    routing: Route
  }

  extend type UniversalContentItem implements NodeRoute {
    routing: Route
  }

  extend type ContentSeriesContentItem implements NodeRoute {
    routing: Route
  }

  extend type MediaContentItem implements NodeRoute {
    routing: Route
  }

  extend type WeekendContentItem implements NodeRoute {
    routing: Route
  }

  extend type EventContentItem implements NodeRoute {
    routing: Route
  }

  extend type InformationalContentItem implements NodeRoute {
    routing: Route
  }

  extend type GroupPreference implements NodeRoute {
    routing: Route
  }
`;
