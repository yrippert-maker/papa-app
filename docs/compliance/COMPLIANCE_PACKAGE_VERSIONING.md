# Compliance package versioning

## Naming

The compliance ZIP is published as **External Trust Package**.

- **Filename:** `External-Trust-Package-<version>.zip` (e.g. `External-Trust-Package-compliance-v1.zip`)
- **Version:** Tag/release format `compliance-vN` (e.g. `compliance-v1`).

## Rule

**Any change to the contents of the compliance package → new version.**

- Do not modify the contents of an already-released External Trust Package in place.
- To update docs, samples, or checklist: bump the version, rebuild the ZIP, and publish the new file (and tag, if applicable).

## First frozen version

- **Version:** `compliance-v1`
- **Tag:** `compliance-v1` (recommended: create after committing the current state)
- After this point, the set is frozen; further changes require a new version (e.g. `compliance-v2`).

## Building a versioned package

```bash
node scripts/compliance-package.mjs --version compliance-v1
# Output: ./External-Trust-Package-compliance-v1.zip (or COMPLIANCE_PACKAGE_OUTPUT)
```

Or: `npm run compliance:package:v1`

Custom output:

```bash
node scripts/compliance-package.mjs --version compliance-v1 --output ./releases/External-Trust-Package-compliance-v1.zip
```

## Freezing compliance-v1 (recommended)

1. Build the package: `npm run compliance:package:v1`
2. Commit all compliance/trust docs and script changes:
   ```bash
   git add docs/README_COMPLIANCE.md docs/compliance/ docs/trust/ scripts/compliance-package.mjs package.json
   git commit -m "chore(compliance): freeze External Trust Package compliance-v1"
   ```
3. Tag the release:
   ```bash
   git tag compliance-v1
   ```
4. Optionally attach `External-Trust-Package-compliance-v1.zip` to a GitHub Release for the tag (so it is not stored in the repo).
