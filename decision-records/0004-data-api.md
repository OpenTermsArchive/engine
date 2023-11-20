# Define how to expose version through the collection metadata API

- Date: 2023-10-25

## Context and Problem Statement

### Context

The need to extend the current API comes as part of our collaboration with Terms of Service; Didn't Read (ToS;DR), whose web application will be adapted to obtain data from public Open Terms Archive collections instead of the ToS;DR server database.

The terms annotated by ToS;DR are currently taken from original web documents stored on the ToS;DR server database. Open Terms Archive provides a significantly higher quality source for terms, for example by cleaning up all content that is not related to the terms, combining documents scattered across several pages, or normalising PDF documents into Markdown.

To allow the transition from historical ToS;DR's crawler and database to the publicly accessible OTA datasets, ToS;DR requires access to the content of the versions through an API. This RFC outlines the proposed solutions.

## Proposed solutions

### Solution A:

#### Base URL

`<collection host>/api/:version`

#### Endpoint

##### `GET /version/:serviceId/:termsType/:date.md`

Return the Markdown content of the version of the terms that was applicable at the given date

##### Parameters

| Parameter | Type   | Description            |
| --------- | ------ | ---------------------- |
| serviceId | URL-encoded string | The ID of the service |
| termsType | URL-encoded string | The name of terms type |
| date | URL-encoded ISO date string | The date for which you want the version. This date should not be in the futur |

Note about the date:
- It is not required that this date matches exactly the fetch date of a version. As versions are fetched at a periodic interval, the version that will be returned will be the one that was applicable at the provided date.
- To get the latest version available, simply use the current date as parameter.

##### Returns

- A raw markdown content when a version was found for this date
- A HTTP 404 for a date that is anterior of the first available version
- A HTTP 400 Bad Request, if the date is in the futur

##### Example

```
GET /version/Open%20Terms%20Archive/Privacy%20Policy/2023-10-24T14%3A41%3A42.381Z.md
```
```markdown
Privacy Policy
==============

Last updated: September 26, 2023

This privacy policy explains how, why and under what conditions the Open Terms Archive (OTA) site collects personal information and how it is used. Our privacy policy will change over time. And of course, we also record the changes of [our own documents](https://github.com/OpenTermsArchive/demo-versions/tree/main/Open%20Terms%20Archive) 😉

…
```

### Solution B:

#### Base URL

`<collection host>/api/:version`

#### Endpoint

##### `GET /version/:serviceId/:termsType/:date`

Returns a JSON object containing the version content valid for the given date along with metadata.

##### Parameters

| Parameter | Type   | Description            |
| --------- | ------ | ---------------------- |
| serviceId | URL-encoded string | The ID of the service |
| termsType | URL-encoded string | The name of terms type |
| date | URL-encoded ISO 8601 datetime string | The date and time for which the version is requested |

Note about the date:
- It is not required that this date matches exactly the fetch date of a version. As versions are fetched at a periodic interval, the version that will be returned will be the one that was applicable at the provided date.
- To get the latest version available, simply use the current date as parameter.

##### Returns

- A raw markdown content when a version was found for this date
- A HTTP 404 for a date that is anterior of the first available version
- A HTTP 400 Bad Request, if the date is in the futur

##### Example

```
GET /version/Open%20Terms%20Archive/Privacy%20Policy/2023-10-24T14%3A41%3A42.381Z
```
```json
{
  "fetchDate": "2023-10-20T06:30:00.381Z",
  "id": "c0dac2866fb2cdef7f8b98cc260177ac43df273b",
  "content": "
Privacy Policy
==============

Last updated: September 26, 2023

This privacy policy explains how, why and under what conditions the Open Terms Archive (OTA) site collects personal information and how it is used. Our privacy policy will change over time. And of course, we also record the changes of [our own documents](https://github.com/OpenTermsArchive/demo-versions/tree/main/Open%20Terms%20Archive) 😉

…
"
}
```
