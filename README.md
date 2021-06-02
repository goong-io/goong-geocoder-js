# Goong Geocoder

A geocoder control for [goong-js](https://docs.goong.io/javascript) using the [Goong Places API](https://docs.goong.io/rest/place/).

**If you are supporting older browsers, you will need a Promise polyfill.**
[es6-promise](https://github.com/stefanpenner/es6-promise) is a good one, if you're uncertain.

### Usage with a module bundler

This module exports a single class called GoongGeocoder as its default export,
so in browserify or webpack, you can require it like:

```js
var GoongGeocoder = require('@goongmaps/goong-geocoder');
```
### Using with CDN
```js
<script src='https://cdn.jsdelivr.net/npm/@goongmaps/goong-geocoder/dist/goong-geocoder.min.js'></script>
<link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-geocoder/dist/goong-geocoder.css" rel="stylesheet" type="text/css"/>
```
### Examples
#### Using within Map
https://docs.goong.io/example/add-a-geocoder/
#### Using without a Map
It is possible to use the plugin without it being placed as a control on a goong-js map. 
https://docs.goong.io/example/goong-geocoder-without-map/
### Deeper dive

#### API Documentation

See [API.md](https://github.com/goong-io/goong-geocoder-js/blob/master/API.md) for complete reference.
