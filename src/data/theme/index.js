import { gql } from 'apollo-server';
import randomColor from 'randomcolor';

import colorScalarType from './colorScalarType';

export const schema = gql`
  type Theme {
    type: ThemeType
    colors: ThemeColors
  }

  enum ThemeType {
    LIGHT
    DARK
  }

  scalar Color

  type ThemeColors {
    primary: Color
    secondary: Color
    tertiary: Color
    screen: Color
    paper: Color
    alert: Color
    text: TextColors
  }

  type TextColors {
    primary: Color
    secondary: Color
    tertiary: Color
    link: Color
  }
`;

export const resolver = {
  Color: colorScalarType,
};

export class model {} // todo
