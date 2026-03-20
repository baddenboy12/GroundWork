/**
 * Non-interactive bubblewrap build script.
 * Generates TWA Android project, creates keystore, builds & signs APK.
 */
const path = require('path');
const fs = require('fs');

// Resolve bubblewrap core from the globally installed CLI
const coreBase = path.dirname(require.resolve('@bubblewrap/core/package.json', {
  paths: [path.join(process.env.APPDATA || '', 'npm/node_modules/@bubblewrap/cli')],
}));
const core = require(coreBase);

const KEYSTORE_PASSWORD = 'groundwork123';
const KEY_PASSWORD = 'groundwork123';

async function main() {
  const targetDir = __dirname;
  const manifestFile = path.join(targetDir, 'twa-manifest.json');

  // 1. Load config
  const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.bubblewrap', 'config.json');
  const config = await core.Config.loadConfig(configPath);
  if (!config) throw new Error('No bubblewrap config found at ' + configPath);
  console.log('Config loaded:', JSON.stringify(config));

  // 2. Load TWA manifest
  const twaManifest = await core.TwaManifest.fromFile(manifestFile);
  console.log('Manifest loaded:', twaManifest.name, twaManifest.host);

  // 3. Generate TWA project
  const log = new core.ConsoleLog('build-twa');
  const twaGenerator = new core.TwaGenerator();

  console.log('Removing old project files...');
  await twaGenerator.removeTwaProject(targetDir);

  console.log('Generating Android project...');
  await twaGenerator.createTwaProject(targetDir, twaManifest, log, (current, total) => {
    if (current === total) console.log('Project generation complete.');
  });

  // Write checksum file
  const manifestContents = await fs.promises.readFile(manifestFile);
  const crypto = require('crypto');
  const checksum = crypto.createHash('sha1').update(manifestContents).digest('hex');
  await fs.promises.writeFile(path.join(targetDir, 'manifest-checksum.txt'), checksum);

  // 4. Create keystore if it doesn't exist
  const keystorePath = path.resolve(targetDir, 'groundwork.keystore');
  if (!fs.existsSync(keystorePath)) {
    console.log('Creating signing keystore...');
    const jdkHelper = new core.JdkHelper(process, config);
    const keyTool = new core.KeyTool(jdkHelper, log);
    await keyTool.createSigningKey({
      path: keystorePath,
      alias: 'groundwork',
      keypassword: KEY_PASSWORD,
      password: KEYSTORE_PASSWORD,
      fullName: 'Corey Butler',
      organizationalUnit: 'GroundWork',
      organization: 'TeezFPO',
      country: 'US',
    }, true);
    console.log('Keystore created at', keystorePath);
  } else {
    console.log('Keystore already exists at', keystorePath);
  }

  // 5. Build APK
  console.log('Building APK...');
  const jdkHelper = new core.JdkHelper(process, config);
  const androidSdkTools = await core.AndroidSdkTools.create(process, config, jdkHelper, log);

  // Install build tools if needed
  if (!await androidSdkTools.checkBuildTools()) {
    console.log('Installing build tools...');
    await androidSdkTools.installBuildTools();
  }

  const gradleWrapper = new core.GradleWrapper(process, androidSdkTools, targetDir);
  console.log('Running gradle assembleRelease...');
  await gradleWrapper.assembleRelease();

  // 6. Zipalign
  const apkUnsigned = path.join(targetDir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
  const apkAligned = path.join(targetDir, 'app-release-unsigned-aligned.apk');
  console.log('Zipaligning...');
  await androidSdkTools.zipalignOnlyVerification(apkUnsigned);
  fs.copyFileSync(apkUnsigned, apkAligned);

  // 7. Sign APK
  const apkSigned = path.join(targetDir, 'app-release-signed.apk');
  console.log('Signing APK...');
  await androidSdkTools.apksigner(
    keystorePath,
    `"${KEYSTORE_PASSWORD}"`,
    'groundwork',
    `"${KEY_PASSWORD}"`,
    apkAligned,
    apkSigned,
  );

  console.log('\nAPK built successfully:', apkSigned);

  // 8. Also build AAB
  console.log('Building App Bundle...');
  await gradleWrapper.bundleRelease();

  const aabUnsigned = path.join(targetDir, 'app/build/outputs/bundle/release/app-release.aab');
  const aabSigned = path.join(targetDir, 'app-release-bundle.aab');
  const jarSigner = new core.JarSigner(jdkHelper);
  await jarSigner.sign(
    { path: keystorePath, alias: 'groundwork' },
    `"${KEYSTORE_PASSWORD}"`,
    `"${KEY_PASSWORD}"`,
    aabUnsigned,
    aabSigned,
  );
  console.log('App Bundle built successfully:', aabSigned);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
