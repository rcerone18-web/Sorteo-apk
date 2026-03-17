/**
 * Parche para Expo Go 54: setCustomSourceTransformer puede ser undefined.
 * Se ejecuta antes de cargar la app.
 */
function patchResolveAssetSource(module) {
  if (module && typeof module.setCustomSourceTransformer === 'undefined') {
    module.setCustomSourceTransformer = function () {};
  }
}

try {
  const expoResolver = require('expo-asset/build/resolveAssetSource');
  patchResolveAssetSource(expoResolver);
} catch (_) {}

try {
  const expoAsset = require('expo-asset');
  if (expoAsset.resolveAssetSource) patchResolveAssetSource(expoAsset.resolveAssetSource);
} catch (_) {}

require('expo/AppEntry.js');
