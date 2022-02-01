# Renamer

This module is used to apply renaming rules to service IDs and document types.

## Usage

You can use it in your other scripts like this:

```
await renamer.loadRules();
const { serviceId: renamedServiceId, documentType: renamedDocumentType } = renamer.applyRules(serviceId, documentType);
```

## Adding renaming rules

### Service

To rename a service, add a rule in `./rules/services.json`, for example, to rename "GoogleAds" to "Google Ads", add the following line in the file:

```json
{
  …
  "GoogleAds": "Google Ads"
}
```

### Document type

To rename a document type, add a rule in `./rules/documentTypes.json`, for example, to rename "Program Policies" to "Acceptable Use Policy", add the following line in the file:

```json
{
  …
  "Program Policies": "Acceptable Use Policy"
}
```

### Document type for a specific service

To rename a document type only for a specific service, add a rule in `./rules/servicesDocumentTypes.json`, for example, to rename "Program Policies" to "Acceptable Use Policy" only for Skype, add the following line in the file:

```json
{
  …
  "Skype": {
    "Program Policies": "Acceptable Use Policy"
  }
}
```
