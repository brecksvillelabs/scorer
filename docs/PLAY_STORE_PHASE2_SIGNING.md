# Scorer v0.5.1 — Play Store Phase 2

## Outcome

Phase 2 separates release correctness from permanent key custody:

1. Pull requests and `main` use a disposable CI-only key to build a signed AAB
   and test the release variant on Android 16 / API 36.
2. The manually dispatched **Build Play AAB** workflow accepts only the real
   encrypted upload-key secrets and produces the bundle intended for Play.
3. No keystore, alias or password is stored in Git, build scripts or artifacts.

The disposable QC bundle is named **ci-only-not-for-play** and must never be
uploaded to Google Play.

## Permanent upload-key boundary

The upload keystore is the owner's credential. Generate it once, keep at least
two secure backups, and do not send its password through issue comments, pull
requests, screenshots or chat. Google Play should generate and protect the app
signing key; Scorer keeps only the separate upload key used to authenticate
future bundles.

Use a key validity of at least 25 years. Recommended alias:

`scorer-upload`

After the keystore is created, export its public certificate separately for
recordkeeping:

```shell
keytool -export -rfc -keystore scorer-upload.jks -alias scorer-upload -file scorer-upload-certificate.pem
```

The `.pem` certificate is public. The `.jks` keystore and both passwords remain
secret.

## Required GitHub Actions secrets

- `SCORER_UPLOAD_KEYSTORE_BASE64`
- `SCORER_UPLOAD_STORE_PASSWORD`
- `SCORER_UPLOAD_KEY_ALIAS`
- `SCORER_UPLOAD_KEY_PASSWORD`

On Windows PowerShell, create the base64 value without printing it to the
terminal:

```powershell
$bytes = [System.IO.File]::ReadAllBytes('C:\secure\scorer-upload.jks')
[System.IO.File]::WriteAllText('C:\secure\scorer-upload.base64.txt', [Convert]::ToBase64String($bytes))
```

Copy the contents of `scorer-upload.base64.txt` directly into the matching
GitHub Actions secret, then securely remove the temporary text file. The
workflow reconstructs the keystore inside the runner with owner-only
permissions and does not upload it.

## Release workflow behavior

`Build Play AAB`:

1. refuses to proceed if any secret is absent,
2. reconstructs the keystore in the temporary runner directory,
3. installs the locked Node dependencies,
4. runs the complete regression suite,
5. synchronizes the packaged Capacitor assets,
6. builds `bundleRelease`,
7. verifies the AAB signature and ZIP integrity,
8. writes a SHA-256 checksum,
9. uploads only the signed AAB and checksum.

The workflow does not publish automatically. The owner must download the
verified AAB and upload it to the Play Console internal-testing track. This
manual boundary prevents an accidental production rollout.

## Play App Signing choice

For the new Scorer app, use Google Play's default option to generate and
protect the app signing key. The locally held Scorer key remains the separate
upload key. This allows Google to serve signed APKs while preserving the
ability to reset a lost or compromised upload key without changing the app's
installation identity.
