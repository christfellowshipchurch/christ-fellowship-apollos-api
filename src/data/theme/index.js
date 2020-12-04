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

    alert: Color
    warning: Color
    success: Color
    wordOfChrist: Color

    screen: Color
    paper: Color

    black: Color
    white: Color

    darkPrimary: Color
    darkSecondary: Color
    darkTertiary: Color

    lightPrimary: Color
    lightSecondary: Color
    lightTertiary: Color
  }
`;

export const resolver = {
  Color: colorScalarType,
};

export class model {} // todo
