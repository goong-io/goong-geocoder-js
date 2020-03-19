#Goong Geocoder
---

A geocoder control for [goong-js](https://docs.goong.io/js/guide) using the [Goong Geocoding API](https://docs.goong.io/rest/guide#place).

### Usage

https://blog.goong.io/2020/02/04/huong-dan-su-dung-goong-sdk-tren-javascript/

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
###  Using without a Map
It is possible to use the plugin without it being placed as a control on a goong-js map. 

### Deeper dive

#### API Documentation

See [API.md](https://github.com/goong-io/goong-geocoder-js/blob/master/API.md) for complete reference.

#### Examples

https://blog.goong.io/2020/02/04/huong-dan-su-dung-goong-sdk-tren-javascript/

