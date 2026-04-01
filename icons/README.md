# Icons Directory

This directory contains all icon assets for the R365 Toast Reconciliation Extension.

## Icon Requirements

### Browser Extension Icons

The extension requires icons in multiple sizes to support different contexts:

- **16x16 px** - Toolbar icon (small display)
- **32x32 px** - Toolbar icon (retina display)
- **48x48 px** - Extension management page
- **128x128 px** - Chrome Web Store and installation

### Format Specifications

- **File Format**: PNG (recommended) or SVG
- **Color Mode**: RGB
- **Transparency**: Supported (use transparent backgrounds when appropriate)
- **Naming Convention**: 
  - `icon16.png`
  - `icon32.png`
  - `icon48.png`
  - `icon128.png`

### Design Guidelines

1. **Simplicity**: Icons should be simple and recognizable at small sizes
2. **Consistency**: Maintain consistent visual style across all sizes
3. **Contrast**: Ensure good contrast for visibility on different backgrounds
4. **Branding**: Align with R365 and Toast branding guidelines
5. **Clear Edges**: Use crisp edges for better clarity at smaller sizes

## Current Icons

List your current icon files here and their purposes:

- `icon16.png` - Small toolbar icon
- `icon32.png` - Retina toolbar icon
- `icon48.png` - Extension page icon
- `icon128.png` - Store listing icon

## Testing Icons

Before finalizing icons, test them:

1. Load the extension in development mode
2. Check toolbar appearance (normal and retina displays)
3. View extension management page (chrome://extensions)
4. Test on both light and dark browser themes
5. Verify appearance at different zoom levels

## Updating Icons

To update icons:

1. Create new icon files following the specifications above
2. Replace existing files in this directory
3. Update `manifest.json` if changing file names
4. Reload the extension to see changes

## Resources

- [Chrome Extension Icon Guidelines](https://developer.chrome.com/docs/extensions/mv3/user_interface/#icons)
- [Web Store Image Guidelines](https://developer.chrome.com/docs/webstore/images/)
- Design tools: Figma, Adobe Illustrator, Sketch, or GIMP

## Notes

- Keep source files (AI, SVG, or PSD) in a separate design folder if needed
- Always optimize PNG files for web (use tools like TinyPNG or ImageOptim)
- Consider creating adaptive icons for different UI themes if necessary
