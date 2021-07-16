import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import * as log from 'loglevel';

import { copyFileOrDir, generateRandomSuffix } from '../helpers/helpers';
import {
  AppOptions,
  OutputOptions,
  PackageJSON,
} from '../../shared/src/options/model';
import { parseJson } from '../utils/parseUtils';
import { DEFAULT_APP_NAME } from '../constants';

const writeFileAsync = promisify(fs.writeFile);

/**
 * Only picks certain app args to pass to nativefier.json
 */
function pickElectronAppArgs(options: AppOptions): OutputOptions {
  return {
    accessibilityPrompt: options.nativefier.accessibilityPrompt,
    alwaysOnTop: options.nativefier.alwaysOnTop,
    appBundleId: options.packager.appBundleId,
    appCategoryType: options.packager.appCategoryType,
    appCopyright: options.packager.appCopyright,
    appVersion: options.packager.appVersion,
    arch: options.packager.arch,
    asar: options.packager.asar,
    backgroundColor: options.nativefier.backgroundColor,
    basicAuthPassword: options.nativefier.basicAuthPassword,
    basicAuthUsername: options.nativefier.basicAuthUsername,
    blockExternalUrls: options.nativefier.blockExternalUrls,
    bounce: options.nativefier.bounce,
    browserwindowOptions: options.nativefier.browserwindowOptions,
    buildDate: new Date().getTime(),
    buildVersion: options.packager.buildVersion,
    clearCache: options.nativefier.clearCache,
    counter: options.nativefier.counter,
    crashReporter: options.nativefier.crashReporter,
    darwinDarkModeSupport: options.packager.darwinDarkModeSupport,
    derefSymlinks: options.packager.derefSymlinks,
    disableContextMenu: options.nativefier.disableContextMenu,
    disableDevTools: options.nativefier.disableDevTools,
    disableGpu: options.nativefier.disableGpu,
    disableOldBuildWarning: options.nativefier.disableOldBuildWarning,
    diskCacheSize: options.nativefier.diskCacheSize,
    download: options.packager.download,
    electronVersionUsed: options.packager.electronVersion,
    enableEs3Apis: options.nativefier.enableEs3Apis,
    executableName: options.packager.executableName,
    fastQuit: options.nativefier.fastQuit,
    fileDownloadOptions: options.nativefier.fileDownloadOptions,
    flashPluginDir: options.nativefier.flashPluginDir,
    fullScreen: options.nativefier.fullScreen,
    globalShortcuts: options.nativefier.globalShortcuts,
    height: options.nativefier.height,
    helperBundleId: options.packager.helperBundleId,
    hideWindowFrame: options.nativefier.hideWindowFrame,
    ignoreCertificate: options.nativefier.ignoreCertificate,
    ignoreGpuBlacklist: options.nativefier.ignoreGpuBlacklist,
    insecure: options.nativefier.insecure,
    internalUrls: options.nativefier.internalUrls,
    isUpgrade: options.packager.upgrade,
    junk: options.packager.junk,
    lang: options.nativefier.lang,
    maximize: options.nativefier.maximize,
    maxHeight: options.nativefier.maxHeight,
    maxWidth: options.nativefier.maxWidth,
    minHeight: options.nativefier.minHeight,
    minWidth: options.nativefier.minWidth,
    name: options.packager.name ?? DEFAULT_APP_NAME,
    nativefierVersion: options.nativefier.nativefierVersion,
    osxNotarize: options.packager.osxNotarize,
    osxSign: options.packager.osxSign,
    portable: options.packager.portable,
    processEnvs: options.nativefier.processEnvs,
    protocols: options.packager.protocols,
    proxyRules: options.nativefier.proxyRules,
    prune: options.packager.prune,
    quiet: options.packager.quiet,
    showMenuBar: options.nativefier.showMenuBar,
    singleInstance: options.nativefier.singleInstance,
    targetUrl: options.packager.targetUrl,
    titleBarStyle: options.nativefier.titleBarStyle,
    tray: options.nativefier.tray,
    usageDescription: options.packager.usageDescription,
    userAgent: options.nativefier.userAgent,
    userAgentHonest: options.nativefier.userAgentHonest,
    versionString: options.nativefier.versionString,
    width: options.nativefier.width,
    widevine: options.nativefier.widevine,
    win32metadata: options.packager.win32metadata,
    x: options.nativefier.x,
    y: options.nativefier.y,
    zoom: options.nativefier.zoom,
    // OLD_BUILD_WARNING_TEXT is an undocumented env. var to let *packagers*
    // tweak the message shown on warning about an old build, to something
    // more tailored to their audience (who might not even know Nativefier).
    // See https://github.com/kelyvin/Google-Messages-For-Desktop/issues/34#issuecomment-812731144
    // and https://github.com/nativefier/nativefier/issues/1131#issuecomment-812646988
    oldBuildWarningText: process.env.OLD_BUILD_WARNING_TEXT || '',
  };
}

async function maybeCopyScripts(
  srcs: string[] | undefined,
  dest: string,
): Promise<void> {
  if (!srcs || srcs.length === 0) {
    log.debug('No files to inject, skipping copy.');
    return;
  }

  const supportedInjectionExtensions = ['.css', '.js'];

  log.debug(`Copying ${srcs.length} files to inject in app.`);
  for (const src of srcs) {
    if (!fs.existsSync(src)) {
      throw new Error(
        `File ${src} not found. Note that Nativefier expects *local* files, not URLs.`,
      );
    }

    if (supportedInjectionExtensions.indexOf(path.extname(src)) < 0) {
      log.warn('Skipping unsupported injection file', src);
      continue;
    }

    const postFixHash = generateRandomSuffix();
    const destFileName = `inject-${postFixHash}${path.extname(src)}`;
    const destPath = path.join(dest, 'inject', destFileName);
    log.debug(`Copying injection file "${src}" to "${destPath}"`);
    await copyFileOrDir(src, destPath);
  }
}

/**
 * Use a basic 6-character hash to prevent collisions. The hash is deterministic url & name,
 * so that an upgrade (same URL) of an app keeps using the same appData folder.
 * Warning! Changing this normalizing & hashing will change the way appNames are generated,
 *          changing appData folder, and users will get logged out of their apps after an upgrade.
 */
export function normalizeAppName(appName: string, url: string): string {
  const hash = crypto.createHash('md5');
  hash.update(url);
  const postFixHash = hash.digest('hex').substring(0, 6);
  const normalized = appName
    .toLowerCase()
    .replace(/[,:.]/g, '')
    .replace(/[\s_]/g, '-');
  return `${normalized}-nativefier-${postFixHash}`;
}

function changeAppPackageJsonName(
  appPath: string,
  name: string,
  url: string,
): string {
  const packageJsonPath = path.join(appPath, '/package.json');
  const packageJson = parseJson<PackageJSON>(
    fs.readFileSync(packageJsonPath).toString(),
  );
  if (!packageJson) {
    throw new Error(`Could not load package.json from ${packageJsonPath}`);
  }
  const normalizedAppName = normalizeAppName(name, url);
  packageJson.name = normalizedAppName;
  log.debug(`Updating ${packageJsonPath} 'name' field to ${normalizedAppName}`);

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  return normalizedAppName;
}

/**
 * Creates a temporary directory, copies the './app folder' inside,
 * and adds a text file with the app configuration.
 */
export async function prepareElectronApp(
  src: string,
  dest: string,
  options: AppOptions,
): Promise<void> {
  log.debug(`Copying electron app from ${src} to ${dest}`);
  try {
    await copyFileOrDir(src, dest);
  } catch (err: unknown) {
    throw `Error copying electron app from ${src} to temp dir ${dest}. Error: ${
      (err as Error).message
    }`;
  }

  const appJsonPath = path.join(dest, '/nativefier.json');
  log.debug(`Writing app config to ${appJsonPath}`);
  await writeFileAsync(
    appJsonPath,
    JSON.stringify(pickElectronAppArgs(options), null, 2),
  );

  if (options.nativefier.bookmarksMenu) {
    const bookmarksJsonPath = path.join(dest, '/bookmarks.json');
    try {
      await copyFileOrDir(options.nativefier.bookmarksMenu, bookmarksJsonPath);
    } catch (err: unknown) {
      log.error('Error copying bookmarks menu config file.', err);
    }
  }

  try {
    await maybeCopyScripts(options.nativefier.inject, dest);
  } catch (err: unknown) {
    log.error('Error copying injection files.', err);
  }
  const normalizedAppName = changeAppPackageJsonName(
    dest,
    options.packager.name as string,
    options.packager.targetUrl,
  );
  options.packager.appBundleId = `com.electron.nativefier.${normalizedAppName}`;
}
