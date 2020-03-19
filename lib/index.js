'use strict';

var Typeahead = require('suggestions');

var debounce = require('lodash.debounce');

var extend = require('xtend');

var EventEmitter = require('events').EventEmitter;

var GoongClient = require('@goongmaps/goong-sdk');

var goongAutocomplete = require('@goongmaps/goong-sdk/services/autocomplete');

/**
 * A geocoder component using the [Goong Geocoding API](https://docs.goong.io/rest/guide#place)
 * @class GoongGeocoder
 * @param {Object} options
 * @param {String} options.accessToken Required. An API Key created at https://account.goong.io
 * @param {String} [options.origin=https://rsapi.goong.io] Use to set a custom API origin.
 * @param {Object} [options.goongjs] A [goongjs](https://docs.goong.io/js/guide) instance to use when creating [Markers](https://docs.goong.io/js/guide#add-custom-icons-with-markers). Required if `options.marker` is `true`.
 * @param {Number} [options.zoom=16] On geocoded result what zoom level should the map animate to.
 * @param {Boolean|Object} [options.flyTo=true] If `false`, animating the map to a selected result is disabled. If `true`, animating the map will use the default animation parameters.
 * @param {String} [options.placeholder=Search] Override the default placeholder attribute value.
 * @param {Object} [options.proximity] a proximity argument: this is
 * a geographical point given as an object with `latitude` and `longitude`
 * properties. Search results closer to this point will be given
 * higher priority.
 * @param {Boolean} [options.trackProximity=true] If `true`, the geocoder proximity will automatically update based on the map view.
 * @param {Boolean} [options.collapsed=false] If `true`, the geocoder control will collapse until hovered or in focus.
 * @param {Boolean} [options.clearAndBlurOnEsc=false] If `true`, the geocoder control will clear it's contents and blur when user presses the escape key.
 * @param {Boolean} [options.clearOnBlur=false] If `true`, the geocoder control will clear its value when the input blurs.
 * @param {Number} [options.minLength=2] Minimum number of characters to enter before results are shown.
 * @param {Number} [options.limit=5] Maximum number of results to show.
 * @param {Number} [options.radius=3000] Distance by kilometers around search location
 * @param {Boolean|Object} [options.marker=true]  If `true`, a [Marker](https://docs.goong.io/js/guide#add-custom-icons-with-markers) will be added to the map at the location of the user-selected result using a default set of Marker options.  If the value is an object, the marker will be constructed using these options. If `false`, no marker will be added to the map. Requires that `options.goongjs` also be set.
 * @param {Function} [options.render] A function that specifies how the results should be rendered in the dropdown menu. This function should accepts a single [Predictions](https://docs.goong.io/rest/guide#place) object as input and return a string. Any HTML in the returned string will be rendered.
 * @param {Function} [options.getItemValue] A function that specifies how the selected result should be rendered in the search bar. This function should accept a single [Place Detail](https://docs.goong.io/rest/guide#get-point-detail-by-id) object as input and return a string. HTML tags in the output string will not be rendered. Defaults to `(item) => item.formatted_address`.

 * @example
 * var geocoder = new GoongGeocoder({ accessToken: goongjs.accessToken });
 * map.addControl(geocoder);
 * @return {GoongGeocoder} `this`
 *
 */


function GoongGeocoder(options) {
  this._eventEmitter = new EventEmitter();
  this.options = extend({}, this.options, options);
  this.inputString = '';
  this.fresh = true;
  this.lastSelected = null;
}

GoongGeocoder.prototype = {
  options: {
    zoom: 16,
    flyTo: true,
    trackProximity: true,
    minLength: 2,
    limit: 5,
    radius: 3000,
    origin: 'https://rsapi.goong.io',
    marker: true,
    goongjs: null,
    collapsed: false,
    clearAndBlurOnEsc: false,
    clearOnBlur: false,
    getItemValue: function getItemValue(item) {
      return item.description;
    },
    render: function render(item) {
      var placeName = item.structured_formatting;
      return '<div class="goongjs-ctrl-geocoder--suggestion"><div class="goongjs-ctrl-geocoder--suggestion-title">' + placeName.main_text + '</div><div class="goongjs-ctrl-geocoder--suggestion-address">' + placeName.secondary_text + '</div></div>';
    }
  },
  request: null,
  /**
   * Add the geocoder to a container. The container can be either a `goongjs.Map` or a reference to an HTML `class` or `id`.
   *
   * If the container is a `goongjs.Map`, this function will behave identically to `Map.addControl(geocoder)`.
   * If the container is an HTML `id` or `class`, the geocoder will be appended to that element.
   *
   * This function will throw an error if the container is not either a map or a `class`/`id` reference.
   * It will also throw an error if the referenced HTML element cannot be found in the `document.body`.
   *
   * For example, if the HTML body contains the element `<div id='geocoder-container'></div>`, the following script will append the geocoder to `#geocoder-container`:
   *
   * ```javascript
   * var geocoder = new GoongGeocoder({ accessToken: goongjs.accessToken });
   * geocoder.addTo('#geocoder-container');
   * ```
   * @param {String|goongjs.Map} container A reference to the container to which to add the geocoder
   */
  addTo: function (container) {
    // if the container is a map, add the control like normal
    if (container._controlContainer) {
      //  it's a goongjs map, add like normal
      container.addControl(this);
    } // if the container is not a map, but an html element, then add the control to that element
    else if (typeof container == 'string' && (container.startsWith('#') || container.startsWith('.'))) {
      var parent = document.querySelectorAll(container);

      if (parent.length == 0) {
        throw new Error("Element ", container, "not found.");
      }

      if (parent.length > 1) {
        throw new Error("Geocoder can only be added to a single html element");
      }

      parent.forEach(function (parentEl) {
        var el = this.onAdd(); //returns the input elements, which are then added to the requested html container

        parentEl.appendChild(el);
      }.bind(this));
    } else {
      throw new Error("Error: addTo Container must be a goong-js map or a html element reference");
    }
  },
  onAdd: function (map) {
    if (map && typeof map != 'string') {
      this._map = map;
    }
    this.autoCompleteService = goongAutocomplete(
      GoongClient({
        accessToken: this.options.accessToken,
        origin: this.options.origin
      })
    );

    this._onChange = this._onChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPaste = this._onPaste.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._showButton = this._showButton.bind(this);
    this._hideButton = this._hideButton.bind(this);
    this._onQueryResult = this._onQueryResult.bind(this);
    this.clear = this.clear.bind(this);
    this._updateProximity = this._updateProximity.bind(this);
    this._collapse = this._collapse.bind(this);
    this._unCollapse = this._unCollapse.bind(this);
    this._clear = this._clear.bind(this);
    this._clearOnBlur = this._clearOnBlur.bind(this);
    var el = this.container = document.createElement('div');
    el.className = 'goongjs-ctrl-geocoder goongjs-ctrl';
    var searchIcon = this.createIcon('search', '<path d="M7.4 2.5c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9c1 0 1.8-.2 2.5-.8l3.7 3.7c.2.2.4.3.8.3.7 0 1.1-.4 1.1-1.1 0-.3-.1-.5-.3-.8L11.4 10c.4-.8.8-1.6.8-2.5.1-2.8-2.1-5-4.8-5zm0 1.6c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2-3.3-1.3-3.3-3.1 1.4-3.3 3.3-3.3z"/>');
    this._inputEl = document.createElement('input');
    this._inputEl.type = 'text';
    this._inputEl.className = 'goongjs-ctrl-geocoder--input';
    this.setPlaceholder();

    if (this.options.collapsed) {
      this._collapse();

      this.container.addEventListener('mouseenter', this._unCollapse);
      this.container.addEventListener('mouseleave', this._collapse);

      this._inputEl.addEventListener('focus', this._unCollapse);
    }

    if (this.options.collapsed || this.options.clearOnBlur) {
      this._inputEl.addEventListener('blur', this._onBlur);
    }

    this._inputEl.addEventListener('keydown', debounce(this._onKeyDown, 200));

    this._inputEl.addEventListener('paste', this._onPaste);

    this._inputEl.addEventListener('change', this._onChange);

    this.container.addEventListener('mouseenter', this._showButton);
    this.container.addEventListener('mouseleave', this._hideButton);

    this._inputEl.addEventListener('keyup', function () {
    }.bind(this));

    var actions = document.createElement('div');
    actions.classList.add('goongjs-ctrl-geocoder--pin-right');
    this._clearEl = document.createElement('button');

    this._clearEl.setAttribute('aria-label', 'Clear');

    this._clearEl.addEventListener('click', this.clear);

    this._clearEl.className = 'goongjs-ctrl-geocoder--button';
    var buttonIcon = this.createIcon('close', '<path d="M3.8 2.5c-.6 0-1.3.7-1.3 1.3 0 .3.2.7.5.8L7.2 9 3 13.2c-.3.3-.5.7-.5 1 0 .6.7 1.3 1.3 1.3.3 0 .7-.2 1-.5L9 10.8l4.2 4.2c.2.3.7.3 1 .3.6 0 1.3-.7 1.3-1.3 0-.3-.2-.7-.3-1l-4.4-4L15 4.6c.3-.2.5-.5.5-.8 0-.7-.7-1.3-1.3-1.3-.3 0-.7.2-1 .3L9 7.1 4.8 2.8c-.3-.1-.7-.3-1-.3z"/>');

    this._clearEl.appendChild(buttonIcon);

    this._loadingEl = this.createIcon('loading', '<path fill="#333" d="M4.4 4.4l.8.8c2.1-2.1 5.5-2.1 7.6 0l.8-.8c-2.5-2.5-6.7-2.5-9.2 0z"/><path opacity=".1" d="M12.8 12.9c-2.1 2.1-5.5 2.1-7.6 0-2.1-2.1-2.1-5.5 0-7.7l-.8-.8c-2.5 2.5-2.5 6.7 0 9.2s6.6 2.5 9.2 0 2.5-6.6 0-9.2l-.8.8c2.2 2.1 2.2 5.6 0 7.7z"/>');
    actions.appendChild(this._clearEl);
    actions.appendChild(this._loadingEl);
    el.appendChild(searchIcon);
    el.appendChild(this._inputEl);
    el.appendChild(actions);
    this._typeahead = new Typeahead(this._inputEl, [], {
      filter: false,
      minLength: this.options.minLength,
      limit: this.options.limit
    });
    this.setRenderFunction(this.options.render);
    this._typeahead.getItemValue = this.options.getItemValue;
    this.mapMarker = null;
    this._handleMarker = this._handleMarker.bind(this);

    if (this._map) {
      if (this.options.trackProximity) {
        this._updateProximity();

        this._map.on('moveend', this._updateProximity);
      }

      this._goongjs = this.options.goongjs;

      if (!this._goongjs && this.options.marker) {
        // eslint-disable-next-line no-console
        console.error("No goongjs detected in options. Map markers are disabled. Please set options.goongjs.");
        this.options.marker = false;
      }
    }

    return el;
  },
  createIcon: function (name, path) {
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'goongjs-ctrl-geocoder--icon goongjs-ctrl-geocoder--icon-' + name);
    icon.setAttribute('viewBox', '0 0 18 18');
    icon.setAttribute('xml:space', 'preserve');
    icon.setAttribute('width', 18);
    icon.setAttribute('height', 18);
    icon.innerHTML = path;
    return icon;
  },
  onRemove: function () {
    this.container.parentNode.removeChild(this.container);

    if (this.options.trackProximity && this._map) {
      this._map.off('moveend', this._updateProximity);
    }

    this._removeMarker();

    this._map = null;
    return this;
  },
  _onPaste: function (e) {
    var value = (e.clipboardData || window.clipboardData).getData('text');

    if (value.length >= this.options.minLength) {
      this._geocode(value);
    }
  },
  _onKeyDown: function (e) {
    var ESC_KEY_CODE = 27,
      TAB_KEY_CODE = 9;

    if (e.keyCode === ESC_KEY_CODE && this.options.clearAndBlurOnEsc) {
      this._clear(e);

      return this._inputEl.blur();
    } // if target has shadowRoot, then get the actual active element inside the shadowRoot


    var target = e.target && e.target.shadowRoot ? e.target.shadowRoot.activeElement : e.target;
    var value = target ? target.value : '';

    if (!value) {
      this.fresh = true; // the user has removed all the text

      if (e.keyCode !== TAB_KEY_CODE) this.clear(e);
      return this._clearEl.style.display = 'none';
    } // TAB, ESC, LEFT, RIGHT, ENTER, UP, DOWN


    if (e.metaKey || [TAB_KEY_CODE, ESC_KEY_CODE, 37, 39, 13, 38, 40].indexOf(e.keyCode) !== -1) return;

    if (target.value.length >= this.options.minLength) {
      this._geocode(target.value);
    }
  },
  _showButton: function () {
    if (this._typeahead.selected) this._clearEl.style.display = 'block';
  },
  _hideButton: function () {
    if (this._typeahead.selected) this._clearEl.style.display = 'none';
  },
  _onBlur: function (e) {
    if (this.options.clearOnBlur) {
      this._clearOnBlur(e);
    }

    if (this.options.collapsed) {
      this._collapse();
    }
  },
  _onChange: function () {
    var selected = this._typeahead.selected;

    if (selected && JSON.stringify(selected) !== this.lastSelected) {
      if (!this.options.flyTo) {
        return;
      }
      var request = this.autoCompleteService.placeDetail({ placeid: selected.place_id }).send();
      request.then(
        function (response) {
          this._clearEl.style.display = 'none';
          var detail = response.body;
          var flyOptions;
          var defaultFlyOptions = {
            zoom: this.options.zoom
          };
          flyOptions = extend({}, defaultFlyOptions, this.options.flyTo); //  ensure that center is not overriden by custom options
          var lat = detail.result.geometry.location.lat
          var lng = detail.result.geometry.location.lng
          flyOptions.center = [lng, lat];

          if (this._map) {
            this._map.flyTo(flyOptions);
          }
          if (this.options.marker && this._goongjs) {
            this._handleMarker(detail);
          }

          // After selecting a result, re-focus the textarea and set
          // cursor at start.

          this._inputEl.focus();

          this._inputEl.scrollLeft = 0;

          this._inputEl.setSelectionRange(0, 0);

          this.lastSelected = JSON.stringify(selected);

          this._eventEmitter.emit('result', {
            result: detail
          });
        }.bind(this));

      request.catch(
        function (error) {
          this._eventEmitter.emit('error', { error: error });
        }.bind(this));

      return request;      
    }
  },

  _geocode: function (searchInput) {
    this._loadingEl.style.display = 'block';
    this._eventEmitter.emit('loading', {
      query: searchInput
    });

    this.inputString = searchInput;

    var request;
    var config = {
      input: searchInput,
      radius: this.options.radius
    };
    if (this.options.trackProximity && this._map && this.options.proximity && this.options.proximity.latitude && this.options.proximity.longitude) {
      config = extend(config, { location: this.options.proximity.latitude + "," + this.options.proximity.longitude })
    }
    request = this.autoCompleteService.search(config).send();
    request.then(
      function (response) {
        var res = response.body;

        this._loadingEl.style.display = 'none';
        if (this.fresh) {
          this.fresh = false;
        }
        if (res.predictions.length) {
          this._clearEl.style.display = 'block';
          this._eventEmitter.emit('results', res);
          this._typeahead.update(res.predictions);
        } else {
          this._clearEl.style.display = 'none';
          this._typeahead.selected = null;
          this._renderNoResults();
          this._eventEmitter.emit('results', res);
        }
      }.bind(this));
    request.catch(
      function (error) {
        if (error && error.status === 0) return;
        this._loadingEl.style.display = 'none';
        this._clearEl.style.display = 'none';
        this._typeahead.selected = null;
        this._renderError();
        this._eventEmitter.emit('results', { predictions: [] });
        this._eventEmitter.emit('error', { error: error });
      }.bind(this)
    );

    return request;
  },

  /**
   * Shared logic for clearing input
   * @param {Event} [ev] the event that triggered the clear, if available
   * @private
   *
   */
  _clear: function (ev) {
    if (ev) ev.preventDefault();
    this._inputEl.value = '';
    this._typeahead.selected = null;

    this._typeahead.clear();

    this._onChange();

    this._clearEl.style.display = 'none';

    this._removeMarker();

    this.lastSelected = null;

    this._eventEmitter.emit('clear');

    this.fresh = true;
  },

  /**
   * Clear and then focus the input.
   * @param {Event} [ev] the event that triggered the clear, if available
   *
   */
  clear: function (ev) {
    this._clear(ev);

    this._inputEl.focus();
  },

  /**
   * Clear the input, without refocusing it. Used to implement clearOnBlur
   * constructor option.
   * @param {Event} [ev] the blur event
   * @private
   */
  _clearOnBlur: function (ev) {
    var ctx = this;
    /*
     * If relatedTarget is not found, assume user targeted the suggestions list.
     * In that case, do not clear on blur. There are other edge cases where
     * ev.relatedTarget could be null. Clicking on list always results in null
     * relatedtarget because of upstream behavior in `suggestions`.
     */
    if (ev.relatedTarget) {
      ctx._clear(ev);
    }
  },
  _onQueryResult: function (response) {
    var results = response.result;
    this._typeahead.selected = results;
    this._inputEl.value = results.geometry.name;
  },
  _updateProximity: function () {
    // proximity is designed for local scale, if the user is looking at the whole world,
    // it doesn't make sense to factor in the arbitrary centre of the map
    if (!this._map) {
      return;
    }

    if (this._map.getZoom() > 9) {
      var center = this._map.getCenter().wrap();

      this.setProximity({
        longitude: center.lng,
        latitude: center.lat
      });
    } else {
      this.setProximity(null);
    }
  },
  _collapse: function () {
    // do not collapse if input is in focus
    if (!this._inputEl.value && this._inputEl !== document.activeElement) this.container.classList.add('goongjs-ctrl-geocoder--collapsed');
  },
  _unCollapse: function () {
    this.container.classList.remove('goongjs-ctrl-geocoder--collapsed');
  },

  /**
   * Set & query the input
   * @param {string} searchInput location name or other search input
   * @returns {GoongGeocoder} this
   */
  query: function (searchInput) {
    this._geocode(searchInput).then(this._onQueryResult);

    return this;
  },
  _renderError: function () {
    var errorMessage = "<div class='goong-js-geocoder--error'>There was an error reaching the server</div>";

    this._renderMessage(errorMessage);
  },
  _renderNoResults: function () {
    var errorMessage = "<div class='goong-js-geocoder--error goongjs-gl-geocoder--no-results'>No results found</div>";

    this._renderMessage(errorMessage);
  },
  _renderMessage: function (msg) {
    this._typeahead.update([]);

    this._typeahead.selected = null;

    this._typeahead.clear();

    this._typeahead.renderError(msg);
  },

  /**
   * Get the text to use as the search bar placeholder
   *
   * If placeholder is provided in options, then use options.placeholder   
   * Otherwise use the default
   *
   * @returns {String} the value to use as the search bar placeholder
   * @private
   */
  _getPlaceholderText: function () {
    if (this.options.placeholder) return this.options.placeholder;
    return 'Search';
  },

  /**
   * Set input
   * @param {string} searchInput location name or other search input
   * @returns {GoongGeocoder} this
   */
  setInput: function (searchInput) {
    // Set input value to passed value and clear everything else.
    this._inputEl.value = searchInput;
    this._typeahead.selected = null;

    this._typeahead.clear();

    this._onChange();

    return this;
  },

  /**
   * Set proximity
   * @param {Object} proximity The new `options.proximity` value. This is a geographical point given as an object with `latitude` and `longitude` properties.
   * @returns {GoongGeocoder} this
   */
  setProximity: function (proximity) {
    this.options.proximity = proximity;
    return this;
  },

  /**
   * Get proximity
   * @returns {Object} The geocoder proximity
   */
  getProximity: function () {
    return this.options.proximity;
  },

  /**
   * Set the render function used in the results dropdown
   * @param {Function} fn The function to use as a render function. This function accepts a single [Predictions](https://docs.goong.io/rest/guide#get-points-by-keyword) object as input and returns a string.
   * @returns {GoongGeocoder} this
   */
  setRenderFunction: function (fn) {
    if (fn && typeof fn == "function") {
      this._typeahead.render = fn;
    }

    return this;
  },

  /**
   * Get the function used to render the results dropdown
   *
   * @returns {Function} the render function
   */
  getRenderFunction: function () {
    return this._typeahead.render;
  },

  /**
   * Get the zoom level the map will move to
   * @returns {Number} the map zoom
   */
  getZoom: function () {
    return this.options.zoom;
  },

  /**
   * Set the zoom level
   * @param {Number} zoom The zoom level that the map should animate to
   * @returns {GoongGeocoder} this
   */
  setZoom: function (zoom) {
    this.options.zoom = zoom;
    return this;
  },

  /**
   * Get the parameters used to fly to the selected response, if any
   * @returns {Boolean|Object} The `flyTo` option
   */
  getFlyTo: function () {
    return this.options.flyTo;
  },

  /**
   * Set the flyTo options
   * @param {Boolean|Object} flyTo If false, animating the map to a selected result is disabled. If true, animating the map will use the default animation parameters
   */
  setFlyTo: function (flyTo) {
    this.options.flyTo = flyTo;
    return this;
  },

  /**
   * Get the value of the placeholder string
   * @returns {String} The input element's placeholder value
   */
  getPlaceholder: function () {
    return this.options.placeholder;
  },

  /**
   * Set the value of the input element's placeholder
   * @param {String} placeholder the text to use as the input element's placeholder
   * @returns {GoongGeocoder} this
   */
  setPlaceholder: function (placeholder) {
    this.placeholder = placeholder ? placeholder : this._getPlaceholderText();
    this._inputEl.placeholder = this.placeholder;

    this._inputEl.setAttribute('aria-label', this.placeholder);

    return this;
  },



  /**
   * Get the minimum number of characters typed to trigger results used in the plugin
   * @returns {Number} The minimum length in characters before a search is triggered
   */
  getMinLength: function () {
    return this.options.minLength;
  },

  /**
   * Set the minimum number of characters typed to trigger results used by the plugin
   * @param {Number} minLength the minimum length in characters
   * @returns {GoongGeocoder} this
   */
  setMinLength: function (minLength) {
    this.options.minLength = minLength;
    if (this._typeahead) this._typeahead.minLength = minLength;
    return this;
  },

  /**
   * Get the limit value for the number of results to display used by the plugin
   * @returns {Number} The limit value for the number of results to display used by the plugin
   */
  getLimit: function () {
    return this.options.limit;
  },

  /**
   * Set the limit value for the number of results to display used by the plugin
   * @param {Number} limit the number of search results to return
   * @returns {GoongGeocoder}
   */
  setLimit: function (limit) {
    this.options.limit = limit;
    if (this._typeahead) this._typeahead.options.limit = limit;
    return this;
  },

  /**
   * Get the radius value for the number of results to display used by the plugin
   * @returns {Number} The limit value for the number of results to display used by the plugin
   */
  getRadius: function () {
    return this.options.radius;
  },

  /**
   * Set the limit value for the number of results to display used by the plugin
   * @param {Number} radius the number of search results to return
   * @returns {GoongGeocoder}
   */
  setRadius: function (radius) {
    this.options.radius = radius;
    if (this._typeahead) this._typeahead.options.radius = radius;
    return this;
  },

  /**
   * Set the geocoding endpoint used by the plugin.
   * @param {Function} origin A function which accepts an HTTPS URL to specify the endpoint to query results from.
   * @returns {GoongGeocoder} this
   */
  setOrigin: function (origin) {
    this.options.origin = origin;
    this.autoCompleteService = goongAutocomplete(
      GoongClient({
        accessToken: this.options.accessToken,
        origin: this.options.origin
      })
    );
    return this;
  },

  /**
   * Get the geocoding endpoint the plugin is currently set to
   * @returns {Function} the endpoint URL
   */
  getOrigin: function () {
    return this.options.origin;
  },

  /**
   * Handle the placement of a result marking the response result
   * @private
   * @param {Object} response the selected geojson feature
   * @returns {GoongGeocoder} this
   */
  _handleMarker: function (response) {
    // clean up any old marker that might be present
    if (!this._map) {
      return;
    }

    this._removeMarker();

    var defaultMarkerOptions = {
      color: '#469af7'
    };
    var markerOptions = extend({}, defaultMarkerOptions, this.options.marker);
    this.mapMarker = new this._goongjs.Marker(markerOptions);
    this.mapMarker.setLngLat([response.result.geometry.location.lng, response.result.geometry.location.lat]).addTo(this._map);
    return this;
  },

  /**
   * Handle the removal of a result marker
   * @private
   */
  _removeMarker: function () {
    if (this.mapMarker) {
      this.mapMarker.remove();
      this.mapMarker = null;
    }
  },

  /**
   * Subscribe to events that happen within the plugin.
   * @param {String} type name of event. Available events and the data passed into their respective event objects are:
   *
   * - __clear__ `Emitted when the input is cleared`
   * - __loading__ `{ query } Emitted when the geocoder is looking up a query`
   * - __results__ `{ results } Fired when the geocoder returns a response`
   * - __result__ `{ result } Fired when input is set`
   * - __error__ `{ error } Error as string`
   * @param {Function} fn function that's called when the event is emitted.
   * @returns {GoongGeocoder} this;
   */
  on: function (type, fn) {
    this._eventEmitter.on(type, fn);

    return this;
  },

  /**
   * Remove an event
   * @returns {GoongGeocoder} this
   * @param {String} type Event name.
   * @param {Function} fn Function that should unsubscribe to the event emitted.
   */
  off: function (type, fn) {
    this._eventEmitter.removeListener(type, fn);

    // this.eventManager.remove();
    return this;
  }
};
module.exports = GoongGeocoder;
