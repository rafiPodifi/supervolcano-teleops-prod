const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const USB_HOST_FEATURE = 'android.hardware.usb.host';
const USB_DEVICE_ATTACHED_ACTION =
  'android.hardware.usb.action.USB_DEVICE_ATTACHED';
const USB_FILTER_RESOURCE = '@xml/usb_device_filter';

function withExternalCameraManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] || [];
    const hasFeature = manifest['uses-feature'].some(
      (f) => f.$ && f.$['android:name'] === USB_HOST_FEATURE
    );
    if (!hasFeature) {
      manifest['uses-feature'].push({
        $: {
          'android:name': USB_HOST_FEATURE,
          'android:required': 'false',
        },
      });
    }

    const mainActivity = AndroidConfig.Manifest.getMainActivity(
      cfg.modResults
    );
    if (mainActivity) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'] || [];
      const hasIntent = mainActivity['intent-filter'].some(
        (f) =>
          Array.isArray(f.action) &&
          f.action.some(
            (a) => a.$ && a.$['android:name'] === USB_DEVICE_ATTACHED_ACTION
          )
      );
      if (!hasIntent) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': USB_DEVICE_ATTACHED_ACTION } }],
        });
      }

      mainActivity['meta-data'] = mainActivity['meta-data'] || [];
      const hasMeta = mainActivity['meta-data'].some(
        (m) => m.$ && m.$['android:name'] === USB_DEVICE_ATTACHED_ACTION
      );
      if (!hasMeta) {
        mainActivity['meta-data'].push({
          $: {
            'android:name': USB_DEVICE_ATTACHED_ACTION,
            'android:resource': USB_FILTER_RESOURCE,
          },
        });
      }
    }

    return cfg;
  });
}

module.exports = function withExternalCamera(config) {
  return withExternalCameraManifest(config);
};
