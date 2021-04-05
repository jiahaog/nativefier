import * as fs from 'fs';
import * as path from 'path';

import * as log from 'loglevel';

import { NativefierOptions } from '../../options/model';
import { dirExists, fileExists } from '../fsHelpers';
import { extractBoolean, extractString } from './plistInfoXMLHelpers';
import { getOptionsFromExecutable } from './executableHelpers';

export type UpgradeAppInfo = {
  appResourcesDir: string;
  options: NativefierOptions;
};

function findUpgradeAppResourcesDir(searchDir: string): string | null {
  searchDir = dirExists(searchDir) ? searchDir : path.dirname(searchDir);
  log.debug(`Searching for nativfier.json in ${searchDir}`);
  const children = fs.readdirSync(searchDir, { withFileTypes: true });
  if (fileExists(path.join(searchDir, 'nativefier.json'))) {
    // Found 'nativefier.json', so this must be it!
    return path.resolve(searchDir);
  }
  const childDirectories = children.filter((c) => c.isDirectory());
  for (const childDir of childDirectories) {
    // We must go deeper!
    const result = findUpgradeAppResourcesDir(
      path.join(searchDir, childDir.name, 'nativefier.json'),
    );
    if (result !== null) {
      return path.resolve(result);
    }
  }

  // Didn't find it down here
  return null;
}

function getIconPath(appResourcesDir: string): string | undefined {
  const icnsPath = path.join(appResourcesDir, '..', 'electron.icns');
  if (fileExists(icnsPath)) {
    log.debug(`Found icon at: ${icnsPath}`);
    return path.resolve(icnsPath);
  }
  const icoPath = path.join(appResourcesDir, 'icon.ico');
  if (fileExists(icoPath)) {
    log.debug(`Found icon at: ${icoPath}`);
    return path.resolve(icoPath);
  }
  const pngPath = path.join(appResourcesDir, 'icon.png');
  if (fileExists(pngPath)) {
    log.debug(`Found icon at: ${pngPath}`);
    return path.resolve(pngPath);
  }

  log.debug('Could not find icon file.');
  return undefined;
}

function getInfoPListOptions(appResourcesDir: string): NativefierOptions {
  if (!fileExists(path.join(appResourcesDir, '..', '..', 'Info.plist'))) {
    // Not a darwin/mas app, so this is irrelevant
    return {};
  }

  const infoPlistXML: string = fs
    .readFileSync(path.join(appResourcesDir, '..', '..', 'Info.plist'))
    .toString();

  // https://github.com/electron/electron-packager/blob/0d3f84374e9ab3741b171610735ebc6be3e5e75f/src/mac.js#L230-L232
  const appCopyright = extractString(infoPlistXML, 'NSHumanReadableCopyright');
  log.debug(`Extracted app copyright from Info.plist: ${appCopyright}`);

  // https://github.com/electron/electron-packager/blob/0d3f84374e9ab3741b171610735ebc6be3e5e75f/src/mac.js#L214-L216
  // This could also be the buildVersion, but since they end up in the same place, that SHOULDN'T matter
  const bundleVersion = extractString(infoPlistXML, 'CFBundleVersion');
  log.debug(`Extracted bundle version from Info.plist: ${bundleVersion}`);
  const appVersion =
    bundleVersion === undefined || bundleVersion === '1.0.0' // If it's 1.0.0, that's just the default
      ? undefined
      : bundleVersion;

  log.debug(`Extracted app version from Info.plist: ${appVersion}`);

  // https://github.com/electron/electron-packager/blob/0d3f84374e9ab3741b171610735ebc6be3e5e75f/src/mac.js#L234-L236
  const darwinDarkModeSupport = extractBoolean(
    infoPlistXML,
    'NSRequiresAquaSystemAppearance',
  );
  log.debug(
    `Extracted Darwin dark mode support from Info.plist: ${
      darwinDarkModeSupport ? 'Yes' : 'No'
    }`,
  );

  return {
    appCopyright,
    appVersion,
    darwinDarkModeSupport:
      darwinDarkModeSupport === undefined
        ? undefined
        : darwinDarkModeSupport === false,
  };
}

function getInjectPaths(appResourcesDir: string): string[] | undefined {
  const injectDir = path.join(appResourcesDir, 'inject');
  if (!dirExists(injectDir)) {
    return undefined;
  }

  const injectPaths = fs
    .readdirSync(injectDir, { withFileTypes: true })
    .filter(
      (fd) =>
        fd.isFile() &&
        (fd.name.toLowerCase().endsWith('.css') ||
          fd.name.toLowerCase().endsWith('.js')),
    )
    .map((fd) => path.resolve(path.join(injectDir, fd.name)));
  log.debug(`CSS/JS Inject paths: ${injectPaths.join(', ')}`);
  return injectPaths;
}

function isAsar(appResourcesDir: string): boolean {
  const asar = fileExists(path.join(appResourcesDir, '..', 'electron.asar'));
  log.debug(`Is this app an ASAR? ${asar ? 'Yes' : 'No'}`);
  return asar;
}

export function findUpgradeApp(upgradeFrom: string): UpgradeAppInfo | null {
  const searchDir = dirExists(upgradeFrom)
    ? upgradeFrom
    : path.dirname(upgradeFrom);
  log.debug(`Looking for old options file in ${searchDir}`);
  const appResourcesDir = findUpgradeAppResourcesDir(searchDir);
  if (appResourcesDir === null) {
    log.debug(`No nativefier.json file found in ${searchDir}`);
    return null;
  }

  log.debug(`Loading ${path.join(appResourcesDir, 'nativefier.json')}`);
  const options: NativefierOptions = JSON.parse(
    fs.readFileSync(path.join(appResourcesDir, 'nativefier.json'), 'utf8'),
  );

  return {
    appResourcesDir,
    options: {
      ...options,
      ...getOptionsFromExecutable(appResourcesDir, options.name),
      ...getInfoPListOptions(appResourcesDir),
      asar: isAsar(appResourcesDir),
      icon: getIconPath(appResourcesDir),
      inject: getInjectPaths(appResourcesDir),
    },
  };
}

export function useOldAppOptions(
  rawOptions: NativefierOptions,
  oldApp: UpgradeAppInfo,
): NativefierOptions {
  if (rawOptions.targetUrl !== undefined && dirExists(rawOptions.targetUrl)) {
    // You got your ouput dir in my targetUrl!
    rawOptions.out = rawOptions.targetUrl;
  }

  return { ...rawOptions, ...oldApp.options };
}
