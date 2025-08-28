// The essential imports
import * as AppleColors from "@bacons/apple-colors";
import React from "react";
import { Text as RNText, StyleProp, TextProps, TextStyle, View, ViewProps } from "react-native";

// The FormFont constant
export const FormFont = {
  default: {
    color: AppleColors.label,
    fontSize: 17,
  },
  secondary: {
    color: AppleColors.secondaryLabel,
    fontSize: 17,
  },
  caption: {
    color: AppleColors.secondaryLabel,
    fontSize: 12,
  },
};

// Helper function for merging styles
function mergedStyleProp<TStyle extends TextStyle>(
  ...styleProps: (StyleProp<TStyle> | null | undefined)[]
): StyleProp<TStyle> {
  const validStyles = styleProps.filter((style): style is StyleProp<TStyle> => 
    style !== null && style !== undefined
  );
  
  if (validStyles.length === 0) return undefined;
  if (validStyles.length === 1) return validStyles[0];
  
  return validStyles;
}

// The minimal Text component
type FormTextProps = TextProps & {
  bold?: boolean;
};

export function Text({ bold, ...props }: FormTextProps) {
  const font: TextStyle = {
    ...FormFont.default,
    flexShrink: 0,
    fontWeight: bold ? "600" : "normal",
  };

  return (
    <RNText
      dynamicTypeRamp="body"
      {...props}
      style={mergedStyleProp(font, props.style)}
    />
  );
}

// Section component for grouping form elements
type FormSectionProps = ViewProps & {
  title?: string;
  footer?: string;
  children?: React.ReactNode;
};

export function Section({ title, footer, children, style, ...props }: FormSectionProps) {
  return (
    <View style={[{ marginVertical: 16 }, style]} {...props}>
      {title && (
        <Text style={[FormFont.caption, { marginBottom: 8, textTransform: "uppercase" }]}>
          {title}
        </Text>
      )}
      <View style={{ backgroundColor: AppleColors.systemBackground, borderRadius: 8, padding: 16 }}>
        {children}
      </View>
      {footer && (
        <Text style={[FormFont.caption, { marginTop: 8 }]}>
          {footer}
        </Text>
      )}
    </View>
  );
}

// HStack component for horizontal layout
type FormHStackProps = ViewProps & {
  children?: React.ReactNode;
};

export function HStack({ children, style, ...props }: FormHStackProps) {
  return (
    <View 
      style={[{ flexDirection: "row", alignItems: "center" }, style]} 
      {...props}
    >
      {children}
    </View>
  );
}