// Web shim for react-native-svg
// Provides no-op exports for all react-native-svg components

import React from 'react';

// Create a no-op component factory
const createNoOp = (name) => {
  const NoOp = React.forwardRef((props, ref) => {
    const { children } = props;
    // For container elements, render children in a span
    if (name === 'Svg' || name === 'G' || name === 'Defs' || name === 'ClipPath' || name === 'Mask') {
      return React.createElement('span', { ref, style: { display: 'contents' } }, children);
    }
    return null;
  });
  NoOp.displayName = name;
  return NoOp;
};

// Main SVG components
export const Svg = createNoOp('Svg');
export const Circle = createNoOp('Circle');
export const Ellipse = createNoOp('Ellipse');
export const G = createNoOp('G');
export const Text = createNoOp('Text');
export const TSpan = createNoOp('TSpan');
export const TextPath = createNoOp('TextPath');
export const Path = createNoOp('Path');
export const Polygon = createNoOp('Polygon');
export const Polyline = createNoOp('Polyline');
export const Line = createNoOp('Line');
export const Rect = createNoOp('Rect');
export const Use = createNoOp('Use');
export const Image = createNoOp('Image');
export const Symbol = createNoOp('Symbol');
export const Defs = createNoOp('Defs');
export const LinearGradient = createNoOp('LinearGradient');
export const RadialGradient = createNoOp('RadialGradient');
export const Stop = createNoOp('Stop');
export const ClipPath = createNoOp('ClipPath');
export const Pattern = createNoOp('Pattern');
export const Mask = createNoOp('Mask');
export const Marker = createNoOp('Marker');
export const ForeignObject = createNoOp('ForeignObject');

// Filters
export const FeBlend = createNoOp('FeBlend');
export const FeColorMatrix = createNoOp('FeColorMatrix');
export const FeComponentTransfer = createNoOp('FeComponentTransfer');
export const FeComposite = createNoOp('FeComposite');
export const FeConvolveMatrix = createNoOp('FeConvolveMatrix');
export const FeDiffuseLighting = createNoOp('FeDiffuseLighting');
export const FeDisplacementMap = createNoOp('FeDisplacementMap');
export const FeDistantLight = createNoOp('FeDistantLight');
export const FeDropShadow = createNoOp('FeDropShadow');
export const FeFlood = createNoOp('FeFlood');
export const FeFuncA = createNoOp('FeFuncA');
export const FeFuncB = createNoOp('FeFuncB');
export const FeFuncG = createNoOp('FeFuncG');
export const FeFuncR = createNoOp('FeFuncR');
export const FeGaussianBlur = createNoOp('FeGaussianBlur');
export const FeImage = createNoOp('FeImage');
export const FeMerge = createNoOp('FeMerge');
export const FeMergeNode = createNoOp('FeMergeNode');
export const FeMorphology = createNoOp('FeMorphology');
export const FeOffset = createNoOp('FeOffset');
export const FePointLight = createNoOp('FePointLight');
export const FeSpecularLighting = createNoOp('FeSpecularLighting');
export const FeSpotLight = createNoOp('FeSpotLight');
export const FeTile = createNoOp('FeTile');
export const FeTurbulence = createNoOp('FeTurbulence');
export const Filter = createNoOp('Filter');

// Utility exports
export const SvgUri = createNoOp('SvgUri');
export const SvgXml = createNoOp('SvgXml');
export const SvgCss = createNoOp('SvgCss');
export const SvgCssUri = createNoOp('SvgCssUri');
export const SvgFromUri = createNoOp('SvgFromUri');
export const SvgFromXml = createNoOp('SvgFromXml');

// Default export
export default Svg;
